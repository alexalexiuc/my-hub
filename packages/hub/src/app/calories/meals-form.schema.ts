import { z } from 'zod';
import type { MealLog } from '@my-hub/shared/types';
import { MealTypes, MealTypesValues } from '@my-hub/shared/constants';
import type { MealType } from '@my-hub/shared/constants';
import { calculateMacroKcal, defaultMealTypeForHour } from '@my-hub/shared/utils';
import { optionalNumber } from '@/lib/schemas/common';

export const MealFormSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  mealType: z.enum(MealTypesValues as [MealType, ...MealType[]]),
  kcal: optionalNumber('Calories'),
  protein: optionalNumber('Protein'),
  carbs: optionalNumber('Carbs'),
  fat: optionalNumber('Fat'),
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

/** Blank form for a new entry, its slot guessed from the clock rather than always Lunch. */
export function newMealFormValues(now: Date = new Date()): MealFormValues {
  return { ...defaultMealFormValues, mealType: defaultMealTypeForHour(now.getHours()) };
}

/**
 * The kcal the macros add up to, when calories are blank but at least one macro is filled —
 * null otherwise. Shown as a hint, and used on save so a macro-only entry still counts.
 */
export function kcalFromMacroFields(values: Pick<MealFormValues, 'kcal' | 'protein' | 'carbs' | 'fat'>): number | null {
  if (values.kcal) return null;
  const [protein, carbs, fat] = [values.protein, values.carbs, values.fat].map(v => Number(v) || 0);
  if (!protein && !carbs && !fat) return null;
  return calculateMacroKcal(protein ?? 0, carbs ?? 0, fat ?? 0);
}

/** The form with blank calories filled in from the macros, when they can be. */
export function withMacroKcal(values: MealFormValues): MealFormValues {
  const derived = kcalFromMacroFields(values);
  return derived === null ? values : { ...values, kcal: String(derived) };
}

/**
 * A meal's fields as form values. Takes a logged meal when editing, or a recent-meal suggestion
 * when re-logging one — suggestions carry no notes, since a note describes one occasion rather
 * than the dish.
 */
export function mealToFormValues(
  meal: Pick<MealLog, 'description' | 'mealType' | 'kcal' | 'protein' | 'carbs' | 'fat'> & { notes?: string | null },
): MealFormValues {
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

/** Body for editing an existing meal. */
export function formToUpdateBody(values: MealFormValues) {
  return {
    description: values.description,
    mealType: values.mealType,
    kcal: values.kcal ? Math.round(Number(values.kcal)) : null,
    protein: values.protein ? Number(values.protein) : null,
    carbs: values.carbs ? Number(values.carbs) : null,
    fat: values.fat ? Number(values.fat) : null,
    notes: values.notes || null,
  };
}
