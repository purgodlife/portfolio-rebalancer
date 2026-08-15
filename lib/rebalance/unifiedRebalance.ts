import type { Account, Category, Holding } from './types';

export interface UnifiedCategoryWarning {
  categoryName: string;
  targets: { accountName: string; targetPercent: number }[];
  averagedTargetPercent: number;
}

export interface UnifiedMergeResult {
  /** 계좌 구분 없이 이름이 같은 카테고리를 하나로 합친 목록. */
  categories: Category[];
  /** 위 합친 카테고리를 가리키도록 categoryId가 재매핑된 보유종목 목록. */
  holdings: Holding[];
  /** "시장:티커" 키별로 이 종목이 걸쳐있는 계좌 이름 목록(중복 제거, 정렬됨). */
  accountsByHoldingKey: Record<string, string[]>;
  /** 같은 이름의 카테고리가 계좌마다 다른 목표비중으로 설정돼 평균값을 쓴 경우의 안내. */
  warnings: UnifiedCategoryWarning[];
  /** 정규화(100%로 재조정) 이전의 목표비중 합계. */
  rawTotalPercent: number;
}

/**
 * 여러 계좌의 카테고리·보유종목을 "전 계좌 통합 리밸런싱"용으로 하나로 합친다.
 * 순수 함수: 스토리지에 의존하지 않으며, 결과를 그대로 lib/rebalance/index.ts의
 * calculateRebalance()에 넘기면 된다(그 함수는 계좌라는 개념 자체를 모른다).
 *
 * 병합 규칙:
 * - 카테고리는 "이름"이 같으면 하나로 합친다. 계좌마다 그 이름의 목표비중이
 *   다르면(예: 계좌 A는 채권 20%, 계좌 B는 채권 30%) 평균값을 쓰고 warnings에
 *   담아 화면에 안내한다.
 * - 합친 카테고리들의 목표비중 합이 100%가 아니면 비례적으로 재조정한다.
 * - 보유종목은 "시장:티커"가 같으면 (계좌가 달라도) calculateRebalance 내부의
 *   groupHoldings()에서 자동으로 하나의 종목으로 합산된다. 이 함수는 그 종목이
 *   실제로 어느 계좌(들)에 걸쳐 있는지 accountsByHoldingKey로 알려줘서, 매수/매도
 *   추천이 여러 계좌에 걸친 경우 화면에서 안내할 수 있게 한다.
 */
export function mergeAccountsForUnifiedRebalance(
  accounts: Account[],
  categories: Category[],
  holdings: Holding[]
): UnifiedMergeResult {
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  function accountLabel(accountId: string | undefined): string {
    if (!accountId) return '-';
    return accountNameById.get(accountId) ?? accountId;
  }

  const byName = new Map<string, Category[]>();
  for (const c of categories) {
    const name = c.name.trim();
    const arr = byName.get(name) ?? [];
    arr.push(c);
    byName.set(name, arr);
  }

  const oldToNewCategoryId = new Map<string, string>();
  const warnings: UnifiedCategoryWarning[] = [];
  const rawMerged: { id: string; name: string; rawTargetPercent: number }[] = [];

  for (const [name, group] of byName) {
    const mergedId = `unified:${name}`;
    for (const c of group) oldToNewCategoryId.set(c.id, mergedId);

    const distinctTargets = Array.from(new Set(group.map((c) => c.targetPercent)));
    const averagedTargetPercent = group.reduce((s, c) => s + c.targetPercent, 0) / group.length;

    if (distinctTargets.length > 1) {
      warnings.push({
        categoryName: name,
        targets: group.map((c) => ({ accountName: accountLabel(c.accountId), targetPercent: c.targetPercent })),
        averagedTargetPercent,
      });
    }

    rawMerged.push({ id: mergedId, name, rawTargetPercent: averagedTargetPercent });
  }

  const rawTotalPercent = rawMerged.reduce((s, c) => s + c.rawTargetPercent, 0);
  const scale = rawTotalPercent > 0 ? 100 / rawTotalPercent : 1;

  const mergedCategories: Category[] = rawMerged.map((c) => ({
    id: c.id,
    name: c.name,
    targetPercent: c.rawTargetPercent * scale,
  }));

  const mergedHoldings: Holding[] = [];
  const accountsByHoldingKey = new Map<string, Set<string>>();

  for (const h of holdings) {
    const newCategoryId = oldToNewCategoryId.get(h.categoryId);
    if (!newCategoryId) continue; // 카테고리가 지워진 orphan 보유종목은 건너뜀

    mergedHoldings.push({ ...h, categoryId: newCategoryId });

    const owningCategory = categories.find((c) => c.id === h.categoryId);
    const holdingKey = `${h.market}:${h.ticker.trim().toUpperCase()}`;
    const set = accountsByHoldingKey.get(holdingKey) ?? new Set<string>();
    set.add(accountLabel(owningCategory?.accountId));
    accountsByHoldingKey.set(holdingKey, set);
  }

  const accountsByHoldingKeyObj: Record<string, string[]> = {};
  for (const [k, v] of accountsByHoldingKey) {
    accountsByHoldingKeyObj[k] = Array.from(v).sort();
  }

  return {
    categories: mergedCategories,
    holdings: mergedHoldings,
    accountsByHoldingKey: accountsByHoldingKeyObj,
    warnings,
    rawTotalPercent,
  };
}
