import type { AccountType } from './types';

export type AccountCountryGroupKey = 'countryGroupCommon' | 'countryGroupKr' | 'countryGroupUs';

/**
 * 계좌 유형을 국가(세제)별로 묶어서 보여주기 위한 그룹 정의.
 * 'general'은 한국·미국 어느 쪽에서도 특별한 세제 혜택이 없는 일반 계좌(국내
 * 위탁계좌든 미국 taxable brokerage든 세법상 취급이 사실상 동일)이므로 공통
 * 그룹으로 분류한다. labelKey는 messages/*.json의 accounts.* 키와 매칭된다.
 */
export const ACCOUNT_TYPE_GROUPS: { labelKey: AccountCountryGroupKey; types: AccountType[] }[] = [
  { labelKey: 'countryGroupCommon', types: ['general'] },
  { labelKey: 'countryGroupKr', types: ['pensionSavings', 'irp', 'isa'] },
  { labelKey: 'countryGroupUs', types: ['us401k', 'usTraditionalIra', 'usRothIra'] },
];

export const ALL_ACCOUNT_TYPES: AccountType[] = ACCOUNT_TYPE_GROUPS.flatMap((g) => g.types);
