import { z } from 'zod';
import { MealTypesValues } from '@my-hub/shared/constants';
import type { MealType } from '@my-hub/shared/constants';

export const AddMealFormSchema = z.object({
  mealType: z.enum(MealTypesValues as [MealType, ...MealType[]]),
  description: z.string().trim().min(1, 'Description is required'),
  kcal: z.string(),
});

export type AddMealFormValues = z.infer<typeof AddMealFormSchema>;

export function defaultAddMealFormValues(mealType: MealType): AddMealFormValues {
  return { mealType, description: '', kcal: '' };
}

export function addMealFormToBody(values: AddMealFormValues) {
  return {
    mealType: values.mealType,
    description: values.description.trim(),
    kcal: values.kcal ? parseInt(values.kcal, 10) : undefined,
  };
}

const OptionalNumericString = z.string().regex(/^\d*\.?\d*$/, 'Numbers only');

export const SwapMealFormSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  kcal: OptionalNumericString,
  protein: OptionalNumericString,
  carbs: OptionalNumericString,
  fat: OptionalNumericString,
});

export type SwapMealFormValues = z.infer<typeof SwapMealFormSchema>;

/**
 * Prefills the macro fields from the meal being edited so a description-only edit
 * keeps them — the PATCH clears any macro that is omitted, so the form must always
 * carry the current values unless the user deliberately empties a field.
 */
export function defaultSwapMealFormValues(meal: {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}): SwapMealFormValues {
  return {
    description: '',
    kcal: meal.kcal?.toString() ?? '',
    protein: meal.protein?.toString() ?? '',
    carbs: meal.carbs?.toString() ?? '',
    fat: meal.fat?.toString() ?? '',
  };
}

/** Maps the swap form to the PATCH body — empty inputs become explicit `null` (clear). */
export function swapMealFormToBody(values: SwapMealFormValues) {
  return {
    description: values.description.trim(),
    kcal: values.kcal ? Math.round(parseFloat(values.kcal)) : null,
    protein: values.protein ? parseFloat(values.protein) : null,
    carbs: values.carbs ? parseFloat(values.carbs) : null,
    fat: values.fat ? parseFloat(values.fat) : null,
  };
}
