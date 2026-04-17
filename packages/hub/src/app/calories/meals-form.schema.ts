import { z } from 'zod';
import type { MealLog } from '@my-hub/shared/types';
import { MealTypes, MealTypesValues } from '@my-hub/shared/constants';
import type { MealType } from '@my-hub/shared/constants';

export const MealFormSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  mealType: z.enum(MealTypesValues as [MealType, ...MealType[]]),
  kcal: z.string(),
  protein: z.string(),
  carbs: z.string(),
  fat: z.string(),
  notes: z.string(),
});

export type MealFormValues = z.infer<typeof MealFormSchema>;

export const defaultMealFormValues: MealFormValues = {
  description: '',
  mealType: MealTypes.Lunch,
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  notes: '',
};

export function mealToFormValues(meal: MealLog): MealFormValues {
  return {
    description: meal.description,
    mealType: meal.mealType as MealType,
    kcal: meal.kcal?.toString() ?? '',
    protein: meal.protein?.toString() ?? '',
    carbs: meal.carbs?.toString() ?? '',
    fat: meal.fat?.toString() ?? '',
    notes: meal.notes ?? '',
  };
}

export function formToAddBody(values: MealFormValues, date: string) {
  return {
    description: values.description,
    mealType: values.mealType,
    date,
    kcal: values.kcal ? Math.round(Number(values.kcal)) : undefined,
    protein: values.protein ? Number(values.protein) : undefined,
    carbs: values.carbs ? Number(values.carbs) : undefined,
    fat: values.fat ? Number(values.fat) : undefined,
    notes: values.notes || undefined,
  };
}

export function formToUpdateBody(values: MealFormValues) {
  return {
    description: values.description,
    mealType: values.mealType,
    kcal: values.kcal ? Math.round(Number(values.kcal)) : undefined,
    protein: values.protein ? Number(values.protein) : undefined,
    carbs: values.carbs ? Number(values.carbs) : undefined,
    fat: values.fat ? Number(values.fat) : undefined,
    notes: values.notes || undefined,
  };
}
