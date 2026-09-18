import type { MealLog } from '@my-hub/shared/types';
import type { MealType } from '@my-hub/shared/constants';
import {
  buildWeightTrend,
  dailyGoalDeltaKg,
  dateToString,
  daysBetweenDateStr,
  projectedWeightOn,
  resolveGoalAnchor,
  trendRateKgPerWeek,
  type GoalAnchor,
  type WeightSample,
} from '@my-hub/shared/utils';

/** A weight entry, reduced to what the goal-progress maths needs. */
export type WeightPoint = WeightSample;

/** One plotted day on the goal-progress chart. */
export interface GoalProgressPoint {
  date: string;
  label: string;
  /** What the scale said, plotted faintly so the reading is still visible. */
  actual: number;
  /** The smoothed weight — what the goal is actually judged on. */
  trend: number;
  /** The cumulative goal line on this date. */
  projected: number;
}

/** Everything the goal-progress card renders, derived in one pass. */
export interface GoalProgressView {
  points: GoalProgressPoint[];
  anchor: GoalAnchor;
  /** Smoothed weight at the most recent weigh-in — the figure to compare against the goal. */
  currentTrendKg: number;
  /** The most recent raw weigh-in, shown alongside so the card matches the scale. */
  currentActualKg: number;
  /** Where the goal line sits today, however long ago the last weigh-in was. */
  projectedTodayKg: number;
  /** Trend minus projection: negative is below the line. */
  deltaKg: number;
  /** Total change since the anchor, on the trend. */
  totalChangeKg: number;
  /** The rate actually being achieved, or null before there are two weigh-ins to fit. */
  actualRateKgPerWeek: number | null;
  /** The goal's own rate, signed to match `actualRateKgPerWeek`. */
  goalRateKgPerWeek: number;
}

export interface GoalProgressInput {
  /** The user's full weight history, any order. Smoothing needs all of it, not just the window. */
  weightHistory: WeightPoint[];
  profile: { goalStartDate?: string | null; goalStartWeightKg?: number | null } | null | undefined;
  goalType: string | null;
  goalWeeklyRateKg: number | null;
  /** Earliest date to plot. Anything before it still feeds the trend, it just isn't drawn. */
  windowStart: string;
  /** Today as YYYY-MM-DD, passed in so the maths stays pure and testable. */
  today: string;
}

/**
 * Builds the goal-progress chart and its headline figures.
 *
 * Two things make this differ from a plain week view, and both are deliberate:
 *
 * 1. The projection runs from a fixed anchor (see `resolveGoalAnchor`), not from the current
 *    week's first weigh-in. A week that ends over target stays over target — it does not become
 *    the next week's baseline, which is what used to let a month of misses still read "on track".
 * 2. The goal is judged on the smoothed trend, not the raw reading. Daily scale noise is larger
 *    than a week of goal progress, so comparing single readings mostly compares water.
 *
 * Smoothing runs over the whole history before the window is applied, so the line entering the
 * window on the left is already warm rather than restarting at whatever that day's reading was.
 *
 * @returns null when there is no goal rate, no anchor, or no weigh-in inside the window.
 */
export function buildGoalProgressView(input: GoalProgressInput): GoalProgressView | null {
  const { weightHistory, profile, goalType, goalWeeklyRateKg, windowStart, today } = input;

  const dailyDelta = dailyGoalDeltaKg(goalType, goalWeeklyRateKg);
  if (dailyDelta === null) return null;

  const anchor = resolveGoalAnchor(profile, weightHistory);
  if (!anchor) return null;

  const trend = buildWeightTrend(weightHistory);
  const windowed = trend.filter(p => p.date >= windowStart && p.date <= today);
  const latest = windowed.at(-1) ?? trend.at(-1);
  if (!latest) return null;

  const points: GoalProgressPoint[] = windowed.map(p => ({
    date: p.date,
    label: p.date.slice(5),
    actual: p.value,
    trend: p.trend,
    projected: projectedWeightOn(anchor, dailyDelta, p.date),
  }));

  const projectedTodayKg = projectedWeightOn(anchor, dailyDelta, today);

  return {
    points,
    anchor,
    currentTrendKg: latest.trend,
    currentActualKg: latest.value,
    projectedTodayKg,
    deltaKg: latest.trend - projectedTodayKg,
    totalChangeKg: latest.trend - anchor.weightKg,
    actualRateKgPerWeek: trendRateKgPerWeek(windowed),
    goalRateKgPerWeek: dailyDelta * 7,
  };
}

