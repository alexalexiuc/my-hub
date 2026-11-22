/**
 * Frozen per-day calorie ranges.
 *
 * A finished day keeps the range it had, rather than being re-judged against whatever the
 * profile says today. Ranges are frozen at the writes that would move them: before a profile
 * update or a weigh-in change, every finished day with meals that isn't frozen yet is stored with
 * the range it has right then. Reads only look the frozen rows up; every other day follows the
 * live rule.
 *
 * Imports nothing from `./profile` or the measurements service, since both call
 * `freezeDayTargets` before their writes.
 *
 * Exports:
 *   getDayTargetsForRange           — each date's range, frozen ones as stored
 *   getDayTargets                   — the same for one date
 *   freezeDayTargets                — store the current range of every finished, unfrozen day with meals
 *   queryLatestWeightKg             — the latest weigh-in, one-row query
 *   deleteAllUserCalorieDayTargets  — bulk delete for account wipes
 */
import { and, between, desc, eq, isNull, lt } from 'drizzle-orm';
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
 * The first date that may still be in progress for the user. With no timezone saved it steps back
 * a day from UTC's, which no timezone (down to UTC-12) is behind.
 */
function firstOpenDate(timezone: string | null | undefined, now: Date): string {
  return timezone ? currentDateString(timezone) : shiftDateStr(toUTCDateStr(now), -1);
}

/**
 * Stores the current range of every finished day that has meals and isn't frozen yet. Call it
 * before any write that would move a range (profile update, weigh-in logged, edited or deleted),
 * so past days keep the range they were lived against. A day with no target (no profile or no
 * weigh-in yet) isn't frozen, so setting one up later still applies to it. Idempotent; concurrent
 * calls are safe (first insert wins). Returns how many days were frozen.
 *
 * @param userId - Owner of the days.
 * @param now    - Clock, for tests.
 */
export async function freezeDayTargets(userId: string, now: Date = new Date()): Promise<number> {
  const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId));
  const openFrom = firstOpenDate(user?.timezone, now);

  const unfrozen = await db
    .selectDistinct({ date: mealLogs.date })
    .from(mealLogs)
    .leftJoin(
      calorieDayTargets,
      and(eq(calorieDayTargets.userId, mealLogs.userId), eq(calorieDayTargets.date, mealLogs.date)),
    )
    .where(and(eq(mealLogs.userId, userId), lt(mealLogs.date, openFrom), isNull(calorieDayTargets.id)));
  if (unfrozen.length === 0) return 0;

  const { profile, weightKg } = await loadDayTargetInputs(userId);
  const rows = unfrozen.flatMap(({ date }) => {
    const day = dayCalorieTargets(profile, weightKg, date);
    if (day.target === null) return [];
    return [
      {
        userId,
        date,
        target: Math.round(day.target),
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
