import { groupHoldings } from '@/lib/rebalance/grouping';
import { lotCreatedAt } from '@/lib/rebalance/lotTime';
import { classifyHoldingTerm, estimateUsSaleTax, type HoldingTerm } from './usCapitalGains';
import type { Holding } from '@/lib/rebalance/types';

/**
 * 미국 세금 거주자·시민권자 관점의 연도별 실현손익 집계.
 *
 * 한국 거주자 전용 지표인 lib/tax/usRealizedGains.ts(calculateUsRealizedGainsByYear)와
 * 다른 점: 미국은 거주자·시민권자의 "전세계 소득"에 과세하므로 국내(KR)
 * 상장주식 매도도 미국 국세청(IRS) 신고 대상에 포함된다 — 한국이 자국
 * 거주자에게 국내상장주식 매매차익을 비과세하는 것은 어디까지나 한국
 * 세법상의 혜택일 뿐, 미국의 신고·과세 의무에는 영향을 주지 않는다.
 * 그래서 이 함수는 시장(KR/US)을 가리지 않고 모든 매도 lot을 대상으로 하고,
 * 미국 세법의 핵심 구분인 장기(1년 초과)/단기(1년 이하) 보유를 함께
 * 판정한다(장단기 판정 방식은 usCapitalGains.ts의 classifyHoldingTerm 참고 —
 * 평균원가법 특성상 lot 단위가 아닌 근사치).
 *
 * 원화(KRW) 상장 종목의 손익을 달러로 환산할 때는 이 앱이 KRW 종목에는
 * 환율 필드를 두지 않으므로(달러 종목에만 의미 있는 값이라 그렇다) 현재
 * 환율로 근사 변환하고 hasApproximatedFx로 표시한다. 달러(USD) 상장 종목은
 * 애초에 달러 금액이라 환산이 필요 없다.
 *
 * 출처: IRS Topic no. 409, Capital gains and losses
 * https://www.irs.gov/taxtopics/tc409
 */
export interface YearlyUsResidentGain {
  year: number;
  longTermGainUsd: number;
  shortTermGainUsd: number;
  longTermSellCount: number;
  shortTermSellCount: number;
  /** 이 연도 계산에 KRW→USD 현재 환율 근사가 하나라도 섞여 있는지 */
  hasApproximatedFx: boolean;
}

export function calculateUsResidentRealizedGainsByYear(
  holdings: Holding[],
  fallbackUsdKrwRate: number
): YearlyUsResidentGain[] {
  const byYear = new Map<
    number,
    { longUsd: number; shortUsd: number; longCount: number; shortCount: number; approximated: boolean }
  >();

  for (const group of groupHoldings(holdings)) {
    const buyLots = group.lots
      .filter((l) => (l.lotType ?? 'buy') === 'buy')
      .map((l) => ({ quantity: l.quantity, createdAtMs: lotCreatedAt(l) }));

    for (const lot of group.lots) {
      if ((lot.lotType ?? 'buy') !== 'sell') continue;

      const sellTs = lotCreatedAt(lot);
      const year = sellTs > 0 ? new Date(sellTs).getFullYear() : new Date().getFullYear();
      const gainInHoldingCcy = (lot.avgPrice - group.avgBuyPrice) * lot.quantity;

      let gainUsd: number;
      let approximated = false;
      if (group.currency === 'USD') {
        gainUsd = gainInHoldingCcy;
      } else {
        gainUsd = gainInHoldingCcy / fallbackUsdKrwRate;
        approximated = true;
      }

      const term: HoldingTerm = classifyHoldingTerm(buyLots, sellTs > 0 ? sellTs : Date.now());

      const entry = byYear.get(year) ?? {
        longUsd: 0,
        shortUsd: 0,
        longCount: 0,
        shortCount: 0,
        approximated: false,
      };
      if (term === 'long') {
        entry.longUsd += gainUsd;
        entry.longCount += 1;
      } else {
        entry.shortUsd += gainUsd;
        entry.shortCount += 1;
      }
      entry.approximated = entry.approximated || approximated;
      byYear.set(year, entry);
    }
  }

  return Array.from(byYear.entries())
    .map(([year, v]) => ({
      year,
      longTermGainUsd: v.longUsd,
      shortTermGainUsd: v.shortUsd,
      longTermSellCount: v.longCount,
      shortTermSellCount: v.shortCount,
      hasApproximatedFx: v.approximated,
    }))
    .sort((a, b) => b.year - a.year);
}

export interface YearlyUsResidentTaxEstimate {
  longTermTaxUsd: number;
  shortTermTaxUsd: number;
  totalTaxUsd: number;
}

/** 연도별 장단기 실현손익에 각각의 세율(+NIIT)을 적용해 예상 세액을 계산한다(참고용). */
export function estimateYearlyUsResidentTax(
  year: Pick<YearlyUsResidentGain, 'longTermGainUsd' | 'shortTermGainUsd'>,
  longTermRate: number,
  shortTermRate: number,
  subjectToNiit: boolean
): YearlyUsResidentTaxEstimate {
  const long = estimateUsSaleTax({
    realizedGainUsd: year.longTermGainUsd,
    term: 'long',
    longTermRate,
    shortTermRate,
    subjectToNiit,
  });
  const short = estimateUsSaleTax({
    realizedGainUsd: year.shortTermGainUsd,
    term: 'short',
    longTermRate,
    shortTermRate,
    subjectToNiit,
  });
  return {
    longTermTaxUsd: long.estimatedTaxUsd,
    shortTermTaxUsd: short.estimatedTaxUsd,
    totalTaxUsd: long.estimatedTaxUsd + short.estimatedTaxUsd,
  };
}
