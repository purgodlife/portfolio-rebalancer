export type Market = 'KR' | 'US';
export type Currency = 'KRW' | 'USD';

export interface Category {
  id: string;
  name: string;
  /** 0-100 */
  targetPercent: number;
}

export interface Holding {
  id: string;
  ticker: string;
  name: string;
  categoryId: string;
  market: Market;
  currency: Currency;
  avgPrice: number;
  quantity: number;
  currentPrice: number;
}

export interface RebalanceInput {
  categories: Category[];
  holdings: Holding[];
  /** amount being deposited, in depositCurrency */
  depositAmount: number;
  depositCurrency: Currency;
  /** 1 USD = usdKrwRate KRW */
  usdKrwRate: number;
  /** if true, allows selling overweight holdings to hit targets exactly */
  allowSell: boolean;
}

export interface HoldingAction {
  holdingId: string;
  ticker: string;
  name: string;
  categoryId: string;
  currency: Currency;
  action: 'buy' | 'sell' | 'hold';
  /** always >= 0, in the holding's own currency */
  amountInHoldingCurrency: number;
  /** always >= 0, in KRW base currency */
  amountInBaseCurrency: number;
  /** rough reference share count at current price; not rounded to lots */
  approxShares: number;
}

export interface CategoryResult {
  categoryId: string;
  name: string;
  currentValueBase: number;
  currentPercent: number;
  targetPercent: number;
  targetValueBase: number;
  /** positive = net buy, negative = net sell */
  diffBase: number;
  projectedValueBase: number;
  projectedPercent: number;
}

export interface RebalanceResult {
  baseCurrency: 'KRW';
  totalValueBeforeBase: number;
  totalValueAfterBase: number;
  depositBase: number;
  categories: CategoryResult[];
  actions: HoldingAction[];
  /** should be ~0; nonzero indicates rounding drift */
  unallocatedCashBase: number;
}
