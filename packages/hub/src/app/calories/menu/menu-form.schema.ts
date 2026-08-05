import { z } from 'zod';
import { MealTypesValues } from '@my-hub/shared/constants';
import type { MealType } from '@my-hub/shared/constants';
import { dedupeTrimmed } from '@my-hub/shared/utils';
import { optionalNumber } from '@/lib/schemas/common';
import type { WeeklyMenuMeal } from './types';

/** One editable meal row in the create-menu form. Shared by the day editor and the modal's week totals. */
export interface MealFormRow {
  id: string; // local key for React list
  mealType: MealType;
  description: string;
  /** Raw textarea contents — one ingredient per line. Parsed with `parseIngredientLines` on submit. */
  ingredients: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
}

export const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export function makeRow(mealType: MealType = 'lunch'): MealFormRow {
  return {
    id: crypto.randomUUID(),
    mealType,
    description: '',
    ingredients: '',
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
  };
}

/**
 * Splits a textarea's contents into ingredient lines. Normalisation goes through the same
 * `dedupeTrimmed` the service uses in `normalizeIngredients`, so what the user sees after a
 * reload matches what they typed — a second implementation here would quietly keep duplicates
 * the server then drops. Returns `undefined` when nothing is left, so callers can omit the
 * field entirely rather than sending an empty array.
 */
export function parseIngredientLines(text: string): string[] | undefined {
  const lines = dedupeTrimmed(text.split('\n'));
  return lines.length > 0 ? lines : undefined;
}

/**
 * Spells out the consequence of the newline-only split in `parseIngredientLines`, shown wherever
 * ingredients are edited. Commas are deliberately not separators — they occur inside real
 * ingredients ("olive oil, extra virgin") — so the rule has to be stated rather than inferred.
 */
export const INGREDIENT_LINE_HINT = 'One ingredient per line — two on the same line are saved as a single entry.';

/** A planned meal of 0 kcal is a slot someone forgot to fill, unlike a logged meal, which may genuinely be zero. */
const positiveNumericString = (label: string) => optionalNumber(label, { allowZero: false });

/**
 * The single meal-detail form, used both to add a meal to an empty slot and to edit an existing
 * one. Add and edit deliberately share one schema: they write the same columns through the same
 * `MenuMealWriteSchema` body, so two separate forms could only ever drift apart.
 */
export const MenuMealFormSchema = z.object({
  mealType: z.enum(MealTypesValues as [MealType, ...MealType[]]),
  description: z.string().trim().min(1, 'Description is required'),
  ingredients: z.string(),
  kcal: positiveNumericString('Calories'),
  protein: positiveNumericString('Protein'),
  carbs: positiveNumericString('Carbs'),
  fat: positiveNumericString('Fat'),
});

export type MenuMealFormValues = z.infer<typeof MenuMealFormSchema>;

/** Blank form for a new meal, opened on the first meal type still free that day. */
export function newMenuMealFormValues(mealType: MealType): MenuMealFormValues {
  return { mealType, description: '', ingredients: '', kcal: '', protein: '', carbs: '', fat: '' };
}

/**
 * Prefills the macro and ingredient fields from the meal being edited so a description-only
 * edit keeps them — the PATCH clears anything that is omitted, so the form must always carry
 * the current values unless the user deliberately empties a field. `description` stays blank
 * on purpose: the modal shows the current dish above it as the reference to replace.
 */
export function existingMenuMealFormValues(
  meal: Pick<WeeklyMenuMeal, 'mealType' | 'ingredients' | 'kcal' | 'protein' | 'carbs' | 'fat'>,
): MenuMealFormValues {
  return {
    mealType: meal.mealType,
    description: '',
    ingredients: meal.ingredients?.join('\n') ?? '',
    kcal: meal.kcal?.toString() ?? '',
    protein: meal.protein?.toString() ?? '',
    carbs: meal.carbs?.toString() ?? '',
    fat: meal.fat?.toString() ?? '',
  };
}

/**
 * Maps the form to a `MenuMealWriteSchema` body (minus `dayOfWeek`, which the caller adds).
 * Empty inputs become explicit `null` — both write paths replace the whole slot, so an omitted
 * field means "clear it", not "leave it alone".
 */
export function menuMealFormToBody(values: MenuMealFormValues) {
  return {
    mealType: values.mealType,
    description: values.description.trim(),
    ingredients: parseIngredientLines(values.ingredients) ?? null,
    kcal: values.kcal ? Math.round(parseFloat(values.kcal)) : null,
    protein: values.protein ? parseFloat(values.protein) : null,
    carbs: values.carbs ? parseFloat(values.carbs) : null,
    fat: values.fat ? parseFloat(values.fat) : null,
  };
}
