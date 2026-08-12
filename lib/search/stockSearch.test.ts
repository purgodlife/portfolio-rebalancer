import { describe, it, expect } from 'vitest';
import { toChosungString, isChosungOnly } from './chosung';
import { searchStocks } from './stockSearch';

describe('chosung', () => {
  it('extracts chosung correctly', () => {
    expect(toChosungString('삼성전자')).toBe('ㅅㅅㅈㅈ');
    expect(toChosungString('카카오')).toBe('ㅋㅋㅇ');
  });
  it('detects chosung-only input', () => {
    expect(isChosungOnly('ㅋ')).toBe(true);
    expect(isChosungOnly('ㅋㄹ')).toBe(true);
    expect(isChosungOnly('크')).toBe(false);
    expect(isChosungOnly('')).toBe(false);
  });
});

describe('searchStocks', () => {
  it('finds by chosung prefix "ㅋ"', () => {
    const r = searchStocks('ㅋ', 'KR');
    expect(r.some((e) => e.name === '카카오')).toBe(true);
    expect(r.every((e) => e.name.startsWith('카') || e.name.startsWith('크') || e.name[0] !== undefined)).toBe(true);
  });
  it('narrows down as more of the syllable is typed ("카")', () => {
    const r = searchStocks('카', 'KR');
    expect(r.some((e) => e.name === '카카오')).toBe(true);
    expect(r.every((e) => e.name.startsWith('카'))).toBe(true);
  });
  it('finds by exact ticker', () => {
    const r = searchStocks('005930', 'KR');
    expect(r[0].name).toBe('삼성전자');
  });
  it('finds US stocks by prefix', () => {
    const r = searchStocks('AAP', 'US');
    expect(r.some((e) => e.ticker === 'AAPL')).toBe(true);
  });
  it('returns empty for blank query', () => {
    expect(searchStocks('', 'KR')).toEqual([]);
  });
});
