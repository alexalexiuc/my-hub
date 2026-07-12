import { toUTCDateStr, addDays, dateToString, startOfWeekMonday } from '@my-hub/shared/utils';
import type { DayOfWeek, MealType } from '@my-hub/shared/constants';

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout', 'other'];

/** `${dayOfWeek}:${mealType}` → true */
export type LoggedMeals = Record<string, true>;

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
 * Advances/retreats a YYYY-MM-DD Monday by n weeks.
 * All-UTC (parse, add, format) — mixing a local parse with UTC day arithmetic drifts one day
 * across DST transitions.
 */
export function shiftWeek(monday: string, n: number): string {
  return toUTCDateStr(addDays(new Date(monday), n * 7));
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
  return anchor ? shiftWeek(anchor, 1) : currentWeekStart;
}

/**
 * Formats a week's date range as e.g. "Jun 1 – Jun 7" from its Monday `weekStart`.
 * Pass `includeYear` to append the year, e.g. "Jun 1 – Jun 7, 2026".
 */
export function formatWeekLabel(weekStart: string, includeYear = false): string {
  const date = new Date(weekStart + 'T00:00:00');
  const end = new Date(date);
  end.setDate(date.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const range = `${fmt(date)} – ${fmt(end)}`;
  return includeYear ? `${range}, ${date.getFullYear()}` : range;
}

// ---------------------------------------------------------------------------
// Planned-vs-target visual helpers, shared by DayCard's per-day bar and
// MenuDetail's weekly summary card so both use identical thresholds.
// ---------------------------------------------------------------------------

/** The calorie target for a given day: the base daily target, plus the gym-day bonus if applicable. */
export function dayTargetKcal(baseTarget: number, isGymDay: boolean, gymDayBonus: number): number {
  return isGymDay ? baseTarget + gymDayBonus : baseTarget;
}

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
