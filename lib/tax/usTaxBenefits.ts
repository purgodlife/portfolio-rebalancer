/**
 * 미국 401(k) / Traditional IRA / Roth IRA 납입한도·소득 phase-out, 장기
 * 양도소득세(LTCG) 구간을 계산하는 순수 로직.
 *
 * 아래 수치는 모두 2026년 과세연도(tax year 2026) 기준이며, 미국 국세청
 * (IRS)이 공식 발표한 현재 확정된 수치만 반영한다. 주(state) 소득세, 지방세,
 * NIIT(순투자소득세) 상세 계산, 고용주 매칭·베스팅 규정 등은 개인·플랜마다
 * 달라 포함하지 않았다.
 *
 * 이 계산기는 참고용 정보 제공 도구이며 세무 자문이 아니다. 실제 공제·과세
 * 결과는 개인의 전체 소득·공제 구성에 따라 달라지므로, 정확한 금액은 IRS
 * 공식 워크시트(Form 1040 지침, Publication 590-A/B) 또는 세무사를 통해
 * 확인해야 한다.
 *
 * 출처:
 * - IRS, "401(k) limit increases to $24,500 for 2026, IRA limit increases to
 *   $7,500" (IR-2025-111, 2025-11-13)
 *   https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500
 * - IRS Notice 2025-67 (2026년 은퇴플랜 물가연동 한도 상세)
 *   https://www.irs.gov/pub/irs-drop/n-25-67.pdf
 * - IRS Revenue Procedure 2025-32 (2026년 소득세 물가연동 조정, 장기양도소득세
 *   구간 포함) https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
 * - IRS Publication 590-A (전통 IRA 납입·공제 일반 규정)
 *   https://www.irs.gov/publications/p590a
 */

export type FilingStatus = 'single' | 'marriedFilingJointly' | 'marriedFilingSeparately';

// ── 401(k) 등 확정기여형 퇴직플랜(403(b)/457/TSP 포함) ─────────────────────

/** 근로자 본인 납입한도(연간, 2026, IR-2025-111) */
export const US_401K_EMPLOYEE_LIMIT = 24_500;
/** 50세 이상 추가 납입(catch-up) 한도(2026) */
export const US_401K_CATCHUP_50 = 8_000;
/** 60~63세 특별 추가 납입 한도(SECURE 2.0, 2026) */
export const US_401K_CATCHUP_60_63 = 11_250;

export interface Contribution401kResult {
  /** 나이와 무관한 기본 한도 */
  employeeLimit: number;
  /** 나이 구간에 따른 추가 납입(catch-up) 한도 */
  catchUp: number;
  /** 기본 한도 + catch-up */
  total: number;
}

/** 나이에 따른 401(k)(403(b)/457/TSP 포함) 근로자 납입한도를 계산한다. */
export function calculate401kLimit(age: number): Contribution401kResult {
  let catchUp = 0;
  if (age >= 60 && age <= 63) catchUp = US_401K_CATCHUP_60_63;
  else if (age >= 50) catchUp = US_401K_CATCHUP_50;
  return { employeeLimit: US_401K_EMPLOYEE_LIMIT, catchUp, total: US_401K_EMPLOYEE_LIMIT + catchUp };
}

// ── IRA (Traditional + Roth 합산) 납입한도 ─────────────────────────────────

/** IRA 기본 납입한도(Traditional+Roth 합산, 연간, 2026) */
export const US_IRA_CONTRIBUTION_LIMIT = 7_500;
/** 50세 이상 IRA 추가 납입(catch-up) 한도(2026) */
export const US_IRA_CATCHUP_50 = 1_100;

export interface IraContributionLimitResult {
  base: number;
  catchUp: number;
  total: number;
}

/** 나이에 따른 IRA(Traditional+Roth 합산) 납입한도를 계산한다. */
export function calculateIraContributionLimit(age: number): IraContributionLimitResult {
  const catchUp = age >= 50 ? US_IRA_CATCHUP_50 : 0;
  return { base: US_IRA_CONTRIBUTION_LIMIT, catchUp, total: US_IRA_CONTRIBUTION_LIMIT + catchUp };
}

