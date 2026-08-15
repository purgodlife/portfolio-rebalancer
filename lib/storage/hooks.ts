'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { getDb, type AppSettings, type PortfolioSnapshot, type WatchlistItem } from './db';
import { DEFAULT_ACCOUNT_ID, useSelectedAccountId } from './accountContext';
import {
  planMirrorSync,
  computeUnifiedCategoryRemovalImpact,
  type UnifiedCategoryRemovalImpact,
} from '@/lib/rebalance/unifiedAllocationSync';
import type { Account, AccountType, Category, Holding } from '@/lib/rebalance/types';

/**
 * "통합 자산배분" 카테고리들이 소속되는 특수 accountId. 실제 계좌 테이블에는
 * 이 id를 가진 계좌가 존재하지 않는다 — 여러 계좌가 공유하는 목표 카테고리
 * 목록을 나타내는 용도로만 쓰인다(lib/rebalance/unifiedAllocationSync.ts 참고).
 */
export const UNIFIED_ALLOCATION_ACCOUNT_ID = 'unified';

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** accountId가 없는(계좌 기능 도입 전) 기존 데이터는 기본 계좌 소속으로 취급한다. */
function resolveAccountId(accountId: string | undefined): string {
  return accountId ?? DEFAULT_ACCOUNT_ID;
}

/**
 * 이 계좌가 "통합 자산배분"을 따르는지(true) 아니면 자기만의 카테고리를 쓰는
 * "개별 모드"인지(false). useIndividualAllocation이 명시적으로 false로
 * 저장된 계좌만 통합 모드다 — undefined(필드가 아직 없는 기존 계좌)나 true는
 * 모두 개별 모드로 취급해서, 마이그레이션이 아직 실행되지 않은 짧은 순간에도
 * 기존 사용자의 카테고리가 실수로 안 보이는 일이 없게 한다.
 */
export function isUnifiedAllocationAccount(account: Account | undefined): boolean {
  return account?.useIndividualAllocation === false;
}

// ── 계좌(포트폴리오) ──────────────────────────────────────────────────────

export function useAccounts(): Account[] {
  return useLiveQuery(() => getDb().accounts.toArray(), [], []) ?? [];
}

/** 새로 만드는 계좌는 기본적으로 통합 자산배분을 따른다(개별 모드는 사용자가 나중에 직접 켜야 함). */
export async function addAccount(name: string, type: AccountType): Promise<string> {
  const id = uid('acc');
  await getDb().accounts.add({ id, name, type, useIndividualAllocation: false });
  await syncAccountMirrors(id);
  return id;
}

export async function updateAccount(account: Account): Promise<void> {
  await getDb().accounts.put(account);
}

/** 계좌를 지우면 그 계좌에 속한 카테고리·보유종목도 함께 지워진다(연쇄 삭제). */
export async function removeAccount(id: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.accounts, db.categories, db.holdings, async () => {
    const allCategories = await db.categories.toArray();
    const categoryIds = allCategories
      .filter((c) => resolveAccountId(c.accountId) === id)
      .map((c) => c.id);
    if (categoryIds.length > 0) {
      await db.holdings.where('categoryId').anyOf(categoryIds).delete();
      await db.categories.bulkDelete(categoryIds);
    }
    await db.accounts.delete(id);
  });
}

/** 최초 실행 시(계좌가 하나도 없을 때) "기본 계좌"를 시드로 넣어준다. */
export async function seedDefaultAccountIfEmpty(): Promise<void> {
  const db = getDb();
  const count = await db.accounts.count();
  if (count > 0) return;
  await db.accounts.add({
    id: DEFAULT_ACCOUNT_ID,
    name: '기본 계좌',
    type: 'general',
    useIndividualAllocation: false,
  });
}

// ── 카테고리(자산배분) — 현재 선택된 계좌 소속만 보여준다 ───────────────────

/**
 * 현재 선택된 계좌가 개별 모드면 그 계좌 자신의 카테고리(미러가 아닌 것)를,
 * 통합 모드(기본값)면 통합 자산배분을 그대로 미러링한 카테고리만 반환한다.
 * 계좌 전환 시 두 종류가 섞여 보이지 않도록 항상 둘 중 하나만 반환한다.
 */
export function useCategories(): Category[] {
  const selectedAccountId = useSelectedAccountId();
  const accounts = useAccounts();
  const all = useLiveQuery(() => getDb().categories.toArray(), [], []) ?? [];
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const unified = isUnifiedAllocationAccount(selectedAccount);
  return all.filter(
    (c) =>
      resolveAccountId(c.accountId) === selectedAccountId && (unified ? !!c.mirrorsCategoryId : !c.mirrorsCategoryId)
  );
}

