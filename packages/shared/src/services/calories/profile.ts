import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { calorieProfiles } from '../../db/schema/calories';
import type { CalorieProfile } from '../../types/index';

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
