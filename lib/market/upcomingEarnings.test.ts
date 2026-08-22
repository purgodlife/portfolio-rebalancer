import { describe, expect, it } from 'vitest';
import {
  isEarningsCacheStale,
  selectUpcomingEarnings,
  EARNINGS_CACHE_MAX_AGE_MS,
  DEFAULT_UPCOMING_WINDOW_DAYS,
  type EarningsEntry,
} from './upcomingEarnings';

const NOW = new Date('2026-08-22T00:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function entry(overrides: Partial<EarningsEntry> = {}): EarningsEntry {
  return {
    key: 'US:AAPL',
    ticker: 'AAPL',
    name: 'Apple Inc.',
    market: 'US',
    earningsDate: null,
    ...overrides,
  };
}

describe('isEarningsCacheStale', () => {
  it('treats undefined fetchedAt as stale', () => {
    expect(isEarningsCacheStale(undefined, NOW)).toBe(true);
  });

  it('treats a fetch within the max age window as fresh', () => {
    const fetchedAt = NOW - (EARNINGS_CACHE_MAX_AGE_MS - 1);
    expect(isEarningsCacheStale(fetchedAt, NOW)).toBe(false);
  });

  it('treats a fetch past the max age window as stale', () => {
    const fetchedAt = NOW - (EARNINGS_CACHE_MAX_AGE_MS + 1);
    expect(isEarningsCacheStale(fetchedAt, NOW)).toBe(true);
  });
});

describe('selectUpcomingEarnings', () => {
  it('excludes entries with a null earnings date', () => {
    const result = selectUpcomingEarnings([entry({ earningsDate: null })], NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes entries whose earnings date is in the past', () => {
    const result = selectUpcomingEarnings([entry({ earningsDate: NOW - DAY })], NOW);
    expect(result).toHaveLength(0);
  });

  it('excludes entries beyond the window', () => {
    const result = selectUpcomingEarnings(
      [entry({ earningsDate: NOW + (DEFAULT_UPCOMING_WINDOW_DAYS + 1) * DAY })],
      NOW
    );
    expect(result).toHaveLength(0);
  });

  it('includes an entry exactly at the window boundary', () => {
    const boundary = NOW + DEFAULT_UPCOMING_WINDOW_DAYS * DAY;
    const result = selectUpcomingEarnings([entry({ earningsDate: boundary })], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].earningsDate).toBe(boundary);
  });

  it('includes entries within the window and sorts them ascending', () => {
    const soon = entry({ key: 'US:MSFT', ticker: 'MSFT', earningsDate: NOW + 10 * DAY });
    const sooner = entry({ key: 'US:GOOG', ticker: 'GOOG', earningsDate: NOW + 3 * DAY });
    const result = selectUpcomingEarnings([soon, sooner], NOW);
    expect(result.map((e) => e.ticker)).toEqual(['GOOG', 'MSFT']);
  });

  it('narrows earningsDate to number in the returned type', () => {
    const result = selectUpcomingEarnings([entry({ earningsDate: NOW + DAY })], NOW);
    const value: number = result[0].earningsDate;
    expect(value).toBeGreaterThan(NOW);
  });

  it('returns an empty array when given no entries', () => {
    expect(selectUpcomingEarnings([], NOW)).toEqual([]);
  });

  it('respects a custom window size', () => {
    const result = selectUpcomingEarnings([entry({ earningsDate: NOW + 5 * DAY })], NOW, 3);
    expect(result).toHaveLength(0);
  });
});
