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
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { calorieProfiles } from '../../db/schema/calories';
import type { CalorieProfile } from '../../types';

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
