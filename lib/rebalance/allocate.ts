/**
 * 순수 함수 모음: 목표 비중에 맞춰 금액을 배분/회수하는 일반화된 로직.
 * 카테고리 단위 배분과, 카테고리 내부 종목 단위 배분 모두 이 함수들을 재사용한다.
 */

export interface WeightedItem {
  id: string;
  currentValue: number;
  /** 0~1 사이로 정규화된 목표 비중 */
  weight: number;
}

export interface AllocationDiff {
  id: string;
  /** 양수 = 매수, 음수 = 매도 */
  diff: number;
}

const EPS = 1e-9;

/**
 * 매도를 허용하는 "정확한" 배분: 입금 후 최종 가치를 기준으로 각 항목이
 * 목표 비중에 정확히 도달하도록 diff를 계산한다. (합계는 항상 cash와 같다)
 */
export function allocateExact(
  items: WeightedItem[],
  cash: number
): AllocationDiff[] {
  const currentTotal = items.reduce((s, i) => s + i.currentValue, 0);
  const totalAfter = currentTotal + cash;
  return items.map((it) => {
    const target = it.weight * totalAfter;
    let diff = target - it.currentValue;
    // 보유 가치보다 많이 팔 수는 없음
    if (diff < 0) diff = Math.max(diff, -it.currentValue);
    return { id: it.id, diff };
  });
}

/**
 * 매도 없이 "매수만" 사용 가능한 현금(cash)으로 목표에 최대한 가깝게 배분한다.
 * - 필요 금액(shortfall) 합이 cash보다 작으면: 부족분을 다 채우고 남는 돈은 목표 비중대로 추가 배분.
 * - 필요 금액 합이 cash보다 크면: 부족분 비율대로 비례 배분(과부족 정도가 큰 항목에 더 많이).
 */
export function allocateBuyOnly(
  items: WeightedItem[],
  cash: number
): AllocationDiff[] {
  if (items.length === 0 || cash <= 0) {
    return items.map((it) => ({ id: it.id, diff: 0 }));
  }
  const currentTotal = items.reduce((s, i) => s + i.currentValue, 0);
  const totalAfter = currentTotal + cash;
  const rawDiffs = items.map((it) => it.weight * totalAfter - it.currentValue);
  const positive = rawDiffs.map((d) => Math.max(0, d));
  const sumPositive = positive.reduce((a, b) => a + b, 0);
  const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;

  if (sumPositive <= EPS) {
    // 모든 항목이 이미 목표 이상 -> 목표 비중대로 추가 배분
    return items.map((it) => ({ id: it.id, diff: (it.weight / totalWeight) * cash }));
  }

  if (sumPositive <= cash + EPS) {
    const leftover = cash - sumPositive;
    return items.map((it, idx) => ({
      id: it.id,
      diff: positive[idx] + (it.weight / totalWeight) * leftover,
    }));
  }

  const scale = cash / sumPositive;
  return items.map((it, idx) => ({ id: it.id, diff: positive[idx] * scale }));
}

/**
 * 그룹(카테고리 내부 종목들)에 이미 정해진 변화 금액(changeAmount, 양수=매수 음수=매도)을
 * 균등비중을 기준으로 가장 편차가 큰 종목부터 우선 배분한다.
 * 종목별 목표비중이 따로 없으므로 "균등 비중"을 잠정 목표로 사용한다.
 */
export function distributeWithinGroup(
  items: { id: string; currentValue: number }[],
  changeAmount: number
): AllocationDiff[] {
  const n = items.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: items[0].id, diff: changeAmount }];
  if (Math.abs(changeAmount) <= EPS) {
    return items.map((it) => ({ id: it.id, diff: 0 }));
  }

  const currentTotal = items.reduce((s, i) => s + i.currentValue, 0);
  const equalWeight = 1 / n;

  if (changeAmount > 0) {
    const weighted = items.map((it) => ({ id: it.id, currentValue: it.currentValue, weight: equalWeight }));
    return allocateBuyOnly(weighted, changeAmount);
  }

  // 매도: 균등비중 대비 초과분이 큰 종목부터 판다
  const needed = -changeAmount;
  const totalAfterSellIdeal = currentTotal - needed;
  const rawDiffs = items.map((it) => equalWeight * totalAfterSellIdeal - it.currentValue); // 음수일수록 많이 팔아야 함
  const overweight = rawDiffs.map((d) => Math.max(0, -d));
  const sumOverweight = overweight.reduce((a, b) => a + b, 0);

  if (sumOverweight <= EPS) {
    // 균등비중 대비 초과보유가 없으면 현재가치 비례로 매도
    if (currentTotal <= EPS) return items.map((it) => ({ id: it.id, diff: 0 }));
    return items.map((it) => ({
      id: it.id,
      diff: -Math.min(it.currentValue, needed * (it.currentValue / currentTotal)),
    }));
  }

  if (sumOverweight <= needed + EPS) {
    const leftover = needed - sumOverweight;
    return items.map((it, idx) => {
      const base = overweight[idx];
      const extra = currentTotal > EPS ? leftover * (it.currentValue / currentTotal) : 0;
      return { id: it.id, diff: -Math.min(it.currentValue, base + extra) };
    });
  }

  const scale = needed / sumOverweight;
  return items.map((it, idx) => ({
    id: it.id,
    diff: -Math.min(it.currentValue, overweight[idx] * scale),
  }));
}
