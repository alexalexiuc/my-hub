/**
 * Weekly menu service — menu/meal CRUD plus day-log ("logged as eaten") tracking.
 *
 * Named exports:
 * - `WeeklyMenu`, `WeeklyMenuMeal`, `WeeklyMenuMealInput`, `CreateWeeklyMenuInput`, `UpdateWeeklyMenuMealInput`, `LogMenuMealInput` — service types
 * - `hasAccessToMenu(userId, menuId)` — ownership check (1s promise cache)
 * - `createWeeklyMenu(input)` — create (or replace, per user+week) a menu with its meals
 * - `updateWeeklyMenu(userId, menuId, { title?, notes? })` — patch a menu's title/prep notes without touching meals
 * - `getWeeklyMenus(userId)` — all menus, ascending by weekStart, without meal rows
 * - `getWeeklyMenu(userId, menuId)` / `getWeeklyMenuByWeek(userId, weekStart)` — single menu with meals
 * - `addMealToMenu(userId, menuId, meal)` — insert one meal; null when slot exists or no access
 * - `updateWeeklyMenuMeal(userId, menuId, dayOfWeek, mealType, updates)` — swap a slot's meal (clears its day-log)
 * - `upsertMenuMeal(userId, menuId, meal)` — set a slot's meal (insert-or-overwrite; clears its day-log)
 * - `deleteWeeklyMenuMeal(userId, menuId, dayOfWeek, mealType)` — remove a slot (clears its day-log)
 * - `deleteWeeklyMenu(userId, menuId)` / `deleteAllUserWeeklyMenus(userId)` — menu deletion (evicts access cache)
 * - `logMenuMeal(userId, menuId, dayOfWeek, mealType, loggedDate, meal)` — transactionally journal a meal AND mark its slot logged
 * - `markDayAsLogged(userId, menuId, dayOfWeek, loggedDate, mealType)` — mark a slot logged (idempotent, marker only)
 * - `getLoggedDays(userId, menuId)` — `{ "day:mealType": loggedDate }` map of logged slots
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { weeklyMenus, weeklyMenuMeals, weeklyMenuDayLogs, mealLogs } from '../../db/schema/calories';
import type { MealType } from '../../constants/calories';
import type { DayOfWeek } from '../../constants/weekly-menu';
import { PromiseCacheX } from 'promise-cachex';
import { logger, omitUndefined } from '../../utils';

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
 * Duplicate (dayOfWeek, mealType) slots in the input collapse to the first occurrence
 * (enforced by the `uq_weekly_menu_meal_slot` unique constraint + onConflictDoNothing).
 */
export async function createWeeklyMenu(input: CreateWeeklyMenuInput): Promise<WeeklyMenu> {
  const menuId = crypto.randomUUID();

  // Delete any existing menu for this user + week (one menu per week)
  const replaced = await db
    .delete(weeklyMenus)
    .where(and(eq(weeklyMenus.userId, input.userId), eq(weeklyMenus.weekStart, input.weekStart)))
    .returning({ menuId: weeklyMenus.menuId });

  // Evict the replaced menu's cached access grant — a stale `true` within the TTL would
  // let an in-flight write insert child rows referencing the deleted menu (FK violation).
  for (const row of replaced) {
    menuAccessCache.delete(`${input.userId}:${row.menuId}`);
  }

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
          .onConflictDoNothing()
          .returning()
      : [];

  return { ...menu, meals: mealRows };
}

export interface UpdateWeeklyMenuInput {
  title?: string | null;
  notes?: string | null;
}

/**
 * Patch a menu's title and/or prep notes without touching its meals. Follows update semantics:
 * `undefined` leaves a field unchanged, `null` clears it. Returns the updated menu row
 * (without meals), or null when the menu doesn't belong to the user.
 */
export async function updateWeeklyMenu(
  userId: string,
  menuId: string,
  updates: UpdateWeeklyMenuInput,
): Promise<Omit<WeeklyMenu, 'meals'> | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized menu update attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  const patch = omitUndefined({ title: updates.title, notes: updates.notes });
  if (Object.keys(patch).length === 0) {
    const [row] = await db.select().from(weeklyMenus).where(eq(weeklyMenus.menuId, menuId));
    return row ?? null;
  }

  const [updated] = await db
    .update(weeklyMenus)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(weeklyMenus.menuId, menuId))
    .returning();

  return updated ?? null;
}

/**
 * Get all weekly menus for a user, oldest first (ascending by weekStart), without meal rows.
 */
