import { toUTCDateStr, addDays } from '@my-hub/shared/utils';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];

/** `${dayOfWeek}:${mealType}` → true */
export type LoggedMeals = Record<string, true>;

/** Returns YYYY-MM-DD for the given day of the week relative to a weekStart (Monday). */
export function dateForDay(weekStart: string, dayOfWeek: DayOfWeek): string {
  return toUTCDateStr(addDays(new Date(weekStart), dayOfWeek));
}

export function toLoggedMeals(loggedDays: Record<string, string>): LoggedMeals {
  return Object.fromEntries(Object.keys(loggedDays).map(k => [k, true])) as LoggedMeals;
}

/** Formats a week's date range as e.g. "Jun 1 – Jun 7" from its Monday `weekStart`. */
export function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart + 'T00:00:00');
  const end = new Date(date);
  end.setDate(date.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(date)} – ${fmt(end)}`;
}
