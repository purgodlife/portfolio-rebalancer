import { describe, expect, it } from 'vitest';
import { detectLeverage, evaluateEtfRisk } from './etf';

describe('detectLeverage', () => {
  it('flags common leveraged/inverse fund names', () => {
    expect(detectLeverage('ProShares UltraPro QQQ', 'TQQQ')).toBe(true);
    expect(detectLeverage('Direxion Daily Semiconductor Bull 3X Shares', 'SOXL')).toBe(true);
    expect(detectLeverage('ProShares Short S&P500', 'SH')).toBe(false); // "Short"는 패턴에 없음 (오탐 줄이려 보수적으로 설계)
  });

  it('does not flag plain index funds', () => {
    expect(detectLeverage('SPDR S&P 500 ETF Trust', 'SPY')).toBe(false);
    expect(detectLeverage('Invesco QQQ Trust, Series 1', 'QQQ')).toBe(false);
  });
});

describe('evaluateEtfRisk', () => {
  it('passes a low-cost, well-diversified, non-leveraged ETF on every criterion', () => {
    const result = evaluateEtfRisk('SPDR S&P 500 ETF Trust', 'SPY', {
      expenseRatio: 0.0009,
      topHoldingsConcentration: 0.3,
    });
    expect(result.failCount).toBe(0);
    expect(result.isLikelyLeveraged).toBe(false);
  });

  it('fails a leveraged fund on the leverage check even with good cost/concentration numbers', () => {
    const result = evaluateEtfRisk('ProShares UltraPro QQQ', 'TQQQ', {
      expenseRatio: 0.0084,
      topHoldingsConcentration: 0.5,
    });
    expect(result.checks.find((c) => c.key === 'leverage')?.status).toBe('fail');
    expect(result.isLikelyLeveraged).toBe(true);
  });

  it('marks cost/concentration unknown without failing when fundamentals are missing', () => {
    const result = evaluateEtfRisk('Some ETF', 'XYZ', null);
    expect(result.checks.find((c) => c.key === 'expenseRatio')?.status).toBe('unknown');
    expect(result.checks.find((c) => c.key === 'concentration')?.status).toBe('unknown');
  });
});
