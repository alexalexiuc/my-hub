import { describe, expect, it } from 'vitest';
import { projectPortfolioGrowth } from './portfolio';

describe('projectPortfolioGrowth', () => {
  it('returns months + 1 points starting at startValue', () => {
    const points = projectPortfolioGrowth({
      startValue: 1000,
      monthlyContribution: 0,
      annualReturnPct: 7,
      months: 12,
    });
    expect(points).toHaveLength(13);
    expect(points[0]).toEqual({ monthIndex: 0, value: 1000 });
  });

  it('with 0% return grows linearly by the contribution', () => {
    const points = projectPortfolioGrowth({
      startValue: 500,
      monthlyContribution: 100,
      annualReturnPct: 0,
      months: 6,
    });
    expect(points[6]!.value).toBeCloseTo(500 + 6 * 100, 8);
  });

  it('with no contribution compounds to startValue × (1 + r) after 12 months', () => {
    const points = projectPortfolioGrowth({
      startValue: 1000,
      monthlyContribution: 0,
      annualReturnPct: 7,
      months: 12,
    });
    expect(points[12]!.value).toBeCloseTo(1070, 6);
  });

  it('handles negative returns', () => {
    const points = projectPortfolioGrowth({
      startValue: 1000,
      monthlyContribution: 0,
      annualReturnPct: -10,
      months: 12,
    });
    expect(points[12]!.value).toBeCloseTo(900, 6);
  });
});
