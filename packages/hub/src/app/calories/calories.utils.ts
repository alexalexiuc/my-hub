import type { MealLog } from '@my-hub/shared/types';
import type { MealType } from '@my-hub/shared/constants';
import { GoalTypes } from '@my-hub/shared/constants';
import { dateToString } from '@my-hub/shared/utils';

/** A weight entry, reduced to what the goal-progress maths needs. */
export interface WeightPoint {
  date: string;
  value: number;
}

/**
 * The daily weight change implied by a weekly goal: negative for loss, positive for gain, zero
 * for maintain. Returns null when the goal cannot imply one — no rate given, or a rate that is
 * zero or negative, which would describe a goal moving the wrong way.
 */
export function getDailyGoalDelta(goalType: string | null, goalWeeklyRateKg: number | null): number | null {
  if (goalType === GoalTypes.Maintain) return 0;
  if (!goalWeeklyRateKg || goalWeeklyRateKg <= 0) return null;
  if (goalType === GoalTypes.WeightLoss) return -(goalWeeklyRateKg / 7);
  if (goalType === GoalTypes.WeightGain) return goalWeeklyRateKg / 7;
  return null;
}

/**
 * The weight a week's projection starts from: the weigh-in on the Monday itself, or the most
 * recent one before it. Falls back to the newest entry of all when the whole history postdates
 * the week, so a user who only started weighing mid-week still gets a line to compare against.
 *
 * Expects `weightRows` sorted newest first.
 */
export function getBaselineWeightForWeek(weightRows: WeightPoint[], weekStartDate: string): number | null {
  const mondayWeightOrLast =
    weightRows.find(row => row.date === weekStartDate || row.date < weekStartDate)?.value ?? null;
  if (mondayWeightOrLast !== null) return mondayWeightOrLast;
  return weightRows[0]?.value ?? null;
}

/**
 * The weight recorded on `date`. With `nearestIfNone`, an absent entry falls back to the most
 * recent earlier one instead of leaving a gap — used for the first day of a week, where the line
 * has to start somewhere, while later days stay null so the chart shows the gap honestly.
 *
 * Expects `weightRows` sorted newest first.
 */
export function findPastWeight(weightRows: WeightPoint[], date: string, nearestIfNone = false): number | null {
  for (const row of weightRows) {
    if (nearestIfNone && row.date <= date) return row.value;
    if (row.date === date) return row.value;
  }
  return null;
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
