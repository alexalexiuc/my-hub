/**
 * Calorie profile service.
 *
 * Exports:
 *   getCalorieProfile              — fetch a user's calorie profile
 *   upsertCalorieProfile           — create or update a calorie profile
 *   deleteCalorieProfile           — delete a calorie profile
 *   deleteAllUserCalorieProfiles   — bulk delete all profiles for a user
 *   generateCaloriesAutomationKey  — generate and persist a new automation API key
 *   getUserCalorieTargets          — profile + latest weight → daily calorie/macro targets, single source for weekly-menu tools
 * Types: UserCalorieTargets
 */
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { calorieProfiles } from '../../db/schema/calories';
import type { CalorieProfile } from '../../types';
import type { DayOfWeek, GoalType } from '../../constants';
import { MeasurementTypes, DEFAULT_GYM_DAY_CALORIE_BONUS } from '../../constants';
import { profileToTargets } from '../../utils';
import { getLatestMeasurementsPerType } from '../measurements/measurements';

// Excludes body measurement fields — those live in body_measurements table
export type ProfileUpdates = Partial<Omit<typeof calorieProfiles.$inferInsert, 'id' | 'userId' | 'createdAt'>>;

export async function getCalorieProfile(userId: string): Promise<CalorieProfile | undefined> {
  return db.query.calorieProfiles.findFirst({
    where: eq(calorieProfiles.userId, userId),
  });
}

export async function deleteCalorieProfile(userId: string): Promise<boolean> {
  const rows = await db
    .delete(calorieProfiles)
    .where(eq(calorieProfiles.userId, userId))
    .returning({ id: calorieProfiles.id });
  return rows.length > 0;
}

export async function deleteAllUserCalorieProfiles(userId: string): Promise<number> {
  const rows = await db
    .delete(calorieProfiles)
    .where(eq(calorieProfiles.userId, userId))
    .returning({ id: calorieProfiles.id });
  return rows.length;
}

export async function upsertCalorieProfile(userId: string, updates: ProfileUpdates): Promise<CalorieProfile> {
  const patch = { ...updates, updatedAt: new Date() };

  const existing = await db.query.calorieProfiles.findFirst({
    where: eq(calorieProfiles.userId, userId),
  });

  if (existing) {
    const [row] = await db.update(calorieProfiles).set(patch).where(eq(calorieProfiles.userId, userId)).returning();
    if (!row) throw new Error('Update did not return a row');
    return row;
  }

  const [row] = await db
    .insert(calorieProfiles)
    .values({ userId, ...patch })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

/**
 * Generates a new 64-char hex automation API key, persists it to the user's
 * calorie profile, and returns it. Overwrites any previously set key.
 */
export async function generateCaloriesAutomationKey(userId: string): Promise<string> {
  const key = randomBytes(32).toString('hex');
  await upsertCalorieProfile(userId, { automationApiKey: key });
  return key;
}

export interface UserCalorieTargets {
  goalType: GoalType | null;
  dailyCalories: { min: number | null; goal: number | null; max: number | null };
  macros: { protein: number | null; carbs: number | null; fat: number | null };
  gymDays: DayOfWeek[] | null;
  gymDayCalorieBonus: number;
}

/**
 * Derives a user's daily calorie/macro targets from their profile and latest weight
 * measurement. Single source for this computation — used by both the plan-week and
 * get-weekly-menu MCP tools (for the caller and for anyone who has shared their menu
 * with the caller), so their `userTargets` output never drifts apart. Returns `null`
 * if the user has no calorie profile set up.
 */
export async function getUserCalorieTargets(userId: string): Promise<UserCalorieTargets | null> {
  const profile = await getCalorieProfile(userId);
  if (!profile) return null;

  const latestMeasurements = await getLatestMeasurementsPerType(userId);
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);
  const gymDays = profile.gymDays ?? [];

  return {
    goalType: profile.goalType ?? null,
    dailyCalories: { min: targets.minCalories, goal: targets.goalCalories, max: targets.maxCalories },
    macros: { protein: profile.goalProtein ?? null, carbs: profile.goalCarbs ?? null, fat: profile.goalFat ?? null },
    gymDays: gymDays.length > 0 ? gymDays : null,
    gymDayCalorieBonus: profile.gymDayCalorieBonus ?? DEFAULT_GYM_DAY_CALORIE_BONUS,
  };
}
