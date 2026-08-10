import { allocateBuyOnly, allocateExact, distributeWithinGroup } from './allocate';
import type {
  Category,
  CategoryResult,
  Currency,
  Holding,
  HoldingAction,
  RebalanceInput,
  RebalanceResult,
} from './types';

export * from './types';

function toBase(amount: number, currency: Currency, usdKrwRate: number): number {
  return currency === 'USD' ? amount * usdKrwRate : amount;
}

function fromBase(amountBase: number, currency: Currency, usdKrwRate: number): number {
  return currency === 'USD' ? amountBase / usdKrwRate : amountBase;
}

function holdingValueBase(h: Holding, usdKrwRate: number): number {
  return toBase(h.currentPrice * h.quantity, h.currency, usdKrwRate);
}

/**
 * 입금액(및 선택적으로 매도)을 목표 자산배분에 맞춰 카테고리별/종목별로 배분한다.
 * 순수 함수: 외부 상태(스토리지, 네트워크)에 의존하지 않는다.
 */
export function calculateRebalance(input: RebalanceInput): RebalanceResult {
  const { categories, holdings, depositAmount, depositCurrency, usdKrwRate, allowSell } = input;

  const depositBase = toBase(depositAmount, depositCurrency, usdKrwRate);
  const totalTargetPercent = categories.reduce((s, c) => s + c.targetPercent, 0) || 1;

  const holdingsByCategory = new Map<string, Holding[]>();
  for (const h of holdings) {
    const arr = holdingsByCategory.get(h.categoryId) ?? [];
    arr.push(h);
    holdingsByCategory.set(h.categoryId, arr);
  }

  const categoryCurrentValues = categories.map((c) => {
    const hs = holdingsByCategory.get(c.id) ?? [];
    return hs.reduce((s, h) => s + holdingValueBase(h, usdKrwRate), 0);
  });

  const totalValueBeforeBase = categoryCurrentValues.reduce((s, v) => s + v, 0);

  const weightedCategories = categories.map((c, idx) => ({
    id: c.id,
    currentValue: categoryCurrentValues[idx],
    weight: c.targetPercent / totalTargetPercent,
  }));

  const categoryDiffs = allowSell
    ? allocateExact(weightedCategories, depositBase)
    : allocateBuyOnly(weightedCategories, depositBase);

  const diffById = new Map(categoryDiffs.map((d) => [d.id, d.diff]));

  const totalValueAfterBase = totalValueBeforeBase + depositBase;

  const categoryResults: CategoryResult[] = categories.map((c, idx) => {
    const currentValueBase = categoryCurrentValues[idx];
    const diffBase = diffById.get(c.id) ?? 0;
    const projectedValueBase = currentValueBase + diffBase;
    return {
      categoryId: c.id,
      name: c.name,
      currentValueBase,
      currentPercent: totalValueBeforeBase > 0 ? (currentValueBase / totalValueBeforeBase) * 100 : 0,
      targetPercent: c.targetPercent,
      targetValueBase: (c.targetPercent / totalTargetPercent) * totalValueAfterBase,
      diffBase,
      projectedValueBase,
      projectedPercent: totalValueAfterBase > 0 ? (projectedValueBase / totalValueAfterBase) * 100 : 0,
    };
  });

  const actions: HoldingAction[] = [];
  for (const c of categories) {
    const hs = holdingsByCategory.get(c.id) ?? [];
    if (hs.length === 0) continue;
    const changeAmount = diffById.get(c.id) ?? 0;
    const groupItems = hs.map((h) => ({ id: h.id, currentValue: holdingValueBase(h, usdKrwRate) }));
    const withinDiffs = distributeWithinGroup(groupItems, changeAmount);
    const diffMap = new Map(withinDiffs.map((d) => [d.id, d.diff]));

    for (const h of hs) {
      const diffBase = diffMap.get(h.id) ?? 0;
      if (Math.abs(diffBase) < 1) {
        actions.push({
          holdingId: h.id,
          ticker: h.ticker,
          name: h.name,
          categoryId: h.categoryId,
          currency: h.currency,
          action: 'hold',
          amountInHoldingCurrency: 0,
          amountInBaseCurrency: 0,
          approxShares: 0,
        });
        continue;
      }
      const action = diffBase > 0 ? 'buy' : 'sell';
      const amountInBaseCurrency = Math.abs(diffBase);
      const amountInHoldingCurrency = fromBase(amountInBaseCurrency, h.currency, usdKrwRate);
      actions.push({
        holdingId: h.id,
        ticker: h.ticker,
        name: h.name,
        categoryId: h.categoryId,
        currency: h.currency,
        action,
        amountInHoldingCurrency,
        amountInBaseCurrency,
        approxShares: h.currentPrice > 0 ? amountInHoldingCurrency / h.currentPrice : 0,
      });
    }
  }

  const allocatedTotal = categoryDiffs.reduce((s, d) => s + d.diff, 0);
  const unallocatedCashBase = depositBase - allocatedTotal;

  return {
    baseCurrency: 'KRW',
    totalValueBeforeBase,
    totalValueAfterBase,
    depositBase,
    categories: categoryResults,
    actions,
    unallocatedCashBase,
  };
}

export function validateCategories(categories: Category[]): { valid: boolean; totalPercent: number } {
  const totalPercent = categories.reduce((s, c) => s + c.targetPercent, 0);
  return { valid: Math.abs(totalPercent - 100) < 0.01, totalPercent };
}
