import { describe, expect, it } from 'vitest';
import { computeContributionCadence, projectPortfolioGrowth } from './portfolio';

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

describe('computeContributionCadence', () => {
  // Plan: 1000/month from January 2026. "Now" is September 2026, so the plan
  // has asked for 9 × 1000 = 9000 by now.
  const base = {
    plannedMonthlyContribution: 1000,
    anchorMonth: '2026-01',
    currentMonth: '2026-09',
  };

  it('returns null when there is no plan to measure against', () => {
    expect(computeContributionCadence({ ...base, plannedMonthlyContribution: 0, contributedToDate: 5000 })).toBeNull();
  });

  it('counts the current month as due — expected is inclusive of it', () => {
    const cadence = computeContributionCadence({ ...base, contributedToDate: 9000 })!;
    expect(cadence.monthsElapsed).toBe(9);
    expect(cadence.expectedToDate).toBe(9000);
    expect(cadence.difference).toBe(0);
    expect(cadence.status).toBe('on_track');
  });

  it('paying exactly to date covers through the current month and defers the next buy', () => {
    const cadence = computeContributionCadence({ ...base, contributedToDate: 9000 })!;
    expect(cadence.monthsFunded).toBe(9);
    expect(cadence.coveredThroughMonth).toBe('2026-09');
    expect(cadence.nextContributionMonth).toBe('2026-10');
    expect(cadence.dueNow).toBe(false);
    expect(cadence.monthsAhead).toBe(0);
    expect(cadence.amountDueNow).toBe(0);
  });

  it('a double contribution funds the following month too', () => {
    // Jan–Aug paid normally (8000) plus an extra 1000 in August.
    const cadence = computeContributionCadence({ ...base, contributedToDate: 10000 })!;
    expect(cadence.status).toBe('ahead');
    expect(cadence.difference).toBe(1000);
    expect(cadence.monthsDifference).toBe(1);
    expect(cadence.monthsAhead).toBe(1);
    expect(cadence.coveredThroughMonth).toBe('2026-10');
    expect(cadence.nextContributionMonth).toBe('2026-11');
    expect(cadence.dueNow).toBe(false);
  });

  it('reports a shortfall and an overdue month when behind', () => {
    const cadence = computeContributionCadence({ ...base, contributedToDate: 7000 })!;
    expect(cadence.status).toBe('behind');
    expect(cadence.difference).toBe(-2000);
    expect(cadence.amountDueNow).toBe(2000);
    expect(cadence.coveredThroughMonth).toBe('2026-07');
    expect(cadence.nextContributionMonth).toBe('2026-08');
    expect(cadence.dueNow).toBe(true);
    expect(cadence.monthsAhead).toBe(0);
  });

  it('tolerates a contribution that lands slightly off the planned amount', () => {
    // 50 short of the 9000 plan — inside the default 10% (100) band.
    const cadence = computeContributionCadence({ ...base, contributedToDate: 8950 })!;
    expect(cadence.status).toBe('on_track');
    expect(cadence.monthsFunded).toBe(9);
    expect(cadence.coveredThroughMonth).toBe('2026-09');
    expect(cadence.nextContributionMonth).toBe('2026-10');
    // The gap is still reported even though the status forgives it.
    expect(cadence.amountDueNow).toBe(50);
  });

  it('falls out of the band once the drift exceeds the tolerance', () => {
    const cadence = computeContributionCadence({ ...base, contributedToDate: 8800 })!;
    expect(cadence.status).toBe('behind');
    expect(cadence.nextContributionMonth).toBe('2026-09');
    expect(cadence.dueNow).toBe(true);
  });

  it('honours a custom tolerance', () => {
    const opts = { ...base, contributedToDate: 8800 };
    expect(computeContributionCadence({ ...opts, tolerancePct: 25 })!.status).toBe('on_track');
    expect(computeContributionCadence({ ...opts, tolerancePct: 0 })!.status).toBe('behind');
  });

  it('treats an anchor in the future as not yet accruing', () => {
    const cadence = computeContributionCadence({
      ...base,
      anchorMonth: '2026-12',
      contributedToDate: 0,
    })!;
    expect(cadence.monthsElapsed).toBe(0);
    expect(cadence.expectedToDate).toBe(0);
    expect(cadence.status).toBe('on_track');
    expect(cadence.coveredThroughMonth).toBeNull();
    expect(cadence.nextContributionMonth).toBe('2026-12');
    expect(cadence.dueNow).toBe(false);
  });

  it('spans a year boundary', () => {
    const cadence = computeContributionCadence({
      plannedMonthlyContribution: 500,
      anchorMonth: '2025-11',
      currentMonth: '2026-02',
      contributedToDate: 3000,
    })!;
    expect(cadence.monthsElapsed).toBe(4); // Nov, Dec, Jan, Feb
    expect(cadence.expectedToDate).toBe(2000);
    expect(cadence.monthsFunded).toBe(6);
    expect(cadence.coveredThroughMonth).toBe('2026-04');
    expect(cadence.nextContributionMonth).toBe('2026-05');
    expect(cadence.monthsAhead).toBe(2);
  });

  it('handles nothing contributed yet', () => {
    const cadence = computeContributionCadence({ ...base, contributedToDate: 0 })!;
    expect(cadence.monthsFunded).toBe(0);
    expect(cadence.coveredThroughMonth).toBeNull();
    expect(cadence.nextContributionMonth).toBe('2026-01');
    expect(cadence.dueNow).toBe(true);
    expect(cadence.amountDueNow).toBe(9000);
  });
});
