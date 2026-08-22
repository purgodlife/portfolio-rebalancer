import type { CheckStatus, RiskCheck } from './types';

/**
 * 벤저민 그레이엄 '현명한 투자자'(The Intelligent Investor) 14장의 방어적
 * 투자자(defensive investor) 7개 기준을 근사적으로 자동 계산한다. 무료 데이터
 * 소스(Yahoo Finance)의 한계 때문에 원 기준과 완전히 같지는 않다 — 정확히
 * 어떤 부분이 근사치인지는 각 판정 함수 주석에 적어둔다. 데이터가 없으면
 * pass/fail 대신 'unknown'으로 표시하고, 절대 추측으로 pass/fail을 단정하지 않는다.
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
  /** 'ETF' | 'EQUITY' | ... (Yahoo quoteType). ETF는 별도 lib/risk/etf.ts로 평가한다. */
  quoteType: string | null;
  expenseRatio: number | null;
  topHoldingsConcentration: number | null;
  /** 다가오는 실적발표 예정일(Yahoo calendarEvents, epoch ms). 지난 실적이거나 데이터 없으면 null. */
  earningsDate: number | null;
  fetchedAt: number;
  warnings: string[];
}

export type { CheckStatus } from './types';

export type GrahamCheckKey =
  | 'marketCap'
  | 'currentRatio'
  | 'debtToEquity'
  | 'earningsStability'
  | 'earningsGrowth'
  | 'dividendRecord'
  | 'per'
  | 'pbr'
  | 'perPbrCombo';

export type GrahamCheck = RiskCheck<GrahamCheckKey>;

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

function push(checks: GrahamCheck[], key: GrahamCheckKey, status: CheckStatus, value: string) {
  checks.push({ key, status, value });
}

