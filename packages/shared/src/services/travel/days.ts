/**
 * Trip day notes CRUD
 * - upsertTripDay(userId, tripId, date, data) — creates or updates notes for a calendar day; placeIds preserved when not provided
 * - getTripDays(userId, tripId) — lists all day records for a trip, sorted by date
 * - deleteTripDay(userId, dayId) — hard delete
 * - deleteAllUserTripDays(userId) — bulk delete for account removal
 * Types: TripDayUpsert
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripDays } from '../../db/schema/travel';
import type { TripDay } from '../../types';
import { verifyTripOwnership } from './trips';

export interface TripDayUpsert {
  title?: string | null;
  notes?: string | null;
  /** Place IDs to associate with this day. Pass undefined to preserve existing associations; pass [] to clear. */
  placeIds?: number[] | null;
}

export async function upsertTripDay(
  userId: string,
  tripId: number,
  date: string,
  data: TripDayUpsert,
): Promise<TripDay> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }

  const now = new Date();
  const [row] = await db
    .insert(tripDays)
    .values({
      userId,
      tripId,
      date,
      title: data.title ?? null,
      notes: data.notes ?? null,
      placeIds: data.placeIds ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [tripDays.tripId, tripDays.date],
      set: {
        title: sql`excluded.title`,
        notes: sql`excluded.notes`,
        // Preserve existing placeIds when null is inserted (Hub UI edits don't touch place associations)
        placeIds: sql`COALESCE(excluded.place_ids, ${tripDays.placeIds})`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
    .returning();

  if (!row) throw new Error('Upsert did not return a row');
  return row;
}

export async function getTripDays(userId: string, tripId: number): Promise<TripDay[]> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }
  return db
    .select()
    .from(tripDays)
    .where(and(eq(tripDays.userId, userId), eq(tripDays.tripId, tripId)))
    .orderBy(asc(tripDays.date));
}

export async function deleteTripDay(userId: string, dayId: number): Promise<TripDay | null> {
  const [row] = await db
    .delete(tripDays)
    .where(and(eq(tripDays.userId, userId), eq(tripDays.id, dayId)))
    .returning();
  return row ?? null;
}

export async function deleteAllUserTripDays(userId: string): Promise<number> {
  const rows = await db.delete(tripDays).where(eq(tripDays.userId, userId)).returning({ id: tripDays.id });
  return rows.length;
}
