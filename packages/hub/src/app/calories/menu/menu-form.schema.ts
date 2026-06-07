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

export const SwapMealFormSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
});

export type SwapMealFormValues = z.infer<typeof SwapMealFormSchema>;

export const defaultSwapMealFormValues: SwapMealFormValues = { description: '' };
