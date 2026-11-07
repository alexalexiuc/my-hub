import { getCalorieProfile, getMealsForDate, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import type { MealEntry } from '../types';
import { rowToProfile, profileToTargets } from './profile';
import { rowToMealEntry } from './meals';
import { sumMeals } from './summary';
import { dayTargetFields, type DayTargetFields } from './targets';
import { GoalTypes, MeasurementTypes } from '@my-hub/shared/constants';
import type { GoalType } from '@my-hub/shared/constants';

export interface DailySummary extends DayTargetFields {
  date: string;
  meals: MealEntry[];
  totals: {
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    mealCount: number;
  };
  /** Profile-level targets, before the gym-day bonus — `dayTarget` / `dayMin` are this date's. */
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  /** `dayTarget` minus what was eaten. */
  remainingCalories: number | null;
  overBudget: boolean | null;
  goalMet: boolean | null;
}

/**
 * Whether a day's intake met the goal. Gaining: reached the day's floor — or, without one, the
 * goal calories plus the gym-day bonus — and going over is fine. Losing or maintaining: inside
 * the day's range, the verdict `calories_get_history` gives the same day. Null without a target.
 */
export function isDayGoalMet(
  goalType: GoalType | null | undefined,
  calories: number,
  day: Pick<DayTargetFields, 'dayTarget' | 'dayMin' | 'gymDayBonusApplied'>,
  goalCalories: number | null,
): boolean | null {
  if (day.dayTarget === null) return null;
  if (goalType === GoalTypes.WeightGain) {
    const gainFloor = day.dayMin ?? (goalCalories === null ? day.dayTarget : goalCalories + day.gymDayBonusApplied);
    return calories >= gainFloor;
  }
  return calories <= day.dayTarget && (day.dayMin === null || calories >= day.dayMin);
}

/**
 * Fetches all data needed for a daily summary and computes totals, this date's targets (gym-day
 * bonus included), remaining calories, and goal status. Used by both the calories://today
 * resource and the calories_get_daily_summary tool to avoid duplication.
 */
export async function buildDailySummary(userId: string, date: string): Promise<DailySummary> {
  const [profileRow, dayRows, latestMeasurements] = await Promise.all([
    getCalorieProfile(userId),
    getMealsForDate(userId, date),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);
  const day = dayTargetFields(profile, weightM?.value, date);

  const meals = dayRows.map(rowToMealEntry);
  const totals = sumMeals(meals);
  const remaining = day.dayTarget !== null ? day.dayTarget - totals.calories : null;

  const goalType = 'goalType' in profile ? profile.goalType : null;
  const goalMet = isDayGoalMet(goalType, totals.calories, day, targets.goalCalories);

  return {
    date,
    meals,
    totals: {
      calories: totals.calories,
      proteinG: totals.proteinG || null,
      carbsG: totals.carbsG || null,
      fatG: totals.fatG || null,
      mealCount: meals.length,
    },
    goalCalories: targets.goalCalories,
    minCalories: targets.minCalories,
    maxCalories: targets.maxCalories,
    ...day,
    remainingCalories: remaining,
    overBudget: remaining !== null ? remaining < 0 : null,
    goalMet,
  };
}
