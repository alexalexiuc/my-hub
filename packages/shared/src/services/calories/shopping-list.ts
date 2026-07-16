/**
 * Weekly-menu shopping list service.
 *
 * Named exports:
 * - `ShoppingListItem` — persisted shopping list row (id, menuId, userId, text, checked, createdAt)
 * - `getShoppingListItems(userId, menuId)` — all items for a menu, oldest first
 * - `addShoppingListItems(userId, menuId, texts)` — bulk insert with trim + case-insensitive dedupe
 * - `replaceShoppingListItems(userId, menuId, texts)` — replace the whole list (clear + insert); for AI-authored lists
 * - `setShoppingListItemChecked(userId, itemId, checked)` — toggle an item's checked state
 * - `deleteShoppingListItem(userId, itemId)` — remove a single item
 * - `deleteAllUserShoppingListItems(userId)` — wipe all items for a user ("delete all my data" flow)
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { weeklyMenuShoppingItems } from '../../db/schema/calories';
import { hasAccessToMenu } from './weekly-menu';
import { dedupeTrimmed, logger } from '../../utils';

export interface ShoppingListItem {
  id: number;
  menuId: string;
  userId: string;
  text: string;
  checked: boolean;
  createdAt: Date;
}

/**
 * Get all shopping list items for a menu, oldest first.
 * Returns an empty list when the menu doesn't belong to the user.
 */
export async function getShoppingListItems(userId: string, menuId: string): Promise<ShoppingListItem[]> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized shopping-list access attempt by user ${userId} to menu ${menuId}`);
    return [];
  }

  return db
    .select()
    .from(weeklyMenuShoppingItems)
    .where(eq(weeklyMenuShoppingItems.menuId, menuId))
    .orderBy(asc(weeklyMenuShoppingItems.id));
}

/**
 * Add items to a menu's shopping list. Input texts are trimmed; blanks and
 * (case-insensitive) duplicates — against both existing items and earlier
 * entries in the same call — are silently skipped. Returns only the rows that
 * were actually inserted, or null when the menu doesn't belong to the user.
 */
export async function addShoppingListItems(
  userId: string,
  menuId: string,
  texts: string[],
): Promise<ShoppingListItem[] | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized shopping-list add attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  // The unique constraint is case-sensitive, so this read is what makes the
  // case-insensitive rule hold; onConflictDoNothing only backstops races.
  const existing = await db
    .select({ text: weeklyMenuShoppingItems.text })
    .from(weeklyMenuShoppingItems)
    .where(eq(weeklyMenuShoppingItems.menuId, menuId));

  const toInsert = dedupeTrimmed(texts, new Set(existing.map(r => r.text.toLowerCase())));

  if (toInsert.length === 0) return [];

  return db
    .insert(weeklyMenuShoppingItems)
    .values(toInsert.map(text => ({ menuId, userId, text })))
    .onConflictDoNothing()
    .returning();
}

/**
 * Replace a menu's entire shopping list with a new set of items in one transaction:
 * every existing item for the menu is removed and the provided texts are inserted fresh
 * (trimmed; blanks and case-insensitive duplicates within the input are skipped). This is
 * the write path for an AI-authored list — it overwrites rather than appends. Returns the
 * new items, or null when the menu doesn't belong to the user.
 */
export async function replaceShoppingListItems(
  userId: string,
  menuId: string,
  texts: string[],
): Promise<ShoppingListItem[] | null> {
  if (!(await hasAccessToMenu(userId, menuId))) {
    logger.warn(`Unauthorized shopping-list replace attempt by user ${userId} to menu ${menuId}`);
    return null;
  }

  const toInsert = dedupeTrimmed(texts);

  return db.transaction(async tx => {
    await tx.delete(weeklyMenuShoppingItems).where(eq(weeklyMenuShoppingItems.menuId, menuId));

    if (toInsert.length === 0) return [];

    return tx
      .insert(weeklyMenuShoppingItems)
      .values(toInsert.map(text => ({ menuId, userId, text })))
      .returning();
  });
}

/**
 * Set an item's checked state. Ownership is enforced via the item's userId column.
 * Returns the updated item, or null if it doesn't exist or isn't the user's.
 */
export async function setShoppingListItemChecked(
  userId: string,
  itemId: number,
  checked: boolean,
): Promise<ShoppingListItem | null> {
  const [updated] = await db
    .update(weeklyMenuShoppingItems)
    .set({ checked })
    .where(and(eq(weeklyMenuShoppingItems.id, itemId), eq(weeklyMenuShoppingItems.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Delete a single shopping list item. Ownership is enforced via the item's
 * userId column. Returns true if a row was removed.
 */
export async function deleteShoppingListItem(userId: string, itemId: number): Promise<boolean> {
  const deleted = await db
    .delete(weeklyMenuShoppingItems)
    .where(and(eq(weeklyMenuShoppingItems.id, itemId), eq(weeklyMenuShoppingItems.userId, userId)))
    .returning({ id: weeklyMenuShoppingItems.id });

  return deleted.length > 0;
}

/**
 * Delete all shopping list items for a user. Used by the "delete all my data" flow.
 * (Menu deletion already cascades; this covers the explicit bulk wipe.)
 */
export async function deleteAllUserShoppingListItems(userId: string): Promise<number> {
  logger.info(`Deleting all weekly-menu shopping list items for user ${userId}`);
  const deleted = await db
    .delete(weeklyMenuShoppingItems)
    .where(eq(weeklyMenuShoppingItems.userId, userId))
    .returning({ id: weeklyMenuShoppingItems.id });

  return deleted.length;
}
