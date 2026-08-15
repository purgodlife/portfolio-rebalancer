import type { Category, Holding } from './types';

/**
 * "통합 자산배분"(모든 계좌가 공유하는 하나의 목표 카테고리 목록)과 각 계좌의
 * 미러 카테고리(Category.mirrorsCategoryId로 연결된, 그 계좌 소속의 사본)를
 * 동기화하는 데 필요한 순수 계산 로직.
 *
 * 왜 "미러"가 필요한가: 보유종목(Holding)은 항상 특정 계좌 소속의 카테고리
 * id를 가리켜야 한다(계좌별로 보유종목이 분리되어야 하므로). 통합 카테고리를
 * 여러 계좌가 직접 공유하게 하면 보유종목이 어느 계좌 것인지 구분할 수 없게
 * 된다. 그래서 통합 모드인 계좌마다 통합 카테고리를 그대로 복제한 "미러"
 * 카테고리를 실제로 만들어두고, 이름·비중만 통합 카테고리와 계속 맞춰준다.
 * 미러의 id는 절대 바뀌지 않으므로 거기 속한 보유종목의 연결도 끊기지 않는다.
 */

export interface MirrorSyncPlan {
  /** 아직 미러가 없는 통합 카테고리 — 이 계좌에 새로 만들어야 함 */
  toCreate: { name: string; targetPercent: number; mirrorsCategoryId: string }[];
  /** 이미 있는 미러인데 이름/비중이 원본과 달라진 것 — 값을 맞춰야 함 */
  toUpdate: { id: string; name: string; targetPercent: number }[];
  /** 원본 통합 카테고리가 삭제돼 더 이상 존재하지 않는 미러 — 정리 대상 후보
   * (실제로 지울지는 호출하는 쪽에서 보유종목 유무를 보고 판단해야 한다) */
  toRemove: string[];
}

export function planMirrorSync(unifiedCategories: Category[], accountCategories: Category[]): MirrorSyncPlan {
  const mirrorsBySourceId = new Map<string, Category>();
  for (const c of accountCategories) {
    if (c.mirrorsCategoryId) mirrorsBySourceId.set(c.mirrorsCategoryId, c);
  }

  const toCreate: MirrorSyncPlan['toCreate'] = [];
  const toUpdate: MirrorSyncPlan['toUpdate'] = [];

  for (const u of unifiedCategories) {
    const mirror = mirrorsBySourceId.get(u.id);
    if (!mirror) {
      toCreate.push({ name: u.name, targetPercent: u.targetPercent, mirrorsCategoryId: u.id });
      continue;
    }
    if (mirror.name !== u.name || mirror.targetPercent !== u.targetPercent) {
      toUpdate.push({ id: mirror.id, name: u.name, targetPercent: u.targetPercent });
    }
  }

  const unifiedIds = new Set(unifiedCategories.map((u) => u.id));
  const toRemove = accountCategories
    .filter((c) => c.mirrorsCategoryId && !unifiedIds.has(c.mirrorsCategoryId))
    .map((c) => c.id);

  return { toCreate, toUpdate, toRemove };
}

export interface UnifiedCategoryRemovalImpact {
  /** 이 통합 카테고리를 미러링하고 있던, 여러 계좌에 흩어진 미러 카테고리 id들 */
  mirrorCategoryIds: string[];
  /** 그 미러 카테고리들에 속해 있어 함께 삭제될 보유종목 수(모든 계좌 합산) */
  holdingsAtRiskCount: number;
}

/**
 * 통합 카테고리 하나를 삭제하면 그걸 미러링하던 모든 계좌의 카테고리(및 그
 * 안의 보유종목)가 함께 삭제된다 — 계좌 하나만의 문제가 아니라 여러 계좌에
 * 걸쳐 영향이 퍼지므로, 실행 전에 정확히 몇 개가 위험한지 계산해서 사용자
 * 확인을 받아야 한다.
 */
export function computeUnifiedCategoryRemovalImpact(
  unifiedCategoryId: string,
  allCategories: Category[],
  allHoldings: Holding[]
): UnifiedCategoryRemovalImpact {
  const mirrorCategoryIds = allCategories
    .filter((c) => c.mirrorsCategoryId === unifiedCategoryId)
    .map((c) => c.id);
  const mirrorIdSet = new Set(mirrorCategoryIds);
  const holdingsAtRiskCount = allHoldings.filter((h) => mirrorIdSet.has(h.categoryId)).length;
  return { mirrorCategoryIds, holdingsAtRiskCount };
}
