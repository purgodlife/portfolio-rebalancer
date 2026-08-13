import { describe, expect, it } from 'vitest';
import { consecutiveYearsFromNow, evaluateGraham, type Fundamentals } from './graham';

function makeFundamentals(overrides: Partial<Fundamentals> = {}): Fundamentals {
  return {
    symbol: 'TEST',
    currency: 'USD',
    currentRatio: null,
    debtToEquity: null,
    trailingPE: null,
    priceToBook: null,
    dividendYield: null,
    marketCap: null,
    annualNetIncomes: [],
    dividendYears: [],
    fetchedAt: Date.now(),
    warnings: [],
    ...overrides,
  };
}

describe('evaluateGraham', () => {
  it('returns unknown for every check when there is no data at all', () => {
    const result = evaluateGraham(null);
    expect(result.unknownCount).toBe(result.checks.length);
    expect(result.passCount).toBe(0);
    expect(result.failCount).toBe(0);
  });

  it('passes a textbook-defensive stock on every computable criterion', () => {
    const f = makeFundamentals({
      currentRatio: 2.5,
      debtToEquity: 0.4,
      trailingPE: 12,
      priceToBook: 1.2,
      annualNetIncomes: [
        { year: 2025, netIncome: 100 },
        { year: 2024, netIncome: 90 },
        { year: 2023, netIncome: 80 },
        { year: 2022, netIncome: 70 },
      ],
      dividendYears: Array.from({ length: 25 }, (_, i) => 2026 - i),
    });
    const result = evaluateGraham(f);
    expect(result.failCount).toBe(0);
    expect(result.checks.find((c) => c.key === 'currentRatio')?.status).toBe('pass');
    expect(result.checks.find((c) => c.key === 'perPbrCombo')?.status).toBe('pass');
  });

  it('fails current ratio below 2 and PER above 15', () => {
    const f = makeFundamentals({ currentRatio: 1.1, trailingPE: 40 });
    const result = evaluateGraham(f);
    expect(result.checks.find((c) => c.key === 'currentRatio')?.status).toBe('fail');
    expect(result.checks.find((c) => c.key === 'per')?.status).toBe('fail');
  });

  it('treats debtToEquity given as a percentage (e.g. 45.2) the same as 0.452', () => {
    const asPercent = evaluateGraham(makeFundamentals({ debtToEquity: 45.2 }));
    const asRatio = evaluateGraham(makeFundamentals({ debtToEquity: 0.452 }));
    expect(asPercent.checks.find((c) => c.key === 'debtToEquity')?.status).toBe('pass');
    expect(asRatio.checks.find((c) => c.key === 'debtToEquity')?.status).toBe('pass');
  });

  it('marks earnings stability unknown with fewer than 3 years of data, and fails on any loss year', () => {
    const tooFew = evaluateGraham(makeFundamentals({ annualNetIncomes: [{ year: 2026, netIncome: 10 }] }));
    expect(tooFew.checks.find((c) => c.key === 'earningsStability')?.status).toBe('unknown');

    const oneLoss = evaluateGraham(
      makeFundamentals({
        annualNetIncomes: [
          { year: 2026, netIncome: 10 },
          { year: 2025, netIncome: -5 },
          { year: 2024, netIncome: 8 },
        ],
      })
    );
    expect(oneLoss.checks.find((c) => c.key === 'earningsStability')?.status).toBe('fail');
  });

  it('fails dividend record for a no-dividend stock instead of marking it unknown', () => {
    const f = makeFundamentals({ dividendYears: [] });
    const result = evaluateGraham(f);
    expect(result.checks.find((c) => c.key === 'dividendRecord')?.status).toBe('fail');
  });
});

describe('consecutiveYearsFromNow', () => {
  it('counts back from this year when this year already has a dividend', () => {
    expect(consecutiveYearsFromNow([2024, 2025, 2026], 2026)).toBe(3);
  });

  it('counts back from last year when this year has no dividend yet', () => {
    expect(consecutiveYearsFromNow([2022, 2023, 2024, 2025], 2026)).toBe(4);
  });

  it('stops at the first gap', () => {
    expect(consecutiveYearsFromNow([2018, 2019, 2021, 2022, 2023, 2024, 2025], 2026)).toBe(5);
  });

  it('returns 0 when there is no recent dividend', () => {
    expect(consecutiveYearsFromNow([2010, 2011], 2026)).toBe(0);
  });
});
