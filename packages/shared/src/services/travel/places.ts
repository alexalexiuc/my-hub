/**
 * Trip place (point of interest) CRUD
 * - addTripPlace(userId, tripId, data) — creates a place record
 * - getTripPlaces(userId, tripId, opts?) — lists places, optionally filtered by visited status or priority
 * - updateTripPlace(userId, placeId, data) — partial update (name, location, notes, visited, priority)
 * - deleteTripPlace(userId, placeId) — hard delete
 * - deleteAllUserTripPlaces(userId) — bulk delete for account removal
 * Types: TripPlaceInsert, TripPlaceUpdate, GetTripPlacesOpts
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripPlaces } from '../../db/schema/travel';
import { omitUndefined } from '../../utils/';
import type { NewTripPlace, TripPlace, TripPlacePriority } from '../../types';
import { verifyTripOwnership } from './trips';

export type TripPlaceInsert = Omit<NewTripPlace, 'id' | 'userId' | 'tripId' | 'createdAt' | 'updatedAt'>;
export type TripPlaceUpdate = Partial<
  Pick<TripPlaceInsert, 'name' | 'location' | 'notes' | 'visited' | 'priority' | 'lat' | 'lng'>
>;

export interface GetTripPlacesOpts {
  visited?: boolean;
  priority?: TripPlacePriority;
}

export async function addTripPlace(userId: string, tripId: number, data: TripPlaceInsert): Promise<TripPlace> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }
  const [row] = await db
    .insert(tripPlaces)
    .values({
      ...data,
      userId,
      tripId,
    })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getTripPlaces(
  userId: string,
  tripId: number,
  opts: GetTripPlacesOpts = {},
): Promise<TripPlace[]> {
  const conditions = [eq(tripPlaces.userId, userId), eq(tripPlaces.tripId, tripId)];

  if (opts.visited !== undefined) conditions.push(eq(tripPlaces.visited, opts.visited));
  if (opts.priority !== undefined) conditions.push(eq(tripPlaces.priority, opts.priority));

  return db
    .select()
    .from(tripPlaces)
    .where(and(...conditions))
    .orderBy(asc(tripPlaces.visited), asc(tripPlaces.priority), asc(tripPlaces.id));
}

export async function updateTripPlace(
  userId: string,
  placeId: number,
  data: TripPlaceUpdate,
): Promise<TripPlace | null> {
  const [row] = await db
    .update(tripPlaces)
    .set({
      ...omitUndefined(data),
      updatedAt: new Date(),
    })
    .where(and(eq(tripPlaces.userId, userId), eq(tripPlaces.id, placeId)))
    .returning();

  return row ?? null;
}

export async function deleteTripPlace(userId: string, placeId: number): Promise<TripPlace | null> {
  const [row] = await db
    .delete(tripPlaces)
    .where(and(eq(tripPlaces.userId, userId), eq(tripPlaces.id, placeId)))
    .returning();

  return row ?? null;
}

export async function deleteAllUserTripPlaces(userId: string): Promise<number> {
  const rows = await db.delete(tripPlaces).where(eq(tripPlaces.userId, userId)).returning({ id: tripPlaces.id });

  return rows.length;
}
