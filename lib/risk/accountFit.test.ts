import { describe, expect, it } from 'vitest';
import { evaluateAccountFit, type HoldingFitInput } from './accountFit';

function h(overrides: Partial<HoldingFitInput> = {}): HoldingFitInput {
  return {
    ticker: 'TEST',
    name: 'Test Co',
    market: 'KR',
    quoteType: 'EQUITY',
    dividendYield: null,
    ...overrides,
  };
}

describe('evaluateAccountFit', () => {
  it('returns an informational note and no restrictions for a general account', () => {
    const report = evaluateAccountFit('general', [h({ market: 'US' })]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].level).toBe('info');
    expect(report.findings[0].key).toBe('generalNoRestriction');
  });

  it('flags US-market holdings as critical for ISA (direct foreign stocks are not allowed)', () => {
    const report = evaluateAccountFit('isa', [h({ market: 'US', ticker: 'AAPL', name: 'Apple' })]);
    expect(report.findings.some((f) => f.level === 'critical' && f.key === 'foreignDirectStock')).toBe(true);
  });

  it('flags US-market holdings as critical for IRP and pension savings too', () => {
    for (const type of ['irp', 'pensionSavings'] as const) {
      const report = evaluateAccountFit(type, [h({ market: 'US', ticker: 'AAPL' })]);
      expect(report.findings.some((f) => f.level === 'critical' && f.key === 'foreignDirectStock')).toBe(true);
    }
  });

  it('treats a low-dividend KR individual stock in an ISA as low benefit', () => {
    const report = evaluateAccountFit('isa', [
      h({ market: 'KR', quoteType: 'EQUITY', dividendYield: 0.005, ticker: '005930', name: '삼성전자' }),
    ]);
    expect(report.findings.some((f) => f.level === 'low' && f.key === 'isaLowBenefitStock')).toBe(true);
  });

  it('treats a high-dividend KR individual stock in an ISA as good', () => {
    const report = evaluateAccountFit('isa', [
      h({ market: 'KR', quoteType: 'EQUITY', dividendYield: 0.05, ticker: '005930', name: '삼성전자' }),
    ]);
    expect(report.findings.some((f) => f.level === 'good' && f.key === 'isaDividendGood')).toBe(true);
  });

  it('treats a foreign-index KR-listed ETF in an ISA as good (taxable gains sheltered)', () => {
    const report = evaluateAccountFit('isa', [
      h({ market: 'KR', quoteType: 'ETF', ticker: '360750', name: 'TIGER 미국S&P500' }),
    ]);
    expect(report.findings.some((f) => f.level === 'good' && f.key === 'isaTaxableEtfGood')).toBe(true);
  });

  it('treats a domestic-index KR-listed ETF in an ISA as limited benefit (already tax-free)', () => {
    const report = evaluateAccountFit('isa', [
      h({ market: 'KR', quoteType: 'ETF', ticker: '069500', name: 'KODEX 코스피' }),
    ]);
    expect(report.findings.some((f) => f.level === 'info' && f.key === 'isaDomesticEtfLimited')).toBe(true);
  });

  it('flags leveraged/inverse ETFs as critical for pension accounts (trading is banned)', () => {
    for (const type of ['irp', 'pensionSavings'] as const) {
      const report = evaluateAccountFit(type, [
        h({ market: 'KR', quoteType: 'ETF', ticker: '122630', name: 'KODEX 레버리지' }),
      ]);
      expect(report.findings.some((f) => f.level === 'critical' && f.key === 'pensionLeverageBanned')).toBe(true);
    }
  });

  it('adds an informational risky-asset-limit note for IRP when there are holdings', () => {
    const report = evaluateAccountFit('irp', [h({ market: 'KR' })]);
    expect(report.findings.some((f) => f.key === 'irpRiskyAssetLimitInfo')).toBe(true);
  });

  it('does not add the risky-asset-limit note for pension savings (no such rule)', () => {
    const report = evaluateAccountFit('pensionSavings', [h({ market: 'KR', dividendYield: 0.03 })]);
    expect(report.findings.some((f) => f.key === 'irpRiskyAssetLimitInfo')).toBe(false);
  });

  it('reports no issues found when a pension account holds only compliant assets', () => {
    const report = evaluateAccountFit('pensionSavings', []);
    expect(report.findings).toEqual([{ level: 'good', key: 'noIssuesFound' }]);
  });
});
