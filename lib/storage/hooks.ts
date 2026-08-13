'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, type AppSettings, type PortfolioSnapshot, type WatchlistItem } from './db';
import type { Category, Holding } from '@/lib/rebalance/types';

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useCategories(): Category[] {
  return useLiveQuery(() => getDb().categories.toArray(), [], []) ?? [];
}

export function useHoldings(): Holding[] {
  return useLiveQuery(() => getDb().holdings.toArray(), [], []) ?? [];
}

/**
 * settings 레코드가 아직 하나도 없는 최초 실행 상태와, 쿼리가 아직 로딩 중인 상태를
 * 구분하기 위해 배열 형태로 조회한다 (toArray()는 로딩이 끝나면 빈 배열이라도 항상
 * 반환하므로, "로딩 중" 기본값 undefined와 확실히 구분된다).
 */
export function useAppSettings(): { settings: AppSettings | undefined; isLoading: boolean } {
  const list = useLiveQuery(() => getDb().settings.toArray(), [], undefined);
  return { settings: list?.[0], isLoading: list === undefined };
}

export async function setDisclaimerAgreed(): Promise<void> {
  const db = getDb();
  const existing = await db.settings.get('app-settings');
  await db.settings.put({
    id: 'app-settings',
    locale: existing?.locale ?? 'ko',
    hasAgreedToDisclaimer: true,
    disclaimerAgreedAt: new Date().toISOString(),
  });
}

/**
 * 카테고리 관련 함수들은 입력값을 그대로 저장한다 (자동으로 비율을 조정하지
 * 않음). 합계가 100%가 아니면 UI에서 경고만 보여주고, 계산기 사용은 막는다.
 */
export async function addCategory(name: string, targetPercent: number): Promise<void> {
  await getDb().categories.add({ id: uid('cat'), name, targetPercent });
}

export async function updateCategory(category: Category): Promise<void> {
  await getDb().categories.put(category);
}

export async function removeCategory(id: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.categories, db.holdings, async () => {
    await db.categories.delete(id);
    await db.holdings.where('categoryId').equals(id).delete();
  });
}

export async function addHolding(holding: Omit<Holding, 'id' | 'createdAt'>): Promise<void> {
  await getDb().holdings.add({ ...holding, id: uid('hold'), createdAt: Date.now() });
}

export async function updateHolding(holding: Holding): Promise<void> {
  await getDb().holdings.put(holding);
}

export async function removeHolding(id: string): Promise<void> {
  await getDb().holdings.delete(id);
}

const DEFAULT_CATEGORIES: Array<Omit<Category, 'id'>> = [
  { name: '채권', targetPercent: 20 },
  { name: 'S&P500', targetPercent: 30 },
  { name: '기타지수', targetPercent: 40 },
  { name: '개별주식', targetPercent: 10 },
];

/** 최초 실행 시(카테고리가 하나도 없을 때) 예시 자산배분을 시드로 넣어준다. */
export async function seedDefaultCategoriesIfEmpty(): Promise<void> {
  const db = getDb();
  const count = await db.categories.count();
  if (count > 0) return;
  await db.categories.bulkAdd(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uid('cat') }))
  );
}

/**
 * 월별 자산추이 화면에서 쓰는 일별 스냅샷(하루 1건, 같은 날 다시 방문하면 최신값으로 덮어씀).
 * 과거 시세 데이터를 별도로 구하지 않고, 방문할 때마다 "그 시점의 평가금액"을 그대로 남겨서
 * 시간이 지나며 자연스럽게 추이가 쌓이게 한다.
 */
export function useSnapshots(): PortfolioSnapshot[] {
  return useLiveQuery(() => getDb().snapshots.orderBy('date').toArray(), [], []) ?? [];
}

export async function upsertSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  await getDb().snapshots.put(snapshot);
}


/**
 * 관심종목(워치리스트) — 보유하지 않은 종목도 자유롭게 추가/삭제하면서 현재가만
 * 확인하고 싶을 때 쓴다. 매수가/수량이 없으므로 리밸런싱 계산에는 전혀 관여하지 않는다.
 */
export function useWatchlist(): WatchlistItem[] {
  return useLiveQuery(() => getDb().watchlist.toArray(), [], []) ?? [];
}

export async function addWatchlistItem(item: Omit<WatchlistItem, 'id'>): Promise<void> {
  await getDb().watchlist.add({ ...item, id: uid('watch') });
}

export async function removeWatchlistItem(id: string): Promise<void> {
  await getDb().watchlist.delete(id);
}
