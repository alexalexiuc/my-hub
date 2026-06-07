import { dateToString, addDays } from '@my-hub/shared/utils';
import { DaysOfWeekValues } from '@my-hub/shared/constants';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';

export const DAYS: DayOfWeek[] = DaysOfWeekValues;

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  pre_workout: 'Pre-Workout',
  lunch: 'Lunch',
  post_workout: 'Post-Workout',
  dinner: 'Dinner',
  snack: 'Snack',
};

/** `${dayOfWeek}:${mealType}` → true */
export type LoggedMeals = Record<string, true>;

/** Returns YYYY-MM-DD for the given day of the week relative to a weekStart (Monday). */
export function dateForDay(weekStart: string, dayOfWeek: DayOfWeek): string {
  return dateToString(addDays(new Date(weekStart + 'T00:00:00'), dayOfWeek));
}

export function toLoggedMeals(loggedDays: Record<string, string>): LoggedMeals {
  return Object.fromEntries(Object.keys(loggedDays).map(k => [k, true])) as LoggedMeals;
}
