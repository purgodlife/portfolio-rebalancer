import { describe, expect, it } from 'vitest';
import { matchesQuery, matchesAnyQuery } from './textFilter';

describe('matchesQuery', () => {
  it('returns true for an empty query', () => {
    expect(matchesQuery('Apple Inc', '')).toBe(true);
    expect(matchesQuery('Apple Inc', '   ')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(matchesQuery('Apple Inc', 'apple')).toBe(true);
    expect(matchesQuery('Apple Inc', 'APPLE')).toBe(true);
  });

  it('matches a partial substring', () => {
    expect(matchesQuery('삼성전자', '삼성')).toBe(true);
    expect(matchesQuery('AAPL', 'AA')).toBe(true);
  });

  it('returns false when there is no match', () => {
    expect(matchesQuery('Apple Inc', 'msft')).toBe(false);
  });
});

describe('matchesAnyQuery', () => {
  it('returns true for an empty query regardless of fields', () => {
    expect(matchesAnyQuery(['AAPL', 'Apple Inc'], '')).toBe(true);
  });

  it('matches if any field matches', () => {
    expect(matchesAnyQuery(['AAPL', 'Apple Inc'], 'apple')).toBe(true);
    expect(matchesAnyQuery(['AAPL', 'Apple Inc'], 'aapl')).toBe(true);
  });

  it('returns false if no field matches', () => {
    expect(matchesAnyQuery(['AAPL', 'Apple Inc'], 'msft')).toBe(false);
  });
});
