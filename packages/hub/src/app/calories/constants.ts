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

/**
 * Selectable windows for the weight charts, in days. `null` means the whole history on hand.
 *
 * The goal card defaults to 28 days rather than a single week on purpose: a 1 kg/week goal is
 * smaller than the 1–1.5 kg a scale swings on water alone, so one week shows mostly noise, while
 * four weeks put the goal signal clearly ahead of it.
 */
export const WEIGHT_RANGE_OPTIONS = [
  { key: '4w', label: '4W', days: 28 },
  { key: '8w', label: '8W', days: 56 },
  { key: '12w', label: '12W', days: 84 },
  { key: '6m', label: '6M', days: 182 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
] as const;

export type WeightRangeKey = (typeof WEIGHT_RANGE_OPTIONS)[number]['key'];

/** Goal progress is about the current run, so it offers the shorter windows only. */
export const GOAL_RANGE_KEYS: WeightRangeKey[] = ['4w', '8w', '12w', 'all'];

export const DEFAULT_GOAL_RANGE: WeightRangeKey = '4w';
export const DEFAULT_TREND_RANGE: WeightRangeKey = '12w';

/**
 * Point count above which a weight chart switches to weekly averages. Beyond roughly this many
 * daily readings the line stops being legible on a phone before it stops being accurate.
 */
export const WEIGHT_CHART_WEEKLY_AVERAGE_THRESHOLD = 90;

/** Colors for the three macros, shared by every macro chart/bar/legend in the feature. */
export const MACRO_COLORS = {
  carbs: '#fbbf24', // amber-400
  protein: '#38bdf8', // sky-400
  fat: '#fb7185', // rose-400
} as const;
