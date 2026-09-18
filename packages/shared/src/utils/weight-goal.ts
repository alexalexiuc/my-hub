/**
 * Weight-goal projection and trend maths.
 *
 * Exports:
 *   dailyGoalDeltaKg      — the per-day weight change a weekly goal rate implies
 *   resolveGoalAnchor     — the fixed point a goal projection runs from
 *   projectedWeightOn     — the goal line's value on a given date
 *   buildWeightTrend      — exponentially-weighted smoothing of raw weigh-ins
 *   trendRateKgPerWeek    — the actual kg/week slope of a smoothed series
 *   trendOn               — the trend value as at a given date
 *   goalJourney           — how far a goal has come, and how far is left, against a target weight
 *   projectGoalDate       — when a target weight is reached at a given rate
 *   daysBetweenDateStr    — whole days from one YYYY-MM-DD to another
 *
 * All pure: no DB, no clock, no side effects. Shared so the Hub progress card and the email
 * reports judge a goal the same way instead of each re-deriving it.
 */
import { GoalTypes, type GoalType } from '../constants/calories';
import { shiftDateStr } from './dates';

/** One weigh-in, reduced to what the goal maths needs. */
export interface WeightSample {
  /** YYYY-MM-DD */
  date: string;
  /** kg */
  value: number;
}

/** A smoothed weigh-in: the raw reading plus the trend value at that date. */
export interface WeightTrendPoint extends WeightSample {
  /** Exponentially-weighted mean of every reading up to and including this one, in kg. */
  trend: number;
}

/** The fixed point a goal projection runs from. */
export interface GoalAnchor {
  /** YYYY-MM-DD */
  date: string;
  /** kg */
  weightKg: number;
  /**
   * `profile` — the user's stored goal baseline, the authoritative case.
   * `inferred` — no baseline stored, so the oldest weigh-in on hand stands in. Callers should
   * say so rather than presenting an inferred target as the user's own.
   */
  source: 'profile' | 'inferred';
}

/**
 * The default smoothing factor for {@link buildWeightTrend}, **per day elapsed** rather than per
 * reading. 0.1 gives a half-life of about 6.6 days, which is the long-standing "trend weight"
 * setting: slow enough that a salty weekend moves the line by ~0.15 kg rather than the 1–1.5 kg
 * the scale actually shows, fast enough to turn within a fortnight when the trajectory changes.
 */
export const WEIGHT_TREND_ALPHA = 0.1;

/**
 * The daily weight change implied by a weekly goal: negative for loss, positive for gain, zero
 * for maintain. Returns null when the goal cannot imply one — no rate given, or a rate that is
 * zero or negative, which would describe a goal moving the wrong way.
 */
export function dailyGoalDeltaKg(goalType: string | null, goalWeeklyRateKg: number | null): number | null {
  if (goalType === GoalTypes.Maintain) return 0;
  if (!goalWeeklyRateKg || goalWeeklyRateKg <= 0) return null;
  if (goalType === GoalTypes.WeightLoss) return -(goalWeeklyRateKg / 7);
  if (goalType === GoalTypes.WeightGain) return goalWeeklyRateKg / 7;
  return null;
}

