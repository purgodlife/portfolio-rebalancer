import { describe, expect, it } from 'vitest';
import {
  calculatePensionTaxCredit,
  calculateIsaTax,
  PENSION_SAVINGS_LIMIT,
  PENSION_TOTAL_LIMIT,
  PENSION_RATE_LOW_INCOME,
  PENSION_RATE_HIGH_INCOME,
  ISA_NON_TAXABLE_LIMIT_GENERAL,
  ISA_NON_TAXABLE_LIMIT_PREFERENTIAL,
  ISA_EXCESS_GAIN_TAX_RATE,
  ISA_TRANSFER_BONUS_CAP,
} from './taxBenefits';

describe('calculatePensionTaxCredit', () => {
  it('applies the low-income rate (16.5%) when total salary is at or below the threshold', () => {
    const result = calculatePensionTaxCredit({
      pensionSavingsContribution: 6_000_000,
      irpContribution: 3_000_000,
      totalSalary: 50_000_000,
    });
    expect(result.isHighIncome).toBe(false);
    expect(result.rate).toBe(PENSION_RATE_LOW_INCOME);
    expect(result.eligibleTotal).toBe(PENSION_TOTAL_LIMIT);
    expect(result.estimatedCredit).toBe(Math.round(PENSION_TOTAL_LIMIT * PENSION_RATE_LOW_INCOME));
  });

  it('applies the high-income rate (13.2%) when total salary exceeds the threshold', () => {
    const result = calculatePensionTaxCredit({
      pensionSavingsContribution: 6_000_000,
      irpContribution: 3_000_000,
      totalSalary: 80_000_000,
    });
    expect(result.isHighIncome).toBe(true);
    expect(result.rate).toBe(PENSION_RATE_HIGH_INCOME);
  });

  it('falls back to global income when total salary is not provided', () => {
    const result = calculatePensionTaxCredit({
      pensionSavingsContribution: 1_000_000,
      irpContribution: 0,
      globalIncome: 46_000_000,
    });
    expect(result.isHighIncome).toBe(true);
  });

  it('caps pension savings alone at 6,000,000 even if more is contributed', () => {
    const result = calculatePensionTaxCredit({
      pensionSavingsContribution: 10_000_000,
      irpContribution: 0,
      totalSalary: 40_000_000,
    });
    expect(result.eligiblePensionSavings).toBe(PENSION_SAVINGS_LIMIT);
  });

  it('caps the combined pension savings + IRP total at 9,000,000', () => {
    const result = calculatePensionTaxCredit({
      pensionSavingsContribution: 6_000_000,
      irpContribution: 6_000_000,
      totalSalary: 40_000_000,
    });
    expect(result.eligibleTotal).toBe(PENSION_TOTAL_LIMIT);
    expect(result.remainingRoom).toBe(0);
  });

  it('reports remaining room correctly when under the limit', () => {
    const result = calculatePensionTaxCredit({
      pensionSavingsContribution: 2_000_000,
      irpContribution: 1_000_000,
      totalSalary: 40_000_000,
    });
    expect(result.eligibleTotal).toBe(3_000_000);
    expect(result.remainingRoom).toBe(PENSION_TOTAL_LIMIT - 3_000_000);
  });

  it('adds an ISA-transfer bonus (10% of transfer, capped) on top of the base limit', () => {
    const result = calculatePensionTaxCredit({
      pensionSavingsContribution: 6_000_000,
      irpContribution: 3_000_000,
      totalSalary: 40_000_000,
      isaTransferAmount: 50_000_000, // 10% = 5,000,000 > cap
    });
    expect(result.isaTransferBonus).toBe(ISA_TRANSFER_BONUS_CAP);
    expect(result.effectiveLimit).toBe(PENSION_TOTAL_LIMIT + ISA_TRANSFER_BONUS_CAP);
  });

  it('never returns negative values for zero or missing contributions', () => {
    const result = calculatePensionTaxCredit({ pensionSavingsContribution: 0, irpContribution: 0 });
    expect(result.eligibleTotal).toBe(0);
    expect(result.estimatedCredit).toBe(0);
    expect(result.remainingRoom).toBe(PENSION_TOTAL_LIMIT);
  });
});

describe('calculateIsaTax', () => {
  it('uses the general non-taxable limit for general-type ISA', () => {
    const result = calculateIsaTax({ isaType: 'general', realizedGain: 1_000_000 });
    expect(result.nonTaxableLimit).toBe(ISA_NON_TAXABLE_LIMIT_GENERAL);
    expect(result.taxableExcess).toBe(0);
    expect(result.estimatedTax).toBe(0);
  });

  it('uses the higher non-taxable limit for preferential-type ISA', () => {
    const result = calculateIsaTax({ isaType: 'preferential', realizedGain: 3_000_000 });
    expect(result.nonTaxableLimit).toBe(ISA_NON_TAXABLE_LIMIT_PREFERENTIAL);
    expect(result.taxableExcess).toBe(0);
  });

  it('taxes the excess above the non-taxable limit at 9.9%', () => {
    const result = calculateIsaTax({ isaType: 'general', realizedGain: 5_000_000 });
    const expectedExcess = 5_000_000 - ISA_NON_TAXABLE_LIMIT_GENERAL;
    expect(result.taxableExcess).toBe(expectedExcess);
    expect(result.estimatedTax).toBe(Math.round(expectedExcess * ISA_EXCESS_GAIN_TAX_RATE));
  });

  it('reports tax savings compared to a general (non-ISA) account', () => {
    const result = calculateIsaTax({ isaType: 'general', realizedGain: 5_000_000 });
    expect(result.taxSavingsVsGeneral).toBeGreaterThan(0);
  });

  it('never returns negative excess for gains under the limit', () => {
    const result = calculateIsaTax({ isaType: 'general', realizedGain: 0 });
    expect(result.taxableExcess).toBe(0);
    expect(result.estimatedTax).toBe(0);
    expect(result.taxSavingsVsGeneral).toBe(0);
  });
});
