import { describe, expect, it } from 'vitest';
import { groupHoldings, groupToHolding } from './grouping';
import type { Holding } from './types';

const base = {
  ticker: 'AAPL',
  name: 'Apple Inc.',
  categoryId: 'stock',
  market: 'US' as const,
  currency: 'USD' as const,
  currentPrice: 200,
};

describe('groupHoldings', () => {
  it('merges multiple buy lots into one quantity-weighted average position', () => {
    const holdings: Holding[] = [
      { id: 'hold-1000-a', ...base, avgPrice: 150, quantity: 10 },
      { id: 'hold-2000-b', ...base, avgPrice: 180, quantity: 5 },
    ];
    const [group] = groupHoldings(holdings);
    expect(group.netQuantity).toBe(15);
    expect(group.avgBuyPrice).toBeCloseTo((150 * 10 + 180 * 5) / 15, 5);
    expect(group.lots.map((l) => l.id)).toEqual(['hold-1000-a', 'hold-2000-b']);
  });

  it('reduces net quantity for sell lots without changing the average buy price (average-cost method)', () => {
    const holdings: Holding[] = [
      { id: 'hold-1000-a', ...base, avgPrice: 150, quantity: 10 },
      { id: 'hold-2000-b', ...base, avgPrice: 210, quantity: 4, lotType: 'sell' },
    ];
    const [group] = groupHoldings(holdings);
    expect(group.netQuantity).toBe(6);
    expect(group.avgBuyPrice).toBe(150);
    expect(group.totalSellQuantity).toBe(4);
  });

  it('keeps different tickers or markets as separate groups', () => {
    const holdings: Holding[] = [
      { id: 'hold-1-a', ...base, avgPrice: 150, quantity: 1 },
      { id: 'hold-2-b', ...base, ticker: 'MSFT', avgPrice: 300, quantity: 1 },
      { id: 'hold-3-c', ...base, market: 'KR', currency: 'KRW', avgPrice: 300, quantity: 1 },
    ];
    expect(groupHoldings(holdings).length).toBe(3);
  });

  it('treats holdings without an explicit lotType as buy lots (backward compatibility)', () => {
    const holdings: Holding[] = [{ id: 'hold-1-a', ...base, avgPrice: 150, quantity: 3 }];
    const [group] = groupHoldings(holdings);
    expect(group.netQuantity).toBe(3);
    expect(group.totalSellQuantity).toBe(0);
  });

  it('computes a purchase-amount-weighted average FX rate for USD groups', () => {
    const holdings: Holding[] = [
      { id: 'hold-1-a', ...base, avgPrice: 100, quantity: 10, purchaseFxRate: 1300 },
      { id: 'hold-2-b', ...base, avgPrice: 100, quantity: 10, purchaseFxRate: 1400 },
    ];
    const [group] = groupHoldings(holdings);
    expect(group.avgPurchaseFxRate).toBeCloseTo(1350, 5);
  });
});

describe('groupToHolding', () => {
  it('produces a Holding-shaped object usable by calculateRebalance', () => {
    const holdings: Holding[] = [{ id: 'hold-1-a', ...base, avgPrice: 150, quantity: 10 }];
    const [group] = groupHoldings(holdings);
    const h = groupToHolding(group);
    expect(h.quantity).toBe(10);
    expect(h.avgPrice).toBe(150);
    expect(h.id).toBe(group.key);
  });
});
