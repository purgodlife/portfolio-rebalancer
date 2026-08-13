'use client';

import type { Market } from '@/lib/rebalance/types';
import type { Fundamentals } from '@/lib/risk/graham';
import { resolveYahooSymbol } from './quote';

export type { Fundamentals } from '@/lib/risk/graham';

/**
 * 그레이엄 체크리스트용 재무 데이터를 조회한다. 먼저 시세 조회(/api/quote)로
 * 정확한 Yahoo 심볼(예: 한국 종목의 .KS/.KQ 접미사)을 알아낸 뒤, 그 심볼로
 * /api/fundamentals를 호출한다.
 */
export async function fetchFundamentals(ticker: string, market: Market): Promise<Fundamentals | null> {
  const resolved = await resolveYahooSymbol(ticker, market);
  if (!resolved) return null;
  try {
    const res = await fetch(`/api/fundamentals?symbol=${encodeURIComponent(resolved.symbol)}`);
    if (!res.ok) return null;
    return (await res.json()) as Fundamentals;
  } catch {
    return null;
  }
}
