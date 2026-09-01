import {
  toUTCDateStr,
  addDays,
  dateToString,
  startOfWeekMonday,
  shiftWeekStr,
  formatWeekRangeStr,
  mealOrder,
} from '@my-hub/shared/utils';
import { DaysOfWeekValues, DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek, GymTime, MealType } from '@my-hub/shared/constants';
import { MEAL_LABEL } from '@/app/calories/constants';
import { apiFetch } from '@/lib/utils';
import {
  DeleteMenuMealSchema,
  LogDayBodySchema,
  LogDayResponseSchema,
  LogWholeDaySchema,
  UnlogWholeDaySchema,
  WholeDayResponseSchema,
} from '@/app/api/calories/menu/menu.schemas';
import type { WeeklyMenu, WeeklyMenuMeal } from './types';

/**
 * Meal types as `Select` options. Takes the types to offer, since the create editor lists them
 * all while the add-a-meal modal offers only the slots a day still has free.
 */
export function mealTypeOptions(types: MealType[]): { value: MealType; label: string }[] {
  return types.map(value => ({ value, label: MEAL_LABEL[value] }));
}

/** `${dayOfWeek}:${mealType}` → true */
export type LoggedMeals = Record<string, true>;

/**
 * Flip one meal slot's logged state. The request was written out at three call sites (the meal
 * row, the day card and the Today page's next-meal card) with the same eight-field body, so a
 * field added to `LogDayBodySchema` had to be found in all of them.
 */
export async function setMealLogged(
  menuId: string,
  loggedDate: string,
  dayOfWeek: DayOfWeek,
  meal: WeeklyMenuMeal,
  logged: boolean,
  opts: { silentToast?: boolean } = {},
): Promise<void> {
  if (!logged) {
    await apiFetch(`/api/calories/menu/${menuId}/log-day`, {
      method: 'DELETE',
      body: { dayOfWeek, mealType: meal.mealType },
      bodySchema: DeleteMenuMealSchema,
      ...opts,
    });
    return;
  }

  await apiFetch(`/api/calories/menu/${menuId}/log-day`, {
    method: 'POST',
    body: {
      dayOfWeek,
      loggedDate,
      mealType: meal.mealType,
      description: meal.description,
      kcal: meal.kcal,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
    },
    bodySchema: LogDayBodySchema,
    responseSchema: LogDayResponseSchema,
    ...opts,
  });
}

/** Flip a whole day's logged state — one request and one transaction, not one per meal. */
export async function setDayLogged(
  menuId: string,
  loggedDate: string,
  dayOfWeek: DayOfWeek,
  logged: boolean,
): Promise<void> {
  // Split rather than ternaries inside one call: the body and its schema have to stay paired,
  // and a conditional `bodySchema` loses the inference that keeps them in step.
  if (!logged) {
    await apiFetch(`/api/calories/menu/${menuId}/log-day/all`, {
      method: 'DELETE',
      body: { dayOfWeek },
      bodySchema: UnlogWholeDaySchema,
      responseSchema: WholeDayResponseSchema,
    });
    return;
  }

  await apiFetch(`/api/calories/menu/${menuId}/log-day/all`, {
    method: 'POST',
    body: { dayOfWeek, loggedDate },
    bodySchema: LogWholeDaySchema,
    responseSchema: WholeDayResponseSchema,
  });
}

/** Returns YYYY-MM-DD for the given day of the week relative to a weekStart (Monday). */
export function dateForDay(weekStart: string, dayOfWeek: DayOfWeek): string {
  return toUTCDateStr(addDays(new Date(weekStart), dayOfWeek));
}

export function toLoggedMeals(loggedDays: Record<string, string>): LoggedMeals {
  return Object.fromEntries(Object.keys(loggedDays).map(k => [k, true])) as LoggedMeals;
}

/** The menu with the greatest `weekStart`, independent of the array's sort order. */
export function latestMenu<T extends { weekStart: string }>(menus: T[]): T | null {
  return menus.reduce<T | null>((best, m) => (!best || m.weekStart > best.weekStart ? m : best), null);
}

/** Returns the ISO Monday (YYYY-MM-DD) for the week containing today (local date). */
export function currentWeekMonday(): string {
  return dateToString(startOfWeekMonday(new Date()));
}

/**
 * The menu closest to `week` on the given side (`-1` = closest earlier, `1` = closest later).
 * Compares weekStart values instead of array positions, so a change in the service's sort
 * order can never silently invert prev/next navigation.
 */
export function closestMenu<T extends { weekStart: string }>(menus: T[], week: string, dir: -1 | 1): T | null {
  return menus.reduce<T | null>((best, m) => {
    const isOnSide = dir < 0 ? m.weekStart < week : m.weekStart > week;
    const isCloser = !best || (dir < 0 ? m.weekStart > best.weekStart : m.weekStart < best.weekStart);
    return isOnSide && isCloser ? m : best;
  }, null);
}

/**
 * The week a newly created menu should default to: the week after the latest
 * current-or-future menu, or `currentWeekStart` when there is no such menu.
 */
export function nextMenuWeekStart(menus: { weekStart: string }[], currentWeekStart: string): string {
  const latest = latestMenu(menus);
  const anchor = latest && latest.weekStart >= currentWeekStart ? latest.weekStart : null;
  return anchor ? shiftWeekStr(anchor, 1) : currentWeekStart;
}