/** Whole days from `from` to `to`, negative when `to` precedes `from`. Both YYYY-MM-DD. */
export function daysBetweenDateStr(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The point a goal projection runs from. Prefers the baseline stored on the profile, which is
 * stamped when the goal is set and only moves when the user deliberately resets it — that is what
 * keeps a goal cumulative across weeks instead of restarting every Monday.
 *
 * Falls back to the oldest weigh-in supplied, flagged `inferred`, so a profile that predates the
 * stored baseline still draws a line rather than showing nothing.
 *
 * @param profile   Stored baseline, if any. Both fields must be present to be used.
 * @param samples   Weigh-ins in any order; only the oldest matters for the fallback.
 */
export function resolveGoalAnchor(
  profile: { goalStartDate?: string | null; goalStartWeightKg?: number | null } | null | undefined,
  samples: WeightSample[],
): GoalAnchor | null {
  const { goalStartDate, goalStartWeightKg } = profile ?? {};
  if (goalStartDate && typeof goalStartWeightKg === 'number') {
    return { date: goalStartDate, weightKg: goalStartWeightKg, source: 'profile' };
  }

  let oldest: WeightSample | null = null;
  for (const sample of samples) {
    if (!oldest || sample.date < oldest.date) oldest = sample;
  }
  if (!oldest) return null;
  return { date: oldest.date, weightKg: oldest.value, source: 'inferred' };
}

/**
 * The goal line's value on `date`: the anchor weight moved by `dailyDelta` for every day since
 * the anchor. Extends backwards as readily as forwards, so a chart window that opens before the
 * goal started still shows where the line came from.
 */
export function projectedWeightOn(anchor: GoalAnchor, dailyDelta: number, date: string): number {
  return anchor.weightKg + dailyDelta * daysBetweenDateStr(anchor.date, date);
}

/**
 * Smooths raw weigh-ins into a trend line using an exponentially-weighted moving average.
 *
 * Day-to-day scale readings swing by 1–1.5 kg on water and glycogen alone, which is larger than
 * the ~1 kg/week a goal moves — so judging a goal on single readings judges mostly noise. The
 * trend value is what should be compared against a projection; the raw value is kept alongside it
 * so a chart can still plot what the scale actually said.
 *
 * The decay is **time-aware**: `alpha` is per day elapsed, not per reading, so the weight carried
 * over from the previous trend is `(1 - alpha) ^ daysElapsed`. Stepping once per reading instead
 * would make the smoothing depend on how often someone happened to stand on the scale — a month
 * with nothing logged would advance the average by a single step, so the line coming out of the
 * gap still mostly described the weight going into it. Elapsed time is what should decay
 * confidence in a stale reading, and after a four-week gap the next weigh-in nearly resets the
 * trend to itself (alpha 0.1 over 28 days is an effective 0.95).
 *
 * Gaps are still not interpolated — no weigh-ins are invented for the missing days.
 *
 * Readings sharing a date are averaged into one value first: two measurements of the same morning
 * measure the same quantity, and a time-aware step would otherwise give the second a zero-length
 * interval and therefore no weight at all. Both are still returned, carrying that day's trend.
 *
 * @param samples  Weigh-ins in any order; sorted oldest-first internally.
 * @param alpha    Per-day smoothing factor in (0, 1]. Higher follows the scale more closely.
 * @returns        Oldest-first points, each carrying its raw value and the trend at that date.
 */
export function buildWeightTrend(samples: WeightSample[], alpha: number = WEIGHT_TREND_ALPHA): WeightTrendPoint[] {
  const ordered = [...samples].sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length === 0) return [];

  const totals = new Map<string, { sum: number; count: number }>();
  for (const sample of ordered) {
    const bucket = totals.get(sample.date);
    if (bucket) {
      bucket.sum += sample.value;
      bucket.count += 1;
    } else {
      totals.set(sample.date, { sum: sample.value, count: 1 });
    }
  }

  // `totals` was filled in date order, and Map iterates by insertion, so this walks chronologically.
  const trendByDate = new Map<string, number>();
  let trend: number | null = null;
  let previousDate: string | null = null;
  for (const [date, { sum, count }] of totals) {
    const value = sum / count;
    if (trend === null || previousDate === null) {
      trend = value;
    } else {
      const elapsedDays = Math.max(1, daysBetweenDateStr(previousDate, date));
      const effectiveAlpha = 1 - Math.pow(1 - alpha, elapsedDays);
      trend += effectiveAlpha * (value - trend);
    }
    trendByDate.set(date, trend);
    previousDate = date;
  }

  return ordered.map(sample => ({ date: sample.date, value: sample.value, trend: trendByDate.get(sample.date)! }));
}

/**
 * The actual rate a smoothed series is moving, in kg per week: the least-squares slope of trend
 * against day offset, times seven. Negative for loss.
 *
 * This is the number worth acting on — it says whether the deficit is the right size, where a
 * kg-ahead/behind figure only says where you happen to have landed. Returns null below two points
 * or when every point shares one date, which give no slope.
 */