/**
 * Weekly averages of a weigh-in series, oldest first, labelled by the week's first date.
 *
 * A year of daily weigh-ins drawn point-per-day is an unreadable smear on a phone; one point per
 * week keeps the shape of the trend while staying legible. Only used above a threshold — short
 * ranges are plotted as recorded.
 */
export function averageWeeklyWeights(samples: WeightPoint[]): WeightPoint[] {
  const ordered = [...samples].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered[0];
  if (!first) return [];

  const buckets = new Map<number, { date: string; sum: number; count: number }>();
  for (const sample of ordered) {
    const week = Math.floor(daysBetweenDateStr(first.date, sample.date) / 7);
    const bucket = buckets.get(week);
    if (bucket) {
      bucket.sum += sample.value;
      bucket.count += 1;
    } else {
      buckets.set(week, { date: sample.date, sum: sample.value, count: 1 });
    }
  }

  return [...buckets.values()].map(b => ({ date: b.date, value: b.sum / b.count }));
}

/**
 * Bar colour for one day's intake against that day's own target: red past the ceiling, amber
 * below the floor, grey for a day with nothing logged, green in between. Neutral when the
 * profile yields neither bound, since there is nothing to judge the day against.
 */
export function intakeBarColor(kcal: number, min: number | null, target: number | null): string {
  if (target === null && min === null) return 'var(--subtle)';
  if (kcal === 0) return 'var(--border)';
  if (target !== null && kcal > target) return 'var(--red)';
  if (min !== null && kcal < min) return 'var(--accent)';
  return 'var(--green)';
}

export interface CalorieDonutState {
  isOver: boolean;
  isUnder: boolean;
  remaining: number | null;
  arcColor: string;
  chartData: { value: number; key: string }[];
  overflowData: { value: number; key: string }[];
}

/**
 * Derives all display state needed to render a calorie donut chart.
 * @param eaten - Total calories consumed
 * @param cap - Daily calorie cap (max target), or null if no goal set
 * @param min - Daily minimum target, or null if none
 */
export function calcCalorieDonutState(eaten: number, cap: number | null, min: number | null = null): CalorieDonutState {
  const isOver = cap !== null && eaten > cap;
  const isUnder = min !== null && eaten < min;
  const remaining = cap !== null ? Math.max(cap - eaten, 0) : null;
  const arcColor = cap !== null ? (isOver ? '#ef4444' : isUnder ? '#facc15' : '#4ade80') : '#3f3f46';

  const chartData =
    cap !== null
      ? isOver
        ? [{ value: cap, key: 'eaten' }]
        : [
            { value: eaten, key: 'eaten' },
            { value: remaining!, key: 'remaining' },
          ]
      : [{ value: 1, key: 'empty' }];

  const overflowAmount = isOver && cap !== null ? Math.min(eaten - cap, cap) : 0;
  const overflowData =
    isOver && cap !== null
      ? [
          { value: overflowAmount, key: 'overflow' },
          { value: cap - overflowAmount, key: 'overflow-empty' },
        ]
      : [
          { value: 0, key: 'overflow' },
          { value: 0, key: 'overflow-empty' },
        ];

  return {
    isOver,
    isUnder,
    remaining,
    arcColor,
    chartData,
    overflowData,
  };
}

