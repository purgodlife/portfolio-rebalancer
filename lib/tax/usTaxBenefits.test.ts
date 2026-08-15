import { describe, expect, it } from 'vitest';
import {
  calculate401kLimit,
  calculateIraContributionLimit,
  calculateTraditionalIraDeduction,
  calculateRothIraEligibility,
  estimateLtcgBracket,
  US_401K_EMPLOYEE_LIMIT,
  US_401K_CATCHUP_50,
  US_401K_CATCHUP_60_63,
  US_IRA_CONTRIBUTION_LIMIT,
  US_IRA_CATCHUP_50,
} from './usTaxBenefits';

describe('calculate401kLimit', () => {
  it('applies no catch-up under 50', () => {
    const r = calculate401kLimit(35);
    expect(r).toEqual({ employeeLimit: US_401K_EMPLOYEE_LIMIT, catchUp: 0, total: US_401K_EMPLOYEE_LIMIT });
  });

  it('applies standard catch-up for 50-59', () => {
    const r = calculate401kLimit(55);
    expect(r.catchUp).toBe(US_401K_CATCHUP_50);
    expect(r.total).toBe(US_401K_EMPLOYEE_LIMIT + US_401K_CATCHUP_50);
  });

  it('applies higher catch-up for ages 60-63', () => {
    const r = calculate401kLimit(61);
    expect(r.catchUp).toBe(US_401K_CATCHUP_60_63);
  });

  it('reverts to standard catch-up at 64+', () => {
    const r = calculate401kLimit(64);
    expect(r.catchUp).toBe(US_401K_CATCHUP_50);
  });
});

describe('calculateIraContributionLimit', () => {
  it('has no catch-up under 50', () => {
    expect(calculateIraContributionLimit(40)).toEqual({
      base: US_IRA_CONTRIBUTION_LIMIT,
      catchUp: 0,
      total: US_IRA_CONTRIBUTION_LIMIT,
    });
  });

  it('adds catch-up at 50+', () => {
    const r = calculateIraContributionLimit(50);
    expect(r.catchUp).toBe(US_IRA_CATCHUP_50);
    expect(r.total).toBe(US_IRA_CONTRIBUTION_LIMIT + US_IRA_CATCHUP_50);
  });
});

describe('calculateTraditionalIraDeduction', () => {
  it('is fully deductible when neither spouse is covered by a workplace plan', () => {
    const r = calculateTraditionalIraDeduction({
      filingStatus: 'single',
      magi: 500_000,
      coveredByWorkplacePlan: false,
      contribution: 7_500,
    });
    expect(r.applicablePhaseOut).toBe(false);
    expect(r.deductibleAmount).toBe(7_500);
  });

  it('is fully deductible below the phase-out start for a covered single filer', () => {
    const r = calculateTraditionalIraDeduction({
      filingStatus: 'single',
      magi: 70_000,
      coveredByWorkplacePlan: true,
      contribution: 7_500,
    });
    expect(r.deductibleFraction).toBe(1);
    expect(r.deductibleAmount).toBe(7_500);
  });

  it('partially phases out within the range for a covered single filer', () => {
    const r = calculateTraditionalIraDeduction({
      filingStatus: 'single',
      magi: 86_000, // midpoint of 81,000-91,000
      coveredByWorkplacePlan: true,
      contribution: 7_500,
    });
    expect(r.deductibleFraction).toBeCloseTo(0.5, 5);
    expect(r.deductibleAmount).toBe(3_750);
  });

  it('is fully non-deductible above the phase-out end', () => {
    const r = calculateTraditionalIraDeduction({
      filingStatus: 'single',
      magi: 95_000,
      coveredByWorkplacePlan: true,
      contribution: 7_500,
    });
    expect(r.deductibleAmount).toBe(0);
    expect(r.nonDeductibleAmount).toBe(7_500);
  });

  it('uses the higher spouse-covered-only range for MFJ', () => {
    const r = calculateTraditionalIraDeduction({
      filingStatus: 'marriedFilingJointly',
      magi: 245_000, // within 242,000-252,000 spouse-covered range
      coveredByWorkplacePlan: false,
      spouseCoveredByWorkplacePlan: true,
      contribution: 7_500,
    });
    expect(r.applicablePhaseOut).toBe(true);
    expect(r.deductibleFraction).toBeGreaterThan(0);
    expect(r.deductibleFraction).toBeLessThan(1);
  });
});

describe('calculateRothIraEligibility', () => {
  it('allows the full desired contribution below the phase-out start', () => {
    const r = calculateRothIraEligibility({
      filingStatus: 'single',
      magi: 100_000,
      age: 40,
      desiredContribution: 7_500,
    });
    expect(r.eligibleFraction).toBe(1);
    expect(r.maxAllowedContribution).toBe(7_500);
    expect(r.disallowedAmount).toBe(0);
  });

  it('partially restricts contributions within the phase-out range', () => {
    const r = calculateRothIraEligibility({
      filingStatus: 'single',
      magi: 160_500, // midpoint of 153,000-168,000
      age: 40,
      desiredContribution: 7_500,
    });
    expect(r.eligibleFraction).toBeCloseTo(0.5, 5);
    expect(r.maxAllowedContribution).toBeLessThan(7_500);
    expect(r.disallowedAmount).toBeGreaterThan(0);
  });

  it('disallows contributions entirely above the phase-out end', () => {
    const r = calculateRothIraEligibility({
      filingStatus: 'single',
      magi: 200_000,
      age: 40,
      desiredContribution: 7_500,
    });
    expect(r.maxAllowedContribution).toBe(0);
    expect(r.disallowedAmount).toBe(7_500);
  });

  it('includes the age 50+ catch-up in the base contribution limit', () => {
    const r = calculateRothIraEligibility({
      filingStatus: 'single',
      magi: 50_000,
      age: 55,
      desiredContribution: 100_000,
    });
    expect(r.contributionLimit).toBe(US_IRA_CONTRIBUTION_LIMIT + US_IRA_CATCHUP_50);
    expect(r.maxAllowedContribution).toBe(US_IRA_CONTRIBUTION_LIMIT + US_IRA_CATCHUP_50);
  });
});

describe('estimateLtcgBracket', () => {
  it('returns 0% at or below the zero-rate threshold', () => {
    expect(estimateLtcgBracket('single', 40_000).bracketLabel).toBe('0%');
    expect(estimateLtcgBracket('single', 49_450).bracketLabel).toBe('0%');
  });

  it('returns 15% between the thresholds', () => {
    expect(estimateLtcgBracket('single', 100_000).bracketLabel).toBe('15%');
    expect(estimateLtcgBracket('marriedFilingJointly', 200_000).bracketLabel).toBe('15%');
  });

  it('returns 20% above the 15% threshold', () => {
    expect(estimateLtcgBracket('single', 600_000).bracketLabel).toBe('20%');
    expect(estimateLtcgBracket('marriedFilingJointly', 700_000).bracketLabel).toBe('20%');
  });
});
