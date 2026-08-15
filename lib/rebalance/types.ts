export type Market = 'KR' | 'US';
export type Currency = 'KRW' | 'USD';
export type LotType = 'buy' | 'sell';

/**
 * 계좌 유형. 일반계좌는 세제 혜택이 없고, 연금저축/IRP/ISA(한국)와
 * 401(k)/Traditional IRA/Roth IRA(미국)는 각각 나라별로 다른 세제 혜택·한도가
 * 적용된다(세제혜택 계산기 화면 참고, lib/tax/taxBenefits.ts·lib/tax/usTaxBenefits.ts).
 * 계좌 유형은 표시·분류 용도로만 쓰이고, 리밸런싱 계산 로직 자체는 계좌
 * 유형을 구분하지 않는다. 국가별 그룹핑은 lib/rebalance/accountTypeGroups.ts 참고.
 */
export type AccountType =
  | 'general'
  | 'pensionSavings'
  | 'irp'
  | 'isa'
  | 'us401k'
  | 'usTraditionalIra'
  | 'usRothIra';

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
  /**
   * true면 이 계좌는 자기만의 자산배분(카테고리)을 직접 입력·관리한다("개별
   * 모드"). false 또는 undefined(기본값)면 통합 자산배분(모든 계좌가 공유하는
   * 하나의 목표표, lib/storage/hooks.ts의 UNIFIED_ALLOCATION_ACCOUNT_ID)을
   * 그대로 따른다("통합 모드", 기본값). 통합 모드인 계좌의 실제 카테고리
   * 행(row)은 통합 카테고리를 그대로 미러링한 것으로, Category.mirrorsCategoryId로
   * 연결된다 — 이렇게 해야 보유종목이 참조하는 categoryId는 그대로 둔 채
   * 이름·비중 변경만 모든 계좌에 전파할 수 있다.
   *
   * 이 필드가 없는(undefined) 기존 계좌는 이 기능이 추가되기 전부터 자기만의
   * 카테고리를 이미 입력해둔 상태이므로, 앱 최초 실행 시 1회 마이그레이션으로
   * true(개별 모드)를 명시적으로 저장해 기존 데이터가 갑자기 안 보이는 일이
   * 없게 한다(lib/storage/hooks.ts의 migrateExistingAccountsToIndividualAllocation).
   */
  useIndividualAllocation?: boolean;
}

export interface Category {
  id: string;
  name: string;
  /** 0-100 */
  targetPercent: number;
  /**
   * 이 카테고리가 속한 계좌 id. 계좌 기능이 추가되기 전 데이터는 이 값이
   * 없으므로(undefined), 그런 경우 기본 계좌에 속한 것으로 취급한다.
   * 통합 자산배분 카테고리 자체는 accountId가 특수 상수
   * UNIFIED_ALLOCATION_ACCOUNT_ID(lib/storage/hooks.ts)로 저장된다 — 어느
   * 계좌에도 속하지 않는, 여러 계좌가 공유하는 "원본" 카테고리다.
   */
  accountId?: string;
  /**
   * 이 값이 있으면 이 카테고리는 통합 카테고리(id가 이 값)를 그대로 미러링한
   * "계좌별 사본"이다 — name·targetPercent는 통합 카테고리와 자동으로
   * 동기화되고(사용자가 직접 수정할 수 없음) 화면에는 읽기전용으로 표시한다.
   * id 자체는 계좌마다 고유하게 유지되므로, 이 카테고리를 가리키는
   * 보유종목(Holding.categoryId)은 통합 카테고리의 이름이 바뀌어도 계속 같은
   * 카테고리를 가리킨다(=매수/매도 시 입력해둔 종목 연결이 끊기지 않는다).
   */
  mirrorsCategoryId?: string;
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
   * 이 매수/매도 거래 시점의 USD/KRW 환율 (currency가 USD인 종목에만 의미가
   * 있음). 매수(buy) lot에서는 "매입 시 환율", 매도(sell) lot에서는 "매도 시
   * 환율"을 뜻한다(필드명은 이 기능이 매수만 지원하던 시절 이름 그대로다).
   * 원화 환산 손익을 주가 변동분과 환율 변동분(환차익)으로 나눠 보여주거나
   * (lib/rebalance/grouping.ts), 미국주식 매도 실현손익을 정확히 원화
   * 환산하는 데(lib/tax/usRealizedGains.ts) 쓰인다.
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
