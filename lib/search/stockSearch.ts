import { isChosungOnly, toChosungString } from './chosung';
import { KR_STOCKS, US_STOCKS, type StockEntry } from './stockData';
import type { Market } from '@/lib/rebalance/types';

export function stocksForMarket(market: Market): StockEntry[] {
  return market === 'KR' ? KR_STOCKS : US_STOCKS;
}

/**
 * 티커/종목명 입력값(query)으로 종목을 검색한다.
 * - 티커 완전일치/접두일치가 가장 높은 우선순위
 * - 한글 초성만 입력한 경우("ㅋ") 초성 접두일치
 * - 종목명 접두일치
 * - 그 외 부분일치(초성 부분일치 포함)는 낮은 우선순위로 포함
 */
export function searchStocks(query: string, market: Market, limit = 8): StockEntry[] {
  const q = query.trim();
  if (!q) return [];

  const list = stocksForMarket(market);
  const qLower = q.toLowerCase();
  const qChosung = isChosungOnly(q) ? q : null;

  const scored: Array<{ entry: StockEntry; score: number }> = [];

  for (const entry of list) {
    const tickerLower = entry.ticker.toLowerCase();
    const nameChosung = qChosung ? toChosungString(entry.name) : null;

    let score = -1;
    if (tickerLower === qLower) score = 100;
    else if (tickerLower.startsWith(qLower)) score = 90;
    else if (entry.name.startsWith(q)) score = 85;
    else if (qChosung && nameChosung && nameChosung.startsWith(qChosung)) score = 80;
    else if (qChosung && nameChosung && nameChosung.includes(qChosung)) score = 50;
    else if (entry.name.toLowerCase().includes(qLower) || tickerLower.includes(qLower)) score = 40;

    if (score >= 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'ko'));
  return scored.slice(0, limit).map((s) => s.entry);
}
