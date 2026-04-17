import type { MealLog } from '@my-hub/shared/types';
import type { MealEntry } from '../types';

export function rowToMealEntry(row: MealLog): MealEntry {
  return {
    mealId: row.mealId ?? '',
    date: row.date,
    mealType: row.mealType,
    description: row.description,
    calories: row.kcal ?? 0,
    proteinG: row.protein,
    carbsG: row.carbs,
    fatG: row.fat,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}
