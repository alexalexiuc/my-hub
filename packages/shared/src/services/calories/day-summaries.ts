/**
 * Zero-filled per-day calorie/macro aggregates for an arbitrary date range — the shape a calendar
 * view needs (one row per day even when nothing was logged), as opposed to
 * `getMealsForDateRange`'s raw meal rows.
 *
 * `getDailySummariesForRange` — kcal/protein/carbs/fat/mealCount totals per day in [start, end].
 */

import { getMealsForDateRange } from './meals.js';
import { calendarDays } from '../../utils/index.js';

export interface DailyCalorieSummary {
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  mealCount: number;
}

export async function getDailySummariesForRange(
  userId: string,
  start: string,
  end: string,
): Promise<DailyCalorieSummary[]> {
  const meals = await getMealsForDateRange(userId, start, end);

  const byDate = new Map<string, DailyCalorieSummary>();
  for (const date of calendarDays(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`))) {
    byDate.set(date, { date, kcal: 0, protein: 0, carbs: 0, fat: 0, mealCount: 0 });
  }

  for (const meal of meals) {
    const summary = byDate.get(meal.date);
    if (!summary) continue;
    summary.kcal += meal.kcal ?? 0;
    summary.protein += meal.protein ?? 0;
    summary.carbs += meal.carbs ?? 0;
    summary.fat += meal.fat ?? 0;
    summary.mealCount += 1;
  }

  return [...byDate.values()];
}
