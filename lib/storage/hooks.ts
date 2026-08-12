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

function roundPercent(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 반올림 오차로 합계가 100.0에서 살짝 벗어나면 마지막 항목에서 흡수해 보정한다. */
function fixDrift(cats: Category[]): Category[] {
  if (cats.length === 0) return cats;
  const sum = cats.reduce((s, c) => s + c.targetPercent, 0);
  const drift = roundPercent(100 - sum);
  if (Math.abs(drift) < 0.001) return cats;
  const result = [...cats];
  const last = result[result.length - 1];
  result[result.length - 1] = { ...last, targetPercent: roundPercent(last.targetPercent + drift) };
  return result;
}

/**
 * changedId의 비중을 newPercent(0~100로 clamp)로 고정하고, 나머지 카테고리는
 * 기존 비율을 유지한 채 남는 비중(100 - newPercent)에 맞춰 비례 축소/확대한다.
 * 결과 합계는 항상 정확히 100.0%.
 */
function redistributePercents(
  categories: Category[],
  changedId: string,
  rawNewPercent: number
): Category[] {
  const changed = categories.find((c) => c.id === changedId);
  if (!changed) return categories;

  const others = categories.filter((c) => c.id !== changedId);
  const clampedNew = roundPercent(Math.max(0, Math.min(100, rawNewPercent)));
  const othersOldSum = others.reduce((s, c) => s + c.targetPercent, 0);
  const othersNewSum = 100 - clampedNew;

  let newOthers: Category[];
  if (others.length === 0) {
    newOthers = [];
  } else if (othersOldSum <= 0.001) {
    const even = roundPercent(othersNewSum / others.length);
    newOthers = others.map((c) => ({ ...c, targetPercent: even }));
  } else {
    const scale = othersNewSum / othersOldSum;
    newOthers = others.map((c) => ({
      ...c,
      targetPercent: roundPercent(Math.max(0, c.targetPercent * scale)),
    }));
  }

  const changedIdx = categories.findIndex((c) => c.id === changedId);
  const result = [...categories];
  others.forEach((o, i) => {
    const idx = result.findIndex((c) => c.id === o.id);
    result[idx] = newOthers[i];
  });
  result[changedIdx] = { ...changed, targetPercent: clampedNew };

  return fixDrift(result);
}

/** 나머지 카테고리를 기존 비율 그대로 유지하면서 합계가 100%가 되도록 비례 확대/축소한다. */
function normalizeToHundred(categories: Category[]): Category[] {
  if (categories.length === 0) return categories;
  const sum = categories.reduce((s, c) => s + c.targetPercent, 0);
  if (sum <= 0.001) {
    const even = roundPercent(100 / categories.length);
    return fixDrift(categories.map((c) => ({ ...c, targetPercent: even })));
  }
  const scale = 100 / sum;
  return fixDrift(categories.map((c) => ({ ...c, targetPercent: roundPercent(c.targetPercent * scale) })));
}

/** 카테고리 이름만 변경 (비중에는 영향 없음). */
export async function renameCategory(id: string, name: string): Promise<void> {
  const db = getDb();
  const cat = await db.categories.get(id);
  if (!cat) return;
  await db.categories.put({ ...cat, name });
}

/**
 * 카테고리 비중을 변경한다. 항상 전체 합계가 100.0%를 넘지 않고 정확히 100.0%를
 * 유지하도록 다른 카테고리들을 기존 비율대로 자동 조정한다.
 */
export async function setCategoryPercent(id: string, newPercent: number): Promise<void> {
  const db = getDb();
  const all = await db.categories.toArray();
  const updated = redistributePercents(all, id, newPercent);
  await db.categories.bulkPut(updated);
}

/**
 * 새 카테고리를 desiredPercent 비중으로 추가한다. 기존 카테고리들에서 비례적으로
 * 비중을 덜어와 채우므로, 추가 이후에도 전체 합계는 항상 100.0%로 유지된다.
 */
export async function addCategoryBalanced(name: string, desiredPercent: number): Promise<void> {
  const db = getDb();
  const existing = await db.categories.toArray();
  const newCat: Category = { id: uid('cat'), name, targetPercent: 0 };
  const all = [...existing, newCat];
  const updated = redistributePercents(all, newCat.id, desiredPercent);
  await db.categories.bulkPut(updated);
}

/**
 * 카테고리를 삭제하고, 남은 카테고리들의 비중을 기존 비율 그대로 유지하면서
 * 합계가 다시 100.0%가 되도록 비례 확대한다.
 */
export async function removeCategoryBalanced(id: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.categories, db.holdings, async () => {
    const all = await db.categories.toArray();
    const remaining = all.filter((c) => c.id !== id);
    await db.categories.delete(id);
    await db.holdings.where('categoryId').equals(id).delete();
    if (remaining.length > 0) {
      await db.categories.bulkPut(normalizeToHundred(remaining));
    }
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
