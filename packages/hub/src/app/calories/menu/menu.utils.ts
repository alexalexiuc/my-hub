import {
  toUTCDateStr,
  addDays,
  dateToString,
  startOfWeekMonday,
  shiftWeekStr,
  formatWeekRangeStr,
  mealOrder,
  dayTargetKcal,
  dayTargetStatus,
} from '@my-hub/shared/utils';
import type { DayCalorieTargets } from '@my-hub/shared/utils';
import { DaysOfWeekValues, DAY_LABELS, DayTargetStatuses } from '@my-hub/shared/constants';
import type { DayOfWeek, DayTargetStatus, GymTime, MealType } from '@my-hub/shared/constants';
import { MEAL_LABEL } from '@/app/calories/constants';
import { dayStatusColor } from '@/app/calories/calories.utils';
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

/** One weekday's range as `GET /api/calories/menu` sends it — the shared rule's own output type. */
export type DayTarget = DayCalorieTargets;

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

/** Ceiling used to draw the bars when the profile can't produce a target — never judged against. */
const FALLBACK_DAILY_TARGET_KCAL = 2000;

/** A weekday with no range yet (before the menu list has loaded). */
const NO_TARGET: DayTarget = { target: null, min: null, isGymDay: false, gymDayBonus: 0 };

/** A plan (one day's or the week's) judged against its range. */
export type DayPlan = {
  plannedKcal: number;
  mealCount: number;
  /** `recovery` only when the user trains on some days; null for the week, or with no gym days set. */
  kind: 'gym' | 'recovery' | null;
  /** kcal the gym-day bonus adds to this range — 0 on a recovery day and for the week. */
  bonusKcal: number;
  ceiling: number;
  floor: number | null;
  /** True when `ceiling` is the fallback estimate, not the user's own target. */
  isEstimated: boolean;
  status: DayTargetStatus;
  /** The verdict's colour, for the planned number and the bar. Neutral for an estimate. */
  color: string;
};

/** The verdict and its colour — the one rule shared by day plans and the week plan. */
function judgePlan(
  plan: Pick<DayPlan, 'plannedKcal' | 'mealCount' | 'ceiling' | 'floor' | 'isEstimated'>,
): Pick<DayPlan, 'status' | 'color'> {
  if (plan.isEstimated) return { status: DayTargetStatuses.NoTarget, color: 'var(--muted)' };
  const status = dayTargetStatus({
    kcal: plan.plannedKcal,
    mealCount: plan.mealCount,
    target: plan.ceiling,
    min: plan.floor,
  });
  return { status, color: dayStatusColor(status) };
}

/**
 * Judges a week's plan, day by day and as a whole. Each day is held against its own range, as
 * `GET /api/calories/menu` resolved it with the shared `weekdayCalorieTargets` — the bonus is
 * never re-applied here — and the verdict comes from `dayTargetStatus`, so a planned day reads on
 * target / under / over by the rule Today and Progress use for eaten days. The week sums only the
 * days that have meals: a menu created mid-week plans the remaining days, and holding those
 * against seven days of target would always read as far under.
 */
export function planWeek(
  byDay: Record<number, WeeklyMenuMeal[]>,
  dayTargets: DayTarget[],
): { days: Record<DayOfWeek, DayPlan>; week: DayPlan } {
  const hasGymDays = dayTargets.some(t => t.isGymDay);
  const days = Object.fromEntries(
    DaysOfWeekValues.map(d => {
      const meals = byDay[d] ?? [];
      const t = dayTargets[d] ?? NO_TARGET;
      const base = {
        plannedKcal: meals.reduce((s, m) => s + (m.kcal ?? 0), 0),
        mealCount: meals.length,
        kind: t.isGymDay ? ('gym' as const) : hasGymDays ? ('recovery' as const) : null,
        bonusKcal: t.isGymDay ? t.gymDayBonus : 0,
        ceiling: t.target ?? dayTargetKcal(FALLBACK_DAILY_TARGET_KCAL, t.isGymDay, t.gymDayBonus),
        // An estimate has no real floor: the profile's min held against the fallback ceiling can
        // land above it and draw the range backwards.
        floor: t.target === null ? null : t.min,
        isEstimated: t.target === null,
      };
      return [d, { ...base, ...judgePlan(base) }];
    }),
  ) as Record<DayOfWeek, DayPlan>;

  const planned = DaysOfWeekValues.map(d => days[d]).filter(p => p.mealCount > 0);
  const weekBase = {
    plannedKcal: planned.reduce((s, p) => s + p.plannedKcal, 0),
    mealCount: planned.reduce((s, p) => s + p.mealCount, 0),
    kind: null,
    bonusKcal: 0,
    ceiling: planned.reduce((s, p) => s + p.ceiling, 0),
    floor: planned.some(p => p.floor === null) ? null : planned.reduce((s, p) => s + (p.floor ?? 0), 0),
    isEstimated: planned.some(p => p.isEstimated),
  };
  return { days, week: { ...weekBase, ...judgePlan(weekBase) } };
}

/**
 * A plan's verdict in a few words — "On target", "120 under", "50 over" — or null when there is
 * nothing to judge (no meals with calories, or no real target).
 */
export function planStatusLabel(plan: Pick<DayPlan, 'status' | 'plannedKcal' | 'floor' | 'ceiling'>): string | null {
  if (plan.status === DayTargetStatuses.OnTarget) return 'On target';
  if (plan.status === DayTargetStatuses.Over) return `${(plan.plannedKcal - plan.ceiling).toLocaleString()} over`;
  if (plan.status === DayTargetStatuses.Under && plan.floor !== null) {
    return `${(plan.floor - plan.plannedKcal).toLocaleString()} under`;
  }
  return null;
}

/** "2,900–3,000" for a floor–ceiling range, or just "3,000" when there is no floor. */
export function formatKcalRange(floor: number | null, ceiling: number): string {
  return floor === null ? ceiling.toLocaleString() : `${floor.toLocaleString()}–${ceiling.toLocaleString()}`;
}

/**
 * Positions for a range bar, as percentages of its width: how far the planned fill reaches and
 * where the floor and ceiling ticks sit. The scale starts at zero, so the bar reads like any
 * progress bar, and runs 12% past the ceiling, so an over-planned day visibly overshoots its tick.
 */
export function rangeBarPositions(
  planned: number,
  floor: number | null,
  ceiling: number,
): { fill: number; floorTick: number | null; ceilingTick: number } {
  const high = ceiling * 1.12;
  const at = (v: number) => Math.max(0, Math.min(100, (v / high) * 100));
  return { fill: at(planned), floorTick: floor === null ? null : at(floor), ceilingTick: at(ceiling) };
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

/** Planned kcal as a percentage of target, rounded. Returns null if target is not a positive number. */
export function targetPct(planned: number, target: number | null): number | null {
  if (target == null || target <= 0) return null;
  return Math.round((planned / target) * 100);
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
