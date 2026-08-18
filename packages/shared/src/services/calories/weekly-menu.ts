/**
 * Weekly menu service — menu/meal CRUD plus day-log ("logged as eaten") tracking.
 *
 * Named exports:
 * - `WeeklyMenu`, `WeeklyMenuMeal`, `WeeklyMenuMealInput`, `CreateWeeklyMenuInput`, `UpdateWeeklyMenuMealInput`, `LogMenuMealInput` — service types
 * - `hasAccessToMenu(userId, menuId)` — ownership check (1s promise cache)
 * - `createWeeklyMenu(input)` — transactionally create (or replace, per user+week) a menu with its meals and optional shopping list
 * - `updateWeeklyMenu(userId, menuId, { title?, notes? })` — patch a menu's title/prep notes without touching meals
 * - `getWeeklyMenus(userId)` — all menus, ascending by weekStart, without meal rows
 * - `getWeeklyMenu(userId, menuId)` / `getWeeklyMenuByWeek(userId, weekStart)` — single menu with meals
 * - `addMealToMenu(userId, menuId, meal)` — insert one meal; null when slot exists or no access
 * - `updateWeeklyMenuMeal(userId, menuId, dayOfWeek, mealType, updates)` — swap a slot's meal (clears its day-log)
 * - `upsertMenuMeal(userId, menuId, meal)` — set a slot's meal (insert-or-overwrite; clears its day-log)
 * - `deleteWeeklyMenuMeal(userId, menuId, dayOfWeek, mealType)` — remove a slot (clears its day-log)
 * - `deleteWeeklyMenu(userId, menuId)` / `deleteAllUserWeeklyMenus(userId)` — menu deletion (evicts access cache)
 * - `logMenuMeal(userId, menuId, dayOfWeek, mealType, loggedDate, meal)` — transactionally journal a meal AND mark its slot logged
 * - `unlogMenuMeal(userId, menuId, dayOfWeek, mealType)` — undo the above: drop the marker and the journal entry it created
 * - `logMenuDay(userId, menuId, dayOfWeek, loggedDate)` / `unlogMenuDay(...)` — same, for every slot of a day in one transaction
 * - `getPlannedMealsForDate(userId, date)` — the day's planned meals, each flagged logged
 * - `getLoggedDays(userId, menuId)` — `{ "day:mealType": loggedDate }` map of logged slots
 * - `getMenuStatusForRange(userId, start, end)` — per-date `{ hasMenu, logged }` for the Hub Calendar's menu icon (`logged` true only once every planned slot for that date is logged)
 * - `tryLinkLoggedMealToPlan(userId, date, mealType, mealLogId)` — called after a freely-logged meal (`calories_log_meal`, the Hub "add a meal" form) is journaled; marks the date's planned slot for that meal type logged, regardless of whether the logged meal matches the plan — the menu organizes, it doesn't police
 *
 * There is deliberately no marker-only "mark as logged" helper: writing a day-log without its
 * journal entry is the desync `logMenuMeal`'s transaction exists to prevent, and a slot marked
 * that way would count towards adherence while never appearing in the calorie journal.
 * `tryLinkLoggedMealToPlan` does not violate this — it only ever points the marker at a journal
 * row that has already been written by its caller.
 */
import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  weeklyMenus,
  weeklyMenuMeals,
  weeklyMenuDayLogs,
  weeklyMenuShoppingItems,
  mealLogs,
} from '../../db/schema/calories';
import type { MealType } from '../../constants/calories';
import type { DayOfWeek } from '../../constants/weekly-menu';
import type { ShoppingListItem } from './shopping-list';
import { PromiseCacheX } from 'promise-cachex';
import {
  addDays,
  dateToString,
  dayOfWeekMon0,
  dedupeTrimmed,
  logger,
  omitUndefined,
  startOfWeekMonday,
  toUTCDateStr,
} from '../../utils';

