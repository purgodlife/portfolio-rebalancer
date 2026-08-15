import type { Market } from '@/lib/rebalance/types';

/**
 * 리밸런싱 매도 시 발생하는 세금을 추정한다(매매수수료는 증권사·상품마다
 * 정책이 달라 이 계산기에서는 다루지 않는다 — 필요하면 증권사 앱에서 직접
 * 확인해야 한다).
 *
 * 국내주식 매도 시 증권거래세는 손익과 무관하게 매도 금액에 부과되는 확정
 * 세율이라 정확히 계산할 수 있다(2026-01-01 시행 기준 코스피·코스닥 공통
 * 0.20%). 해외주식(미국) 양도소득세는 한 해 동안의 모든 해외주식 매매 손익을
 * 통산한 뒤 다음해 5월에 신고하는 구조라서, 이 화면에서 보여주는 값은
 * "이번 매도 건의 실현손익에 22%를 곱한 참고용 추정치"일 뿐이며, 연 250만원
 * 기본공제와 다른 매매 손익은 반영하지 않는다(연간 누적 실현손익은 거래내역
 * 화면의 "미국주식 연도별 매매손익"에서 확인할 수 있다).
 *
 * 출처:
 * - 증권거래세법 제8조(세율) — 2025년 세법개정(2026-01-01 시행), 코스피·코스닥 0.20%로 일원화
 * - 소득세법 제118조의2 이하(국외자산 양도소득), 연 250만원 기본공제, 세율 22%(지방세 포함)
 */

/** 국내주식(코스피·코스닥) 매도 시 증권거래세율. 2026-01-01 시행 기준. */
export const KR_SECURITIES_TRANSACTION_TAX_RATE = 0.002; // 0.20%
/** 해외주식 양도소득 참고 세율(양도세 20% + 지방소득세 2%) */
export const US_CAPITAL_GAINS_TAX_RATE = 0.22;
/** 해외주식 양도소득 연간 기본공제(원화 환산 참고용). 이 계산기는 건별 추정이라 실제로 반영하지 않음. */
export const US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW = 2_500_000;

export interface TradeCostInput {
  market: Market;
  action: 'buy' | 'sell';
  /** 이번 매수/매도 금액(해당 종목 통화 기준, 항상 0 이상) */
  amount: number;
  /** 매도일 때만 사용: 이번 매도로 발생한 실현손익(해당 종목 통화 기준, 손실이면 음수) */
  realizedGain?: number;
}

export interface TradeCostResult {
  /** 국내주식 매도에만 적용 */
  securitiesTransactionTax: number;
  /** 해외주식 매도에만 적용되는 참고용 추정치(연간 통산·기본공제 미반영) */
  estimatedCapitalGainsTax: number;
  totalCost: number;
  /** 매수: 금액 그대로 / 매도: 세금 차감 후 실수령액 */
  netAmount: number;
}

export function calculateTradeCost(input: TradeCostInput): TradeCostResult {
  const amount = Math.max(0, input.amount || 0);

  let securitiesTransactionTax = 0;
  let estimatedCapitalGainsTax = 0;

  if (input.action === 'sell') {
    if (input.market === 'KR') {
      securitiesTransactionTax = amount * KR_SECURITIES_TRANSACTION_TAX_RATE;
    } else {
      const gain = Math.max(0, input.realizedGain || 0);
      estimatedCapitalGainsTax = gain * US_CAPITAL_GAINS_TAX_RATE;
    }
  }

  const totalCost = securitiesTransactionTax + estimatedCapitalGainsTax;
  const netAmount = input.action === 'sell' ? amount - totalCost : amount;

  return { securitiesTransactionTax, estimatedCapitalGainsTax, totalCost, netAmount };
}
