import { describe, expect, it } from 'vitest';
import { mergeAccountsForUnifiedRebalance } from './unifiedRebalance';
import type { Account, Category, Holding } from './types';

function account(id: string, name: string): Account {
  return { id, name, type: 'general' };
}

function category(id: string, name: string, targetPercent: number, accountId: string): Category {
  return { id, name, targetPercent, accountId };
}

function holding(id: string, ticker: string, categoryId: string, overrides: Partial<Holding> = {}): Holding {
  return {
    id,
    ticker,
    name: ticker,
    categoryId,
    market: 'KR',
    currency: 'KRW',
    avgPrice: 100,
    quantity: 10,
    currentPrice: 100,
    ...overrides,
  };
}

describe('mergeAccountsForUnifiedRebalance', () => {
  it('passes through a single account unchanged (percent-wise)', () => {
    const accounts = [account('a1', '계좌1')];
    const categories = [category('c1', '채권', 40, 'a1'), category('c2', '주식', 60, 'a1')];
    const holdings = [holding('h1', 'AAA', 'c1')];

    const result = mergeAccountsForUnifiedRebalance(accounts, categories, holdings);

    expect(result.categories).toHaveLength(2);
    expect(result.categories.find((c) => c.name === '채권')?.targetPercent).toBeCloseTo(40, 5);
    expect(result.categories.find((c) => c.name === '주식')?.targetPercent).toBeCloseTo(60, 5);
    expect(result.warnings).toHaveLength(0);
    expect(result.holdings).toHaveLength(1);
  });

  it('merges same-named categories across accounts with identical targets, no warning', () => {
    const accounts = [account('a1', '계좌1'), account('a2', '계좌2')];
    const categories = [category('c1', '채권', 20, 'a1'), category('c2', '채권', 20, 'a2')];
    const holdings = [holding('h1', 'AAA', 'c1'), holding('h2', 'BBB', 'c2')];

    const result = mergeAccountsForUnifiedRebalance(accounts, categories, holdings);

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].targetPercent).toBeCloseTo(100, 5); // 유일 카테고리라 정규화 후 100%
    expect(result.warnings).toHaveLength(0);
    expect(result.holdings).toHaveLength(2);
    expect(result.holdings.every((h) => h.categoryId === result.categories[0].id)).toBe(true);
  });

  it('warns and averages when the same category name has different targets across accounts', () => {
    const accounts = [account('a1', '계좌1'), account('a2', '계좌2')];
    const categories = [
      category('c1', '채권', 20, 'a1'),
      category('c2', '채권', 40, 'a2'),
      category('c3', '주식', 80, 'a1'),
      category('c4', '주식', 60, 'a2'),
    ];
    const holdings: Holding[] = [];

    const result = mergeAccountsForUnifiedRebalance(accounts, categories, holdings);

    const bond = result.categories.find((c) => c.name === '채권');
    expect(bond).toBeDefined();
    // raw average 30 vs 70 (stock) -> total 100 already, no rescale
    expect(bond!.targetPercent).toBeCloseTo(30, 5);
    expect(result.warnings).toHaveLength(2);
    const bondWarning = result.warnings.find((w) => w.categoryName === '채권');
    expect(bondWarning!.averagedTargetPercent).toBeCloseTo(30, 5);
    expect(bondWarning!.targets).toEqual(
      expect.arrayContaining([
        { accountName: '계좌1', targetPercent: 20 },
        { accountName: '계좌2', targetPercent: 40 },
      ])
    );
  });

  it('renormalizes when merged targets do not sum to 100', () => {
    const accounts = [account('a1', '계좌1'), account('a2', '계좌2')];
    // 계좌1은 채권 20/주식 80(=100), 계좌2는 별도 이름의 카테고리만 있고 합이 100이 아님
    const categories = [
      category('c1', '채권', 20, 'a1'),
      category('c2', '주식', 80, 'a1'),
      category('c3', '리츠', 50, 'a2'),
    ];
    const holdings: Holding[] = [];

    const result = mergeAccountsForUnifiedRebalance(accounts, categories, holdings);

    const total = result.categories.reduce((s, c) => s + c.targetPercent, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(result.rawTotalPercent).toBeCloseTo(150, 5);
  });

  it('tracks which accounts a given ticker spans', () => {
    const accounts = [account('a1', '계좌1'), account('a2', '계좌2')];
    const categories = [category('c1', '주식', 100, 'a1'), category('c2', '주식', 100, 'a2')];
    const holdings = [holding('h1', 'AAPL', 'c1', { market: 'US', currency: 'USD' }), holding('h2', 'AAPL', 'c2', { market: 'US', currency: 'USD' })];

    const result = mergeAccountsForUnifiedRebalance(accounts, categories, holdings);

    expect(result.accountsByHoldingKey['US:AAPL']).toEqual(['계좌1', '계좌2']);
  });

  it('drops holdings whose category no longer exists (orphaned)', () => {
    const accounts = [account('a1', '계좌1')];
    const categories = [category('c1', '채권', 100, 'a1')];
    const holdings = [holding('h1', 'AAA', 'c1'), holding('h2', 'BBB', 'deleted-cat')];

    const result = mergeAccountsForUnifiedRebalance(accounts, categories, holdings);

    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0].ticker).toBe('AAA');
  });
});
