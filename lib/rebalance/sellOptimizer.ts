/**
 * 카테고리 하나를 얼마만큼 매도해야 하는지(target)가 정해졌을 때, 그 카테고리
 * 안의 보유종목들 중 "어떤 종목을 몇 주씩" 팔아야 목표 금액에 가장 가깝게
 * 맞출 수 있는지 계산한다. 주식은 소수점 단위로 팔 수 없으므로 정확히 맞을
 * 수는 없지만, 정수 주식수 조합 중 목표에 가장 가까운 조합을 찾는다
 * (bounded knapsack + 이산화(discretization) 탐색).
 */

export interface SellCandidate {
  id: string;
  /** 1주당 가치 (기준 통화, 보통 KRW로 환산된 값) */
  unitValueBase: number;
  /** 매도 가능한 최대 수량(정수, 현재 순보유수량) */
  maxQuantity: number;
}

export interface SellPick {
  id: string;
  quantity: number;
  valueBase: number;
}

export interface SellOptimizationResult {
  picks: SellPick[];
  totalValueBase: number;
}

/** 탐색 정밀도(이산화 구간 수). 클수록 정확하지만 느려진다. */
const MAX_STATES = 6000;

export function optimizeSellQuantities(
  targetBase: number,
  candidates: SellCandidate[]
): SellOptimizationResult {
  const usable = candidates.filter((c) => c.unitValueBase > 0 && c.maxQuantity > 0);
  if (targetBase <= 0 || usable.length === 0) {
    return { picks: [], totalValueBase: 0 };
  }

  const totalAvailable = usable.reduce((s, c) => s + c.unitValueBase * c.maxQuantity, 0);

  // 목표가 보유 가치 전체 이상이면 전량 매도가 최선(더 팔 게 없음).
  if (targetBase >= totalAvailable) {
    const picks = usable.map((c) => ({
      id: c.id,
      quantity: c.maxQuantity,
      valueBase: c.unitValueBase * c.maxQuantity,
    }));
    return { picks, totalValueBase: totalAvailable };
  }

  const unit = Math.max(1, Math.round(totalAvailable / MAX_STATES));
  const maxState = Math.max(1, Math.floor(totalAvailable / unit));

  // 0/1 bounded knapsack (binary splitting으로 "N주까지" 제약을 표현).
  const reachable = new Uint8Array(maxState + 1);
  const parentItem = new Int32Array(maxState + 1).fill(-1);
  const parentQty = new Int32Array(maxState + 1).fill(0);
  const parentPrev = new Int32Array(maxState + 1).fill(-1);
  reachable[0] = 1;

  usable.forEach((c, idx) => {
    const stepValue = Math.max(1, Math.round(c.unitValueBase / unit));
    let remaining = c.maxQuantity;
    let chunk = 1;
    const chunks: number[] = [];
    while (remaining > 0) {
      const take = Math.min(chunk, remaining);
      chunks.push(take);
      remaining -= take;
      chunk *= 2;
    }
    for (const qty of chunks) {
      const weight = stepValue * qty;
      if (weight > maxState) continue;
      for (let s = maxState; s >= weight; s--) {
        if (reachable[s - weight] && !reachable[s]) {
          reachable[s] = 1;
          parentItem[s] = idx;
          parentQty[s] = qty;
          parentPrev[s] = s - weight;
        }
      }
    }
  });

  const targetState = Math.min(maxState, Math.max(0, Math.round(targetBase / unit)));
  let best = 0;
  let bestDiff = Infinity;
  for (let s = 0; s <= maxState; s++) {
    if (!reachable[s]) continue;
    const diff = Math.abs(s - targetState);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }

  const qtyByCandidateIdx = new Map<number, number>();
  let s = best;
  while (s > 0 && parentItem[s] !== -1) {
    const idx = parentItem[s];
    qtyByCandidateIdx.set(idx, (qtyByCandidateIdx.get(idx) ?? 0) + parentQty[s]);
    s = parentPrev[s];
  }

  const picks: SellPick[] = [];
  let totalValueBase = 0;
  usable.forEach((c, idx) => {
    const qty = qtyByCandidateIdx.get(idx) ?? 0;
    if (qty > 0) {
      const valueBase = qty * c.unitValueBase;
      picks.push({ id: c.id, quantity: qty, valueBase });
      totalValueBase += valueBase;
    }
  });

  return { picks, totalValueBase };
}
