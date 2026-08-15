import { describe, expect, it } from 'vitest';
import { planMirrorSync, computeUnifiedCategoryRemovalImpact } from './unifiedAllocationSync';
import type { Category, Holding } from './types';

function unifiedCat(id: string, name: string, targetPercent: number): Category {
  return { id, name, targetPercent, accountId: 'unified' };
}

function mirror(id: string, name: string, targetPercent: number, mirrorsCategoryId: string, accountId = 'acc-1'): Category {
  return { id, name, targetPercent, accountId, mirrorsCategoryId };
}

function individualCat(id: string, name: string, targetPercent: number, accountId = 'acc-1'): Category {
  return { id, name, targetPercent, accountId };
}

describe('planMirrorSync', () => {
  it('plans to create a mirror for every unified category with no existing mirror', () => {
    const plan = planMirrorSync([unifiedCat('u1', '채권', 20), unifiedCat('u2', 'S&P500', 30)], []);
    expect(plan.toCreate).toEqual([
      { name: '채권', targetPercent: 20, mirrorsCategoryId: 'u1' },
      { name: 'S&P500', targetPercent: 30, mirrorsCategoryId: 'u2' },
    ]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('does nothing when mirrors already match the unified source', () => {
    const plan = planMirrorSync(
      [unifiedCat('u1', '채권', 20)],
      [mirror('m1', '채권', 20, 'u1')]
    );
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('plans to update a mirror whose name changed upstream (holding link stays intact via id)', () => {
    const plan = planMirrorSync(
      [unifiedCat('u1', '미국지수', 30)], // renamed from 'S&P500'
      [mirror('m1', 'S&P500', 30, 'u1')]
    );
    expect(plan.toUpdate).toEqual([{ id: 'm1', name: '미국지수', targetPercent: 30 }]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toRemove).toEqual([]);
  });

  it('plans to update a mirror whose percent changed upstream', () => {
    const plan = planMirrorSync(
      [unifiedCat('u1', '채권', 25)],
      [mirror('m1', '채권', 20, 'u1')]
    );
    expect(plan.toUpdate).toEqual([{ id: 'm1', name: '채권', targetPercent: 25 }]);
  });

  it('plans to remove a mirror whose source unified category no longer exists', () => {
    const plan = planMirrorSync([], [mirror('m1', '채권', 20, 'u1')]);
    expect(plan.toRemove).toEqual(['m1']);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it('never touches non-mirror (individual) categories on the account', () => {
    const plan = planMirrorSync(
      [unifiedCat('u1', '채권', 20)],
      [individualCat('ind1', '내 개별 카테고리', 50)]
    );
    // the individual category is untouched; a mirror for u1 still needs to be created
    expect(plan.toCreate).toEqual([{ name: '채권', targetPercent: 20, mirrorsCategoryId: 'u1' }]);
    expect(plan.toRemove).toEqual([]);
  });

  it('handles a mixed batch of create/update/remove in one pass', () => {
    const plan = planMirrorSync(
      [unifiedCat('u1', '채권', 20), unifiedCat('u2', '새카테고리', 10)],
      [mirror('m1', '채권', 15, 'u1'), mirror('m2', '없어진카테고리', 5, 'u3')]
    );
    expect(plan.toUpdate).toEqual([{ id: 'm1', name: '채권', targetPercent: 20 }]);
    expect(plan.toCreate).toEqual([{ name: '새카테고리', targetPercent: 10, mirrorsCategoryId: 'u2' }]);
    expect(plan.toRemove).toEqual(['m2']);
  });
});

function holding(id: string, categoryId: string): Holding {
  return {
    id,
    ticker: 'AAPL',
    name: 'Apple',
    categoryId,
    market: 'US',
    currency: 'USD',
    avgPrice: 100,
    quantity: 1,
    currentPrice: 100,
  };
}

describe('computeUnifiedCategoryRemovalImpact', () => {
  it('counts holdings across every account that mirrors the removed unified category', () => {
    const allCategories = [
      unifiedCat('u1', '채권', 20),
      mirror('m1', '채권', 20, 'u1', 'acc-1'),
      mirror('m2', '채권', 20, 'u1', 'acc-2'),
      mirror('m3', 'S&P500', 30, 'u2', 'acc-1'), // unrelated, must not be counted
    ];
    const allHoldings = [holding('h1', 'm1'), holding('h2', 'm1'), holding('h3', 'm2'), holding('h4', 'm3')];

    const impact = computeUnifiedCategoryRemovalImpact('u1', allCategories, allHoldings);
    expect(impact.mirrorCategoryIds.sort()).toEqual(['m1', 'm2']);
    expect(impact.holdingsAtRiskCount).toBe(3);
  });

  it('reports zero impact when no account mirrors the category and it has no holdings', () => {
    const impact = computeUnifiedCategoryRemovalImpact('u1', [unifiedCat('u1', '채권', 20)], []);
    expect(impact.mirrorCategoryIds).toEqual([]);
    expect(impact.holdingsAtRiskCount).toBe(0);
  });
});
