export type Market = 'KR' | 'US';
export type Currency = 'KRW' | 'USD';
export type LotType = 'buy' | 'sell';

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
  /**
   * 매입 시점 USD/KRW 환율 (currency가 USD인 종목에만 의미가 있음).
   * 원화 환산 손익을 주가 변동분과 환율 변동분(환차익)으로 나눠 보여주는 데 쓰인다.
   */
  purchaseFxRate?: number;
  /**
   * 이 기록이 매수 내역인지 매도 내역인지 (기본값 'buy', 과거 데이터 호환용).
   * 같은 티커+시장으로 여러 번 입력하면 자동으로 하나의 종목으로 합산되고,
   * 이 필드로 개별 매수/매도 내역을 구분해서 펼쳐볼 수 있다.
   */
  lotType?: LotType;
  /** 이 기록이 입력된 시각(ms). 거래내역 화면에서 시간순 정렬에 쓰인다. */
  createdAt?: number;
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
  market: Market;
  currency: Currency;
  action: 'buy' | 'sell' | 'hold';
  /** always >= 0, in the holding's own currency */
  amountInHoldingCurrency: number;
  /** always >= 0, in KRW base currency */
  amountInBaseCurrency: number;
  /**
   * 매수(buy)는 목표 금액을 현재가로 나눈 참고용 소수 수량(≈)이고,
   * 매도(sell)는 목표 금액에 가장 가깝게 맞춘 실제 정수 매도 수량이다.
   */
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
