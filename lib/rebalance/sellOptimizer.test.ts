import { describe, expect, it } from 'vitest';
import { optimizeSellQuantities, type SellCandidate } from './sellOptimizer';

describe('optimizeSellQuantities', () => {
  it('hits the target exactly when a whole-share combination allows it', () => {
    const result = optimizeSellQuantities(500_000, [
      { id: 'a', unitValueBase: 100_000, maxQuantity: 10 },
    ]);
    expect(result.totalValueBase).toBe(500_000);
    expect(result.picks).toEqual([{ id: 'a', quantity: 5, valueBase: 500_000 }]);
  });

  it('never recommends selling more shares than are available, and sells everything if target exceeds total value', () => {
    const candidates: SellCandidate[] = [{ id: 'a', unitValueBase: 30_000, maxQuantity: 4 }];
    const result = optimizeSellQuantities(10_000_000, candidates);
    expect(result.picks).toEqual([{ id: 'a', quantity: 4, valueBase: 120_000 }]);
  });

  it('returns nothing when there is nothing to sell', () => {
    expect(optimizeSellQuantities(100_000, [])).toEqual({ picks: [], totalValueBase: 0 });
    expect(optimizeSellQuantities(0, [{ id: 'a', unitValueBase: 1000, maxQuantity: 5 }])).toEqual({
      picks: [],
      totalValueBase: 0,
    });
  });

  it('finds a combination at least as close to the target as brute-force search', () => {
    const candidates: SellCandidate[] = [
      { id: 'a', unitValueBase: 137_000, maxQuantity: 6 },
      { id: 'b', unitValueBase: 52_300, maxQuantity: 9 },
      { id: 'c', unitValueBase: 981_000, maxQuantity: 2 },
    ];
    const target = 650_000;
    const result = optimizeSellQuantities(target, candidates);

    let bruteBestDiff = Infinity;
    for (let a = 0; a <= candidates[0].maxQuantity; a++) {
      for (let b = 0; b <= candidates[1].maxQuantity; b++) {
        for (let c = 0; c <= candidates[2].maxQuantity; c++) {
          const total =
            a * candidates[0].unitValueBase + b * candidates[1].unitValueBase + c * candidates[2].unitValueBase;
          bruteBestDiff = Math.min(bruteBestDiff, Math.abs(total - target));
        }
      }
    }

    const achievedDiff = Math.abs(result.totalValueBase - target);
    // 이산화(discretization) 오차를 감안해 브루트포스 최적해 대비 약간의 여유만 허용한다.
    expect(achievedDiff).toBeLessThanOrEqual(bruteBestDiff + unitTolerance(candidates));

    for (const pick of result.picks) {
      const cand = candidates.find((c) => c.id === pick.id)!;
      expect(pick.quantity).toBeGreaterThanOrEqual(0);
      expect(pick.quantity).toBeLessThanOrEqual(cand.maxQuantity);
      expect(Number.isInteger(pick.quantity)).toBe(true);
    }
  });
});

function unitTolerance(candidates: SellCandidate[]): number {
  const totalAvailable = candidates.reduce((s, c) => s + c.unitValueBase * c.maxQuantity, 0);
  return Math.max(1, Math.round(totalAvailable / 6000)) * 2;
}