// ── Traditional IRA 소득공제 phase-out ────────────────────────────────────

interface PhaseOutRange {
  start: number;
  end: number;
}

/** 본인이 직장 은퇴플랜(401k 등)에 가입된 경우의 소득공제 phase-out 구간(2026) */
export const TRADITIONAL_IRA_DEDUCTION_PHASEOUT_COVERED: Record<FilingStatus, PhaseOutRange> = {
  single: { start: 81_000, end: 91_000 },
  marriedFilingJointly: { start: 129_000, end: 149_000 },
  marriedFilingSeparately: { start: 0, end: 10_000 },
};

/** 본인은 미가입이지만 배우자가 직장 은퇴플랜에 가입된 경우(MFJ)의 phase-out 구간(2026) */
export const TRADITIONAL_IRA_DEDUCTION_PHASEOUT_SPOUSE_COVERED: PhaseOutRange = { start: 242_000, end: 252_000 };

/** 선형(비례) phase-out: MAGI가 구간 시작 이하면 1(전액), 끝 이상이면 0(전액 불가). */
function phaseOutFraction(magi: number, range: PhaseOutRange): number {
  if (magi <= range.start) return 1;
  if (magi >= range.end) return 0;
  return (range.end - magi) / (range.end - range.start);
}

export interface TraditionalIraDeductionInput {
  filingStatus: FilingStatus;
  /** 수정조정총소득(Modified AGI) */
  magi: number;
  /** 본인이 직장 은퇴플랜(401k 등)에 가입되어 있는지 */
  coveredByWorkplacePlan: boolean;
  /** MFJ에서 본인은 미가입이지만 배우자가 가입된 경우에만 의미가 있음 */
  spouseCoveredByWorkplacePlan?: boolean;
  /** Traditional IRA 납입(예정)액 */
  contribution: number;
}

export interface TraditionalIraDeductionResult {
  /** 소득 기준 phase-out이 적용되는 상황인지 (본인·배우자 모두 미가입이면 false, 소득 무관 전액 공제) */
  applicablePhaseOut: boolean;
  /** 공제 가능 비율(0~1) */
  deductibleFraction: number;
  deductibleAmount: number;
  nonDeductibleAmount: number;
}

/**
 * Traditional IRA 납입액 중 소득공제(세전 효과)를 받을 수 있는 금액을 계산한다.
 * 본인·배우자 모두 직장 은퇴플랜 미가입이면 소득과 무관하게 전액 공제된다.
 * IRS 공식 계산은 공제 가능액을 $10 단위로 반올림하고 최소 $200을 보장하는
 * 세부 규정이 있는데, 이 함수는 이를 단순화한 선형 근사치이므로 참고용으로만
 * 쓰고 정확한 금액은 IRS Publication 590-A로 확인해야 한다.
 */
export function calculateTraditionalIraDeduction(
  input: TraditionalIraDeductionInput
): TraditionalIraDeductionResult {
  const contribution = Math.max(0, input.contribution || 0);
  const magi = Math.max(0, input.magi || 0);

  if (!input.coveredByWorkplacePlan && !input.spouseCoveredByWorkplacePlan) {
    return { applicablePhaseOut: false, deductibleFraction: 1, deductibleAmount: contribution, nonDeductibleAmount: 0 };
  }

  const range = input.coveredByWorkplacePlan
    ? TRADITIONAL_IRA_DEDUCTION_PHASEOUT_COVERED[input.filingStatus]
    : TRADITIONAL_IRA_DEDUCTION_PHASEOUT_SPOUSE_COVERED;

  const deductibleFraction = phaseOutFraction(magi, range);
  const deductibleAmount = Math.round(contribution * deductibleFraction);

  return {
    applicablePhaseOut: true,
    deductibleFraction,
    deductibleAmount,
    nonDeductibleAmount: contribution - deductibleAmount,
  };
}

