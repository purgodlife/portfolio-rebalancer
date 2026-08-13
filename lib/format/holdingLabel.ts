import type { Market } from '@/lib/rebalance/types';

/**
 * 국내(KR) 종목 티커는 숫자+영문 조합(예: 005930, 0046A0)이라 그 자체로는
 * 알아보기 어렵다. 그래서 국내 종목은 종목명을 주(primary)로 보여주고 티커는
 * 보조(secondary)로, 해외(US) 종목은 반대로(티커가 익숙하므로) 티커를 주로
 * 보여준다.
 */
export function primaryLabel(h: { ticker: string; name: string; market: Market }): string {
  return h.market === 'KR' ? h.name : h.ticker;
}

export function secondaryLabel(h: { ticker: string; name: string; market: Market }): string {
  return h.market === 'KR' ? h.ticker : h.name;
}
