import { groupHoldings } from '@/lib/rebalance/grouping';
import { lotCreatedAt } from '@/lib/rebalance/lotTime';
import { US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW, US_CAPITAL_GAINS_TAX_RATE } from './tradeCosts';
import type { Holding } from '@/lib/rebalance/types';

/**
 * 이미 실행된(과거) 미국주식 매도 내역을 연도별로 묶어 실현손익을 계산한다.
 * 해외주식 양도소득세는 건별이 아니라 "한 해 동안의 모든 매매 손익을 통산"해서
 * 연 250만원 기본공제를 뺀 나머지에 22%를 매기는 구조이므로, 개별 매도 건이
 * 아니라 연도 단위 합계로 봐야 실제로 신고 대상인지 가늠할 수 있다.
 *
 * 종목별 매입원가는 이 앱이 이미 쓰고 있는 평균원가법(매수 lot들의 수량가중
 * 평균, 매도 이후에도 값이 바뀌지 않음 — lib/rebalance/grouping.ts)을 그대로
 * 따른다.
 *
 * 한계: 실제 국세청 신고는 매수·매도 각 시점의 환율로 원화 환산한 손익을
 * 기준으로 하는데, 이 앱은 매도 시점의 환율을 별도로 기록하지 않는다.
 * 그래서 이 함수는 USD 기준 손익만 계산하고, 화면에서 원화 환산이 필요하면
 * estimateUsCapitalGainsTax()에 현재 환율(참고용)을 넣어 대략적인 값만 보여준다.
 *
 * 출처: 소득세법 제118조의2 이하(국외자산 양도소득), 연 250만원 기본공제, 세율 22%(지방세 포함)
 */
export interface YearlyUsRealizedGain {
  year: number;
  /** 매도 종목 통화(USD) 기준 실현손익 합계(양수=이익, 음수=손실) */
  realizedGainUsd: number;
  /** 이 해에 있었던 미국주식 매도 건수 */
  sellCount: number;
}

export function calculateUsRealizedGainsByYear(holdings: Holding[]): YearlyUsRealizedGain[] {
  const byYear = new Map<number, { gain: number; count: number }>();

  for (const group of groupHoldings(holdings)) {
    if (group.market !== 'US') continue;
    for (const lot of group.lots) {
      if ((lot.lotType ?? 'buy') !== 'sell') continue;
      const ts = lotCreatedAt(lot);
      const year = ts > 0 ? new Date(ts).getFullYear() : new Date().getFullYear();
      const gain = (lot.avgPrice - group.avgBuyPrice) * lot.quantity;
      const entry = byYear.get(year) ?? { gain: 0, count: 0 };
      entry.gain += gain;
      entry.count += 1;
      byYear.set(year, entry);
    }
  }

  return Array.from(byYear.entries())
    .map(([year, v]) => ({ year, realizedGainUsd: v.gain, sellCount: v.count }))
    .sort((a, b) => b.year - a.year);
}

export interface UsCapitalGainsEstimate {
  realizedGainUsd: number;
  /** 참고용 원화 환산액(현재 환율 기준 — 실제 신고는 각 매도 시점 환율을 씀) */
  realizedGainKrw: number;
  /** 연 250만원 기본공제를 뺀 과세대상 금액(0 미만이면 0) */
  taxableGainKrw: number;
  estimatedTaxKrw: number;
}

/** 연간 실현손익(USD)을 현재 환율로 원화 환산해 기본공제·예상세액을 추정한다(참고용). */
export function estimateUsCapitalGainsTax(realizedGainUsd: number, usdKrwRate: number): UsCapitalGainsEstimate {
  const realizedGainKrw = realizedGainUsd * usdKrwRate;
  const taxableGainKrw = Math.max(0, realizedGainKrw - US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW);
  const estimatedTaxKrw = taxableGainKrw * US_CAPITAL_GAINS_TAX_RATE;
  return { realizedGainUsd, realizedGainKrw, taxableGainKrw, estimatedTaxKrw };
}
