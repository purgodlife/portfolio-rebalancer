import { groupHoldings, groupToHolding } from '@/lib/rebalance/grouping';
import type { Category, Holding } from '@/lib/rebalance/types';

export interface StructuralRiskItem {
  id: string;
  label: string;
  valueBase: number;
  weightPercent: number;
}

export interface StructuralRisk {
  totalValueBase: number;
  byHolding: StructuralRiskItem[];
  byCategory: StructuralRiskItem[];
  byCurrency: StructuralRiskItem[];
  byMarket: StructuralRiskItem[];
  /**
   * 허핀달-허쉬만 지수(HHI): 각 비중(0~1)을 제곱해서 합산한 값. 1에 가까울수록
   * 소수 종목/카테고리에 몰려 있고, 1/n(n=보유 종목 수)에 가까울수록 고르게
   * 분산되어 있다는 뜻이다. 미국 증권거래위원회(SEC)·반독점 심사 등에서도
   * 쓰이는 표준적인 집중도 지표를 포트폴리오 비중에 그대로 적용한 것이다.
   */
  holdingHHI: number;
  categoryHHI: number;
  topHoldingWeightPercent: number;
  top3WeightPercent: number;
}

function toBase(h: Holding, usdKrwRate: number): number {
  return h.currency === 'USD' ? h.currentPrice * h.quantity * usdKrwRate : h.currentPrice * h.quantity;
}

function hhi(items: StructuralRiskItem[]): number {
  return items.reduce((sum, it) => sum + (it.weightPercent / 100) ** 2, 0);
}

export function computeStructuralRisk(categories: Category[], holdings: Holding[], usdKrwRate: number): StructuralRisk {
  const groups = groupHoldings(holdings)
    .map(groupToHolding)
    .filter((h) => h.quantity > 0);

  const totalValueBase = groups.reduce((s, h) => s + toBase(h, usdKrwRate), 0);
  const weight = (v: number) => (totalValueBase > 0 ? (v / totalValueBase) * 100 : 0);

  const byHolding: StructuralRiskItem[] = groups
    .map((h) => {
      const valueBase = toBase(h, usdKrwRate);
      return { id: `${h.market}:${h.ticker}`, label: `${h.ticker} (${h.name})`, valueBase, weightPercent: weight(valueBase) };
    })
    .sort((a, b) => b.valueBase - a.valueBase);

  function bucket(keyFn: (h: Holding) => string, labelFn: (id: string) => string): StructuralRiskItem[] {
    const map = new Map<string, number>();
    for (const h of groups) {
      const key = keyFn(h);
      map.set(key, (map.get(key) ?? 0) + toBase(h, usdKrwRate));
    }
    return [...map.entries()]
      .map(([id, valueBase]) => ({ id, label: labelFn(id), valueBase, weightPercent: weight(valueBase) }))
      .sort((a, b) => b.valueBase - a.valueBase);
  }

  const byCategory = bucket(
    (h) => h.categoryId,
    (id) => categories.find((c) => c.id === id)?.name ?? id
  );
  const byCurrency = bucket(
    (h) => h.currency,
    (id) => id
  );
  const byMarket = bucket(
    (h) => h.market,
    (id) => id
  );

  return {
    totalValueBase,
    byHolding,
    byCategory,
    byCurrency,
    byMarket,
    holdingHHI: hhi(byHolding),
    categoryHHI: hhi(byCategory),
    topHoldingWeightPercent: byHolding[0]?.weightPercent ?? 0,
    top3WeightPercent: byHolding.slice(0, 3).reduce((s, it) => s + it.weightPercent, 0),
  };
}
