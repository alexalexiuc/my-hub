import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripBookings, trips } from '../../db/schema/travel';
import { omitNullish } from '../../utils/index';
import type { NewTrip, Trip, TripStatus } from '../../types/index';

const tripColorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

function randomTripColor(): string {
  return tripColorPalette[Math.floor(Math.random() * tripColorPalette.length)] ?? '#3B82F6';
}

export type TripInsert = Omit<NewTrip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type TripUpdate = Partial<
  Pick<TripInsert, 'name' | 'color' | 'destination' | 'startAt' | 'endAt' | 'status' | 'notes' | 'coverImageUrl'>
>;

export interface GetTripsOpts {
  status?: TripStatus;
}

export interface TripBookingRange {
  tripId: number;
  fromAt: Date | null;
  toAt: Date | null;
}

export async function createTrip(userId: string, data: TripInsert): Promise<Trip> {
  const [row] = await db
    .insert(trips)
    .values({
      ...data,
      color: data.color ?? randomTripColor(),
      userId,
    })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getTrips(userId: string, opts: GetTripsOpts = {}): Promise<Trip[]> {
  if (opts.status) {
    return db
      .select()
      .from(trips)
      .where(and(eq(trips.userId, userId), eq(trips.status, opts.status)))
      .orderBy(asc(trips.startAt), asc(trips.id));
  }

  return db.select().from(trips).where(eq(trips.userId, userId)).orderBy(asc(trips.startAt), asc(trips.id));
}

export async function getTripById(userId: string, tripId: number): Promise<Trip | null> {
  const [row] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.userId, userId), eq(trips.id, tripId)));
  return row ?? null;
}

export async function updateTrip(userId: string, tripId: number, data: TripUpdate): Promise<Trip | null> {
  const [row] = await db
    .update(trips)
    .set({
      ...omitNullish(data),
      updatedAt: new Date(),
    })
    .where(and(eq(trips.userId, userId), eq(trips.id, tripId)))
    .returning();

  return row ?? null;
}

export async function deleteTrip(userId: string, tripId: number): Promise<Trip | null> {
  const [row] = await db
    .delete(trips)
    .where(and(eq(trips.userId, userId), eq(trips.id, tripId)))
    .returning();

  return row ?? null;
}

export async function getNextTrip(userId: string, now = new Date()): Promise<Trip | null> {
  const [row] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.userId, userId), gte(trips.startAt, now)))
    .orderBy(asc(trips.startAt), asc(trips.id))
    .limit(1);

  return row ?? null;
}

export async function getTripBookingRanges(userId: string): Promise<TripBookingRange[]> {
  return db
    .select({
      tripId: tripBookings.tripId,
      fromAt: sql<Date | null>`min(${tripBookings.startAt})`,
      toAt: sql<Date | null>`max(coalesce(${tripBookings.endAt}, ${tripBookings.startAt}))`,
    })
    .from(tripBookings)
    .where(eq(tripBookings.userId, userId))
    .groupBy(tripBookings.tripId)
    .orderBy(asc(tripBookings.tripId));
}

export async function verifyTripOwnership(userId: string, tripId: number): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trips)
    .where(and(eq(trips.userId, userId), eq(trips.id, tripId)));

  return (row?.count ?? 0) > 0;
}
