import { lotCreatedAt } from './lotTime';
import type { Holding, Market } from './types';

/**
 * 같은 티커(같은 시장)로 여러 번 나눠 입력한 매수/매도 기록(lot)을 하나의
 * 종목으로 합산한다. 화면에는 이 합산 결과(평단가/순보유수량)를 기본으로
 * 보여주고, 필요할 때만 펼쳐서 개별 매수/매도 내역(lots)을 볼 수 있게 한다.
 */
export interface HoldingGroup {
  /** market:ticker 조합의 고유 키 */
  key: string;
  ticker: string;
  name: string;
  market: Market;
  currency: Holding['currency'];
  categoryId: string;
  currentPrice: number;
  /** 매수 기록만의 수량가중평균 매입가 (평균원가법: 매도해도 이 값은 바뀌지 않음) */
  avgBuyPrice: number;
  /** 순보유수량 = 매수 수량 합 - 매도 수량 합 */
  netQuantity: number;
  totalBuyQuantity: number;
  totalSellQuantity: number;
  /** 입력(생성) 순서대로 정렬된 개별 매수/매도 내역 */
  lots: Holding[];
  /** USD 종목의 매입금액 가중평균 매입환율 (매수 기록에만 근거) */
  avgPurchaseFxRate?: number;
}

function groupKey(h: Pick<Holding, 'ticker' | 'market'>): string {
  return `${h.market}:${h.ticker.trim().toUpperCase()}`;
}



export function groupHoldings(holdings: Holding[]): HoldingGroup[] {
  const byKey = new Map<string, Holding[]>();
  for (const h of holdings) {
    const key = groupKey(h);
    const arr = byKey.get(key) ?? [];
    arr.push(h);
    byKey.set(key, arr);
  }

  const groups: HoldingGroup[] = [];
  for (const [key, lots] of byKey) {
    const sorted = [...lots].sort((a, b) => lotCreatedAt(a) - lotCreatedAt(b));
    const buyLots = sorted.filter((l) => (l.lotType ?? 'buy') === 'buy');
    const sellLots = sorted.filter((l) => l.lotType === 'sell');

    const totalBuyQuantity = buyLots.reduce((s, l) => s + l.quantity, 0);
    const totalSellQuantity = sellLots.reduce((s, l) => s + l.quantity, 0);
    const buyCostSum = buyLots.reduce((s, l) => s + l.quantity * l.avgPrice, 0);
    const avgBuyPrice = totalBuyQuantity > 0 ? buyCostSum / totalBuyQuantity : 0;

    // 매입 시 환율을 입력한 매수 lot들만 골라서 가중평균한다. 입력 안 한 lot을
    // 0원으로 취급해 희석시키면 안 되므로(그러면 평균이 실제보다 훨씬 낮게
    // 나오거나, 전부 미입력이면 0이 되어버림), 분모도 "환율을 입력한 lot들의
    // 매입원가"로 맞춘다. 환율을 입력한 매수 lot이 하나도 없으면 undefined.
    const buyLotsWithFxRate = buyLots.filter((l) => l.purchaseFxRate !== undefined);
    const buyFxCostBasis = buyLotsWithFxRate.reduce((s, l) => s + l.quantity * l.avgPrice, 0);
    const buyFxCostSum = buyLotsWithFxRate.reduce(
      (s, l) => s + l.quantity * l.avgPrice * (l.purchaseFxRate as number),
      0
    );

    const latest = sorted[sorted.length - 1];

    groups.push({
      key,
      ticker: latest.ticker,
      name: latest.name,
      market: latest.market,
      currency: latest.currency,
      categoryId: latest.categoryId,
      currentPrice: latest.currentPrice,
      avgBuyPrice,
      netQuantity: totalBuyQuantity - totalSellQuantity,
      totalBuyQuantity,
      totalSellQuantity,
      lots: sorted,
      avgPurchaseFxRate:
        latest.currency === 'USD' && buyFxCostBasis > 0 ? buyFxCostSum / buyFxCostBasis : undefined,
    });
  }

  return groups.sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/** 그룹을 리밸런싱 계산기가 바로 쓸 수 있는 Holding 형태(순보유수량 기준)로 변환한다. */
export function groupToHolding(group: HoldingGroup): Holding {
  return {
    id: group.key,
    ticker: group.ticker,
    name: group.name,
    categoryId: group.categoryId,
    market: group.market,
    currency: group.currency,
    avgPrice: group.avgBuyPrice,
    quantity: group.netQuantity,
    currentPrice: group.currentPrice,
    purchaseFxRate: group.avgPurchaseFxRate,
  };
}
