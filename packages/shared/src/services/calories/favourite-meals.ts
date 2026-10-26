import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { favouriteMeals } from '../../db/schema/calories';
import type { FavouriteMeal } from '../../types';
import type { MealType } from '../../constants';

/** What a favourite stores: the dish and the macros to log it with. */
export interface FavouriteMealInput {
  description: string;
  mealType: MealType;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

/**
 * The user's pinned meals, newest pin first — the head of the log-a-meal quick-pick row.
 *
 * @param userId  Owner of the favourites.
 */
export async function getFavouriteMeals(userId: string): Promise<FavouriteMeal[]> {
  return db
    .select()
    .from(favouriteMeals)
    .where(eq(favouriteMeals.userId, userId))
    .orderBy(desc(favouriteMeals.createdAt), desc(favouriteMeals.id));
}

/**
 * Pin a meal for one-tap logging. Pinning a description that is already a favourite updates its
 * macros instead of adding a second chip, so re-pinning after a recipe change just corrects it.
 *
 * @param userId  Owner of the favourite.
 * @param input   The dish and its macros.
 */
export async function addFavouriteMeal(userId: string, input: FavouriteMealInput): Promise<FavouriteMeal> {
  const values = { ...input, description: input.description.trim() };
  const [row] = await db
    .insert(favouriteMeals)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: [favouriteMeals.userId, favouriteMeals.description], set: values })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

/**
 * Unpin a favourite. Returns null when no favourite with that id belongs to the user.
 *
 * @param userId  Owner of the favourite.
 * @param id      The favourite's id.
 */
export async function removeFavouriteMeal(userId: string, id: number): Promise<FavouriteMeal | null> {
  const [row] = await db
    .delete(favouriteMeals)
    .where(and(eq(favouriteMeals.userId, userId), eq(favouriteMeals.id, id)))
    .returning();
  return row ?? null;
}

/** Delete every favourite the user owns. Returns the number removed. */
export async function deleteAllUserFavouriteMeals(userId: string): Promise<number> {
  const rows = await db
    .delete(favouriteMeals)
    .where(eq(favouriteMeals.userId, userId))
    .returning({ id: favouriteMeals.id });
  return rows.length;
}
