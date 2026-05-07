/**
 * Travel companion CRUD
 * - addTripCompanion(userId, tripId, data) — creates a companion record
 * - getTripCompanions(userId, tripId) — lists companions for a trip
 * - updateTripCompanion(userId, companionId, data) — partial update (name, email, phone, notes)
 * - deleteTripCompanion(userId, companionId) — hard delete
 * - deleteAllUserTripCompanions(userId) — bulk delete for account removal
 * Types: TripCompanionInsert, TripCompanionUpdate
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripCompanions } from '../../db/schema/travel';
import { omitUndefined } from '../../utils';
import type { NewTripCompanion, TripCompanion } from '../../types';
import { verifyTripOwnership } from './trips';

export type TripCompanionInsert = Omit<NewTripCompanion, 'id' | 'userId' | 'tripId' | 'createdAt' | 'updatedAt'>;
export type TripCompanionUpdate = Partial<Pick<TripCompanionInsert, 'name' | 'email' | 'phone' | 'notes'>>;

export async function addTripCompanion(
  userId: string,
  tripId: number,
  data: TripCompanionInsert,
): Promise<TripCompanion> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }
  const [row] = await db
    .insert(tripCompanions)
    .values({
      ...data,
      userId,
      tripId,
    })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getTripCompanions(userId: string, tripId: number): Promise<TripCompanion[]> {
  return db
    .select()
    .from(tripCompanions)
    .where(and(eq(tripCompanions.userId, userId), eq(tripCompanions.tripId, tripId)))
    .orderBy(asc(tripCompanions.id));
}

export async function updateTripCompanion(
  userId: string,
  companionId: number,
  data: TripCompanionUpdate,
): Promise<TripCompanion | null> {
  const [row] = await db
    .update(tripCompanions)
    .set({
      ...omitUndefined(data),
      updatedAt: new Date(),
    })
    .where(and(eq(tripCompanions.userId, userId), eq(tripCompanions.id, companionId)))
    .returning();

  return row ?? null;
}

export async function deleteTripCompanion(userId: string, companionId: number): Promise<TripCompanion | null> {
  const [row] = await db
    .delete(tripCompanions)
    .where(and(eq(tripCompanions.userId, userId), eq(tripCompanions.id, companionId)))
    .returning();

  return row ?? null;
}

export async function deleteAllUserTripCompanions(userId: string): Promise<number> {
  const rows = await db
    .delete(tripCompanions)
    .where(eq(tripCompanions.userId, userId))
    .returning({ id: tripCompanions.id });

  return rows.length;
}
