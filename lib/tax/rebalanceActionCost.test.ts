import { describe, expect, it } from 'vitest';
import { calculateRebalanceActionCost } from './rebalanceActionCost';
import { KR_SECURITIES_TRANSACTION_TAX_RATE, US_CAPITAL_GAINS_TAX_RATE } from './tradeCosts';

describe('calculateRebalanceActionCost', () => {
  it('never taxes buys, regardless of residency', () => {
    const kr = calculateRebalanceActionCost({
      action: 'buy',
      market: 'KR',
      currency: 'KRW',
      amount: 1_000_000,
      taxResidency: 'kr',
      usdKrwRate: 1400,
    });
    const us = calculateRebalanceActionCost({
      action: 'buy',
      market: 'US',
      currency: 'USD',
      amount: 1000,
      taxResidency: 'us',
      usdKrwRate: 1400,
    });
    expect(kr.totalTax).toBe(0);
    expect(us.totalTax).toBe(0);
  });

  describe('taxResidency = kr (matches legacy calculateTradeCost behavior)', () => {
    it('applies only the KR securities transaction tax on a KR-market sell', () => {
      const result = calculateRebalanceActionCost({
        action: 'sell',
        market: 'KR',
        currency: 'KRW',
        amount: 1_000_000,
        realizedGain: 200_000,
        taxResidency: 'kr',
        usdKrwRate: 1400,
      });
      expect(result.krSecuritiesTax).toBeCloseTo(1_000_000 * KR_SECURITIES_TRANSACTION_TAX_RATE, 5);
      expect(result.capitalGainsTax).toBe(0);
    });

    it('applies only the KR 22% foreign-stock capital gains estimate on a US-market sell', () => {
      const result = calculateRebalanceActionCost({
        action: 'sell',
        market: 'US',
        currency: 'USD',
        amount: 1000,
        realizedGain: 300,
        taxResidency: 'kr',
        usdKrwRate: 1400,
      });
      expect(result.krSecuritiesTax).toBe(0);
      expect(result.capitalGainsTax).toBeCloseTo(300 * US_CAPITAL_GAINS_TAX_RATE, 5);
    });
  });

  describe('taxResidency = us', () => {
    it('still applies the KR securities transaction tax on a KR-market sell (market-based, residency-independent)', () => {
      const result = calculateRebalanceActionCost({
        action: 'sell',
        market: 'KR',
        currency: 'KRW',
        amount: 1_000_000,
        realizedGain: 200_000,
        taxResidency: 'us',
        usdKrwRate: 1400,
        buyLots: [{ quantity: 10, createdAtMs: Date.now() - 500 * 24 * 60 * 60 * 1000 }],
        usLongTermRate: 0.15,
        usShortTermRate: 0.22,
      });
      expect(result.krSecuritiesTax).toBeCloseTo(1_000_000 * KR_SECURITIES_TRANSACTION_TAX_RATE, 5);
    });

    it('applies US long-term capital gains tax on a KR-market sell held over a year', () => {
      const result = calculateRebalanceActionCost({
        action: 'sell',
        market: 'KR',
        currency: 'KRW',
        amount: 1_000_000,
        realizedGain: 1_400_000, // 1000 USD worth of gain at rate 1400
        taxResidency: 'us',
        usdKrwRate: 1400,
        buyLots: [{ quantity: 10, createdAtMs: Date.now() - 500 * 24 * 60 * 60 * 1000 }],
        usLongTermRate: 0.15,
        usShortTermRate: 0.22,
      });
      expect(result.term).toBe('long');
      // 1_400_000 KRW gain / 1400 = 1000 USD gain, taxed at 15% = 150 USD = 210_000 KRW
      expect(result.capitalGainsTax).toBeCloseTo(210_000, 0);
    });

    it('applies US short-term capital gains tax and skips the KR 22% foreign-stock rule on a US-market sell', () => {
      const result = calculateRebalanceActionCost({
        action: 'sell',
        market: 'US',
        currency: 'USD',
        amount: 1000,
        realizedGain: 300,
        taxResidency: 'us',
        usdKrwRate: 1400,
        buyLots: [{ quantity: 10, createdAtMs: Date.now() - 30 * 24 * 60 * 60 * 1000 }],
        usLongTermRate: 0.15,
        usShortTermRate: 0.22,
      });
      expect(result.krSecuritiesTax).toBe(0);
      expect(result.term).toBe('short');
      expect(result.capitalGainsTax).toBeCloseTo(300 * 0.22, 5);
      // must not equal the KR 22% rule applied to the KRW-denominated view (would coincide numerically here since
      // shortTermRate is also 0.22, but the point is it goes through the US path, verified via `term`).
    });

    it('adds NIIT on top when subjectToNiit is set', () => {
      const result = calculateRebalanceActionCost({
        action: 'sell',
        market: 'US',
        currency: 'USD',
        amount: 1000,
        realizedGain: 1000,
        taxResidency: 'us',
        usdKrwRate: 1400,
        buyLots: [{ quantity: 10, createdAtMs: Date.now() - 500 * 24 * 60 * 60 * 1000 }],
        usLongTermRate: 0.15,
        usShortTermRate: 0.22,
        usSubjectToNiit: true,
      });
      expect(result.capitalGainsTax).toBeCloseTo(1000 * (0.15 + 0.038), 5);
    });

    it('does not tax a loss', () => {
      const result = calculateRebalanceActionCost({
        action: 'sell',
        market: 'US',
        currency: 'USD',
        amount: 1000,
        realizedGain: -500,
        taxResidency: 'us',
        usdKrwRate: 1400,
        buyLots: [{ quantity: 10, createdAtMs: Date.now() - 500 * 24 * 60 * 60 * 1000 }],
        usLongTermRate: 0.15,
        usShortTermRate: 0.22,
      });
      expect(result.capitalGainsTax).toBe(0);
      expect(result.krSecuritiesTax).toBe(0);
    });
  });
});
