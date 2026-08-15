import { describe, expect, it } from 'vitest';
import { aggregateMonthly, computeSnapshot, type PortfolioSnapshot } from './snapshot';
import type { Category, Holding } from './types';

const categories: Category[] = [
  { id: 'bond', name: '채권', targetPercent: 20 },
  { id: 'stock', name: '개별주식', targetPercent: 80 },
];

const holdings: Holding[] = [
  { id: 'hold-1-a', ticker: 'TLT', name: '미국채', categoryId: 'bond', market: 'US', currency: 'USD', avgPrice: 90, quantity: 10, currentPrice: 95 },
  { id: 'hold-2-b', ticker: '005930', name: '삼성전자', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 70000, quantity: 10, currentPrice: 75000 },
];

describe('computeSnapshot', () => {
  it('sums holdings into KRW and fills every category (even ones with no holdings) with 0', () => {
    const snap = computeSnapshot(
      [...categories, { id: 'empty', name: '빈카테고리', targetPercent: 0 }],
      holdings,
      1300,
      '2026-08-13',
      'acc-1'
    );
    expect(snap.byCategory.bond).toBeCloseTo(95 * 10 * 1300, 5);
    expect(snap.byCategory.stock).toBe(75000 * 10);
    expect(snap.byCategory.empty).toBe(0);
    expect(snap.totalValueBase).toBeCloseTo(95 * 10 * 1300 + 75000 * 10, 5);
    expect(snap.id).toBe('acc-1:2026-08-13');
    expect(snap.accountId).toBe('acc-1');
  });

  it('merges lots of the same ticker before valuing (uses net quantity)', () => {
    const withExtraLot: Holding[] = [
      ...holdings,
      { id: 'hold-3-c', ticker: '005930', name: '삼성전자', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 75000, quantity: 4, currentPrice: 75000, lotType: 'sell' },
    ];
    const snap = computeSnapshot(categories, withExtraLot, 1300, '2026-08-13', 'acc-1');
    // 10주 매수 - 4주 매도 = 6주 순보유
    expect(snap.byCategory.stock).toBe(75000 * 6);
  });
});

describe('aggregateMonthly', () => {
  it('keeps the latest snapshot within each month', () => {
    const snapshots: PortfolioSnapshot[] = [
      { id: '2026-06-05', date: '2026-06-05', totalValueBase: 1_000_000, byCategory: {}, usdKrwRate: 1300 },
      { id: '2026-06-20', date: '2026-06-20', totalValueBase: 1_100_000, byCategory: {}, usdKrwRate: 1300 },
      { id: '2026-07-02', date: '2026-07-02', totalValueBase: 1_150_000, byCategory: {}, usdKrwRate: 1300 },
    ];
    expect(aggregateMonthly(snapshots)).toEqual([
      { month: '2026-06', totalValueBase: 1_100_000 },
      { month: '2026-07', totalValueBase: 1_150_000 },
    ]);
  });

  it('handles no snapshots', () => {
    expect(aggregateMonthly([])).toEqual([]);
  });
});
