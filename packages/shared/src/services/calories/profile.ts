/**
 * Calorie profile service.
 *
 * Exports:
 *   getCalorieProfile              — fetch a user's calorie profile
 *   upsertCalorieProfile           — create or update a calorie profile
 *   deleteCalorieProfile           — delete a calorie profile
 *   deleteAllUserCalorieProfiles   — bulk delete all profiles for a user
 *   generateCaloriesAutomationKey  — generate and persist a new automation API key
 */
import { randomBytes } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { calorieProfiles } from '../../db/schema/calories';
import { bodyMeasurements } from '../../db/schema/measurements';
import type { CalorieProfile } from '../../types';
import { GoalTypes } from '../../constants/calories';
import { currentDateString } from '../../utils/dates';

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

/** The user's most recent `weight` measurement in kg, or null if they have never logged one. */
async function latestWeightKg(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ value: bodyMeasurements.value })
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, userId), eq(bodyMeasurements.typeKey, 'weight')))
    .orderBy(desc(bodyMeasurements.date), desc(bodyMeasurements.id))
    .limit(1);
  return row?.value ?? null;
}

/**
 * Decides whether this update should stamp a new goal baseline, and what it should be.
 *
 * The baseline is what makes a goal cumulative: the projection runs from it rather than from each
 * week's first weigh-in, so a week that ends over target stays over target instead of becoming the
 * next week's forgiving new start. It therefore moves only on purpose — when the goal itself
 * changes, or when a goal exists without one — never on its own.
 *
 * An explicit baseline in `updates` always wins: that is the user resetting it deliberately.
 */
async function goalBaselinePatch(
  userId: string,
  updates: ProfileUpdates,
  existing: CalorieProfile | undefined,
): Promise<ProfileUpdates> {
  const setsBaselineExplicitly = 'goalStartDate' in updates || 'goalStartWeightKg' in updates;
  if (setsBaselineExplicitly) return {};

  const goalType = updates.goalType ?? existing?.goalType ?? null;
  if (!goalType) return {};

  const goalRate = updates.goalWeeklyRateKg ?? existing?.goalWeeklyRateKg ?? null;
  const goalChanged =
    (updates.goalType !== undefined && updates.goalType !== existing?.goalType) ||
    (updates.goalWeeklyRateKg !== undefined && updates.goalWeeklyRateKg !== existing?.goalWeeklyRateKg);
  const baselineMissing = !existing?.goalStartDate || existing?.goalStartWeightKg == null;

  if (!goalChanged && !baselineMissing) return {};

  // A maintain goal needs no rate; loss and gain do, and a baseline stamped before the rate is
  // known would anchor a line that cannot yet be drawn.
  if (goalType !== GoalTypes.Maintain && !goalRate) return {};

  const weightKg = await latestWeightKg(userId);
  if (weightKg === null) return {};

  return { goalStartDate: currentDateString(), goalStartWeightKg: weightKg };
}

export async function upsertCalorieProfile(userId: string, updates: ProfileUpdates): Promise<CalorieProfile> {
  const existing = await db.query.calorieProfiles.findFirst({
    where: eq(calorieProfiles.userId, userId),
  });

  const patch = { ...updates, ...(await goalBaselinePatch(userId, updates, existing)), updatedAt: new Date() };

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
