import { and, between, eq, isNotNull } from "drizzle-orm";
import { db } from "../../db/client";
import { mealLogs } from "../../db/schema/calories";
import type { MealLog, NewMealLog } from "../../types/index";

export interface GetMealsFilter {
  date?: string;
  mealType?: string;
  limit?: number;
  offset?: number;
}

export async function logMeal(data: Omit<NewMealLog, "id" | "createdAt" | "loggedAt">): Promise<MealLog> {
  const [row] = await db.insert(mealLogs).values(data).returning();
  if (!row) throw new Error("Insert did not return a row");
  return row;
}

export async function getMeals(userId: string, filter: GetMealsFilter = {}): Promise<MealLog[]> {
  const { date, mealType, limit, offset = 0 } = filter;

  const conditions = [eq(mealLogs.userId, userId), isNotNull(mealLogs.mealId)];
  if (date !== undefined) conditions.push(eq(mealLogs.date, date));
  if (mealType !== undefined) conditions.push(eq(mealLogs.mealType, mealType));

  const rows = await db
    .select()
    .from(mealLogs)
    .where(and(...conditions))
    .orderBy(mealLogs.loggedAt);

  return limit !== undefined ? rows.slice(offset, offset + limit) : rows.slice(offset);
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

export async function deleteMeal(userId: string, mealId: string): Promise<MealLog | null> {
  const [row] = await db
    .delete(mealLogs)
    .where(and(eq(mealLogs.userId, userId), eq(mealLogs.mealId, mealId)))
    .returning();
  return row ?? null;
}
