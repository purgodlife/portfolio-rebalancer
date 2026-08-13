import { describe, expect, it } from 'vitest';
import { primaryLabel, secondaryLabel } from './holdingLabel';

describe('primaryLabel / secondaryLabel', () => {
  it('shows the company name first for KR holdings (tickers are opaque codes)', () => {
    const h = { ticker: '005930', name: '삼성전자', market: 'KR' as const };
    expect(primaryLabel(h)).toBe('삼성전자');
    expect(secondaryLabel(h)).toBe('005930');
  });

  it('shows the ticker first for US holdings (tickers are recognizable)', () => {
    const h = { ticker: 'AAPL', name: 'Apple Inc.', market: 'US' as const };
    expect(primaryLabel(h)).toBe('AAPL');
    expect(secondaryLabel(h)).toBe('Apple Inc.');
  });

  it('handles newer alphanumeric KR ETF codes the same way', () => {
    const h = { ticker: '0046A0', name: 'TIGER 미국초단기(3개월이하)국채', market: 'KR' as const };
    expect(primaryLabel(h)).toBe('TIGER 미국초단기(3개월이하)국채');
  });
});