// ---------------------------------------------------------------------------
// Planned-vs-target visual helpers, shared by DayCard's per-day bar and
// MenuDetail's weekly summary card so both use identical thresholds.
// ---------------------------------------------------------------------------

/** Planned kcal as a percentage of target, rounded. Returns null if target is not a positive number. */
export function targetPct(planned: number, target: number | null): number | null {
  if (target == null || target <= 0) return null;
  return Math.round((planned / target) * 100);
}

/**
 * Tailwind text/bg color pair for a planned-vs-target percentage.
 * Renders neutral gray when `pct` is null (no target to compare against) or when
 * `isEstimated` is true (target is a fallback default, not the user's real profile
 * target) — a fallback shouldn't imply the false precision of a color-banded verdict.
 * Bands are symmetric around 100%: within 10% → on track, within 30% → near, else off track.
 */
export function targetColorClasses(pct: number | null, isEstimated = false): { text: string; bg: string } {
  if (pct === null || isEstimated) return { text: 'text-[var(--muted)]', bg: 'bg-[var(--muted)]' };
  const diff = Math.abs(pct - 100);
  if (diff <= 10) return { text: 'text-green-400', bg: 'bg-green-400' };
  if (diff <= 30) return { text: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]' };
  return { text: 'text-red-400', bg: 'bg-red-400' };
}

/**
 * One day's meals as share-ready lines: meal label, description, then every ingredient on its
 * own line with its exact amount (e.g. "200g chicken breast") — the point is to show a housemate
 * exactly what's being made, not just a macro summary — followed by the macro line spelled out
 * in full so it reads unambiguously (not "P/C/F" shorthand) if pasted back into an AI model.
 */
function formatDayMealLines(dayMeals: WeeklyMenuMeal[], order: MealType[]): string[] {
  const mealByType = new Map(dayMeals.map(m => [m.mealType, m]));
  const lines: string[] = [];
  for (const mealType of order) {
    const meal = mealByType.get(mealType);
    if (!meal) continue;
    lines.push(`${MEAL_LABEL[mealType]}: ${meal.description}`);
    for (const ingredient of meal.ingredients ?? []) {
      lines.push(`  • ${ingredient}`);
    }
    const macros = [
      meal.kcal != null ? `${meal.kcal} kcal` : null,
      meal.protein != null ? `${meal.protein}g protein` : null,
      meal.carbs != null ? `${meal.carbs}g carbs` : null,
      meal.fat != null ? `${meal.fat}g fat` : null,
    ].filter((m): m is string => m !== null);
    if (macros.length > 0) lines.push(`  (${macros.join(', ')})`);
  }
  return lines;
}

/**
 * Renders a weekly menu as plain text for the Share panel's "copy to clipboard" action — the
 * only sharing method for now (in-app sharing between housemates is a planned follow-up).
 */
export function formatMenuAsText(menu: WeeklyMenu, gymDays: number[], gymTime: GymTime | null): string {
  const byDay = menu.meals.reduce<Record<number, WeeklyMenuMeal[]>>((acc, meal) => {
    (acc[meal.dayOfWeek] ??= []).push(meal);
    return acc;
  }, {});
  const order = mealOrder(gymTime);

  const lines: string[] = [`Weekly Menu — ${formatWeekRangeStr(menu.weekStart, true)}`];
  if (menu.title) lines.push(`Title: ${menu.title}`);

  for (const day of DaysOfWeekValues) {
    const dayMeals = byDay[day] ?? [];
    if (dayMeals.length === 0) continue;
    lines.push(
      '',
      `${DAY_LABELS[day]}${gymDays.includes(day) ? ' (Gym day)' : ''}`,
      ...formatDayMealLines(dayMeals, order),
    );
  }

  if (menu.notes) {
    lines.push('', `Notes: ${menu.notes}`);
  }

  return lines.join('\n');
}

/**
 * Same as `formatMenuAsText`, scoped to a single day — for sharing just "what's for dinner
 * tonight" without pasting the whole week.
 */
export function formatDayAsText(menu: WeeklyMenu, day: DayOfWeek, gymDays: number[], gymTime: GymTime | null): string {
  const dayMeals = menu.meals.filter(m => m.dayOfWeek === day);
  const order = mealOrder(gymTime);

  const lines: string[] = [
    `${DAY_LABELS[day]}${gymDays.includes(day) ? ' (Gym day)' : ''} — ${formatWeekRangeStr(menu.weekStart, true)}`,
    ...formatDayMealLines(dayMeals, order),
  ];

  return lines.join('\n');
}

/** Fallback daily target (kcal) used when the user's profile can't produce a real goalCalories value. */
export const FALLBACK_DAILY_TARGET_KCAL = 2000;

/**
 * Resolves the base daily target to use for target-bar math: the user's real profile target,
 * or the fallback estimate when the profile is incomplete (`dailyTargetKcal` is null) — plus
 * whether the result is a real target or an estimate, so callers can render it as such.
 */
export function resolveDailyTarget(dailyTargetKcal: number | null): { baseTarget: number; isEstimated: boolean } {
  return dailyTargetKcal == null
    ? { baseTarget: FALLBACK_DAILY_TARGET_KCAL, isEstimated: true }
    : { baseTarget: dailyTargetKcal, isEstimated: false };
}