/**
 * 실제 계좌에 속한 카테고리(개별 카테고리 + 통합 자산배분을 미러링한 카테고리)를
 * 모두 반환한다. "통합 자산배분" 자체의 원본 카테고리(accountId가
 * UNIFIED_ALLOCATION_ACCOUNT_ID인 행)는 어느 계좌에도 속하지 않으므로 제외한다
 * — 보유종목을 다른 계좌로 옮길 때 "어느 계좌의 어느 카테고리로 옮길지" 선택지를
 * 만드는 용도 등에 쓰이는데, 원본 통합 카테고리는 보유종목이 직접 가리켜서는
 * 안 되는 값이기 때문이다.
 */
export function useAllCategories(): Category[] {
  const all = useLiveQuery(() => getDb().categories.toArray(), [], []) ?? [];
  return all.filter((c) => resolveAccountId(c.accountId) !== UNIFIED_ALLOCATION_ACCOUNT_ID);
}

/** 통합 자산배분의 원본 카테고리 목록(모든 계좌가 공유하는 목표표). */
export function useUnifiedCategories(): Category[] {
  const all = useLiveQuery(() => getDb().categories.toArray(), [], []) ?? [];
  return all.filter((c) => c.accountId === UNIFIED_ALLOCATION_ACCOUNT_ID);
}

/** 카테고리 관련 함수들은 입력값을 그대로 저장한다(자동으로 비율을 조정하지 않음). */
export async function addCategory(name: string, targetPercent: number, accountId: string): Promise<void> {
  await getDb().categories.add({ id: uid('cat'), name, targetPercent, accountId });
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

/**
 * 다른 계좌의 카테고리(이름+목표비중)를 이 계좌로 복사하면서, 이 계좌에
 * 기존에 있던 카테고리는 모두 지운다(교체). 자산배분을 다른 계좌 기준으로
 * 새로 맞출 때 쓴다.
 *
 * 보유종목 보호: 기존 카테고리를 무작정 지우면 거기 속한 보유종목도 함께
 * 지워지므로(카테고리 삭제는 항상 연쇄삭제), 기존 카테고리와 "이름이 같은"
 * 카테고리가 복사해오는 목록에도 있으면 그 보유종목을 새 카테고리로 옮겨서
 * 살린다. 이름이 다른(=복사해오는 계좌에는 없는) 카테고리에 속한 보유종목은
 * 카테고리와 함께 삭제된다 — 호출하는 쪽(UI)에서 실행 전에 몇 개나 지워지는지
 * 미리 계산해서 사용자에게 확인받아야 한다.
 */
export async function replaceCategoriesFromAccount(sourceAccountId: string, targetAccountId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.categories, db.holdings, async () => {
    const allCategories = await db.categories.toArray();
    const sourceCategories = allCategories.filter((c) => resolveAccountId(c.accountId) === sourceAccountId);
    const targetCategories = allCategories.filter((c) => resolveAccountId(c.accountId) === targetAccountId);

    // 1) 소스 카테고리를 새 id로 이 계좌에 추가한다.
    const nameToNewId = new Map<string, string>();
    for (const sc of sourceCategories) {
      const newId = uid('cat');
      const name = sc.name.trim();
      nameToNewId.set(name, newId);
      await db.categories.add({ id: newId, name, targetPercent: sc.targetPercent, accountId: targetAccountId });
    }

    // 2) 기존 카테고리를 지우되, 이름이 같은 새 카테고리가 있으면 그 보유종목을
    //    옮겨서 살리고, 없으면 보유종목도 함께 지운다.
    for (const oc of targetCategories) {
      const newId = nameToNewId.get(oc.name.trim());
      const holdingsInCategory = await db.holdings.where('categoryId').equals(oc.id).toArray();
      if (newId) {
        for (const h of holdingsInCategory) {
          await db.holdings.put({ ...h, categoryId: newId });
        }
      } else {
        await db.holdings.where('categoryId').equals(oc.id).delete();
      }
      await db.categories.delete(oc.id);
    }
  });
}

// ── 통합 자산배분(모든 계좌가 공유하는 목표표) ──────────────────────────────

export async function addUnifiedCategory(name: string, targetPercent: number): Promise<void> {
  await getDb().categories.add({ id: uid('cat'), name, targetPercent, accountId: UNIFIED_ALLOCATION_ACCOUNT_ID });
  await syncAllUnifiedMirrors();
}

export async function updateUnifiedCategory(category: Category): Promise<void> {
  await getDb().categories.put(category);
  await syncAllUnifiedMirrors();
}