// ── Roth IRA 납입 가능 여부 phase-out ─────────────────────────────────────

/** Roth IRA 납입 가능 소득(MAGI) phase-out 구간(2026) */
export const ROTH_IRA_PHASEOUT: Record<FilingStatus, PhaseOutRange> = {
  single: { start: 153_000, end: 168_000 },
  marriedFilingJointly: { start: 242_000, end: 252_000 },
  marriedFilingSeparately: { start: 0, end: 10_000 },
};

export interface RothIraEligibilityInput {
  filingStatus: FilingStatus;
  magi: number;
  age: number;
  /** 납입 희망액 */
  desiredContribution: number;
}

export interface RothIraEligibilityResult {
  /** 나이 기준 IRA 납입한도(소득 phase-out 반영 전) */
  contributionLimit: number;
  /** 소득 기준으로 허용되는 비율(0~1) */
  eligibleFraction: number;
  /** 실제로 납입 가능한 최대 금액(희망액·한도·소득기준 중 최솟값) */
  maxAllowedContribution: number;
  /** 희망액 중 납입 불가능한 금액 */
  disallowedAmount: number;
}

/**
 * 소득(MAGI)과 나이를 기준으로 Roth IRA에 납입 가능한 금액을 계산한다.
 * IRS 공식 계산은 $10 단위 반올림·최소 $200 보장 규정이 있는데, 이 함수는
 * 단순화한 선형 근사치이므로 참고용으로만 쓰고 정확한 금액은 IRS Publication
 * 590-A의 워크시트로 확인해야 한다.
 */
export function calculateRothIraEligibility(input: RothIraEligibilityInput): RothIraEligibilityResult {
  const { total: contributionLimit } = calculateIraContributionLimit(input.age);
  const eligibleFraction = phaseOutFraction(Math.max(0, input.magi || 0), ROTH_IRA_PHASEOUT[input.filingStatus]);
  const incomeCappedLimit = Math.round(contributionLimit * eligibleFraction);
  const desired = Math.max(0, input.desiredContribution || 0);
  const maxAllowedContribution = Math.min(desired, incomeCappedLimit, contributionLimit);

  return {
    contributionLimit,
    eligibleFraction,
    maxAllowedContribution,
    disallowedAmount: Math.max(0, desired - maxAllowedContribution),
  };
}

// ── 장기 양도소득세(LTCG) 구간 (참고용) ────────────────────────────────────

export type LtcgFilingStatus = 'single' | 'marriedFilingJointly';

interface LtcgBracket {
  /** 이 금액까지는 0% */
  zeroUpTo: number;
  /** 이 금액까지는 15%, 초과분은 20% */
  fifteenUpTo: number;
}

/** 2026년 연방 장기양도소득세(1년 초과 보유) 구간 (IRS Rev. Proc. 2025-32) */
export const LTCG_BRACKETS_2026: Record<LtcgFilingStatus, LtcgBracket> = {
  single: { zeroUpTo: 49_450, fifteenUpTo: 545_500 },
  marriedFilingJointly: { zeroUpTo: 98_900, fifteenUpTo: 613_700 },
};

/** 고소득자에게 추가로 부과될 수 있는 순투자소득세(Net Investment Income Tax) 세율 */
export const NIIT_RATE = 0.038;

export interface LtcgBracketResult {
  rate: number;
  bracketLabel: '0%' | '15%' | '20%';
}

/** 과세대상소득(taxable income) 기준으로 적용되는 장기양도소득세 구간을 추정한다. */
export function estimateLtcgBracket(filingStatus: LtcgFilingStatus, taxableIncome: number): LtcgBracketResult {
  const bracket = LTCG_BRACKETS_2026[filingStatus];
  const income = Math.max(0, taxableIncome || 0);
  if (income <= bracket.zeroUpTo) return { rate: 0, bracketLabel: '0%' };
  if (income <= bracket.fifteenUpTo) return { rate: 0.15, bracketLabel: '15%' };
  return { rate: 0.2, bracketLabel: '20%' };
}
