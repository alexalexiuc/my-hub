import type { MealLog } from '@my-hub/shared/types';
import type { MealEntry } from '../types';

export function rowToMealEntry(row: MealLog): MealEntry {
  return {
    meal_id: row.mealId ?? '',
    date: row.date,
    meal_type: row.mealType,
    description: row.description,
    calories: row.kcal ?? 0,
    protein_g: row.protein,
    carbs_g: row.carbs,
    fat_g: row.fat,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
  };
}