export interface MacroCalorieSplit {
  proteinCal: number;
  carbsCal: number;
  fatCal: number;
  total: number;
}

/**
 * Converts grams of each macro to their calorie contribution (protein/carbs = 4 kcal/g, fat = 9
 * kcal/g), for anything that needs to render a macro split (donut chart, calendar day bar).
 */
export function macroCalorieSplit(protein: number, carbs: number, fat: number): MacroCalorieSplit {
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  return { proteinCal, carbsCal, fatCal, total: proteinCal + carbsCal + fatCal };
}

/**
 * A value's share of a total as a rounded percentage, 0 when the total is 0 — the "what % of the
 * day's macro calories is this one" math shared by the macro donut legend and the calendar day
 * cell's per-macro lines.
 */
export function pctOfTotal(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

/**
 * Groups an array of meal logs by their meal type.
 * @param meals - Array of meal log entries to group
 */
export function groupByMealType(meals: MealLog[]): Record<MealType, MealLog[]> {
  const groups: Record<MealType, MealLog[]> = {} as Record<MealType, MealLog[]>;
  for (const meal of meals) {
    (groups[meal.mealType as MealType] ??= []).push(meal);
  }
  return groups;
}

/**
 * Formats a date string as a human-readable label ("Today", "Yesterday", or short date).
 * @param date - ISO date string (YYYY-MM-DD)
 */
export function formatDateLabel(date: string): string {
  const now = new Date();
  const today = dateToString(now);
  now.setDate(now.getDate() - 1);
  const yesterday = dateToString(now);
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Shifts a date string by a given number of days and returns the new date string.
 * @param date - ISO date string (YYYY-MM-DD)
 * @param days - Number of days to shift (positive = forward, negative = backward)
 */
export function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return dateToString(d);
}

/**
 * Converts a percentage of total calories to grams for a given macro.
 * @param pct - The percentage string (e.g. "30")
 * @param kcalPerG - Calories per gram for the macro (protein/carbs = 4, fat = 9)
 * @param maxCalNum - The daily calorie target
 */
export function pctToGrams(pct: string, kcalPerG: number, maxCalNum: number): string {
  if (!pct || !maxCalNum) return '';
  return String(Math.round(((Number(pct) / 100) * maxCalNum) / kcalPerG));
}

/**
 * Converts grams of a macro to a percentage of total daily calories.
 * @param g - The grams string (e.g. "150")
 * @param kcalPerG - Calories per gram for the macro (protein/carbs = 4, fat = 9)
 * @param maxCalNum - The daily calorie target
 */
export function gramsToPct(g: string, kcalPerG: number, maxCalNum: number): string {
  if (!g || !maxCalNum) return '';
  return String(Math.round(((Number(g) * kcalPerG) / maxCalNum) * 100));
}

export interface MacroSummaryData {
  used: number;
  remaining: number;
  isOver: boolean;
}

/**
 * Computes the used/remaining macro percentage summary for the profile edit form.
 * Returns null when there is nothing to display (e.g. grams mode without a calorie target).
 */
export function computeMacroSummary(
  macroMode: 'g' | '%',
  goalProtein: string,
  goalCarbs: string,
  goalFat: string,
  maxCalNum: number | null,
): MacroSummaryData | null {
  if (macroMode === '%') {
    const used = (Number(goalProtein) || 0) + (Number(goalCarbs) || 0) + (Number(goalFat) || 0);
    return { used, remaining: 100 - used, isOver: used > 100 };
  }
  if (macroMode === 'g' && maxCalNum) {
    const used =
      (Number(gramsToPct(goalProtein, 4, maxCalNum)) || 0) +
      (Number(gramsToPct(goalCarbs, 4, maxCalNum)) || 0) +
      (Number(gramsToPct(goalFat, 9, maxCalNum)) || 0);
    return { used, remaining: 100 - used, isOver: used > 100 };
  }
  return null;
}
