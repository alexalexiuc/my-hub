import type { MealLog } from '@my-hub/shared/types';
import type { MealType } from '@my-hub/shared/constants';
import { dateToString } from '@my-hub/shared/utils';

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

  return { isOver, isUnder, remaining, arcColor, chartData, overflowData };
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
