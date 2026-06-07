import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { weeklyMenus, weeklyMenuMeals, weeklyMenuDayLogs } from '../../db/schema/calories';
import type { MealType } from '../../constants/calories';
import type { DayOfWeek } from '../../constants/weekly-menu';
import { PromiseCacheX } from 'promise-cachex';
import { logger } from '../../utils';

const menuAccessCache = new PromiseCacheX<boolean>({ ttl: 1000 }); // 1 second

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyMenuMealInput {
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  description: string;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export interface CreateWeeklyMenuInput {
  userId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  title?: string | null;
  notes?: string | null;
  meals: WeeklyMenuMealInput[];
}

export interface WeeklyMenuMeal {
  id: number;
  menuId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  description: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  createdAt: Date;
}

export interface WeeklyMenu {
  menuId: string;
  userId: string;
  weekStart: string;
  title: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  meals: WeeklyMenuMeal[];
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function hasAccessToMenu(userId: string, menuId: string): Promise<boolean> {
  return menuAccessCache.get(`${userId}:${menuId}`, async () => {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(weeklyMenus)
      .where(and(eq(weeklyMenus.userId, userId), eq(weeklyMenus.menuId, menuId)));

    return (row?.count ?? 0) > 0;
  });
}

/**
 * Create a new weekly menu with its meals for a user.
 * If a menu for the same weekStart already exists, it is replaced (delete + insert).
 */
export async function createWeeklyMenu(input: CreateWeeklyMenuInput): Promise<WeeklyMenu> {
  const menuId = crypto.randomUUID();

  // Delete any existing menu for this user + week (one menu per week)
  await db
    .delete(weeklyMenus)
    .where(and(eq(weeklyMenus.userId, input.userId), eq(weeklyMenus.weekStart, input.weekStart)));

  const [menu] = await db
    .insert(weeklyMenus)
    .values({
      menuId,
      userId: input.userId,
      weekStart: input.weekStart,
      title: input.title ?? null,
      notes: input.notes ?? null,
    })
    .returning();

  if (!menu) throw new Error('Insert did not return a row');

  const mealRows =
    input.meals.length > 0
      ? await db
          .insert(weeklyMenuMeals)
          .values(
            input.meals.map(m => ({
              menuId,
              dayOfWeek: m.dayOfWeek,
              mealType: m.mealType,
              description: m.description,
              kcal: m.kcal ?? null,
              protein: m.protein ?? null,
              carbs: m.carbs ?? null,
              fat: m.fat ?? null,
            })),
          )
          .returning()
      : [];

  return { ...menu, meals: mealRows };
}

/**
 * Get all weekly menus for a user, newest first, without meal rows.
 */
export async function getWeeklyMenus(userId: string): Promise<Omit<WeeklyMenu, 'meals'>[]> {
  return db.select().from(weeklyMenus).where(eq(weeklyMenus.userId, userId)).orderBy(desc(weeklyMenus.weekStart));
}

async function getWeeklyMenuWhere(where: ReturnType<typeof and>): Promise<WeeklyMenu | null> {
  const [menu] = await db.select().from(weeklyMenus).where(where);

  if (!menu) return null;

  const meals = await db
    .select()
    .from(weeklyMenuMeals)
    .where(eq(weeklyMenuMeals.menuId, menu.menuId))
    .orderBy(weeklyMenuMeals.dayOfWeek, weeklyMenuMeals.mealType);

  return { ...menu, meals };
}

/**
 * Get a single weekly menu with its meals.
 */
export async function getWeeklyMenu(userId: string, menuId: string): Promise<WeeklyMenu | null> {
  return getWeeklyMenuWhere(and(eq(weeklyMenus.userId, userId), eq(weeklyMenus.menuId, menuId)));
}

/**
 * Get the menu for a specific week start date, or null if none exists.
 */
export async function getWeeklyMenuByWeek(userId: string, weekStart: string): Promise<WeeklyMenu | null> {
  return getWeeklyMenuWhere(and(eq(weeklyMenus.userId, userId), eq(weeklyMenus.weekStart, weekStart)));
}

/**
 * Add a new meal to an existing weekly menu.
 * Returns null if the menu doesn't belong to the user or the slot already exists.
 */
export async function addMealToMenu(
  userId: string,
  menuId: string,
  meal: WeeklyMenuMealInput,
): Promise<WeeklyMenuMeal | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized addMeal attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  const [inserted] = await db
    .insert(weeklyMenuMeals)
    .values({
      menuId,
      dayOfWeek: meal.dayOfWeek,
      mealType: meal.mealType,
      description: meal.description,
      kcal: meal.kcal ?? null,
      protein: meal.protein ?? null,
      carbs: meal.carbs ?? null,
      fat: meal.fat ?? null,
    })
    .onConflictDoNothing()
    .returning();

  return inserted ?? null;
}

export interface UpdateWeeklyMenuMealInput {
  description: string;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

/**
 * Update a single meal in a weekly menu.
 * Verifies ownership via userId. Returns the updated meal or null if not found.
 */
export async function updateWeeklyMenuMeal(
  userId: string,
  menuId: string,
  dayOfWeek: DayOfWeek,
  mealType: MealType,
  updates: UpdateWeeklyMenuMealInput,
): Promise<WeeklyMenuMeal | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized update attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  const [updated] = await db
    .update(weeklyMenuMeals)
    .set({
      description: updates.description,
      kcal: updates.kcal ?? null,
      protein: updates.protein ?? null,
      carbs: updates.carbs ?? null,
      fat: updates.fat ?? null,
    })
    .where(
      and(
        eq(weeklyMenuMeals.menuId, menuId),
        eq(weeklyMenuMeals.dayOfWeek, dayOfWeek),
        eq(weeklyMenuMeals.mealType, mealType),
      ),
    )
    .returning();

  return updated ?? null;
}

/**
 * Delete a weekly menu (cascades to meals).
 */
export async function deleteWeeklyMenu(userId: string, menuId: string): Promise<boolean> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized delete attempt by user ${userId} to menu ${menuId}`);
    return false;
  }

  const result = await db
    .delete(weeklyMenus)
    .where(eq(weeklyMenus.menuId, menuId))
    .returning({ menuId: weeklyMenus.menuId });
  return result.length > 0;
}

/**
 * Delete all weekly menus for a user. Used by the "delete all my data" flow.
 */
export async function deleteAllUserWeeklyMenus(userId: string): Promise<number> {
  logger.info(`Deleting all weekly menus for user ${userId}`);
  const deleted = await db
    .delete(weeklyMenus)
    .where(eq(weeklyMenus.userId, userId))
    .returning({ menuId: weeklyMenus.menuId });
  return deleted.length;
}

// ---------------------------------------------------------------------------
// Day log tracking
// ---------------------------------------------------------------------------

/**
 * Mark a specific meal as logged. Idempotent — safe to call if already logged.
 * Verifies that menuId belongs to userId before writing.
 */
export async function markDayAsLogged(
  userId: string,
  menuId: string,
  dayOfWeek: DayOfWeek,
  loggedDate: string,
  mealType: MealType,
): Promise<boolean> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized log attempt by user ${userId} to menu ${menuId}`);
    return false;
  }

  await db.insert(weeklyMenuDayLogs).values({ menuId, dayOfWeek, mealType, loggedDate }).onConflictDoNothing();

  return true;
}

/**
 * Get all logged meals for a menu as a set of `${dayOfWeek}:${mealType}` keys.
 */
export async function getLoggedDays(userId: string, menuId: string): Promise<Record<string, string>> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized access attempt by user ${userId} to menu ${menuId}`);
    return {};
  }

  const rows = await db
    .select({
      dayOfWeek: weeklyMenuDayLogs.dayOfWeek,
      mealType: weeklyMenuDayLogs.mealType,
      loggedDate: weeklyMenuDayLogs.loggedDate,
    })
    .from(weeklyMenuDayLogs)
    .where(eq(weeklyMenuDayLogs.menuId, menuId));

  return Object.fromEntries(rows.map(r => [`${r.dayOfWeek}:${r.mealType}`, r.loggedDate]));
}
