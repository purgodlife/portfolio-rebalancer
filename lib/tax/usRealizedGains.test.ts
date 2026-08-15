import { describe, expect, it } from 'vitest';
import { calculateUsRealizedGainsByYear, estimateUsCapitalGainsTax } from './usRealizedGains';
import { US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW, US_CAPITAL_GAINS_TAX_RATE } from './tradeCosts';
import type { Holding } from '@/lib/rebalance/types';

const FALLBACK_RATE = 1_300;

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
    avgPrice: 150, // 매도가
    quantity: 5,
    currentPrice: 150,
    lotType: 'sell',
    ...overrides,
  };
}

describe('calculateUsRealizedGainsByYear', () => {
  it('computes USD realized gain using the average cost basis from buy lots', () => {
    const holdings = [
      buyLot('b1', { avgPrice: 100, quantity: 10, createdAt: ts(2026, 1, 1) }),
      sellLot('s1', { avgPrice: 150, quantity: 4, createdAt: ts(2026, 6, 1) }),
    ];
    const result = calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result).toHaveLength(1);
    expect(result[0].year).toBe(2026);
    expect(result[0].realizedGainUsd).toBeCloseTo((150 - 100) * 4, 5);
    expect(result[0].sellCount).toBe(1);
  });

  it('uses the recorded buy and sell FX rates for an exact KRW conversion when both are present', () => {
    const holdings = [
      buyLot('b1', { avgPrice: 100, quantity: 10, purchaseFxRate: 1_200, createdAt: ts(2026, 1, 1) }),
      sellLot('s1', { avgPrice: 150, quantity: 4, purchaseFxRate: 1_400, createdAt: ts(2026, 6, 1) }),
    ];
    const result = calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE);
    const expectedKrw = 150 * 4 * 1_400 - 100 * 4 * 1_200;
    expect(result[0].realizedGainKrw).toBeCloseTo(expectedKrw, 5);
    expect(result[0].hasApproximatedKrw).toBe(false);
  });

  it('falls back to the given rate and flags approximation when the sell FX rate is missing', () => {
    const holdings = [
      buyLot('b1', { avgPrice: 100, quantity: 10, purchaseFxRate: 1_200, createdAt: ts(2026, 1, 1) }),
      sellLot('s1', { avgPrice: 150, quantity: 4, createdAt: ts(2026, 6, 1) }), // no purchaseFxRate on the sell lot
    ];
    const result = calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE);
    const expectedKrw = 150 * 4 * FALLBACK_RATE - 100 * 4 * 1_200;
    expect(result[0].realizedGainKrw).toBeCloseTo(expectedKrw, 5);
    expect(result[0].hasApproximatedKrw).toBe(true);
  });

  it('falls back to the given rate for the buy side when no buy lot recorded a rate', () => {
    const holdings = [
      buyLot('b1', { avgPrice: 100, quantity: 10, createdAt: ts(2026, 1, 1) }), // no purchaseFxRate
      sellLot('s1', { avgPrice: 150, quantity: 4, purchaseFxRate: 1_400, createdAt: ts(2026, 6, 1) }),
    ];
    const result = calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE);
    const expectedKrw = 150 * 4 * 1_400 - 100 * 4 * FALLBACK_RATE;
    expect(result[0].realizedGainKrw).toBeCloseTo(expectedKrw, 5);
    expect(result[0].hasApproximatedKrw).toBe(true);
  });

  it('ignores KR-market and buy-lot holdings', () => {
    const holdings = [
      buyLot('b1', { createdAt: ts(2026, 1, 1) }),
      sellLot('s1', { market: 'KR', currency: 'KRW', createdAt: ts(2026, 6, 1) }),
    ];
    expect(calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE)).toHaveLength(0);
  });

  it('buckets sells into different years', () => {
    const holdings = [
      buyLot('b1', { avgPrice: 100, quantity: 20, createdAt: ts(2025, 1, 1) }),
      sellLot('s1', { avgPrice: 120, quantity: 5, createdAt: ts(2025, 12, 1) }),
      sellLot('s2', { avgPrice: 140, quantity: 5, createdAt: ts(2026, 3, 1) }),
    ];
    const result = calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result).toHaveLength(2);
    const y2025 = result.find((r) => r.year === 2025)!;
    const y2026 = result.find((r) => r.year === 2026)!;
    expect(y2025.realizedGainUsd).toBeCloseTo((120 - 100) * 5, 5);
    expect(y2026.realizedGainUsd).toBeCloseTo((140 - 100) * 5, 5);
  });

  it('can report a net loss for a year', () => {
    const holdings = [
      buyLot('b1', { avgPrice: 100, quantity: 10, createdAt: ts(2026, 1, 1) }),
      sellLot('s1', { avgPrice: 80, quantity: 5, createdAt: ts(2026, 6, 1) }),
    ];
    const result = calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result[0].realizedGainUsd).toBeCloseTo((80 - 100) * 5, 5);
  });

  it('sorts results by year descending', () => {
    const holdings = [
      buyLot('b1', { avgPrice: 100, quantity: 20, createdAt: ts(2024, 1, 1) }),
      sellLot('s1', { avgPrice: 110, quantity: 5, createdAt: ts(2024, 6, 1) }),
      sellLot('s2', { avgPrice: 120, quantity: 5, createdAt: ts(2026, 6, 1) }),
    ];
    const result = calculateUsRealizedGainsByYear(holdings, FALLBACK_RATE);
    expect(result.map((r) => r.year)).toEqual([2026, 2024]);
  });
});

describe('estimateUsCapitalGainsTax', () => {
  it('applies no tax below the annual deduction', () => {
    const result = estimateUsCapitalGainsTax(1_300_000); // < 2,500,000
    expect(result.taxableGainKrw).toBe(0);
    expect(result.estimatedTaxKrw).toBe(0);
  });

  it('taxes only the amount above the annual deduction', () => {
    const gainKrw = 3_900_000;
    const result = estimateUsCapitalGainsTax(gainKrw);
    const expectedTaxable = gainKrw - US_CAPITAL_GAINS_ANNUAL_DEDUCTION_KRW;
    expect(result.taxableGainKrw).toBeCloseTo(expectedTaxable, 5);
    expect(result.estimatedTaxKrw).toBeCloseTo(expectedTaxable * US_CAPITAL_GAINS_TAX_RATE, 5);
  });

  it('treats a net loss as zero taxable gain', () => {
    const result = estimateUsCapitalGainsTax(-500_000);
    expect(result.taxableGainKrw).toBe(0);
    expect(result.estimatedTaxKrw).toBe(0);
  });
});
