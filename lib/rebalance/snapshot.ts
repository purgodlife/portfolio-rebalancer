import { groupHoldings, groupToHolding } from './grouping';
import type { Category, Holding } from './types';

/**
 * 하루 1건(YYYY-MM-DD를 id로 사용, 같은 날 재방문 시 덮어씀)으로 쌓이는 총자산 스냅샷.
 * 월별 자산추이 화면에서 이 기록들을 월 단위로 묶어서 보여준다.
 */
export interface PortfolioSnapshot {
  /** `${accountId}:${date}` 형태의 복합 id (계좌별로 하루 1건). */
  id: string;
  date: string;
  totalValueBase: number;
  byCategory: Record<string, number>;
  usdKrwRate: number;
  /**
   * 이 스냅샷이 속한 계좌 id. 계좌 기능이 추가되기 전 데이터는 이 값이 없으므로
   * (undefined), 그런 경우 기본 계좌에 속한 것으로 취급한다.
   */
  accountId?: string;
}

/**
 * 특정 시점(dateStr, YYYY-MM-DD)의 총자산/카테고리별 평가금액을 계산한다.
 * 순수 함수: 저장은 호출하는 쪽(upsertSnapshot)에서 담당한다.
 */
export function computeSnapshot(
  categories: Category[],
  holdings: Holding[],
  usdKrwRate: number,
  dateStr: string,
  accountId: string
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

  return { id: `${accountId}:${dateStr}`, date: dateStr, totalValueBase, byCategory, usdKrwRate, accountId };
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

/**
 * 여러 계좌의 스냅샷을 "전 계좌 합산" 자산추이로 묶는다. 계좌별로 먼저
 * aggregateMonthly()를 적용해 각 계좌의 월별 대표값을 구한 뒤, 같은 달끼리
 * 계좌 값을 더한다.
 *
 * 주의: 어떤 계좌를 그 달에 한 번도 열어보지 않았으면(스냅샷이 그 계좌에서
 * 하루도 기록되지 않았으면) 그 달의 합계에는 그 계좌 몫이 빠진다 — 계좌별
 * 스냅샷 자체가 "그 계좌를 화면에서 본 날"에만 쌓이는 구조라 생기는 자연스러운
 * 한계다.
 */
export function aggregateMonthlyAcrossAccounts(snapshots: PortfolioSnapshot[]): MonthlyPoint[] {
  const byAccount = new Map<string, PortfolioSnapshot[]>();
  for (const s of snapshots) {
    const accountId = s.accountId ?? 'unknown';
    const arr = byAccount.get(accountId) ?? [];
    arr.push(s);
    byAccount.set(accountId, arr);
  }

  const totalsByMonth = new Map<string, number>();
  for (const accountSnapshots of byAccount.values()) {
    for (const point of aggregateMonthly(accountSnapshots)) {
      totalsByMonth.set(point.month, (totalsByMonth.get(point.month) ?? 0) + point.totalValueBase);
    }
  }

  return [...totalsByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totalValueBase]) => ({ month, totalValueBase }));
}
