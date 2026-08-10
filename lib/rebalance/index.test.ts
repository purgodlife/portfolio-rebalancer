import { describe, expect, it } from 'vitest';
import { calculateRebalance, validateCategories } from './index';
import type { Category, Holding } from './types';

const categories: Category[] = [
  { id: 'bond', name: '채권', targetPercent: 20 },
  { id: 'sp500', name: 'S&P500', targetPercent: 30 },
  { id: 'other-index', name: '기타지수', targetPercent: 40 },
  { id: 'stock', name: '개별주식', targetPercent: 10 },
];

const holdings: Holding[] = [
  { id: 'h1', ticker: 'TLT', name: '미국채 ETF', categoryId: 'bond', market: 'US', currency: 'USD', avgPrice: 90, quantity: 10, currentPrice: 90 },
  { id: 'h2', ticker: 'SPY', name: 'S&P500 ETF', categoryId: 'sp500', market: 'US', currency: 'USD', avgPrice: 400, quantity: 5, currentPrice: 400 },
  { id: 'h3', ticker: '069500', name: 'KODEX 200', categoryId: 'other-index', market: 'KR', currency: 'KRW', avgPrice: 30000, quantity: 100, currentPrice: 30000 },
  { id: 'h4', ticker: '005930', name: '삼성전자', categoryId: 'stock', market: 'KR', currency: 'KRW', avgPrice: 70000, quantity: 20, currentPrice: 70000 },
];

const usdKrwRate = 1300;

describe('validateCategories', () => {
  it('flags totals that are not 100%', () => {
    expect(validateCategories(categories).valid).toBe(true);
    expect(validateCategories([{ id: 'a', name: 'A', targetPercent: 50 }]).valid).toBe(false);
  });
});

describe('calculateRebalance - buy only', () => {
  it('allocates a small deposit toward the most underweight category first', () => {
    const result = calculateRebalance({
      categories,
      holdings,
      depositAmount: 100000,
      depositCurrency: 'KRW',
      usdKrwRate,
      allowSell: false,
    });

    // 매수만 있으므로 어떤 카테고리도 순매도(diff < 0)가 되면 안 됨
    for (const c of result.categories) {
      expect(c.diffBase).toBeGreaterThanOrEqual(-1e-6);
    }
    // 입금액이 전부 배분되어야 함 (매도 없이도 부족분이 더 크므로 전액 소진)
    expect(result.unallocatedCashBase).toBeCloseTo(0, 4);

    for (const a of result.actions) {
      expect(a.action).not.toBe('sell');
    }
  });

  it('never asks to sell more than is held', () => {
    const result = calculateRebalance({
      categories,
      holdings,
      depositAmount: 100000,
      depositCurrency: 'KRW',
      usdKrwRate,
      allowSell: true,
    });
    for (const a of result.actions) {
      if (a.action === 'sell') {
        expect(a.amountInBaseCurrency).toBeGreaterThan(0);
      }
    }
  });
});

describe('calculateRebalance - sell allowed', () => {
  it('reaches target percentages exactly when selling is allowed', () => {
    const result = calculateRebalance({
      categories,
      holdings,
      depositAmount: 500000,
      depositCurrency: 'KRW',
      usdKrwRate,
      allowSell: true,
    });

    for (const c of result.categories) {
      expect(c.projectedPercent).toBeCloseTo(c.targetPercent, 1);
    }
    expect(result.unallocatedCashBase).toBeCloseTo(0, 4);
  });

  it('sums of buy/sell actions roughly match category diffs', () => {
    const result = calculateRebalance({
      categories,
      holdings,
      depositAmount: 500000,
      depositCurrency: 'KRW',
      usdKrwRate,
      allowSell: true,
    });

    for (const c of result.categories) {
      const relatedActions = result.actions.filter((a) => a.categoryId === c.categoryId);
      const net = relatedActions.reduce(
        (s, a) => s + (a.action === 'sell' ? -a.amountInBaseCurrency : a.amountInBaseCurrency),
        0
      );
      expect(net).toBeCloseTo(c.diffBase, 0);
    }
  });
});

describe('calculateRebalance - edge cases', () => {
  it('handles zero deposit gracefully', () => {
    const result = calculateRebalance({
      categories,
      holdings,
      depositAmount: 0,
      depositCurrency: 'KRW',
      usdKrwRate,
      allowSell: false,
    });
    expect(result.depositBase).toBe(0);
    for (const a of result.actions) {
      expect(a.action).toBe('hold');
    }
  });

  it('handles an empty portfolio without throwing', () => {
    const result = calculateRebalance({
      categories,
      holdings: [],
      depositAmount: 1000000,
      depositCurrency: 'KRW',
      usdKrwRate,
      allowSell: false,
    });
    expect(result.actions.length).toBe(0);
    expect(result.categories.length).toBe(categories.length);
  });
});
