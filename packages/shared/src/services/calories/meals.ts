import { and, between, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { mealLogs } from '../../db/schema/calories';
import type { MealLog, NewMealLog } from '../../types';
import { MealType } from '../../constants';
import { omitUndefined } from '../../utils/objects';

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

  // Drizzle's `limit()` mutates the builder and returns it, so applying it without reassigning
  // is correct here.
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

/**
 * Patch a meal the user owns. `undefined` leaves a field untouched, `null` clears it — so the
 * caller can distinguish "not editing the calories" from "this meal has no calorie count".
 * Returns null when no meal with that id belongs to the user.
 */
export async function updateMeal(
  userId: string,
  mealId: string,
  data: Partial<Pick<MealLog, 'description' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'mealType' | 'notes'>>,
): Promise<MealLog | null> {
  const [row] = await db
    .update(mealLogs)
    .set(omitUndefined(data))
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

/**
 * One previously logged meal, offered as a one-tap starting point for a new log.
 * `description` carries the casing of the most recent entry; the macros are that same entry's.
 */
export interface RecentMealSuggestion {
  description: string;
  mealType: MealType;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

/**
 * The user's most recently logged meals, one row per distinct description (compared
 * case-insensitively, so "Greek yogurt" and "greek yogurt" are the same dish), newest first.
 *
 * Exists so logging a meal you eat regularly is a tap rather than re-typing a description and
 * four numbers. Each row carries the macros from the latest time that dish was logged, which is
 * the best guess at what it will be this time — the user can still adjust before saving.
 *
 * @param userId  Owner of the meal logs.
 * @param limit   Maximum suggestions to return. Defaults to 12.
 */
export async function getRecentMealSuggestions(userId: string, limit = 12): Promise<RecentMealSuggestion[]> {
  const normalizedDescription = sql`lower(${mealLogs.description})`;

  // DISTINCT ON keeps the newest row per description, but Postgres requires its ORDER BY to
  // lead with the distinct expression — which is not the order the caller wants. Hence the
  // subquery: dedupe inside, order by recency outside.
  const newestPerDescription = db
    .selectDistinctOn([normalizedDescription], {
      description: mealLogs.description,
      mealType: mealLogs.mealType,
      kcal: mealLogs.kcal,
      protein: mealLogs.protein,
      carbs: mealLogs.carbs,
      fat: mealLogs.fat,
      loggedAt: mealLogs.loggedAt,
    })
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), isNotNull(mealLogs.mealId)))
    .orderBy(normalizedDescription, desc(mealLogs.loggedAt))
    .as('newest_per_description');

  const rows = await db
    .select({
      description: newestPerDescription.description,
      mealType: newestPerDescription.mealType,
      kcal: newestPerDescription.kcal,
      protein: newestPerDescription.protein,
      carbs: newestPerDescription.carbs,
      fat: newestPerDescription.fat,
    })
    .from(newestPerDescription)
    .orderBy(desc(newestPerDescription.loggedAt))
    .limit(limit);

  return rows;
}
