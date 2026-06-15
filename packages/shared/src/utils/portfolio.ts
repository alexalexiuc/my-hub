/**
 * Portfolio math helpers (pure, no DB)
 * - projectPortfolioGrowth(opts) — monthly compound-growth projection series
 * - PROJECTION_HORIZON_MONTHS — default projection horizon (120 = 10 years)
 * - sumAllocations(targets) — sum of target allocation percentages
 * - allocationsSumTo100(targets) — true when targets sum to 100 within tolerance
 * - ALLOCATION_SUM_TOLERANCE — allowed drift from 100 when validating targets
 * Types: ProjectionOpts, ProjectionPoint
 */

/** Allowed drift from 100% when validating target allocations. */
export const ALLOCATION_SUM_TOLERANCE = 0.01;

/** Sum of target allocation percentages. */
export function sumAllocations(targets: number[]): number {
  return targets.reduce((acc, t) => acc + t, 0);
}

/** True when the target allocations sum to 100% within {@link ALLOCATION_SUM_TOLERANCE}. */
export function allocationsSumTo100(targets: number[]): boolean {
  return Math.abs(sumAllocations(targets) - 100) <= ALLOCATION_SUM_TOLERANCE;
}

export interface ProjectionOpts {
  /** Starting portfolio value (today's value or contributed total). */
  startValue: number;
  /** Cash added at the end of each projected month. */
  monthlyContribution: number;
  /** Annual return as a percentage, e.g. 7 for 7%. May be negative. */
  annualReturnPct: number;
  /** Number of months to project. */
  months: number;
}

export interface ProjectionPoint {
  /** 0 = today (startValue), 1 = one month out, ... */
  monthIndex: number;
  value: number;
}

/** Default projection horizon: 10 years of monthly points. */
export const PROJECTION_HORIZON_MONTHS = 120;

/**
 * Projects portfolio value with monthly compounding and a fixed monthly contribution.
 *
 * value_{m+1} = value_m × (1 + r)^(1/12) + contribution, where r = annualReturnPct / 100.
 *
 * Returns months + 1 points; point 0 is the unmodified startValue.
 */
export function projectPortfolioGrowth(opts: ProjectionOpts): ProjectionPoint[] {
  const { startValue, monthlyContribution, annualReturnPct, months } = opts;
  const monthlyGrowth = Math.pow(1 + annualReturnPct / 100, 1 / 12);

  const points: ProjectionPoint[] = [{ monthIndex: 0, value: startValue }];
  let value = startValue;
  for (let m = 1; m <= months; m++) {
    value = value * monthlyGrowth + monthlyContribution;
    points.push({ monthIndex: m, value });
  }
  return points;
}
