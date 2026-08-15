import { describe, expect, it } from 'vitest';
import { classifyHoldingTerm, estimateUsSaleTax, LONG_TERM_THRESHOLD_DAYS } from './usCapitalGains';

const DAY_MS = 1000 * 60 * 60 * 24;

describe('classifyHoldingTerm', () => {
  it('classifies as short-term when there are no buy lots', () => {
    expect(classifyHoldingTerm([], Date.now())).toBe('short');
  });

  it('classifies as long-term when the weighted-average buy date is over 365 days ago', () => {
    const asOf = Date.UTC(2026, 7, 15);
    const term = classifyHoldingTerm(
      [{ quantity: 10, createdAtMs: asOf - LONG_TERM_THRESHOLD_DAYS * DAY_MS - DAY_MS }],
      asOf
    );
    expect(term).toBe('long');
  });

  it('classifies as short-term when the weighted-average buy date is under 365 days ago', () => {
    const asOf = Date.UTC(2026, 7, 15);
    const term = classifyHoldingTerm([{ quantity: 10, createdAtMs: asOf - 30 * DAY_MS }], asOf);
    expect(term).toBe('short');
  });

  it('weights multiple buy lots by quantity', () => {
    const asOf = Date.UTC(2026, 7, 15);
    // 9 shares bought 500 days ago, 1 share bought yesterday -> weighted average is still > 365 days
    const term = classifyHoldingTerm(
      [
        { quantity: 9, createdAtMs: asOf - 500 * DAY_MS },
        { quantity: 1, createdAtMs: asOf - 1 * DAY_MS },
      ],
      asOf
    );
    expect(term).toBe('long');
  });
});

describe('estimateUsSaleTax', () => {
  it('applies the long-term rate for long-term holdings', () => {
    const result = estimateUsSaleTax({
      realizedGainUsd: 1000,
      term: 'long',
      longTermRate: 0.15,
      shortTermRate: 0.22,
      subjectToNiit: false,
    });
    expect(result.estimatedTaxUsd).toBeCloseTo(150, 5);
    expect(result.appliedRate).toBeCloseTo(0.15, 5);
  });

  it('applies the short-term rate for short-term holdings', () => {
    const result = estimateUsSaleTax({
      realizedGainUsd: 1000,
      term: 'short',
      longTermRate: 0.15,
      shortTermRate: 0.22,
      subjectToNiit: false,
    });
    expect(result.estimatedTaxUsd).toBeCloseTo(220, 5);
  });

  it('adds NIIT on top of the base rate when subject to it', () => {
    const result = estimateUsSaleTax({
      realizedGainUsd: 1000,
      term: 'long',
      longTermRate: 0.15,
      shortTermRate: 0.22,
      subjectToNiit: true,
    });
    expect(result.appliedRate).toBeCloseTo(0.188, 5);
    expect(result.estimatedTaxUsd).toBeCloseTo(188, 5);
  });

  it('does not tax a loss', () => {
    const result = estimateUsSaleTax({
      realizedGainUsd: -500,
      term: 'long',
      longTermRate: 0.15,
      shortTermRate: 0.22,
      subjectToNiit: false,
    });
    expect(result.estimatedTaxUsd).toBe(0);
  });
});
