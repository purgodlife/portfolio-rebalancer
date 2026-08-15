import type { Currency, Market } from '@/lib/rebalance/types';
import { calculateTradeCost, KR_SECURITIES_TRANSACTION_TAX_RATE } from './tradeCosts';
import { classifyHoldingTerm, estimateUsSaleTax, type HoldingTerm } from './usCapitalGains';
import type { TaxResidency } from './taxResidency';

/**
 * 리밸런싱 계산기의 "세금 반영(추정)" 미리보기가 액션(매수/매도) 하나당
 * 부담할 세금을 계산한다. 사용자의 세금 거주지(한국/미국)에 따라 완전히
 * 다른 규칙을 적용한다:
 *
 * - 한국 거주자(kr): 기존 로직 그대로(calculateTradeCost) — 국내상장주식
 *   매도에는 증권거래세만, 해외(미국)상장주식 매도에는 22% 양도세 추정치만
 *   적용한다. 국내주식 매매차익 자체는 비과세라 별도로 계산하지 않는다.
 * - 미국 거주자(us): 증권거래세는 종목이 상장된 시장 기준으로 그대로
 *   적용되므로(거주지 무관) 국내상장주식 매도에는 여전히 증권거래세를
 *   매긴다. 그 위에, 미국은 거주자·시민권자의 전세계 소득에 과세하므로
 *   국내·미국 상장주식 매도 모두에 대해 미국 연방 양도소득세(장단기 구분)를
 *   추가로 추정한다 — 한국의 해외주식양도세 22% 규칙은 미국 거주자에게는
 *   적용되지 않는다(그 규칙은 한국 거주자에게만 해당).
 */
export interface RebalanceActionCostInput {
  action: 'buy' | 'sell';
  market: Market;
  currency: Currency;
  /** 이번 매수/매도 금액(해당 종목 통화 기준) */
  amount: number;
  /** 매도일 때만: 이번 매도로 발생한 실현손익(해당 종목 통화 기준, 손실 가능) */
  realizedGain?: number;
  taxResidency: TaxResidency;
  /** currency가 USD가 아닐 때 realizedGain을 달러로 환산하는 데 쓰는 환율 */
  usdKrwRate: number;
  /** 미국 거주자 장단기 판정용 매수 lot 목록 */
  buyLots?: { quantity: number; createdAtMs: number }[];
  asOfMs?: number;
  /** 미국 거주자 장기양도소득세율(소수) */
  usLongTermRate?: number;
  /** 미국 거주자 단기양도소득세율(소수) */
  usShortTermRate?: number;
  usSubjectToNiit?: boolean;
}

export interface RebalanceActionCostResult {
  /** 국내상장주식 매도에 붙는 증권거래세(거주지 무관) */
  krSecuritiesTax: number;
  /** 거주지 규칙에 따른 양도소득세 추정치(한국 거주자면 해외주식만, 미국
   * 거주자면 국내·미국 상장주식 모두) */
  capitalGainsTax: number;
  totalTax: number;
  netAmount: number;
  /** 미국 거주자 매도일 때만 채워지는 장단기 판정 결과 */
  term?: HoldingTerm;
}

export function calculateRebalanceActionCost(input: RebalanceActionCostInput): RebalanceActionCostResult {
  const amount = Math.max(0, input.amount || 0);

  if (input.action === 'buy') {
    return { krSecuritiesTax: 0, capitalGainsTax: 0, totalTax: 0, netAmount: amount };
  }

  if (input.taxResidency === 'kr') {
    const base = calculateTradeCost({
      market: input.market,
      action: 'sell',
      amount: input.amount,
      realizedGain: input.realizedGain,
    });
    return {
      krSecuritiesTax: base.securitiesTransactionTax,
      capitalGainsTax: base.estimatedCapitalGainsTax,
      totalTax: base.totalCost,
      netAmount: base.netAmount,
    };
  }

  // taxResidency === 'us'
  const krSecuritiesTax = input.market === 'KR' ? amount * KR_SECURITIES_TRANSACTION_TAX_RATE : 0;

  const gainInHoldingCcy = Math.max(0, input.realizedGain || 0);
  const gainUsd = input.currency === 'USD' ? gainInHoldingCcy : gainInHoldingCcy / (input.usdKrwRate || 1);
  const term = classifyHoldingTerm(input.buyLots ?? [], input.asOfMs ?? Date.now());
  const { estimatedTaxUsd } = estimateUsSaleTax({
    realizedGainUsd: gainUsd,
    term,
    longTermRate: input.usLongTermRate ?? 0,
    shortTermRate: input.usShortTermRate ?? 0,
    subjectToNiit: !!input.usSubjectToNiit,
  });
  const capitalGainsTax = input.currency === 'USD' ? estimatedTaxUsd : estimatedTaxUsd * (input.usdKrwRate || 1);

  const totalTax = krSecuritiesTax + capitalGainsTax;
  return { krSecuritiesTax, capitalGainsTax, totalTax, netAmount: amount - totalTax, term };
}
