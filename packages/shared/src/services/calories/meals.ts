import { and, between, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { mealLogs } from '../../db/schema/calories';
import type { MealLog, NewMealLog } from '../../types';
import { MealType } from '../../constants';

export interface GetMealsFilter {
  date?: string;
  mealType?: MealType;
  limit?: number;
  /** Number of meal logs to skip for pagination. Defaults to 0 if not provided. */
  offset?: number;
}

export async function logMeal(data: Omit<NewMealLog, 'id' | 'createdAt' | 'loggedAt'>): Promise<MealLog> {
  const [row] = await db.insert(mealLogs).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

/**
 * Fetch meal logs for a user with optional filtering by date and meal type, and support for pagination via limit and offset.
 */
export async function getMeals(userId: string, filter: GetMealsFilter = {}): Promise<MealLog[]> {
  const { date, mealType, limit, offset = 0 } = filter;

  const conditions = [eq(mealLogs.userId, userId), isNotNull(mealLogs.mealId)];
  if (date !== undefined) conditions.push(eq(mealLogs.date, date));
  if (mealType !== undefined) conditions.push(eq(mealLogs.mealType, mealType));

  const query = db
    .select()
    .from(mealLogs)
    .where(and(...conditions))
    .orderBy(mealLogs.loggedAt)
    .offset(offset);

  //TODO: Verify generated query
  if (limit !== undefined) query.limit(limit);

  const rows = await query;

  return rows;
}

export async function getMealsForDate(userId: string, date: string): Promise<MealLog[]> {
  return db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), eq(mealLogs.date, date), isNotNull(mealLogs.mealId)))
    .orderBy(mealLogs.loggedAt);
}

export async function getMealsForDateRange(userId: string, start: string, end: string): Promise<MealLog[]> {
  return db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), between(mealLogs.date, start, end), isNotNull(mealLogs.mealId)))
    .orderBy(mealLogs.date, mealLogs.loggedAt);
}

export async function deleteAllUserMeals(userId: string): Promise<number> {
  const rows = await db.delete(mealLogs).where(eq(mealLogs.userId, userId)).returning({ id: mealLogs.id });
  return rows.length;
}

export async function updateMeal(
  userId: string,
  mealId: string,
  data: Partial<Pick<MealLog, 'description' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'mealType' | 'notes'>>,
): Promise<MealLog | null> {
  const [row] = await db
    .update(mealLogs)
    .set(data)
    .where(and(eq(mealLogs.userId, userId), eq(mealLogs.mealId, mealId)))
    .returning();
  return row ?? null;
}

export async function deleteMeal(userId: string, mealId: string): Promise<MealLog | null> {
  const [row] = await db
    .delete(mealLogs)
    .where(and(eq(mealLogs.userId, userId), eq(mealLogs.mealId, mealId)))
    .returning();
  return row ?? null;
}
