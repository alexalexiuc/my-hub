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
 * goal calories plus the gym-day bonus — and going over is fine. Losing or maintaining: within the
 * day's ceiling and, once the day is over, at or above its floor.
 *
 * Null when there is nothing to judge: no target, or nothing logged (history calls that day
 * `not_logged`). A day still in progress is never failed for being short — a 400 kcal breakfast
 * hasn't missed a 1,600 floor yet — so it is judged only on what can no longer change: a loss day
 * already over its ceiling is `false`, a gain day that reached its floor is `true`, and a gain day
 * short of it is `null` until the day ends.
 *
 * @param isFinished - The day is before today in the user's timezone.
 */
export function isDayGoalMet(
  goalType: GoalType | null | undefined,
  intake: { calories: number; mealCount: number },
  day: Pick<DayTargetFields, 'dayTarget' | 'dayMin' | 'gymDayBonusApplied'>,
  goalCalories: number | null,
  isFinished: boolean,
): boolean | null {
  if (day.dayTarget === null || intake.mealCount === 0 || intake.calories === 0) return null;
  const { calories } = intake;
  if (goalType === GoalTypes.WeightGain) {
    const gainFloor = day.dayMin ?? (goalCalories === null ? day.dayTarget : goalCalories + day.gymDayBonusApplied);
    if (calories >= gainFloor) return true;
    return isFinished ? false : null;
  }
  if (calories > day.dayTarget) return false;
  return !isFinished || day.dayMin === null || calories >= day.dayMin;
}

/**
 * Fetches all data needed for a daily summary and computes totals, this date's targets (gym-day
 * bonus included), remaining calories, and goal status. Used by both the calories://today
 * resource and the calories_get_daily_summary tool to avoid duplication.
 *
 * @param today - YYYY-MM-DD in the user's timezone; `date` from it onwards is still in progress.
 */
export async function buildDailySummary(userId: string, date: string, today: string): Promise<DailySummary> {
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
  const goalMet = isDayGoalMet(
    goalType,
    { calories: totals.calories, mealCount: meals.length },
    day,
    targets.goalCalories,
    date < today,
  );

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
