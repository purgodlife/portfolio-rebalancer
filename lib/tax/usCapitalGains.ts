import { NIIT_RATE } from './usTaxBenefits';

/**
 * 미국 세금 거주자 관점의 매매차익 세금 추정에 쓰는 순수 로직.
 *
 * 미국 연방 양도소득세는 보유기간이 1년을 초과했는지(장기, long-term)
 * 아닌지(단기, short-term)에 따라 완전히 다른 세율을 적용한다. 장기는
 * 0/15/20%의 별도 구간(lib/tax/usTaxBenefits.ts의 LTCG_BRACKETS_2026)을
 * 쓰고, 단기는 일반소득세율(연방 일반소득세 브래킷)을 그대로 적용한다.
 *
 * 이 앱은 종목별 매입원가를 평균원가법(수량가중평균)으로 관리하고 특정
 * lot을 지정해 매도하는 기능이 없으므로, "몇 년 며칠 보유했는지"를 lot
 * 단위로 정확히 추적할 수 없다. 그래서 보유기간은 "매수 lot들의 수량가중
 * 평균 매입일"과 매도일(또는 오늘) 사이의 일수로 근사한다 — 실제 국세청
 * 신고 기준(선입선출 등 lot 단위 판정)과 다를 수 있는 참고용 추정치다.
 *
 * 출처: IRS Topic no. 409, Capital gains and losses
 * https://www.irs.gov/taxtopics/tc409
 */

export type HoldingTerm = 'short' | 'long';

/** 이 일수 이상 보유했으면 장기(long-term)로 근사 분류한다(1년 = 365일). */
export const LONG_TERM_THRESHOLD_DAYS = 365;

/**
 * 매수 lot들의 수량가중평균 매입일과 기준일(asOfMs) 사이의 일수로 보유기간을
 * 근사 판정한다. 매수 lot이 없으면 보수적으로 단기로 본다.
 */
export function classifyHoldingTerm(
  buyLots: { quantity: number; createdAtMs: number }[],
  asOfMs: number
): HoldingTerm {
  const totalQty = buyLots.reduce((s, l) => s + l.quantity, 0);
  if (totalQty <= 0) return 'short';
  const weightedTs = buyLots.reduce((s, l) => s + l.quantity * l.createdAtMs, 0) / totalQty;
  const daysHeld = (asOfMs - weightedTs) / (1000 * 60 * 60 * 24);
  return daysHeld >= LONG_TERM_THRESHOLD_DAYS ? 'long' : 'short';
}

export interface UsSaleTaxInput {
  /** 이번 매도로 발생한 실현손익(USD 기준, 손실이면 음수 — 세금은 이익에만 부과) */
  realizedGainUsd: number;
  term: HoldingTerm;
  /** 장기(long)일 때 적용할 세율(소수, 예: 0.15) */
  longTermRate: number;
  /** 단기(short)일 때 적용할 세율(소수, 예: 0.22 — 개인 한계세율, 이 앱은
   * 자동 계산하지 않으므로 사용자가 입력) */
  shortTermRate: number;
  /** 순투자소득세(NIIT, 3.8%) 대상 고소득자인지 */
  subjectToNiit: boolean;
}

export interface UsSaleTaxResult {
  estimatedTaxUsd: number;
  /** 실제 적용된 세율(NIIT 포함, 소수) */
  appliedRate: number;
}

export function estimateUsSaleTax(input: UsSaleTaxInput): UsSaleTaxResult {
  const gain = Math.max(0, input.realizedGainUsd || 0);
  let rate = input.term === 'long' ? Math.max(0, input.longTermRate || 0) : Math.max(0, input.shortTermRate || 0);
  if (input.subjectToNiit) rate += NIIT_RATE;
  return { estimatedTaxUsd: gain * rate, appliedRate: rate };
}
