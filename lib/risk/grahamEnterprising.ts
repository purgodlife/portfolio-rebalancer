import type { CheckStatus, RiskCheck } from './types';
import type { Fundamentals } from './graham';
import { consecutiveYearsFromNow } from './graham';

/**
 * 벤저민 그레이엄 '현명한 투자자' 15장의 공격적 투자자(enterprising investor)
 * 기준. 14장의 방어적 투자자(defensive investor) 7개 기준처럼 책에 번호로
 * 딱 정리되어 있지는 않지만, 후대 분석가들이 15장 내용을 정리할 때 흔히
 * 인용하는 6개 기준을 사용한다. 전반적으로 방어적 기준보다 문턱이 낮은
 * 대신(더 많은 종목이 후보가 됨), 투자자 스스로 더 깊이 분석할 의지가
 * 있어야 한다는 전제가 깔려 있다.
 *
 * lib/risk/graham.ts와 같은 Fundamentals 데이터를 그대로 재사용하므로
 * 별도 API 호출이 필요 없다.
 */

export type GrahamEnterprisingCheckKey =
  | 'currentRatio'
  | 'debtToEquity'
  | 'earningsStability'
  | 'currentDividend'
  | 'earningsGrowth'
  | 'priceToTangibleAssets';

export type GrahamEnterprisingCheck = RiskCheck<GrahamEnterprisingCheckKey>;

export interface GrahamEnterprisingResult {
  checks: GrahamEnterprisingCheck[];
  passCount: number;
  failCount: number;
  unknownCount: number;
}

function push(checks: GrahamEnterprisingCheck[], key: GrahamEnterprisingCheckKey, status: CheckStatus, value: string) {
  checks.push({ key, status, value });
}

export function evaluateGrahamEnterprising(f: Fundamentals | null | undefined): GrahamEnterprisingResult {
  const checks: GrahamEnterprisingCheck[] = [];

  // 1. 유동비율 >= 1.5 — 방어적 기준(2배)보다 완화된 문턱.
  if (f?.currentRatio != null) {
    push(checks, 'currentRatio', f.currentRatio >= 1.5 ? 'pass' : 'fail', f.currentRatio.toFixed(2));
  } else {
    push(checks, 'currentRatio', 'unknown', '-');
  }

  // 2. 부채 대 순유동자산 110% 이하 — 원 기준의 근사치로 부채/자본비율 1.5배
  //    이하를 쓴다(방어적 기준의 1배보다 완화).
  if (f?.debtToEquity != null) {
    const ratio = f.debtToEquity > 5 ? f.debtToEquity / 100 : f.debtToEquity;
    push(checks, 'debtToEquity', ratio <= 1.5 ? 'pass' : 'fail', ratio.toFixed(2));
  } else {
    push(checks, 'debtToEquity', 'unknown', '-');
  }

  // 3. 최근 5년간 적자가 없을 것 — 방어적 기준(10년)의 절반. 무료 데이터가
  //    보통 4개년 정도까지만 확보되므로, 확보된 연도가 3개 이상이면 그 안에서
  //    판단한다(방어적 체크와 같은 완화 방식).
  const incomes = f?.annualNetIncomes ?? [];
  if (incomes.length >= 3) {
    const positiveCount = incomes.filter((i) => i.netIncome > 0).length;
    push(checks, 'earningsStability', positiveCount === incomes.length ? 'pass' : 'fail', `${positiveCount}/${incomes.length}`);
  } else {
    push(checks, 'earningsStability', 'unknown', `${incomes.length}개년`);
  }

  // 4. 현재 배당을 지급 중일 것 — 방어적 기준(20년 연속)과 달리 "지금 주고
  //    있는지"만 본다.
  const years = f?.dividendYears ?? [];
  if (f && years.length === 0) {
    push(checks, 'currentDividend', 'fail', '무배당');
  } else if (years.length > 0) {
    const consecutive = consecutiveYearsFromNow(years);
    push(checks, 'currentDividend', consecutive >= 1 ? 'pass' : 'fail', consecutive >= 1 ? '지급중' : '중단됨');
  } else {
    push(checks, 'currentDividend', 'unknown', '-');
  }

  // 5. 올해 이익이 5년 전보다 많을 것 — 방어적 기준(10년간 33% 성장)보다 훨씬
  //    완화된, 단순 "감소하지 않았는지"만 보는 기준.
  if (incomes.length >= 3) {
    const newest = incomes[0];
    const oldest = incomes[incomes.length - 1];
    if (oldest.netIncome !== 0) {
      const growthPercent = ((newest.netIncome - oldest.netIncome) / Math.abs(oldest.netIncome)) * 100;
      push(checks, 'earningsGrowth', newest.netIncome > oldest.netIncome ? 'pass' : 'fail', `${growthPercent.toFixed(0)}%`);
    } else {
      push(checks, 'earningsGrowth', 'unknown', '-');
    }
  } else {
    push(checks, 'earningsGrowth', 'unknown', `${incomes.length}개년`);
  }

  // 6. 주가가 유형자산가치의 120% 이하 — 원 기준은 "유형자산"(무형자산 제외)
  //    기준이지만 무료 데이터로는 일반 PBR(전체 장부가 기준)만 가져올 수
  //    있어서, PBR <= 1.2를 근사 기준으로 쓴다.
  if (f?.priceToBook != null && f.priceToBook > 0) {
    push(checks, 'priceToTangibleAssets', f.priceToBook <= 1.2 ? 'pass' : 'fail', f.priceToBook.toFixed(2));
  } else {
    push(checks, 'priceToTangibleAssets', 'unknown', '-');
  }

  return {
    checks,
    passCount: checks.filter((c) => c.status === 'pass').length,
    failCount: checks.filter((c) => c.status === 'fail').length,
    unknownCount: checks.filter((c) => c.status === 'unknown').length,
  };
}
