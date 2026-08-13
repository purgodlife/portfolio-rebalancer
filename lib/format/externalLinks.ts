import type { Market } from '@/lib/rebalance/types';

/**
 * investing.com/Yahoo Finance로 이동하는 딥링크만 만든다(직접 스크래핑 없음).
 * 정확한 거래소 접미사를 모르는 상태에서도 항상 클릭 가능한 링크가 되도록,
 * Yahoo는 코스피(.KS) 추정을 기본으로 쓰고 investing.com은 이름으로 검색한다
 * (검색 결과 페이지라 티커/접미사가 틀려도 항상 동작한다).
 */
export function yahooFinanceUrl(ticker: string, market: Market): string {
  const symbol = market === 'KR' ? `${ticker}.KS` : ticker.toUpperCase();
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}

export function investingSearchUrl(query: string): string {
  return `https://www.investing.com/search/?q=${encodeURIComponent(query)}`;
}
