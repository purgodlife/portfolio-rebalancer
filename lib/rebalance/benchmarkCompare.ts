import type { MonthlyPoint } from './snapshot';

export interface BenchmarkPoint {
  /** YYYY-MM */
  month: string;
  close: number;
}

export interface IndexedComparisonPoint {
  month: string;
  /** 포트폴리오 지수화 값(비교 시작월 = 100). 데이터가 없으면 null. */
  portfolioIndex: number | null;
  /** 벤치마크 지수화 값(같은 기준월 = 100). 데이터가 없으면 null. */
  benchmarkIndex: number | null;
}

/**
 * 포트폴리오 월별 평가금액과 지수 월별 종가를, 통화·규모가 서로 다른 것을
 * "같은 시작점(=100)에서 출발한 수익률"로 지수화해 나란히 비교할 수 있게 만든다.
 * 기준월은 "벤치마크 데이터가 존재하는 가장 이른 포트폴리오 월"로 잡는다
 * (포트폴리오 첫 달에 벤치마크 데이터가 없을 수도 있으므로).
 */
export function buildIndexedComparison(
  portfolio: MonthlyPoint[],
  benchmark: BenchmarkPoint[] | null
): IndexedComparisonPoint[] {
  if (portfolio.length === 0) return [];

  const basePortfolioValue = portfolio[0].totalValueBase;
  const benchmarkByMonth = new Map((benchmark ?? []).map((b) => [b.month, b.close]));

  const baseMonth = portfolio.find((p) => benchmarkByMonth.has(p.month))?.month;
  const baseBenchmarkClose = baseMonth != null ? benchmarkByMonth.get(baseMonth) : undefined;

  return portfolio.map((p) => {
    const portfolioIndex = basePortfolioValue > 0 ? (p.totalValueBase / basePortfolioValue) * 100 : null;
    const close = benchmarkByMonth.get(p.month);
    const benchmarkIndex =
      close != null && baseBenchmarkClose != null && baseBenchmarkClose > 0
        ? (close / baseBenchmarkClose) * 100
        : null;
    return { month: p.month, portfolioIndex, benchmarkIndex };
  });
}
