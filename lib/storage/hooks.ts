'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, type AppSettings } from './db';
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

export function useAppSettings(): AppSettings | undefined {
  return useLiveQuery(() => getDb().settings.get('app-settings'), [], undefined);
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

export async function addHolding(holding: Omit<Holding, 'id'>): Promise<void> {
  await getDb().holdings.add({ ...holding, id: uid('hold') });
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
