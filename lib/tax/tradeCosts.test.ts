import { describe, expect, it } from 'vitest';
import {
  calculateTradeCost,
  KR_SECURITIES_TRANSACTION_TAX_RATE,
  US_CAPITAL_GAINS_TAX_RATE,
} from './tradeCosts';

describe('calculateTradeCost', () => {
  it('applies the fee rate to buys and adds it on top of the amount', () => {
    const result = calculateTradeCost({
      market: 'KR',
      action: 'buy',
      amount: 1_000_000,
      feeRatePercent: 0.015,
    });
    expect(result.feeAmount).toBeCloseTo(150, 5);
    expect(result.securitiesTransactionTax).toBe(0);
    expect(result.estimatedCapitalGainsTax).toBe(0);
    expect(result.netAmount).toBeCloseTo(1_000_150, 5);
  });

  it('charges the KR securities transaction tax on sells, regardless of gain/loss', () => {
    const result = calculateTradeCost({
      market: 'KR',
      action: 'sell',
      amount: 1_000_000,
      feeRatePercent: 0,
      realizedGain: -500_000, // a loss should not exempt the transaction tax
    });
    expect(result.securitiesTransactionTax).toBeCloseTo(1_000_000 * KR_SECURITIES_TRANSACTION_TAX_RATE, 5);
    expect(result.estimatedCapitalGainsTax).toBe(0);
    expect(result.netAmount).toBeCloseTo(1_000_000 - 1_000_000 * KR_SECURITIES_TRANSACTION_TAX_RATE, 5);
  });

  it('estimates US capital gains tax only on a positive realized gain', () => {
    const result = calculateTradeCost({
      market: 'US',
      action: 'sell',
      amount: 1_000_000,
      feeRatePercent: 0,
      realizedGain: 300_000,
    });
    expect(result.securitiesTransactionTax).toBe(0);
    expect(result.estimatedCapitalGainsTax).toBeCloseTo(300_000 * US_CAPITAL_GAINS_TAX_RATE, 5);
  });

  it('does not charge US capital gains tax when the realized gain is a loss', () => {
    const result = calculateTradeCost({
      market: 'US',
      action: 'sell',
      amount: 1_000_000,
      feeRatePercent: 0,
      realizedGain: -200_000,
    });
    expect(result.estimatedCapitalGainsTax).toBe(0);
    expect(result.netAmount).toBe(1_000_000);
  });

  it('combines fee and tax for a KR sell', () => {
    const result = calculateTradeCost({
      market: 'KR',
      action: 'sell',
      amount: 1_000_000,
      feeRatePercent: 0.015,
      realizedGain: 100_000,
    });
    const expectedFee = 1_000_000 * 0.00015;
    const expectedTax = 1_000_000 * KR_SECURITIES_TRANSACTION_TAX_RATE;
    expect(result.totalCost).toBeCloseTo(expectedFee + expectedTax, 5);
    expect(result.netAmount).toBeCloseTo(1_000_000 - expectedFee - expectedTax, 5);
  });

  it('never returns negative amounts for zero input', () => {
    const result = calculateTradeCost({ market: 'KR', action: 'sell', amount: 0, feeRatePercent: 0 });
    expect(result.feeAmount).toBe(0);
    expect(result.securitiesTransactionTax).toBe(0);
    expect(result.netAmount).toBe(0);
  });
});
