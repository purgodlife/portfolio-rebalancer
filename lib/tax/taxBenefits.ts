/**
 * 연금저축·IRP 세액공제, ISA 비과세/저율과세 한도를 계산하는 순수 로직.
 *
 * 아래 수치는 모두 "현재 확정되어 시행 중인" 법령·국세청 안내 기준이며,
 * 논의 중이거나 아직 국회를 통과하지 않은 개편안(예: 2024년 세법개정안에서
 * 거론된 ISA 납입한도 확대·생산적금융 ISA 등)은 포함하지 않는다. 이런 개편안은
 * 정부 스스로도 "구체적 내용이 결정된 바 없다"고 밝힌 상태이므로, 실제로
 * 법제화되기 전까지는 계산에 반영하지 않는 것이 안전하다.
 *
 * 이 계산기는 참고용 정보 제공 도구이며 세무 자문이 아니다. 개인의 소득 구성,
 * 공제 항목, 최저한세 등에 따라 실제 세액공제/과세 결과는 달라질 수 있으므로,
 * 정확한 금액은 국세청 홈택스 연말정산 미리보기 또는 세무사를 통해 확인해야 한다.
 *
 * 출처:
 * - 국세청, "연금계좌 세액공제" — https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7875
 * - 소득세법 제59조의3(연금계좌세액공제)
 * - 조세특례제한법 제91조의18(개인종합자산관리계좌에 대한 과세특례, ISA)
 */

// ── 연금저축 · IRP 세액공제 ──────────────────────────────────────────────

/** 연금저축 단독 세액공제 인정 한도(연간, 원) */
export const PENSION_SAVINGS_LIMIT = 6_000_000;
/** 연금저축 + IRP 합산 세액공제 인정 한도(연간, 원) */
export const PENSION_TOTAL_LIMIT = 9_000_000;
/** 총급여 기준 고소득 판단 기준선(원). 이 금액을 초과하면 낮은 공제율 적용 */
export const PENSION_INCOME_THRESHOLD_TOTAL_SALARY = 55_000_000;
/** 종합소득금액 기준 고소득 판단 기준선(원, 총급여 정보가 없을 때 사용) */
export const PENSION_INCOME_THRESHOLD_GLOBAL_INCOME = 45_000_000;
/** 저소득 구간 세액공제율(지방소득세 포함 16.5%) */
export const PENSION_RATE_LOW_INCOME = 0.165;
/** 고소득 구간 세액공제율(지방소득세 포함 13.2%) */
export const PENSION_RATE_HIGH_INCOME = 0.132;
/** ISA 만기자금을 연금계좌로 전환 시 추가로 인정되는 비율(전환액의 10%) */
export const ISA_TRANSFER_BONUS_RATE = 0.1;
/** ISA→연금계좌 전환 추가 인정 한도(연간, 원) */
export const ISA_TRANSFER_BONUS_CAP = 3_000_000;

export interface PensionTaxInput {
  /** 연금저축(펀드/보험 등) 연간 납입액 */
  pensionSavingsContribution: number;
  /** IRP(개인형퇴직연금) 연간 납입액 */
  irpContribution: number;
  /** 근로소득자의 총급여. 있으면 이 값으로 소득 구간을 판단한다. */
  totalSalary?: number;
  /** 총급여가 없을 때(사업소득자 등) 종합소득금액으로 소득 구간을 판단한다. */
  globalIncome?: number;
  /** ISA 만기 후 60일 이내 연금계좌로 전환한 금액(있는 경우) */
  isaTransferAmount?: number;
}

export interface PensionTaxResult {
  /** 세액공제로 인정되는 연금저축 납입액(최대 600만원) */
  eligiblePensionSavings: number;
  /** ISA 전환으로 추가 인정되는 금액(최대 300만원) */
  isaTransferBonus: number;
  /** 이번 계산에 적용된 세액공제 한도(기본 900만원 + ISA 전환 보너스) */
  effectiveLimit: number;
  /** 세액공제 인정 합산액 */
  eligibleTotal: number;
  /** 적용된 공제율 */
  rate: number;
  /** 고소득 구간(13.2%) 여부 */
  isHighIncome: boolean;
  /** 예상 세액공제액 = 인정 합산액 × 공제율 */
  estimatedCredit: number;
  /** 한도까지 더 넣을 수 있는 금액 */
  remainingRoom: number;
}

