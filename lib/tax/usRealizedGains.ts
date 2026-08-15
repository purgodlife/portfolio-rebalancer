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
 * 원화 환산: 실제 국세청 신고는 매도금액·매입원가를 각각 그 시점의 환율로
 * 원화 환산한 뒤 차액을 손익으로 본다. 이 앱은 매수 lot의 매입 시 환율과
 * (이제) 매도 lot의 매도 시 환율을 모두 입력받을 수 있으므로, 둘 다 기록돼
 * 있으면 그 값으로 정확히 계산한다. 둘 중 하나라도 기록이 없으면(과거 데이터,
 * 또는 입력을 생략한 경우) 그 부분만 현재 환율로 대신 계산하고
 * hasApproximatedKrw로 그 사실을 알려준다.
 *
 * 출처: 소득세법 제118조의2 이하(국외자산 양도소득), 연 250만원 기본공제, 세율 22%(지방세 포함)
 */
export interface YearlyUsRealizedGain {
  year: number;
  /** 매도 종목 통화(USD) 기준 실현손익 합계(양수=이익, 음수=손실) */
  realizedGainUsd: number;
  /** 원화 환산 실현손익 합계(가능하면 매수·매도 각 시점 환율 사용, 아니면 현재 환율로 대체) */
  realizedGainKrw: number;
  /** 이 연도 계산에 현재 환율 대체가 하나라도 섞여 있는지(=완전히 정확하진 않을 수 있음) */
  hasApproximatedKrw: boolean;
  /** 이 해에 있었던 미국주식 매도 건수 */
  sellCount: number;
}

export function calculateUsRealizedGainsByYear(
  holdings: Holding[],
  fallbackUsdKrwRate: number
): YearlyUsRealizedGain[] {
  const byYear = new Map<number, { gainUsd: number; gainKrw: number; count: number; approximated: boolean }>();

  for (const group of groupHoldings(holdings)) {
    if (group.market !== 'US') continue;

    const buyFxRate = group.avgPurchaseFxRate ?? fallbackUsdKrwRate;
    const buyFxIsApproximated = group.avgPurchaseFxRate === undefined;

    for (const lot of group.lots) {
      if ((lot.lotType ?? 'buy') !== 'sell') continue;

      const ts = lotCreatedAt(lot);
      const year = ts > 0 ? new Date(ts).getFullYear() : new Date().getFullYear();
      const gainUsd = (lot.avgPrice - group.avgBuyPrice) * lot.quantity;

      const sellFxRate = lot.purchaseFxRate ?? fallbackUsdKrwRate;
      const sellFxIsApproximated = lot.purchaseFxRate === undefined;

      const proceedsKrw = lot.avgPrice * lot.quantity * sellFxRate;
      const costBasisKrw = group.avgBuyPrice * lot.quantity * buyFxRate;
      const gainKrw = proceedsKrw - costBasisKrw;

      const entry = byYear.get(year) ?? { gainUsd: 0, gainKrw: 0, count: 0, approximated: false };
      entry.gainUsd += gainUsd;
      entry.gainKrw += gainKrw;
      entry.count += 1;
      entry.approximated = entry.approximated || buyFxIsApproximated || sellFxIsApproximated;
      byYear.set(year, entry);
    }
  }

  return Array.from(byYear.entries())
    .map(([year, v]) => ({
      year,
      realizedGainUsd: v.gainUsd,
      realizedGainKrw: v.gainKrw,
      hasApproximatedKrw: v.approximated,
      sellCount: v.count,
    }))
    .sort((a, b) => b.year - a.year);
}

export interface UsCapitalGainsEstimate {
  /** 연 250만원 기본공제를 뺀 과세대상 금액(0 미만이면 0) */
  taxableGainKrw: number;
  estimatedTaxKrw: number;
}

/** 원화 환산된 연간 실현손익에서 기본공제·예상세액을 계산한다(참고용). */
export function estimateUsCapitalGainsTax(realizedGainKrw: number): UsCapitalGainsEstimate {
  const taxableGainKrw = Math.max(0, realizedGainKrw - US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW);
  const estimatedTaxKrw = taxableGainKrw * US_CAPITAL_GAINS_TAX_RATE;
  return { taxableGainKrw, estimatedTaxKrw };
}
