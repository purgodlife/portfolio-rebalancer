import { describe, expect, it } from 'vitest';
import { calculateUsResidentRealizedGainsByYear, estimateYearlyUsResidentTax } from './usResidentSaleGains';
import type { Holding } from '@/lib/rebalance/types';

const FALLBACK_RATE = 1_400;
const DAY_MS = 1000 * 60 * 60 * 24;

function ts(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getTime();
}

function buyLot(id: string, overrides: Partial<Holding> = {}): Holding {
  return {
    id,
    ticker: 'AAPL',
    name: 'Apple',
    categoryId: 'c1',
    market: 'US',
    currency: 'USD',
    avgPrice: 100,
    quantity: 10,
    currentPrice: 150,
    lotType: 'buy',
    ...overrides,
  };
}

function sellLot(id: string, overrides: Partial<Holding> = {}): Holding {
  return {
    id,
    ticker: 'AAPL',
    name: 'Apple',
    categoryId: 'c1',
    market: 'US',
    currency: 'USD',
    avgPrice: 150,
    quantity: 5,
    currentPrice: 150,
    lotType: 'sell',
    ...overrides,
  };
}

function krBuyLot(id: string, overrides: Partial<Holding> = {}): Holding {
  return {
    id,
    ticker: '005930',
    name: '삼성전자',
    categoryId: 'c1',
    market: 'KR',
    currency: 'KRW',
    avgPrice: 70_000,
    quantity: 10,
    currentPrice: 80_000,
    lotType: 'buy',
    ...overrides,
  };
}

function krSellLot(id: string, overrides: Partial<Holding> = {}): Holding {
  return {
    id,
    ticker: '005930',
    name: '삼성전자',
    categoryId: 'c1',
    market: 'KR',
    currency: 'KRW',
    avgPrice: 80_000,
    quantity: 5,
    currentPrice: 80_000,
    lotType: 'sell',
    ...overrides,
  };
}

describe('calculateUsResidentRealizedGainsByYear', () => {
  it('includes KR-market sells (unlike the KR-resident-only calculateUsRealizedGainsByYear)', () => {
    const holdings = [
      krBuyLot('b1', { createdAt: ts(2024, 1, 1) }),
      krSellLot('s1', { createdAt: ts(2026, 6, 1) }),
    ];
    const result = calculateUsResidentRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result).toHaveLength(1);
    const expectedGainUsd = ((80_000 - 70_000) * 5) / FALLBACK_RATE;
    expect(result[0].longTermGainUsd + result[0].shortTermGainUsd).toBeCloseTo(expectedGainUsd, 5);
    expect(result[0].hasApproximatedFx).toBe(true); // KRW -> USD always approximated (current rate)
  });

  it('does not approximate FX for USD-denominated (US-market) sells', () => {
    const holdings = [
      buyLot('b1', { createdAt: ts(2024, 1, 1) }),
      sellLot('s1', { createdAt: ts(2026, 6, 1) }),
    ];
    const result = calculateUsResidentRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result[0].hasApproximatedFx).toBe(false);
  });

  it('classifies a sell as long-term when held over 365 days before the sell date', () => {
    const buyDate = ts(2024, 1, 1);
    const sellDate = buyDate + 400 * DAY_MS;
    const holdings = [buyLot('b1', { createdAt: buyDate }), sellLot('s1', { createdAt: sellDate })];
    const result = calculateUsResidentRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result[0].longTermSellCount).toBe(1);
    expect(result[0].shortTermSellCount).toBe(0);
    expect(result[0].longTermGainUsd).toBeCloseTo((150 - 100) * 5, 5);
    expect(result[0].shortTermGainUsd).toBe(0);
  });

  it('classifies a sell as short-term when held under 365 days before the sell date', () => {
    const buyDate = ts(2026, 1, 1);
    const sellDate = buyDate + 30 * DAY_MS;
    const holdings = [buyLot('b1', { createdAt: buyDate }), sellLot('s1', { createdAt: sellDate })];
    const result = calculateUsResidentRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result[0].shortTermSellCount).toBe(1);
    expect(result[0].longTermSellCount).toBe(0);
    expect(result[0].shortTermGainUsd).toBeCloseTo((150 - 100) * 5, 5);
  });

  it('separates long-term and short-term gains within the same year', () => {
    const holdings = [
      buyLot('b1', { id: 'b1', createdAt: ts(2024, 1, 1), quantity: 10 }),
      sellLot('s1', { id: 's1', createdAt: ts(2026, 6, 1), avgPrice: 160, quantity: 3 }), // long-term
      buyLot('b2', { id: 'b2', ticker: 'MSFT', createdAt: ts(2026, 5, 1), quantity: 5 }),
      sellLot('s2', {
        id: 's2',
        ticker: 'MSFT',
        createdAt: ts(2026, 6, 1),
        avgPrice: 120,
        quantity: 2,
      }), // short-term
    ];
    const result = calculateUsResidentRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result).toHaveLength(1);
    expect(result[0].longTermSellCount).toBe(1);
    expect(result[0].shortTermSellCount).toBe(1);
    expect(result[0].longTermGainUsd).toBeCloseTo((160 - 100) * 3, 5);
    expect(result[0].shortTermGainUsd).toBeCloseTo((120 - 100) * 2, 5);
  });
});

describe('estimateYearlyUsResidentTax', () => {
  it('applies the long-term and short-term rates separately and sums them', () => {
    const result = estimateYearlyUsResidentTax(
      { longTermGainUsd: 1000, shortTermGainUsd: 500 },
      0.15,
      0.22,
      false
    );
    expect(result.longTermTaxUsd).toBeCloseTo(150, 5);
    expect(result.shortTermTaxUsd).toBeCloseTo(110, 5);
    expect(result.totalTaxUsd).toBeCloseTo(260, 5);
  });

  it('does not tax a year with net losses in both buckets', () => {
    const result = estimateYearlyUsResidentTax(
      { longTermGainUsd: -200, shortTermGainUsd: -50 },
      0.15,
      0.22,
      false
    );
    expect(result.totalTaxUsd).toBe(0);
  });
});
