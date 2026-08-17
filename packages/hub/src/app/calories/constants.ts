import { MealType } from '@my-hub/shared/constants';

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Breakfast',
  pre_workout: 'Pre-Workout',
  lunch: 'Lunch',
  post_workout: 'Post-Workout',
  dinner: 'Dinner',
  snack: 'Snack',
  other: 'Extra',
};

/** Colors for the three macros, shared by every macro chart/bar/legend in the feature. */
export const MACRO_COLORS = {
  carbs: '#fbbf24', // amber-400
  protein: '#38bdf8', // sky-400
  fat: '#fb7185', // rose-400
} as const;