export async function getWeeklyMenus(userId: string): Promise<Omit<WeeklyMenu, 'meals'>[]> {
  return db.select().from(weeklyMenus).where(eq(weeklyMenus.userId, userId)).orderBy(asc(weeklyMenus.weekStart));
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

/** Remove any "logged" marker for a meal slot — the log refers to the dish that occupied it. */
async function clearDayLogForSlot(menuId: string, dayOfWeek: DayOfWeek, mealType: MealType): Promise<void> {
  await db
    .delete(weeklyMenuDayLogs)
    .where(
      and(
        eq(weeklyMenuDayLogs.menuId, menuId),
        eq(weeklyMenuDayLogs.dayOfWeek, dayOfWeek),
        eq(weeklyMenuDayLogs.mealType, mealType),
      ),
    );
}

/**
 * Update (swap) a single meal in a weekly menu.
 * Verifies ownership via userId. Returns the updated meal or null if not found.
 * Clears any day-log for the slot — the previous dish's "logged" state must not
 * carry over to the replacement meal.
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

  // A swap replaces the whole dish, so unspecified macros are cleared (null) rather than
  // inherited from the previous meal — otherwise "Plain oats" would keep the old salmon's macros.
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

  if (!updated) return null;

  await clearDayLogForSlot(menuId, dayOfWeek, mealType);

  return updated;
}

/**
 * Set a meal slot: insert the meal, or overwrite the existing dish if the
 * `(menuId, dayOfWeek, mealType)` slot is already taken. Collapses "add" and "swap" into a
 * single idempotent write for callers that just want a slot to hold a given meal (used by the
 * `calories_set_menu_meal` MCP tool). Clears the slot's day-log so a re-defined dish never
 * appears pre-logged. Returns the meal, or null if the menu doesn't belong to the user.
 */
export async function upsertMenuMeal(
  userId: string,
  menuId: string,
  meal: WeeklyMenuMealInput,
): Promise<WeeklyMenuMeal | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized upsertMeal attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  const values = {
    kcal: meal.kcal ?? null,
    protein: meal.protein ?? null,
    carbs: meal.carbs ?? null,
    fat: meal.fat ?? null,
  };

  const [upserted] = await db
    .insert(weeklyMenuMeals)
    .values({ menuId, dayOfWeek: meal.dayOfWeek, mealType: meal.mealType, description: meal.description, ...values })
    .onConflictDoUpdate({
      target: [weeklyMenuMeals.menuId, weeklyMenuMeals.dayOfWeek, weeklyMenuMeals.mealType],
      set: { description: meal.description, ...values },
    })
    .returning();

  if (!upserted) return null;

  await clearDayLogForSlot(menuId, meal.dayOfWeek, meal.mealType);

  return upserted;
}

/**
 * Delete a single meal slot from a weekly menu.
 * Verifies ownership via userId and also clears any day-log for the same slot so a
 * re-added meal does not appear pre-logged. Returns true if a meal row was removed.
 */
export async function deleteWeeklyMenuMeal(
  userId: string,
  menuId: string,
  dayOfWeek: DayOfWeek,
  mealType: MealType,
): Promise<boolean> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized delete-meal attempt by user ${userId} to menu ${menuId}`);
    return false;
  }

  const deleted = await db
    .delete(weeklyMenuMeals)
    .where(
      and(
        eq(weeklyMenuMeals.menuId, menuId),
        eq(weeklyMenuMeals.dayOfWeek, dayOfWeek),
        eq(weeklyMenuMeals.mealType, mealType),
      ),
    )
    .returning({ id: weeklyMenuMeals.id });

  if (deleted.length === 0) return false;

  await clearDayLogForSlot(menuId, dayOfWeek, mealType);

  return true;
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

  // Drop the cached access grant so follow-up calls within the TTL see the deletion
  // instead of inserting rows that reference the removed menu (FK violation).
  menuAccessCache.delete(`${userId}:${menuId}`);

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

  for (const row of deleted) {
    menuAccessCache.delete(`${userId}:${row.menuId}`);
  }

  return deleted.length;
}

// ---------------------------------------------------------------------------
// Day log tracking
// ---------------------------------------------------------------------------

export interface LogMenuMealInput {
  description: string;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

/**
 * Log a planned menu meal as eaten: writes the calorie-journal entry (`meal_logs`) and
 * the slot's day-log marker in a single transaction, so a partial failure can never
 * leave a journal entry without the marker (or vice versa). The day-log marker doubles
 * as the dedupe key — if the slot is already logged, no second journal entry is created.
 * Returns false when the menu doesn't belong to the user.
 */
export async function logMenuMeal(
  userId: string,
  menuId: string,
  dayOfWeek: DayOfWeek,
  mealType: MealType,
  loggedDate: string,
  meal: LogMenuMealInput,
): Promise<boolean> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized log attempt by user ${userId} to menu ${menuId}`);
    return false;
  }

  await db.transaction(async tx => {
    const marked = await tx
      .insert(weeklyMenuDayLogs)
      .values({ menuId, dayOfWeek, mealType, loggedDate })
      .onConflictDoNothing()
      .returning({ id: weeklyMenuDayLogs.id });

    // Slot already logged — keep the call idempotent instead of duplicating the journal entry.
    if (marked.length === 0) return;

    await tx.insert(mealLogs).values({
      mealId: crypto.randomUUID(),
      userId,
      date: loggedDate,
      mealType,
      description: meal.description,
      kcal: meal.kcal != null ? Math.round(meal.kcal) : null,
      protein: meal.protein ?? null,
      carbs: meal.carbs ?? null,
      fat: meal.fat ?? null,
    });
  });

  return true;
}

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