/**
 * 통합 카테고리 하나를 지우면 그걸 미러링하던 모든 계좌의 카테고리(및 그 안의
 * 보유종목)가 함께 지워진다. 실제로 지우기 전에 이 함수로 몇 개의 계좌·보유종목이
 * 영향받는지 미리 계산해서 사용자에게 확인받아야 한다.
 */
export async function getUnifiedCategoryRemovalImpact(categoryId: string): Promise<UnifiedCategoryRemovalImpact> {
  const db = getDb();
  const [allCategories, allHoldings] = await Promise.all([db.categories.toArray(), db.holdings.toArray()]);
  return computeUnifiedCategoryRemovalImpact(categoryId, allCategories, allHoldings);
}

export async function removeUnifiedCategory(categoryId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.categories, db.holdings, async () => {
    const allCategories = await db.categories.toArray();
    const mirrorIds = allCategories.filter((c) => c.mirrorsCategoryId === categoryId).map((c) => c.id);
    if (mirrorIds.length > 0) {
      await db.holdings.where('categoryId').anyOf(mirrorIds).delete();
      await db.categories.bulkDelete(mirrorIds);
    }
    await db.categories.delete(categoryId);
  });
}

/**
 * 이 계좌의 미러 카테고리를 통합 자산배분과 맞춘다(부족하면 새로 만들고,
 * 이름·비중이 달라졌으면 갱신한다). 원본이 지워진 미러는 여기서 자동으로
 * 지우지 않는다 — 보유종목이 딸려있을 수 있어 항상 removeUnifiedCategory()의
 * 확인 절차를 거쳐야 안전하다.
 */
export async function syncAccountMirrors(accountId: string): Promise<void> {
  const db = getDb();
  const allCategories = await db.categories.toArray();
  const unifiedCategories = allCategories.filter((c) => c.accountId === UNIFIED_ALLOCATION_ACCOUNT_ID);
  const accountCategories = allCategories.filter((c) => resolveAccountId(c.accountId) === accountId);
  const plan = planMirrorSync(unifiedCategories, accountCategories);

  if (plan.toCreate.length === 0 && plan.toUpdate.length === 0) return;

  await db.transaction('rw', db.categories, async () => {
    for (const c of plan.toCreate) {
      await db.categories.add({
        id: uid('cat'),
        name: c.name,
        targetPercent: c.targetPercent,
        accountId,
        mirrorsCategoryId: c.mirrorsCategoryId,
      });
    }
    for (const u of plan.toUpdate) {
      const existing = accountCategories.find((c) => c.id === u.id);
      if (existing) {
        await db.categories.put({ ...existing, name: u.name, targetPercent: u.targetPercent });
      }
    }
  });
}

/** 통합 모드인 모든 계좌의 미러 카테고리를 통합 자산배분과 맞춘다. */
export async function syncAllUnifiedMirrors(): Promise<void> {
  const accounts = await getDb().accounts.toArray();
  for (const a of accounts) {
    if (isUnifiedAllocationAccount(a)) {
      await syncAccountMirrors(a.id);
    }
  }
}

/** 계좌를 개별 모드로 전환하거나(true) 통합 모드로 되돌린다(false). 통합 모드로
 * 전환하면 그 즉시 통합 자산배분을 미러링해 카테고리가 비어 보이지 않게 한다. */
export async function setAccountAllocationMode(accountId: string, useIndividualAllocation: boolean): Promise<void> {
  const db = getDb();
  const account = await db.accounts.get(accountId);
  if (!account) return;
  await db.accounts.put({ ...account, useIndividualAllocation });
  if (!useIndividualAllocation) {
    await syncAccountMirrors(accountId);
  }
}

/**
 * 이 기능이 추가되기 전부터 있던 계좌(useIndividualAllocation 필드가 아직 없는
 * 계좌)를 명시적으로 개별 모드(true)로 고정한다. 이렇게 저장해두지 않아도
 * isUnifiedAllocationAccount()가 undefined를 개별 모드로 취급하긴 하지만,
 * 값을 명시적으로 남겨두면 "왜 이 계좌는 통합을 안 따르지"를 나중에 헷갈리지
 * 않는다. 앱 시작 시 1회 실행되며, 이미 값이 있는 계좌는 건드리지 않는다.
 */
export async function migrateExistingAccountsToIndividualAllocation(): Promise<void> {
  const db = getDb();
  const accounts = await db.accounts.toArray();
  for (const a of accounts) {
    if (a.useIndividualAllocation === undefined) {
      await db.accounts.put({ ...a, useIndividualAllocation: true });
    }
  }
}

// ── 보유종목 — 현재 선택된 계좌에 속한 카테고리의 종목만 보여준다 ───────────

