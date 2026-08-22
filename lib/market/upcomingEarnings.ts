export interface EarningsEntry {
  key: string;
  ticker: string;
  name: string;
  market: 'KR' | 'US';
  earningsDate: number | null;
}

export const EARNINGS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const DEFAULT_UPCOMING_WINDOW_DAYS = 30;

export function isEarningsCacheStale(
  fetchedAt: number | undefined,
  nowMs: number,
  maxAgeMs: number = EARNINGS_CACHE_MAX_AGE_MS
): boolean {
  if (fetchedAt === undefined) return true;
  return nowMs - fetchedAt > maxAgeMs;
}

export type UpcomingEarningsEntry = EarningsEntry & { earningsDate: number };

export function selectUpcomingEarnings(
  entries: EarningsEntry[],
  nowMs: number,
  windowDays: number = DEFAULT_UPCOMING_WINDOW_DAYS
): UpcomingEarningsEntry[] {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return entries
    .filter(
      (e): e is UpcomingEarningsEntry =>
        e.earningsDate !== null && e.earningsDate >= nowMs && e.earningsDate <= nowMs + windowMs
    )
    .sort((a, b) => a.earningsDate - b.earningsDate);
}