export function trendRateKgPerWeek(points: WeightTrendPoint[]): number | null {
  if (points.length < 2) return null;

  const origin = points[0]!.date;
  const xs = points.map(p => daysBetweenDateStr(origin, p.date));
  const ys = points.map(p => p.trend);

  const n = points.length;
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    covariance += dx * (ys[i]! - meanY);
    variance += dx * dx;
  }
  if (variance === 0) return null;

  return (covariance / variance) * 7;
}

/**
 * The trend value as at `date`: the most recent point on or before it. Used for "how much have I
 * moved in the last week", which has to tolerate a date with no weigh-in on it.
 *
 * @param points Oldest-first, as {@link buildWeightTrend} returns them.
 */
export function trendOn(points: WeightTrendPoint[], date: string): number | null {
  let found: WeightTrendPoint | null = null;
  for (const point of points) {
    if (point.date > date) break;
    found = point;
  }
  return found?.trend ?? null;
}

/** How far a goal has come towards a target weight, and how far is left. All figures signed. */
export interface GoalJourney {
  /** Change so far, on the trend: negative for weight lost. */
  changedKg: number;
  /** The whole distance from baseline to target. */
  totalKg: number;
  /** What is left to go. */
  remainingKg: number;
  /** Share of the distance covered, 0–100, clamped — moving the wrong way reads 0, not negative. */
  pct: number;
}

/**
 * Progress from the goal's baseline towards a target weight.
 *
 * Returns null when the target describes no journey (it equals the baseline) or sits on the wrong
 * side of it for the goal's direction — a loss goal with a target above the starting weight is a
 * data-entry mistake, and drawing a bar for it would invent progress in the wrong direction.
 *
 * @param expectedDirection Sign the journey should run in: negative for loss, positive for gain.
 *   Pass 0 to skip the direction check.
 */
export function goalJourney(
  anchor: GoalAnchor,
  targetWeightKg: number,
  currentTrendKg: number,
  expectedDirection = 0,
): GoalJourney | null {
  const totalKg = targetWeightKg - anchor.weightKg;
  if (Math.abs(totalKg) < 0.05) return null;
  if (expectedDirection !== 0 && Math.sign(totalKg) !== Math.sign(expectedDirection)) return null;

  const changedKg = currentTrendKg - anchor.weightKg;
  const pct = Math.min(100, Math.max(0, (changedKg / totalKg) * 100));

  return { changedKg, totalKg, remainingKg: targetWeightKg - currentTrendKg, pct };
}

/**
 * The date a target weight is reached, moving at `rateKgPerWeek` from `currentTrendKg`.
 *
 * Fed the *achieved* rate this answers "when will I actually get there"; fed the goal rate it
 * answers "when was the plan". Returns null when the rate is zero, points away from the target, or
 * implies a date more than ten years out — at that point it is not a forecast, and saying nothing
 * is more honest than printing a year the user would read as meaningful.
 *
 * @param today YYYY-MM-DD to count from.
 */
export function projectGoalDate(
  currentTrendKg: number,
  targetWeightKg: number,
  rateKgPerWeek: number | null,
  today: string,
): string | null {
  const remaining = targetWeightKg - currentTrendKg;
  if (Math.abs(remaining) < 0.05) return today;
  if (!rateKgPerWeek) return null;

  const weeks = remaining / rateKgPerWeek;
  if (!Number.isFinite(weeks) || weeks <= 0 || weeks > 520) return null;

  return shiftDateStr(today, Math.round(weeks * 7));
}

/**
 * Whether a delta from the goal line is the good direction for this goal type. A loss goal is
 * ahead when it sits below the line, a gain goal when it sits above; maintain has no good side.
 */
export function isAheadOfGoal(goalType: GoalType | string | null, deltaKg: number): boolean | null {
  if (goalType === GoalTypes.WeightLoss) return deltaKg < 0;
  if (goalType === GoalTypes.WeightGain) return deltaKg > 0;
  return null;
}
