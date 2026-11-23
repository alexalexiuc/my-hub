/**
 * Frozen per-day calorie ranges.
 *
 * A finished day keeps the range it had, rather than being re-judged against whatever the
 * profile says today. Ranges are frozen at the writes that would move them: before a profile
 * update or a weigh-in change, every finished day that isn't frozen yet is stored with
 * the range it has right then. Reads only look the frozen rows up; every other day follows the
 * live rule.
 *
 * Imports nothing from `./profile` or the measurements service, since both call
 * `freezeDayTargets` before their writes.
 *
 * Exports:
 *   getDayTargetsForRange           — each date's range, frozen ones as stored
 *   getDayTargets                   — the same for one date
 *   freezeDayTargets                — store the current range of every finished, unfrozen day
 *   queryLatestWeightKg             — the latest weigh-in, one-row query
 *   deleteAllUserCalorieDayTargets  — bulk delete for account wipes
 */
import { and, between, desc, eq, min } from 'drizzle-orm';
import { db } from '../../db/client';
import { calorieDayTargets, calorieProfiles, mealLogs } from '../../db/schema/calories';
import { bodyMeasurements } from '../../db/schema/measurements';
import { users } from '../../db/schema/users';
import { MeasurementTypes } from '../../constants';
import { calendarDays, currentDateString, shiftDateStr, toUTCDateStr } from '../../utils/dates';
import { dayCalorieTargets, type DayCalorieTargets } from '../../utils/calories';
import type { CalorieProfile } from '../../types';

/** What a day's live range is worked out from: the calorie profile and the latest weigh-in. */
export interface DayTargetInputs {
  profile: CalorieProfile | undefined;
  weightKg: number | null;
}

/**
 * The user's most recent `weight` measurement in kg, or null if they have never logged one. One-row query,
 * same-day ties broken by id; the `latestWeightKg` util picks from an already-loaded measurement list instead.
 */
export async function queryLatestWeightKg(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ value: bodyMeasurements.value })
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, userId), eq(bodyMeasurements.typeKey, MeasurementTypes.Weight)))
    .orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.id))
    .limit(1);
  return row?.value ?? null;
}

async function loadDayTargetInputs(userId: string): Promise<DayTargetInputs> {
  const [profile, weightKg] = await Promise.all([
    db.query.calorieProfiles.findFirst({ where: eq(calorieProfiles.userId, userId) }),
    queryLatestWeightKg(userId),
  ]);
  return { profile, weightKg };
}

/**
 * Each date's calorie range in [start, end] — every date present. Frozen days come from
 * `calorie_day_targets` as stored; the rest follow `dayCalorieTargets` against the current
 * profile and latest weight. Read-only. Without `inputs`, the profile and latest weight load
 * here, in parallel with the frozen rows.
 *
 * @param userId - Owner of the ranges.
 * @param start  - First date, YYYY-MM-DD.
 * @param end    - Last date, YYYY-MM-DD (inclusive).
 * @param inputs - The profile and latest weight, when the caller has already loaded them.
 */
export async function getDayTargetsForRange(
  userId: string,
  start: string,
  end: string,
  inputs?: DayTargetInputs,
): Promise<Map<string, DayCalorieTargets>> {
  const [rows, { profile, weightKg }] = await Promise.all([
    db
      .select()
      .from(calorieDayTargets)
      .where(and(eq(calorieDayTargets.userId, userId), between(calorieDayTargets.date, start, end))),
    inputs ?? loadDayTargetInputs(userId),
  ]);
  const frozen = new Map(rows.map(r => [r.date, r]));

  const result = new Map<string, DayCalorieTargets>();
  for (const date of calendarDays(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`))) {
    const row = frozen.get(date);
    result.set(
      date,
      row
        ? { target: row.target, min: row.min, isGymDay: row.isGymDay, gymDayBonus: row.gymDayBonus }
        : dayCalorieTargets(profile, weightKg, date),
    );
  }
  return result;
}

/** `getDayTargetsForRange` for a single date. */
export async function getDayTargets(
  userId: string,
  date: string,
  inputs?: DayTargetInputs,
): Promise<DayCalorieTargets> {
  const days = await getDayTargetsForRange(userId, date, date, inputs);
  return days.get(date)!;
}

/**
 * Stores the current range of every finished day that isn't frozen yet, from the user's first meal
 * (or the profile's creation, if that is earlier) up to yesterday. Call it before any write that
 * would move a range (profile update, weigh-in logged, edited or deleted), so past days keep the
 * range they were lived against, including empty days that get meals back-filled later.
 * "Yesterday" is the day before `currentDateString(timezone)`, the same today the readers use, so a
 * day already shown with a verdict is never re-judged. A day with neither a target nor a floor (no
 * goal set yet) isn't frozen, so setting one up later still applies to it. Idempotent; concurrent
 * calls are safe (first insert wins). Returns how many days were frozen.
 *
 * @param userId - Owner of the days.
 * @param now    - The moment "today" is read at; defaults to the current time.
 */
export async function freezeDayTargets(userId: string, now: Date = new Date()): Promise<number> {
  // One round trip: the frozen dates are read for the whole history (one short date per day) rather
  // than waiting for the range, which needs the first three answers.
  const [[user], [firstMeal], { profile, weightKg }, frozenRows] = await Promise.all([
    db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)),
    db
      .select({ date: min(mealLogs.date) })
      .from(mealLogs)
      .where(eq(mealLogs.userId, userId)),
    loadDayTargetInputs(userId),
    db.select({ date: calorieDayTargets.date }).from(calorieDayTargets).where(eq(calorieDayTargets.userId, userId)),
  ]);
  if (!profile) return 0;

  const lastFinished = shiftDateStr(currentDateString(user?.timezone, now), -1);
  const profileStart = toUTCDateStr(profile.createdAt);
  const from = firstMeal?.date && firstMeal.date < profileStart ? firstMeal.date : profileStart;
  if (from > lastFinished) return 0;
  const frozen = new Set(frozenRows.map(r => r.date));

  const days = calendarDays(new Date(`${from}T00:00:00Z`), new Date(`${lastFinished}T00:00:00Z`));
  const rows = days.flatMap(date => {
    if (frozen.has(date)) return [];
    const day = dayCalorieTargets(profile, weightKg, date);
    if (day.target === null && day.min === null) return [];
    return [
      {
        userId,
        date,
        target: day.target === null ? null : Math.round(day.target),
        min: day.min === null ? null : Math.round(day.min),
        isGymDay: day.isGymDay,
        gymDayBonus: Math.round(day.gymDayBonus),
      },
    ];
  });
  if (rows.length === 0) return 0;
  await db.insert(calorieDayTargets).values(rows).onConflictDoNothing();
  return rows.length;
}

/** Deletes every frozen day range the user owns; returns how many rows went. */
export async function deleteAllUserCalorieDayTargets(userId: string): Promise<number> {
  const rows = await db
    .delete(calorieDayTargets)
    .where(eq(calorieDayTargets.userId, userId))
    .returning({ id: calorieDayTargets.id });
  return rows.length;
}
