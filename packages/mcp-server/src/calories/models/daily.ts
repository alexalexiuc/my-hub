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
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    meal_count: number;
  };
  goal_calories: number | null;
  min_calories: number | null;
  max_calories: number | null;
  remaining_calories: number | null;
  over_budget: boolean | null;
  goal_met: boolean | null;
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
  const weightM = latestMeasurements.find((m) => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);

  const meals = dayRows.map(rowToMealEntry);
  const totals = sumMeals(meals);
  const goalCal = targets.goalCalories;
  const maxCal = targets.maxCalories;
  const remaining = maxCal !== null ? maxCal - totals.calories : null;

  // goal_met: weight_gain → at or above goal; everything else → at or below max
  const goalType = 'goal_type' in profile ? profile.goal_type : null;
  let goalMet: boolean | null = null;
  if (maxCal !== null) {
    goalMet = goalType === GoalTypes.WeightGain ? totals.calories >= (goalCal ?? maxCal) : totals.calories <= maxCal;
  }

  return {
    date,
    meals,
    totals: {
      calories: totals.calories,
      protein_g: totals.protein_g || null,
      carbs_g: totals.carbs_g || null,
      fat_g: totals.fat_g || null,
      meal_count: meals.length,
    },
    goal_calories: goalCal,
    min_calories: targets.minCalories,
    max_calories: maxCal,
    remaining_calories: remaining,
    over_budget: remaining !== null ? remaining < 0 : null,
    goal_met: goalMet,
  };
}