export function useHoldings(): Holding[] {
  const categories = useCategories();
  const categoryIds = new Set(categories.map((c) => c.id));
  const all = useLiveQuery(() => getDb().holdings.toArray(), [], []) ?? [];
  return all.filter((h) => categoryIds.has(h.categoryId));
}

/**
 * 계좌 구분 없이 모든 보유종목을 반환한다. "전 계좌 통합 리밸런싱" 모드에서
 * lib/rebalance/unifiedRebalance.ts의 mergeAccountsForUnifiedRebalance()에
 * 넘길 원본 데이터를 만드는 용도로만 쓴다.
 */
export function useAllHoldings(): Holding[] {
  return useLiveQuery(() => getDb().holdings.toArray(), [], []) ?? [];
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

/**
 * 여러 보유종목(같은 종목의 매수/매도 내역들)을 한꺼번에 다른 카테고리로
 * 옮긴다. 카테고리는 계좌에 속해있으므로, 다른 계좌의 카테고리를 고르면
 * 그 보유종목이 통째로 다른 계좌로 이동한 것과 같은 효과가 난다.
 */
export async function moveHoldingsToCategory(holdingIds: string[], categoryId: string): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.holdings, async () => {
    for (const id of holdingIds) {
      const holding = await db.holdings.get(id);
      if (holding) {
        await db.holdings.put({ ...holding, categoryId });
      }
    }
  });
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

const DEFAULT_CATEGORIES: Array<Omit<Category, 'id' | 'accountId'>> = [
  { name: '채권', targetPercent: 20 },
  { name: 'S&P500', targetPercent: 30 },
  { name: '기타지수', targetPercent: 40 },
  { name: '개별주식', targetPercent: 10 },
];

/**
 * 최초 실행 시(카테고리가 하나도 없을 때) 예시 자산배분을 통합 자산배분으로
 * 시드로 넣어준다(개별 계좌가 아니라 통합 쪽에 넣는 이유: 새로 만드는 계좌는
 * 기본적으로 통합 모드이므로, 여기에 넣어야 기본 계좌에도 곧바로 미러링된다 —
 * syncAllUnifiedMirrors() 호출과 짝을 이룬다).
 */
export async function seedDefaultCategoriesIfEmpty(): Promise<void> {
  const db = getDb();
  const count = await db.categories.count();
  if (count > 0) return;
  await db.categories.bulkAdd(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uid('cat'), accountId: UNIFIED_ALLOCATION_ACCOUNT_ID }))
  );
}

/**
 * 월별 자산추이 화면에서 쓰는 일별 스냅샷(계좌마다 하루 1건, 같은 날 다시 방문하면
 * 최신값으로 덮어씀). 과거 시세 데이터를 별도로 구하지 않고, 방문할 때마다
 * "그 시점의 평가금액"을 그대로 남겨서 시간이 지나며 자연스럽게 추이가 쌓이게 한다.
 */
export function useSnapshots(): PortfolioSnapshot[] {
  const selectedAccountId = useSelectedAccountId();
  const all = useLiveQuery(() => getDb().snapshots.orderBy('date').toArray(), [], []) ?? [];
  return all.filter((s) => resolveAccountId(s.accountId) === selectedAccountId);
}

/**
 * 계좌 구분 없이 모든 스냅샷을 반환한다. "전 계좌 합산" 자산추이 화면에서
 * lib/rebalance/snapshot.ts의 aggregateMonthlyAcrossAccounts()에 넘길 용도로만 쓴다.
 */
export function useAllSnapshots(): PortfolioSnapshot[] {
  return useLiveQuery(() => getDb().snapshots.orderBy('date').toArray(), [], []) ?? [];
}

export async function upsertSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  await getDb().snapshots.put(snapshot);
}

// ── 관심종목(워치리스트) ─────────────────────────────────────────────────
// 보유하지 않은 종목도 자유롭게 추가/삭제하면서 현재가만 확인하고 싶을 때 쓴다.
// 매수가/수량이 없으므로 리밸런싱 계산에는 전혀 관여하지 않고, 계좌 구분도 없다
// (관심종목은 계좌와 무관하게 하나의 목록으로 관리).

export function useWatchlist(): WatchlistItem[] {
  return useLiveQuery(() => getDb().watchlist.toArray(), [], []) ?? [];
}

export async function addWatchlistItem(item: Omit<WatchlistItem, 'id'>): Promise<void> {
  await getDb().watchlist.add({ ...item, id: uid('watch') });
}

export async function removeWatchlistItem(id: string): Promise<void> {
  await getDb().watchlist.delete(id);
}
