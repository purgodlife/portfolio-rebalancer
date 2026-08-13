import { describe, expect, it } from 'vitest';
import { evaluateGrahamEnterprising } from './grahamEnterprising';
import type { Fundamentals } from './graham';

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
    quoteType: 'EQUITY',
    expenseRatio: null,
    topHoldingsConcentration: null,
    fetchedAt: Date.now(),
    warnings: [],
    ...overrides,
  };
}

describe('evaluateGrahamEnterprising', () => {
  it('is looser than the defensive checklist: 1.5 current ratio passes even though it would fail defensive (2.0)', () => {
    const result = evaluateGrahamEnterprising(makeFundamentals({ currentRatio: 1.6 }));
    expect(result.checks.find((c) => c.key === 'currentRatio')?.status).toBe('pass');
  });

  it('passes current-dividend with just one recent payment, unlike the defensive 20-year streak', () => {
    const result = evaluateGrahamEnterprising(makeFundamentals({ dividendYears: [2026] }));
    expect(result.checks.find((c) => c.key === 'currentDividend')?.status).toBe('pass');
  });

  it('fails current-dividend for a stock that has never paid one', () => {
    const result = evaluateGrahamEnterprising(makeFundamentals({ dividendYears: [] }));
    expect(result.checks.find((c) => c.key === 'currentDividend')?.status).toBe('fail');
  });

  it('passes earnings growth on any positive change since the oldest available year, no 33% threshold', () => {
    const result = evaluateGrahamEnterprising(
      makeFundamentals({
        annualNetIncomes: [
          { year: 2026, netIncome: 101 },
          { year: 2025, netIncome: 100 },
          { year: 2024, netIncome: 100 },
        ],
      })
    );
    expect(result.checks.find((c) => c.key === 'earningsGrowth')?.status).toBe('pass');
  });

  it('uses 1.2x price-to-book as the tangible-assets approximation', () => {
    const pass = evaluateGrahamEnterprising(makeFundamentals({ priceToBook: 1.1 }));
    const fail = evaluateGrahamEnterprising(makeFundamentals({ priceToBook: 1.3 }));
    expect(pass.checks.find((c) => c.key === 'priceToTangibleAssets')?.status).toBe('pass');
    expect(fail.checks.find((c) => c.key === 'priceToTangibleAssets')?.status).toBe('fail');
  });

  it('returns unknown everywhere with no data', () => {
    const result = evaluateGrahamEnterprising(null);
    expect(result.unknownCount).toBe(result.checks.length);
  });
});
