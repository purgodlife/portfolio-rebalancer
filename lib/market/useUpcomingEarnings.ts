'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '@/lib/storage/db';
import type { HoldingGroup } from '@/lib/rebalance/grouping';
import { fetchFundamentals } from './fundamentals';
import { isEarningsCacheStale, type EarningsEntry } from './upcomingEarnings';

/**
 * 보유 중인 종목들의 다가오는 실적발표일을 조회한다. IndexedDB 캐시(12시간)를
 * 우선 사용하고, 캐시가 없거나 오래된 종목만 /api/fundamentals로 재조회한다.
 */
export function useUpcomingEarnings(groups: HoldingGroup[]): { entries: EarningsEntry[]; loading: boolean } {
  const heldGroups = useMemo(() => groups.filter((g) => g.netQuantity > 0), [groups]);
  const heldKeysSignature = heldGroups.map((g) => g.key).join(',');

  const cacheEntries = useLiveQuery(() => getDb().earningsCache.toArray(), [], []) ?? [];
  const cacheByKey = useMemo(() => new Map(cacheEntries.map((e) => [e.key, e])), [cacheEntries]);

  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = Date.now();
    const toFetch = heldGroups.filter((g) => {
      const cached = cacheByKey.get(g.key);
      return isEarningsCacheStale(cached?.fetchedAt, now) && !inFlightRef.current.has(g.key);
    });
    if (toFetch.length === 0) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      for (const g of toFetch) inFlightRef.current.add(g.key);
      await Promise.all(
        toFetch.map(async (g) => {
          const data = await fetchFundamentals(g.ticker, g.market);
          if (cancelled) return;
          await getDb().earningsCache.put({
            key: g.key,
            earningsDate: data?.earningsDate ?? null,
            fetchedAt: Date.now(),
          });
          inFlightRef.current.delete(g.key);
        })
      );
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heldKeysSignature, cacheByKey]);

  const entries: EarningsEntry[] = heldGroups.map((g) => ({
    key: g.key,
    ticker: g.ticker,
    name: g.name,
    market: g.market,
    earningsDate: cacheByKey.get(g.key)?.earningsDate ?? null,
  }));

  return { entries, loading };
}
