import { describe, expect, it } from 'vitest';
import { buildIndexedComparison } from './benchmarkCompare';
import type { MonthlyPoint } from './snapshot';

const portfolio: MonthlyPoint[] = [
  { month: '2026-01', totalValueBase: 1_000_000 },
  { month: '2026-02', totalValueBase: 1_100_000 },
  { month: '2026-03', totalValueBase: 1_050_000 },
];

describe('buildIndexedComparison', () => {
  it('indexes both series to 100 at the first common month', () => {
    const benchmark = [
      { month: '2026-01', close: 2500 },
      { month: '2026-02', close: 2750 },
      { month: '2026-03', close: 2600 },
    ];
    const result = buildIndexedComparison(portfolio, benchmark);
    expect(result[0].portfolioIndex).toBe(100);
    expect(result[0].benchmarkIndex).toBe(100);
    expect(result[1].portfolioIndex).toBeCloseTo(110, 5);
    expect(result[1].benchmarkIndex).toBeCloseTo(110, 5);
    expect(result[2].portfolioIndex).toBeCloseTo(105, 5);
    expect(result[2].benchmarkIndex).toBeCloseTo(104, 5);
  });

  it('returns null benchmark values when there is no benchmark data at all', () => {
    const result = buildIndexedComparison(portfolio, null);
    expect(result.every((r) => r.benchmarkIndex === null)).toBe(true);
    expect(result[0].portfolioIndex).toBe(100);
  });

  it('picks the earliest portfolio month that has matching benchmark data as the base', () => {
    // 포트폴리오 첫 달(2026-01)에는 벤치마크 데이터가 없고, 2026-02부터 있는 경우
    const benchmark = [
      { month: '2026-02', close: 2750 },
      { month: '2026-03', close: 2860 },
    ];
    const result = buildIndexedComparison(portfolio, benchmark);
    expect(result[0].benchmarkIndex).toBeNull();
    expect(result[1].benchmarkIndex).toBe(100); // 기준월
    expect(result[2].benchmarkIndex).toBeCloseTo((2860 / 2750) * 100, 5);
  });

  it('returns an empty array when there is no portfolio data', () => {
    expect(buildIndexedComparison([], null)).toEqual([]);
  });

  it('leaves benchmarkIndex null for months with missing benchmark data', () => {
    const benchmark = [
      { month: '2026-01', close: 2500 },
      { month: '2026-03', close: 2600 }, // 2026-02 결측
    ];
    const result = buildIndexedComparison(portfolio, benchmark);
    expect(result[1].benchmarkIndex).toBeNull();
    expect(result[2].benchmarkIndex).toBeCloseTo(104, 5);
  });
});
