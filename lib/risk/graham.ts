/**
 * 벤저민 그레이엄 '현명한 투자자'의 방어적 투자자(defensive investor) 기준을
 * 근사적으로 자동 계산한다. 무료 데이터 소스(Yahoo Finance)의 한계 때문에
 * 원 기준과 완전히 같지는 않다 — 정확히 어떤 부분이 근사치인지는 각 판정
 * 함수 주석에 적어둔다. 데이터가 없으면 pass/fail 대신 'unknown'으로 표시하고,
 * 절대 추측으로 pass/fail을 단정하지 않는다.
 */

export interface Fundamentals {
  symbol: string;
  currency: string | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  trailingPE: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  marketCap: number | null;
  /** 최근 연도가 먼저 오도록 정렬 */
  annualNetIncomes: { year: number; netIncome: number }[];
  /** 배당을 지급한 연도들(오름차순) */
  dividendYears: number[];
  fetchedAt: number;
  warnings: string[];
}

export type CheckStatus = 'pass' | 'fail' | 'unknown';

export type GrahamCheckKey =
  | 'currentRatio'
  | 'debtToEquity'
  | 'earningsStability'
  | 'dividendRecord'
  | 'per'
  | 'pbr'
  | 'perPbrCombo';

export interface GrahamCheck {
  key: GrahamCheckKey;
  status: CheckStatus;
  /** 화면에 보여줄 값(단위 없이, 포맷은 UI에서) */
  value: string;
}

export interface GrahamResult {
  checks: GrahamCheck[];
  passCount: number;
  failCount: number;
  unknownCount: number;
}

/** 오늘을 기준으로, 배당을 지급한 연도가 몇 년 연속으로 이어지는지 센다. */
export function consecutiveYearsFromNow(years: number[], now: number = new Date().getUTCFullYear()): number {
  const set = new Set(years);
  let count = 0;
  let y = now;
  // 올해는 아직 배당을 안 했을 수도 있으니, 올해 기록이 없으면 작년부터 센다.
  if (!set.has(y)) y -= 1;
  while (set.has(y)) {
    count += 1;
    y -= 1;
  }
  return count;
}

export function evaluateGraham(f: Fundamentals | null | undefined): GrahamResult {
  const checks: GrahamCheck[] = [];

  // 1. 유동비율(current ratio) >= 2 — 그레이엄 원 기준 그대로.
  if (f?.currentRatio != null) {
    checks.push({ key: 'currentRatio', status: f.currentRatio >= 2 ? 'pass' : 'fail', value: f.currentRatio.toFixed(2) });
  } else {
    checks.push({ key: 'currentRatio', status: 'unknown', value: '-' });
  }

  // 2. 부채비율 — 그레이엄 원 기준은 "장기부채 < 순운전자본"이지만 무료
  //    소스로는 이 재무상태표 항목을 안정적으로 못 가져와서, 부채/자본비율
  //    (debt-to-equity) <= 1을 근사 기준으로 쓴다. Yahoo가 %(예: 45.2)로 줄 때는
  //    배수로 보정한다.
  if (f?.debtToEquity != null) {
    const ratio = f.debtToEquity > 5 ? f.debtToEquity / 100 : f.debtToEquity;
    checks.push({ key: 'debtToEquity', status: ratio <= 1 ? 'pass' : 'fail', value: ratio.toFixed(2) });
  } else {
    checks.push({ key: 'debtToEquity', status: 'unknown', value: '-' });
  }

  // 3. 이익 안정성 — 그레이엄 원 기준은 "최근 10년 연속 흑자"지만 무료
  //    소스는 보통 최근 4개년 정도만 준다. 확보된 연도가 3개 미만이면
  //    판단하기엔 근거가 부족하다고 보고 unknown 처리한다.
  const incomes = f?.annualNetIncomes ?? [];
  if (incomes.length >= 3) {
    const positiveCount = incomes.filter((i) => i.netIncome > 0).length;
    checks.push({
      key: 'earningsStability',
      status: positiveCount === incomes.length ? 'pass' : 'fail',
      value: `${positiveCount}/${incomes.length}`,
    });
  } else {
    checks.push({ key: 'earningsStability', status: 'unknown', value: `${incomes.length}개년` });
  }

  // 4. 배당 기록 — 그레이엄 원 기준(20년 연속 무중단 배당) 그대로 적용한다.
  //    성장주처럼 의도적으로 무배당인 우량주도 이 기준 하나는 fail이 될 수 있다.
  const years = f?.dividendYears ?? [];
  if (f && years.length === 0) {
    checks.push({ key: 'dividendRecord', status: 'fail', value: '0' });
  } else if (years.length > 0) {
    const consecutive = consecutiveYearsFromNow(years);
    checks.push({ key: 'dividendRecord', status: consecutive >= 20 ? 'pass' : 'fail', value: String(consecutive) });
  } else {
    checks.push({ key: 'dividendRecord', status: 'unknown', value: '-' });
  }

  // 5. PER <= 15 — 그레이엄 원 기준 그대로.
  if (f?.trailingPE != null && f.trailingPE > 0) {
    checks.push({ key: 'per', status: f.trailingPE <= 15 ? 'pass' : 'fail', value: f.trailingPE.toFixed(1) });
  } else {
    checks.push({ key: 'per', status: 'unknown', value: '-' });
  }

  // 6. PBR <= 1.5 — 그레이엄 원 기준 그대로.
  if (f?.priceToBook != null && f.priceToBook > 0) {
    checks.push({ key: 'pbr', status: f.priceToBook <= 1.5 ? 'pass' : 'fail', value: f.priceToBook.toFixed(2) });
  } else {
    checks.push({ key: 'pbr', status: 'unknown', value: '-' });
  }

  // 7. PER x PBR <= 22.5 — 그레이엄이 5번/6번의 대안으로 제시한 결합 기준.
  if (f?.trailingPE != null && f?.priceToBook != null && f.trailingPE > 0 && f.priceToBook > 0) {
    const combo = f.trailingPE * f.priceToBook;
    checks.push({ key: 'perPbrCombo', status: combo <= 22.5 ? 'pass' : 'fail', value: combo.toFixed(1) });
  } else {
    checks.push({ key: 'perPbrCombo', status: 'unknown', value: '-' });
  }

  return {
    checks,
    passCount: checks.filter((c) => c.status === 'pass').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
    unknownCount: checks.filter((c) => c.status === 'unknown').length,
  };
}
