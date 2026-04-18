import { getCalorieProfile, getMealsForDate, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import type { MealEntry } from '../types';
import { rowToProfile, profileToTargets } from './profile';
import { rowToMealEntry } from './meals';
import { sumMeals } from './summary';
import { GoalTypes, MeasurementTypes } from '@my-hub/shared/constants';

export interface DailySummary {
  date: string;
  meals: MealEntry[];
  totals: {
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    mealCount: number;
  };
  goalCalories: number | null;
  minCalories: number | null;
  maxCalories: number | null;
  remainingCalories: number | null;
  overBudget: boolean | null;
  goalMet: boolean | null;
}

/**
 * Fetches all data needed for a daily summary and computes totals, targets,
 * remaining calories, and goal status. Used by both the calories://today
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

  const meals = dayRows.map(rowToMealEntry);
  const totals = sumMeals(meals);
  const goalCal = targets.goalCalories;
  const maxCal = targets.maxCalories;
  const remaining = maxCal !== null ? maxCal - totals.calories : null;

  // goalMet: weightGain → at or above goal; everything else → at or below max
  const goalType = 'goalType' in profile ? profile.goalType : null;
  let goalMet: boolean | null = null;
  if (maxCal !== null) {
    goalMet = goalType === GoalTypes.WeightGain ? totals.calories >= (goalCal ?? maxCal) : totals.calories <= maxCal;
  }

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
    goalCalories: goalCal,
    minCalories: targets.minCalories,
    maxCalories: maxCal,
    remainingCalories: remaining,
    overBudget: remaining !== null ? remaining < 0 : null,
    goalMet,
  };
}
