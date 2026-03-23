import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripChecklistItems } from '../../db/schema/travel';
import { omitNullish } from '../../utils/index';
import type { NewTripChecklistItem, TripChecklistItem } from '../../types/index';
import { verifyTripOwnership } from './trips';

export type TripChecklistItemInsert = Omit<
  NewTripChecklistItem,
  'id' | 'userId' | 'tripId' | 'createdAt' | 'updatedAt'
>;
export type TripChecklistItemUpdate = Partial<Pick<TripChecklistItemInsert, 'title' | 'done'>>;

export async function addChecklistItem(
  userId: string,
  tripId: number,
  data: TripChecklistItemInsert,
): Promise<TripChecklistItem> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }
  const [row] = await db
    .insert(tripChecklistItems)
    .values({
      ...data,
      userId,
      tripId,
    })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getChecklistItems(userId: string, tripId: number): Promise<TripChecklistItem[]> {
  return db
    .select()
    .from(tripChecklistItems)
    .where(and(eq(tripChecklistItems.userId, userId), eq(tripChecklistItems.tripId, tripId)))
    .orderBy(asc(tripChecklistItems.done), asc(tripChecklistItems.id));
}

export async function updateChecklistItem(
  userId: string,
  itemId: number,
  data: TripChecklistItemUpdate,
): Promise<TripChecklistItem | null> {
  const [row] = await db
    .update(tripChecklistItems)
    .set({
      ...omitNullish(data),
      updatedAt: new Date(),
    })
    .where(and(eq(tripChecklistItems.userId, userId), eq(tripChecklistItems.id, itemId)))
    .returning();

  return row ?? null;
}

export async function toggleChecklistItem(
  userId: string,
  itemId: number,
  done: boolean,
): Promise<TripChecklistItem | null> {
  return updateChecklistItem(userId, itemId, { done });
}

export async function deleteChecklistItem(userId: string, itemId: number): Promise<TripChecklistItem | null> {
  const [row] = await db
    .delete(tripChecklistItems)
    .where(and(eq(tripChecklistItems.userId, userId), eq(tripChecklistItems.id, itemId)))
    .returning();

  return row ?? null;
}
