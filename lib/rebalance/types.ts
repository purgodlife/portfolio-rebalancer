export type Market = 'KR' | 'US';
export type Currency = 'KRW' | 'USD';
export type LotType = 'buy' | 'sell';

/**
 * 계좌 유형. 일반계좌는 세제 혜택이 없고, 연금저축/IRP/ISA는 각각 다른 세제
 * 혜택·한도가 적용된다(세제혜택 계산기 화면 참고). 계좌 유형은 표시·분류
 * 용도로만 쓰이고, 리밸런싱 계산 로직 자체는 계좌 유형을 구분하지 않는다.
 */
export type AccountType = 'general' | 'pensionSavings' | 'irp' | 'isa';

/**
 * 계좌(포트폴리오) 단위. 카테고리(목표 자산배분)는 계좌에 속하고, 보유종목은
 * 카테고리에 속하므로 결과적으로 계좌별로 완전히 분리된 리밸런싱이 가능하다.
 * 연금저축·IRP·ISA·일반계좌처럼 계좌별로 다른 목표 배분을 쓰고 싶은 경우를
 * 위한 것이다.
 */
export interface Account {
  id: string;
  name: string;
  type: AccountType;
}

export interface Category {
  id: string;
  name: string;
  /** 0-100 */
  targetPercent: number;
  /**
   * 이 카테고리가 속한 계좌 id. 계좌 기능이 추가되기 전 데이터는 이 값이
   * 없으므로(undefined), 그런 경우 기본 계좌에 속한 것으로 취급한다.
   */
  accountId?: string;
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