const menuAccessCache = new PromiseCacheX<boolean>({ ttl: 1000 }); // 1 second

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyMenuMealInput {
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  description: string;
  /** Free-text ingredient lines, e.g. `["200g chicken breast", "1 red pepper"]`. */
  ingredients?: string[] | null;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

/**
 * Trim, drop blanks and case-insensitive duplicates from an ingredient list. An
 * absent or empty list collapses to `null` so "no ingredients" has a single
 * representation in the column.
 */
function normalizeIngredients(ingredients: string[] | null | undefined): string[] | null {
  if (ingredients == null) return null;
  const cleaned = dedupeTrimmed(ingredients);
  return cleaned.length > 0 ? cleaned : null;
}

export interface CreateWeeklyMenuInput {
  userId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  title?: string | null;
  notes?: string | null;
  meals: WeeklyMenuMealInput[];
  /** Shopping list for the week. Trimmed and deduped case-insensitively, like the other write paths. */
  shoppingList?: string[];
}

export interface WeeklyMenuMeal {
  id: number;
  menuId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  description: string;
  ingredients: string[] | null;
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

/**
 * True when `loggedDate` really is the calendar date that `dayOfWeek` falls on in this menu's
 * week. The date is supplied by the caller, so without this a wrong or replayed request could
 * journal meals against an unrelated day while the menu still showed the slot as logged.
 */
async function isDateInMenuWeek(menuId: string, dayOfWeek: DayOfWeek, loggedDate: string): Promise<boolean> {
  const [menu] = await db
    .select({ weekStart: weeklyMenus.weekStart })
    .from(weeklyMenus)
    .where(eq(weeklyMenus.menuId, menuId));

  if (!menu) return false;
  return toUTCDateStr(addDays(new Date(menu.weekStart), dayOfWeek)) === loggedDate;
}

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
 * Create a new weekly menu with its meals — and optionally its shopping list — for a user.
 * If a menu for the same weekStart already exists, it is replaced (delete + insert).
 * Duplicate (dayOfWeek, mealType) slots in the input collapse to the first occurrence
 * (enforced by the `uq_weekly_menu_meal_slot` unique constraint + onConflictDoNothing).
 *
 * The whole replacement runs in one transaction, so a failure part-way through cannot
 * leave the user with their old menu deleted and nothing in its place.
 */
export async function createWeeklyMenu(
  input: CreateWeeklyMenuInput,
): Promise<WeeklyMenu & { shoppingList: ShoppingListItem[] }> {
  const menuId = crypto.randomUUID();
  const shoppingTexts = dedupeTrimmed(input.shoppingList ?? []);

  const { menu, meals, shoppingList, replaced } = await db.transaction(async tx => {
    // Delete any existing menu for this user + week (one menu per week)
    const replaced = await tx
      .delete(weeklyMenus)
      .where(and(eq(weeklyMenus.userId, input.userId), eq(weeklyMenus.weekStart, input.weekStart)))
      .returning({ menuId: weeklyMenus.menuId });

    const [menu] = await tx
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

    const meals =
      input.meals.length > 0
        ? await tx
            .insert(weeklyMenuMeals)
            .values(
              input.meals.map(m => ({
                menuId,
                dayOfWeek: m.dayOfWeek,
                mealType: m.mealType,
                description: m.description,
                ingredients: normalizeIngredients(m.ingredients),
                kcal: m.kcal ?? null,
                protein: m.protein ?? null,
                carbs: m.carbs ?? null,
                fat: m.fat ?? null,
              })),
            )
            .onConflictDoNothing()
            .returning()
        : [];

    // The menu is brand new, so there is nothing to clear and no ownership to re-check.
    const shoppingList =
      shoppingTexts.length > 0
        ? await tx
            .insert(weeklyMenuShoppingItems)
            .values(shoppingTexts.map(text => ({ menuId, userId: input.userId, text })))
            .returning()
        : [];

    return { menu, meals, shoppingList, replaced };
  });

  // Evict the replaced menu's cached access grant once the delete is actually visible — a
  // stale `true` within the TTL would let an in-flight write insert child rows referencing
  // the deleted menu (FK violation).
  for (const row of replaced) {
    menuAccessCache.delete(`${input.userId}:${row.menuId}`);
  }

  return { ...menu, meals, shoppingList };
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
      ingredients: normalizeIngredients(meal.ingredients),
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
  ingredients?: string[] | null;
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

  // A swap replaces the whole dish, so unspecified macros and ingredients are cleared (null)
  // rather than inherited from the previous meal — otherwise "Plain oats" would keep the old
  // salmon's macros and ingredient list.
  const [updated] = await db
    .update(weeklyMenuMeals)
    .set({
      description: updates.description,
      ingredients: normalizeIngredients(updates.ingredients),
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
    ingredients: normalizeIngredients(meal.ingredients),
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

  if (!(await isDateInMenuWeek(menuId, dayOfWeek, loggedDate))) {
    logger.warn(`Rejected log for menu ${menuId}: ${loggedDate} is not day ${dayOfWeek} of its week`);
    return false;
  }

  await db.transaction(async tx => {
    // Marker first: its unique slot constraint is what makes this call idempotent, and inserting
    // the journal row before knowing whether the slot was free would orphan it on a re-log.
    const marked = await tx
      .insert(weeklyMenuDayLogs)
      .values({ menuId, dayOfWeek, mealType, loggedDate })
      .onConflictDoNothing()
      .returning({ id: weeklyMenuDayLogs.id });

    // Slot already logged — keep the call idempotent instead of duplicating the journal entry.
    if (marked.length === 0) return;

    const mealId = crypto.randomUUID();
    await tx.insert(mealLogs).values({
      mealId,
      userId,
      date: loggedDate,
      mealType,
      description: meal.description,
      kcal: meal.kcal != null ? Math.round(meal.kcal) : null,
      protein: meal.protein ?? null,
      carbs: meal.carbs ?? null,
      fat: meal.fat ?? null,
    });

    // Point the marker at the row it just created. Separate statement because the foreign key is
    // checked immediately, so the reference cannot be written before the journal row exists.
    await tx.update(weeklyMenuDayLogs).set({ mealLogId: mealId }).where(eq(weeklyMenuDayLogs.id, marked[0]!.id));
  });

  return true;
}

/**
 * Undo `logMenuMeal`: drop the slot's logged marker and the journal entry it created, in one
 * transaction. The entry is matched on the fields `logMenuMeal` wrote (date, meal type and the
 * dish's description) rather than by id, since the marker holds no reference to it — if the user
 * has since edited that journal entry by hand, only the marker is removed and their edit stands.
 * Returns false when the menu isn't the user's or the slot wasn't logged.
 */
export async function unlogMenuMeal(
  userId: string,
  menuId: string,
  dayOfWeek: DayOfWeek,
  mealType: MealType,
): Promise<boolean> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized unlog attempt by user ${userId} to menu ${menuId}`);
    return false;
  }

  return db.transaction(async tx => {
    const [marker] = await tx
      .delete(weeklyMenuDayLogs)
      .where(
        and(
          eq(weeklyMenuDayLogs.menuId, menuId),
          eq(weeklyMenuDayLogs.dayOfWeek, dayOfWeek),
          eq(weeklyMenuDayLogs.mealType, mealType),
        ),
      )
      .returning({ mealLogId: weeklyMenuDayLogs.mealLogId });

    if (!marker) return false;

    // Delete by id: matching on (date, meal type, description) instead would also hit entries the
    // user added by hand that happen to name the same dish. A null id means the marker predates
    // the column — the marker still goes, but its entry is left rather than guessed at.
    if (marker.mealLogId) {
      await tx.delete(mealLogs).where(and(eq(mealLogs.userId, userId), eq(mealLogs.mealId, marker.mealLogId)));
    }

    return true;
  });
}

/**
 * Log every not-yet-logged meal of a day in one transaction. The alternative — the client firing
 * one request per slot — leaves a half-logged day when any of them fails, which is the same
 * desync `logMenuMeal` guards against, one level up. Meal details are read here rather than sent
 * by the caller, so the journal always mirrors the plan.
 *
 * Returns the number of slots newly logged, or null when the menu isn't the user's.
 */
export async function logMenuDay(
  userId: string,
  menuId: string,
  dayOfWeek: DayOfWeek,
  loggedDate: string,
): Promise<number | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized day-log attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  if (!(await isDateInMenuWeek(menuId, dayOfWeek, loggedDate))) {
    logger.warn(`Rejected day-log for menu ${menuId}: ${loggedDate} is not day ${dayOfWeek} of its week`);
    return null;
  }

  return db.transaction(async tx => {
    const planned = await tx
      .select()
      .from(weeklyMenuMeals)
      .where(and(eq(weeklyMenuMeals.menuId, menuId), eq(weeklyMenuMeals.dayOfWeek, dayOfWeek)));

    if (planned.length === 0) return 0;

    // onConflictDoNothing makes this idempotent: slots already logged return no row and are
    // skipped below, so re-running never duplicates a journal entry.
    const marked = await tx
      .insert(weeklyMenuDayLogs)
      .values(planned.map(m => ({ menuId, dayOfWeek, mealType: m.mealType, loggedDate })))
      .onConflictDoNothing()
      .returning({ mealType: weeklyMenuDayLogs.mealType });

    if (marked.length === 0) return 0;

    const newlyLogged = new Set(marked.map(m => m.mealType));
    const rows = planned
      .filter(m => newlyLogged.has(m.mealType))
      .map(m => ({
        mealId: crypto.randomUUID(),
        userId,
        date: loggedDate,
        mealType: m.mealType,
        description: m.description,
        kcal: m.kcal != null ? Math.round(m.kcal) : null,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
      }));

    await tx.insert(mealLogs).values(rows);

    // Link each marker to the entry it created, so undo can delete by id instead of guessing
    // from the description. Written after the insert: the foreign key is checked immediately.
    for (const row of rows) {
      await tx
        .update(weeklyMenuDayLogs)
        .set({ mealLogId: row.mealId })
        .where(
          and(
            eq(weeklyMenuDayLogs.menuId, menuId),
            eq(weeklyMenuDayLogs.dayOfWeek, dayOfWeek),
            eq(weeklyMenuDayLogs.mealType, row.mealType),
          ),
        );
    }

    return marked.length;
  });
}

/**
 * Undo `logMenuDay` for a whole day: drop every marker and the journal entries they created,
 * in one transaction. Same matching caveat as `unlogMenuMeal` — an entry the user has since
 * edited by hand no longer matches and is left alone.
 *
 * Returns the number of slots un-logged, or null when the menu isn't the user's.
 */
export async function unlogMenuDay(userId: string, menuId: string, dayOfWeek: DayOfWeek): Promise<number | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized day-unlog attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  return db.transaction(async tx => {
    const markers = await tx
      .delete(weeklyMenuDayLogs)
      .where(and(eq(weeklyMenuDayLogs.menuId, menuId), eq(weeklyMenuDayLogs.dayOfWeek, dayOfWeek)))
      .returning({ mealLogId: weeklyMenuDayLogs.mealLogId });

    if (markers.length === 0) return 0;

    // By id, for the same reason as unlogMenuMeal: a description match would also delete meals
    // the user logged by hand. Markers written before the column exists carry no id and are
    // simply dropped, leaving their entry in the journal rather than deleting the wrong one.
    const mealLogIds = markers.map(m => m.mealLogId).filter((id): id is string => id !== null);
    if (mealLogIds.length > 0) {
      await tx.delete(mealLogs).where(and(eq(mealLogs.userId, userId), inArray(mealLogs.mealId, mealLogIds)));
    }

    return markers.length;
  });
}

/** A planned meal plus whether its slot has been logged. */
export interface PlannedMealForDate extends WeeklyMenuMeal {
  logged: boolean;
}

/**
 * The meals planned for one calendar date, each flagged with whether it has been logged. Lives
 * here rather than being assembled by a route: "what am I eating, and have I had it yet" is a
 * domain question, and both the Hub and the MCP tools ask it.
 *
 * Returns an empty list when the date's week has no menu.
 */
export async function getPlannedMealsForDate(userId: string, date: string): Promise<PlannedMealForDate[]> {
  const weekStart = dateToString(startOfWeekMonday(new Date(`${date}T00:00:00`)));
  const menu = await getWeeklyMenuByWeek(userId, weekStart);
  if (!menu) return [];

  const dayOfWeek = dayOfWeekMon0(date);
  // Ownership was established by the menu lookup above, so the marker read skips re-checking it.
  const markers = await readDayLogs(menu.menuId);

  return menu.meals
    .filter(m => m.dayOfWeek === dayOfWeek)
    .map(m => ({ ...m, logged: `${m.dayOfWeek}:${m.mealType}` in markers }));
}

/** Day-log markers for a menu, without an ownership check — callers must have established it. */
async function readDayLogs(menuId: string): Promise<Record<string, string>> {
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

/**
 * Called after a freely-logged meal (via `calories_log_meal` or the Hub's "add a meal" form) has
 * already been journaled. If that date's week has a menu with a not-yet-logged slot for the same
 * meal type, marks the slot logged and points it at the journal row the caller just created — the
 * same outcome as pressing "Log it" on the planned-meal card, reached by the other route into the
 * journal.
 *
 * Deliberately does not compare descriptions: the menu organizes what to eat, it doesn't police
 * it. A meal logged for the same date and meal type as a planned slot fulfills that slot whether
 * it matches the plan exactly, is a variation of it ("no breading" on a planned breaded dish, an
 * added side), or is a substitution eaten instead — the plan itself is left untouched either way
 * (only the marker + link are written), so what was actually eaten stays visible in the journal
 * next to what was planned.
 *
 * A no-op (returns false) when the week has no menu, the slot has no planned meal, or the slot is
 * already logged.
 */
export async function tryLinkLoggedMealToPlan(
  userId: string,
  date: string,
  mealType: MealType,
  mealLogId: string,
): Promise<boolean> {
  const weekStart = dateToString(startOfWeekMonday(new Date(`${date}T00:00:00`)));

  // Two targeted single-row lookups (menu, then the one slot) rather than `getWeeklyMenuByWeek`,
  // which would pull every meal in the week just to check whether one (dayOfWeek, mealType) slot
  // is planned — this runs on every meal logged, menu or not, so it stays as cheap as the check it's doing.
  const [menu] = await db
    .select({ menuId: weeklyMenus.menuId })
    .from(weeklyMenus)
    .where(and(eq(weeklyMenus.userId, userId), eq(weeklyMenus.weekStart, weekStart)));
  if (!menu) return false;

  const dayOfWeek = dayOfWeekMon0(date);
  const [planned] = await db
    .select({ id: weeklyMenuMeals.id })
    .from(weeklyMenuMeals)
    .where(
      and(
        eq(weeklyMenuMeals.menuId, menu.menuId),
        eq(weeklyMenuMeals.dayOfWeek, dayOfWeek),
        eq(weeklyMenuMeals.mealType, mealType),
      ),
    )
    .limit(1);
  if (!planned) return false;

  // onConflictDoNothing is the guard against an already-logged slot: the unique constraint makes
  // this safe to call from concurrent inserts (e.g. several `items` logged in one MCP call).
  const inserted = await db
    .insert(weeklyMenuDayLogs)
    .values({ menuId: menu.menuId, dayOfWeek, mealType, loggedDate: date, mealLogId })
    .onConflictDoNothing()
    .returning({ id: weeklyMenuDayLogs.id });

  return inserted.length > 0;
}

/**
 * Get all logged meals for a menu as a set of `${dayOfWeek}:${mealType}` keys.
 */
export async function getLoggedDays(userId: string, menuId: string): Promise<Record<string, string>> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized access attempt by user ${userId} to menu ${menuId}`);
    return {};
  }

  return readDayLogs(menuId);
}

export interface DayMenuStatus {
  hasMenu: boolean;
  /** True only when `hasMenu` and every planned slot for that date has been logged. */
  logged: boolean;
}

/**
 * Per-date `{ hasMenu, logged }` for every day in `[start, end]` that a weekly menu covers — the
 * Hub Calendar's menu icon needs this in one shot for a whole month rather than one
 * `getPlannedMealsForDate` call per day. Three batch queries (menus in range, their meals, their
 * day-logs) regardless of how many days the range spans, mirroring `getDailySummariesForRange`.
 * Dates with no menu are simply absent from the result.
 */
export async function getMenuStatusForRange(
  userId: string,
  start: string,
  end: string,
): Promise<Record<string, DayMenuStatus>> {
  const startWeek = dateToString(startOfWeekMonday(new Date(`${start}T00:00:00`)));
  const endWeek = dateToString(startOfWeekMonday(new Date(`${end}T00:00:00`)));

  const menus = await db
    .select({ menuId: weeklyMenus.menuId, weekStart: weeklyMenus.weekStart })
    .from(weeklyMenus)
    .where(
      and(eq(weeklyMenus.userId, userId), gte(weeklyMenus.weekStart, startWeek), lte(weeklyMenus.weekStart, endWeek)),
    );

  if (menus.length === 0) return {};

  const menuIds = menus.map(m => m.menuId);
  const weekStartByMenu = new Map(menus.map(m => [m.menuId, m.weekStart]));

  const [meals, logs] = await Promise.all([
    db
      .select({
        menuId: weeklyMenuMeals.menuId,
        dayOfWeek: weeklyMenuMeals.dayOfWeek,
        mealType: weeklyMenuMeals.mealType,
      })
      .from(weeklyMenuMeals)
      .where(inArray(weeklyMenuMeals.menuId, menuIds)),
    db
      .select({
        menuId: weeklyMenuDayLogs.menuId,
        dayOfWeek: weeklyMenuDayLogs.dayOfWeek,
        mealType: weeklyMenuDayLogs.mealType,
      })
      .from(weeklyMenuDayLogs)
      .where(inArray(weeklyMenuDayLogs.menuId, menuIds)),
  ]);

  const loggedSlots = new Set(logs.map(l => `${l.menuId}:${l.dayOfWeek}:${l.mealType}`));

  const statuses: Record<string, DayMenuStatus> = {};
  for (const meal of meals) {
    const weekStart = weekStartByMenu.get(meal.menuId);
    if (!weekStart) continue;
    const date = toUTCDateStr(addDays(new Date(`${weekStart}T00:00:00`), meal.dayOfWeek));
    if (date < start || date > end) continue;

    const entry = statuses[date] ?? { hasMenu: false, logged: true };
    entry.hasMenu = true;
    entry.logged = entry.logged && loggedSlots.has(`${meal.menuId}:${meal.dayOfWeek}:${meal.mealType}`);
    statuses[date] = entry;
  }

  return statuses;
}