export function evaluateGraham(f: Fundamentals | null | undefined): GrahamResult {
  const checks: GrahamCheck[] = [];

  // 1. 기업 규모 — 그레이엄 원 기준(매출 1억달러, 1970년대 기준)은 현재
  //    화폐가치로 그대로 쓰면 의미가 왜곡돼서, 시가총액 20억달러(원화 종목은
  //    그 환산액, 환율은 대략치 1,300원 고정 사용) 이상을 "충분한 규모"의
  //    현대적 근사 기준으로 쓴다.
  if (f?.marketCap != null) {
    const threshold = f.currency === 'KRW' ? 2_000_000_000 * 1300 : 2_000_000_000;
    push(checks, 'marketCap', f.marketCap >= threshold ? 'pass' : 'fail', formatMarketCap(f.marketCap, f.currency));
  } else {
    push(checks, 'marketCap', 'unknown', '-');
  }

  // 2. 유동비율(current ratio) >= 2 — 그레이엄 원 기준 그대로.
  if (f?.currentRatio != null) {
    push(checks, 'currentRatio', f.currentRatio >= 2 ? 'pass' : 'fail', f.currentRatio.toFixed(2));
  } else {
    push(checks, 'currentRatio', 'unknown', '-');
  }

  // 3. 부채비율 — 그레이엄 원 기준은 "장기부채 < 순운전자본"이지만 무료
  //    소스로는 이 재무상태표 항목을 안정적으로 못 가져와서, 부채/자본비율
  //    (debt-to-equity) <= 1을 근사 기준으로 쓴다. Yahoo가 %(예: 45.2)로 줄 때는
  //    배수로 보정한다.
  if (f?.debtToEquity != null) {
    const ratio = f.debtToEquity > 5 ? f.debtToEquity / 100 : f.debtToEquity;
    push(checks, 'debtToEquity', ratio <= 1 ? 'pass' : 'fail', ratio.toFixed(2));
  } else {
    push(checks, 'debtToEquity', 'unknown', '-');
  }

  // 4. 이익 안정성 — 그레이엄 원 기준은 "최근 10년 연속 흑자"지만 무료
  //    소스는 보통 최근 4개년 정도만 준다. 확보된 연도가 3개 미만이면
  //    판단하기엔 근거가 부족하다고 보고 unknown 처리한다.
  const incomes = f?.annualNetIncomes ?? [];
  if (incomes.length >= 3) {
    const positiveCount = incomes.filter((i) => i.netIncome > 0).length;
    push(checks, 'earningsStability', positiveCount === incomes.length ? 'pass' : 'fail', `${positiveCount}/${incomes.length}`);
  } else {
    push(checks, 'earningsStability', 'unknown', `${incomes.length}개년`);
  }

  // 5. 이익 성장 — 그레이엄 원 기준은 "최근 10년간 EPS 최소 33% 성장"(기간 초/말
  //    3개년 평균 비교)이다. 무료 소스는 순이익만(주당순이익 아님) 몇 개년만
  //    주기 때문에, 확보된 첫해→마지막해 순이익 증감률을 구해서 "10년-33%"
  //    기준을 확보 기간에 비례 환산한 목표치와 비교한다(예: 4년치만 있으면
  //    목표치도 33%*4/10 ≈ 13.2%로 낮춘다). 근사치일 뿐 원 기준과 다르다.
  if (incomes.length >= 3) {
    const newest = incomes[0];
    const oldest = incomes[incomes.length - 1];
    const yearsSpan = newest.year - oldest.year;
    if (oldest.netIncome > 0 && yearsSpan > 0) {
      const growthPercent = ((newest.netIncome - oldest.netIncome) / oldest.netIncome) * 100;
      const proportionalTarget = (33 * yearsSpan) / 10;
      push(checks, 'earningsGrowth', growthPercent >= proportionalTarget ? 'pass' : 'fail', `${growthPercent.toFixed(0)}% (${yearsSpan}년)`);
    } else {
      push(checks, 'earningsGrowth', 'unknown', '-');
    }
  } else {
    push(checks, 'earningsGrowth', 'unknown', `${incomes.length}개년`);
  }

  // 6. 배당 기록 — 그레이엄 원 기준(20년 연속 무중단 배당) 그대로 적용한다.
  //    성장주처럼 의도적으로 무배당인 우량주도 이 기준 하나는 fail이 될 수 있다.
  const years = f?.dividendYears ?? [];
  if (f && years.length === 0) {
    push(checks, 'dividendRecord', 'fail', '0');
  } else if (years.length > 0) {
    const consecutive = consecutiveYearsFromNow(years);
    push(checks, 'dividendRecord', consecutive >= 20 ? 'pass' : 'fail', String(consecutive));
  } else {
    push(checks, 'dividendRecord', 'unknown', '-');
  }

  // 7. PER <= 15 — 그레이엄 원 기준 그대로.
  if (f?.trailingPE != null && f.trailingPE > 0) {
    push(checks, 'per', f.trailingPE <= 15 ? 'pass' : 'fail', f.trailingPE.toFixed(1));
  } else {
    push(checks, 'per', 'unknown', '-');
  }

  // 8. PBR <= 1.5 — 그레이엄 원 기준 그대로.
  if (f?.priceToBook != null && f.priceToBook > 0) {
    push(checks, 'pbr', f.priceToBook <= 1.5 ? 'pass' : 'fail', f.priceToBook.toFixed(2));
  } else {
    push(checks, 'pbr', 'unknown', '-');
  }

  // 9. PER x PBR <= 22.5 — 그레이엄이 7번/8번의 대안으로 제시한 결합 기준.
  if (f?.trailingPE != null && f?.priceToBook != null && f.trailingPE > 0 && f.priceToBook > 0) {
    const combo = f.trailingPE * f.priceToBook;
    push(checks, 'perPbrCombo', combo <= 22.5 ? 'pass' : 'fail', combo.toFixed(1));
  } else {
    push(checks, 'perPbrCombo', 'unknown', '-');
  }

  return {
    checks,
    passCount: checks.filter((c) => c.status === 'pass').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
    unknownCount: checks.filter((c) => c.status === 'unknown').length,
  };
}

function formatMarketCap(value: number, currency: string | null): string {
  if (currency === 'KRW') return `${(value / 1_0000_0000_0000).toFixed(1)}조원`;
  return `$${(value / 1_000_000_000).toFixed(1)}B`;
}
