import { describe, expect, it } from 'vitest';
import { computeStructuralRisk } from './structural';
import type { Category, Holding } from '../rebalance/types';

const categories: Category[] = [
  { id: 'bond', name: '채권', targetPercent: 20 },
  { id: 'stock', name: '개별주식', targetPercent: 80 },
];

describe('computeStructuralRisk', () => {
  it('reports 100% concentration (HHI = 1) for a single-holding portfolio', () => {
    const holdings: Holding[] = [
      { id: 'hold-1-a', ticker: 'AAPL', name: 'Apple', categoryId: 'stock', market: 'US', currency: 'USD', avgPrice: 100, quantity: 10, currentPrice: 100 },
    ];
    const risk = computeStructuralRisk(categories, holdings, 1300);
    expect(risk.holdingHHI).toBeCloseTo(1, 5);
    expect(risk.topHoldingWeightPercent).toBeCloseTo(100, 5);
    expect(risk.top3WeightPercent).toBeCloseTo(100, 5);
  });

  it('reports a lower HHI for an evenly split portfolio than a concentrated one', () => {
    const evenHoldings: Holding[] = [
      { id: 'hold-1-a', ticker: 'A', name: 'A', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 10, currentPrice: 1000 },
      { id: 'hold-2-b', ticker: 'B', name: 'B', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 10, currentPrice: 1000 },
      { id: 'hold-3-c', ticker: 'C', name: 'C', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 10, currentPrice: 1000 },
      { id: 'hold-4-d', ticker: 'D', name: 'D', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 10, currentPrice: 1000 },
    ];
    const concentratedHoldings: Holding[] = [
      { id: 'hold-1-a', ticker: 'A', name: 'A', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 37, currentPrice: 1000 },
      { id: 'hold-2-b', ticker: 'B', name: 'B', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 1, currentPrice: 1000 },
      { id: 'hold-3-c', ticker: 'C', name: 'C', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 1, currentPrice: 1000 },
      { id: 'hold-4-d', ticker: 'D', name: 'D', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 1000, quantity: 1, currentPrice: 1000 },
    ];
    const even = computeStructuralRisk(categories, evenHoldings, 1300);
    const concentrated = computeStructuralRisk(categories, concentratedHoldings, 1300);
    expect(even.holdingHHI).toBeLessThan(concentrated.holdingHHI);
    expect(even.holdingHHI).toBeCloseTo(0.25, 5); // 4개 종목 균등 = 1/4
  });

  it('splits currency and market exposure correctly for a mixed KR/US portfolio', () => {
    const holdings: Holding[] = [
      { id: 'hold-1-a', ticker: 'AAPL', name: 'Apple', categoryId: 'stock', market: 'US', currency: 'USD', avgPrice: 100, quantity: 10, currentPrice: 100 }, // 1000 USD -> 1,300,000 KRW
      { id: 'hold-2-b', ticker: '005930', name: '삼성전자', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 70000, quantity: 10, currentPrice: 70000 }, // 700,000 KRW
    ];
    const risk = computeStructuralRisk(categories, holdings, 1300);
    expect(risk.totalValueBase).toBeCloseTo(1_300_000 + 700_000, 5);
    const usd = risk.byCurrency.find((c) => c.id === 'USD')!;
    const krw = risk.byCurrency.find((c) => c.id === 'KRW')!;
    expect(usd.weightPercent).toBeCloseTo((1_300_000 / 2_000_000) * 100, 5);
    expect(krw.weightPercent).toBeCloseTo((700_000 / 2_000_000) * 100, 5);
  });

  it('merges lots of the same ticker before computing concentration', () => {
    const holdings: Holding[] = [
      { id: 'hold-1-a', ticker: 'AAPL', name: 'Apple', categoryId: 'stock', market: 'US', currency: 'USD', avgPrice: 100, quantity: 5, currentPrice: 100 },
      { id: 'hold-2-b', ticker: 'AAPL', name: 'Apple', categoryId: 'stock', market: 'US', currency: 'USD', avgPrice: 110, quantity: 5, currentPrice: 100 },
    ];
    const risk = computeStructuralRisk(categories, holdings, 1300);
    expect(risk.byHolding.length).toBe(1);
    expect(risk.byHolding[0].weightPercent).toBeCloseTo(100, 5);
  });

  it('handles an empty portfolio without dividing by zero', () => {
    const risk = computeStructuralRisk(categories, [], 1300);
    expect(risk.totalValueBase).toBe(0);
    expect(risk.holdingHHI).toBe(0);
    expect(risk.byHolding).toEqual([]);
  });
});
