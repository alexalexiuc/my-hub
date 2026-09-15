/**
 * Portfolio math helpers (pure, no DB)
 * - projectPortfolioGrowth(opts) — monthly compound-growth projection series
 * - PROJECTION_HORIZON_MONTHS — default projection horizon (120 = 10 years)
 * - sumAllocations(targets) — sum of target allocation percentages
 * - allocationsSumTo100(targets) — true when targets sum to 100 within tolerance
 * - ALLOCATION_SUM_TOLERANCE — allowed drift from 100 when validating targets
 * - computeContributionCadence(opts) — DCA schedule adherence: ahead/behind + next contribution due
 * Types: ProjectionOpts, ProjectionPoint, ContributionCadenceOpts, ContributionCadence
 */
import {
  ContributionCadenceStatuses,
  DEFAULT_CADENCE_TOLERANCE_PCT,
  type ContributionCadenceStatus,
} from '../constants/finances';
import { monthsBetweenStr, shiftMonthStr } from './dates';

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

// ─── Contribution cadence (DCA schedule adherence) ─────────────────────────

export interface ContributionCadenceOpts {
  /** The plan: cash expected to be contributed each month. Must be > 0. */
  plannedMonthlyContribution: number;
  /** Total cash contributed so far (Σ supply totals). */
  contributedToDate: number;
  /** First month the plan accrues, YYYY-MM — usually the first supply's month. */
  anchorMonth: string;
  /** The month "now" falls in, YYYY-MM. */
  currentMonth: string;
  /** Tolerance band as a percentage of one monthly contribution. */
  tolerancePct?: number;
}

export interface ContributionCadence {
  anchorMonth: string;
  currentMonth: string;
  plannedMonthlyContribution: number;
  /** Months from the anchor through the current month, inclusive. 0 when the anchor is in the future. */
  monthsElapsed: number;
  /** monthsElapsed × plannedMonthlyContribution — what the plan asks for by now. */
  expectedToDate: number;
  contributedToDate: number;
  /** contributedToDate − expectedToDate. Positive = ahead of plan. */
  difference: number;
  /** difference expressed in months of contribution (fractional, signed). */
  monthsDifference: number;
  /** The band inside which a slightly-off contribution still counts as on track. */
  toleranceAmount: number;
  status: ContributionCadenceStatus;
  /** Whole months of the plan already funded, counting from the anchor. */
  monthsFunded: number;
  /** Last month fully covered by contributions; null when nothing is funded yet. */
  coveredThroughMonth: string | null;
  /** First month not yet funded — when the next round of buying is due. */
  nextContributionMonth: string;
  /** True when nextContributionMonth has already arrived. */
  dueNow: boolean;
  /** Cash needed to get back on plan through the current month. 0 when on track or ahead. */
  amountDueNow: number;
  /** Whole months funded beyond the current one — "you can skip this many". */
  monthsAhead: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Measures cash contributions against a flat monthly contribution plan
 * (dollar-cost averaging), the way savings-plan trackers do: the plan accrues
 * one contribution per calendar month from `anchorMonth` through the current
 * month inclusive, and every euro contributed is drawn against that accrual.
 *
 * The surplus is expressed two ways — as an amount (`difference`) and as a
 * paid-through date (`coveredThroughMonth` / `nextContributionMonth`) — so a
 * lump sum answers "which month do I buy again?" directly. Contributing 2×
 * the monthly amount in August funds September too, and the next contribution
 * falls due in October.
 *
 * Real contributions rarely land on the exact planned figure, so a tolerance
 * band of `tolerancePct`% of one monthly contribution is applied in both
 * directions: inside the band the status is `on_track`, and a month that is
 * funded to within the band counts as funded rather than leaving a stray
 * few euros outstanding.
 *
 * Returns null when there is no plan to measure against (contribution ≤ 0).
 */
export function computeContributionCadence(opts: ContributionCadenceOpts): ContributionCadence | null {
  const {
    plannedMonthlyContribution: planned,
    contributedToDate,
    anchorMonth,
    currentMonth,
    tolerancePct = DEFAULT_CADENCE_TOLERANCE_PCT,
  } = opts;
  if (!(planned > 0)) return null;

  // An anchor in the future has not started accruing yet.
  const monthsElapsed = Math.max(0, monthsBetweenStr(anchorMonth, currentMonth) + 1);
  const expectedToDate = monthsElapsed * planned;
  const difference = contributedToDate - expectedToDate;
  const toleranceAmount = (planned * tolerancePct) / 100;

  const status: ContributionCadenceStatus =
    difference > toleranceAmount
      ? ContributionCadenceStatuses.Ahead
      : difference < -toleranceAmount
        ? ContributionCadenceStatuses.Behind
        : ContributionCadenceStatuses.OnTrack;

  // Crediting the tolerance before flooring stops a contribution that is a few
  // euros short of the plan from leaving its month counted as unfunded.
  const monthsFunded = Math.max(0, Math.floor((contributedToDate + toleranceAmount) / planned));
  const nextContributionMonth = shiftMonthStr(anchorMonth, monthsFunded);

  return {
    anchorMonth,
    currentMonth,
    plannedMonthlyContribution: planned,
    monthsElapsed,
    expectedToDate: round2(expectedToDate),
    contributedToDate: round2(contributedToDate),
    difference: round2(difference),
    monthsDifference: round2(difference / planned),
    toleranceAmount: round2(toleranceAmount),
    status,
    monthsFunded,
    coveredThroughMonth: monthsFunded > 0 ? shiftMonthStr(anchorMonth, monthsFunded - 1) : null,
    nextContributionMonth,
    dueNow: nextContributionMonth <= currentMonth,
    amountDueNow: difference < 0 ? round2(-difference) : 0,
    monthsAhead: Math.max(0, monthsFunded - monthsElapsed),
  };
}