export function calculatePensionTaxCredit(input: PensionTaxInput): PensionTaxResult {
  const pensionSavings = Math.max(0, input.pensionSavingsContribution || 0);
  const irp = Math.max(0, input.irpContribution || 0);
  const isaTransfer = Math.max(0, input.isaTransferAmount || 0);

  const eligiblePensionSavings = Math.min(pensionSavings, PENSION_SAVINGS_LIMIT);
  const isaTransferBonus = Math.min(isaTransfer * ISA_TRANSFER_BONUS_RATE, ISA_TRANSFER_BONUS_CAP);
  const effectiveLimit = PENSION_TOTAL_LIMIT + isaTransferBonus;

  const eligibleTotal = Math.min(eligiblePensionSavings + irp, effectiveLimit);

  let isHighIncome = false;
  if (input.totalSalary != null) {
    isHighIncome = input.totalSalary > PENSION_INCOME_THRESHOLD_TOTAL_SALARY;
  } else if (input.globalIncome != null) {
    isHighIncome = input.globalIncome > PENSION_INCOME_THRESHOLD_GLOBAL_INCOME;
  }
  const rate = isHighIncome ? PENSION_RATE_HIGH_INCOME : PENSION_RATE_LOW_INCOME;
  const estimatedCredit = Math.round(eligibleTotal * rate);
  const remainingRoom = Math.max(0, effectiveLimit - eligibleTotal);

  return {
    eligiblePensionSavings,
    isaTransferBonus,
    effectiveLimit,
    eligibleTotal,
    rate,
    isHighIncome,
    estimatedCredit,
    remainingRoom,
  };
}

// ── ISA 비과세 / 저율과세 ────────────────────────────────────────────────

export type IsaType = 'general' | 'preferential';

/** 일반형 ISA 비과세 한도(만기 기준 누적 수익, 원) */
export const ISA_NON_TAXABLE_LIMIT_GENERAL = 2_000_000;
/** 서민형·농어민형 ISA 비과세 한도(원) */
export const ISA_NON_TAXABLE_LIMIT_PREFERENTIAL = 4_000_000;
/** 연간 납입 한도(이월 가능, 원) */
export const ISA_ANNUAL_CONTRIBUTION_LIMIT = 20_000_000;
/** 총 납입 한도(원) */
export const ISA_LIFETIME_CONTRIBUTION_LIMIT = 100_000_000;
/** 비과세 한도 초과분에 적용되는 분리과세율(지방소득세 포함 9.9%) */
export const ISA_EXCESS_GAIN_TAX_RATE = 0.099;
/** 일반 금융소득(이자·배당) 과세 시 세율(지방소득세 포함 15.4%), 비교용 */
export const GENERAL_FINANCIAL_INCOME_TAX_RATE = 0.154;

export interface IsaTaxInput {
  isaType: IsaType;
  /** ISA 계좌 내 실현 이익(이자+배당+매매차익 등 합산, 원) */
  realizedGain: number;
}

export interface IsaTaxResult {
  nonTaxableLimit: number;
  /** 비과세 한도를 넘어 저율(9.9%) 분리과세 대상이 되는 금액 */
  taxableExcess: number;
  /** 초과분에 대한 예상 세액 */
  estimatedTax: number;
  /** ISA가 아니라 일반 계좌였을 경우(15.4%) 대비 절세 효과 */
  taxSavingsVsGeneral: number;
}

export function calculateIsaTax(input: IsaTaxInput): IsaTaxResult {
  const gain = Math.max(0, input.realizedGain || 0);
  const nonTaxableLimit =
    input.isaType === 'preferential' ? ISA_NON_TAXABLE_LIMIT_PREFERENTIAL : ISA_NON_TAXABLE_LIMIT_GENERAL;
  const taxableExcess = Math.max(0, gain - nonTaxableLimit);
  const estimatedTax = Math.round(taxableExcess * ISA_EXCESS_GAIN_TAX_RATE);
  const generalTaxIfNoIsa = Math.round(gain * GENERAL_FINANCIAL_INCOME_TAX_RATE);
  const taxSavingsVsGeneral = Math.max(0, generalTaxIfNoIsa - estimatedTax);

  return { nonTaxableLimit, taxableExcess, estimatedTax, taxSavingsVsGeneral };
}
