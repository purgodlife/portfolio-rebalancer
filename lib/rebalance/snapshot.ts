import { groupHoldings, groupToHolding } from './grouping';
import type { Category, Holding } from './types';

/**
 * 하루 1건(YYYY-MM-DD를 id로 사용, 같은 날 재방문 시 덮어씀)으로 쌓이는 총자산 스냅샷.
 * 월별 자산추이 화면에서 이 기록들을 월 단위로 묶어서 보여준다.
 */
export interface PortfolioSnapshot {
  id: string;
  date: string;
  totalValueBase: number;
  byCategory: Record<string, number>;
  usdKrwRate: number;
}

/**
 * 특정 시점(dateStr, YYYY-MM-DD)의 총자산/카테고리별 평가금액을 계산한다.
 * 순수 함수: 저장은 호출하는 쪽(upsertSnapshot)에서 담당한다.
 */
export function computeSnapshot(
  categories: Category[],
  holdings: Holding[],
  usdKrwRate: number,
  dateStr: string
): PortfolioSnapshot {
  const grouped = groupHoldings(holdings).map(groupToHolding);
  const byCategory: Record<string, number> = {};
  let totalValueBase = 0;

  for (const h of grouped) {
    const valueBase = h.currency === 'USD' ? h.currentPrice * h.quantity * usdKrwRate : h.currentPrice * h.quantity;
    byCategory[h.categoryId] = (byCategory[h.categoryId] ?? 0) + valueBase;
    totalValueBase += valueBase;
  }

  // 보유종목이 없는 카테고리도 0으로 채워서, 나중에 카테고리별 추이를 볼 때 누락되지 않게 한다.
  for (const c of categories) {
    if (!(c.id in byCategory)) byCategory[c.id] = 0;
  }

  return { id: dateStr, date: dateStr, totalValueBase, byCategory, usdKrwRate };
}

export interface MonthlyPoint {
  /** YYYY-MM */
  month: string;
  totalValueBase: number;
}

/**
 * 일별 스냅샷들을 월 단위로 묶어서, 각 달의 "마지막(가장 최근) 스냅샷" 값을 그 달의 대표값으로 쓴다.
 */
export function aggregateMonthly(snapshots: PortfolioSnapshot[]): MonthlyPoint[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = new Map<string, PortfolioSnapshot>();
  for (const s of sorted) {
    const month = s.date.slice(0, 7);
    byMonth.set(month, s); // 같은 달 안에서는 날짜순으로 순회하므로 마지막에 덮어쓴 값이 최신값
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, s]) => ({ month, totalValueBase: s.totalValueBase }));
}
