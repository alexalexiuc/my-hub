import { and, asc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import { tripBookings, tripShares, trips } from '../../db/schema/travel';
import { deriveTripStatus, omitNullish } from '../../utils';
import type { NewTrip, Trip, TripSharePermission, TripWithStatus } from '../../types';
import { TripSharePermissions } from '../../constants';

const tripColorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16'];

function randomTripColor(): string {
  return tripColorPalette[Math.floor(Math.random() * tripColorPalette.length)] ?? '#3B82F6';
}

export type TripInsert = Omit<NewTrip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
export type TripUpdate = Partial<
  Pick<TripInsert, 'name' | 'color' | 'destination' | 'startAt' | 'endAt' | 'cancelledAt' | 'notes' | 'coverImageUrl'>
>;

export interface TripBookingRange {
  tripId: number;
  fromAt: Date | null;
  toAt: Date | null;
}

export interface AccessibleTrip {
  trip: TripWithStatus;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string;
  accessRole: 'owner' | 'viewer';
  permission: TripSharePermission;
}

function withStatus(trip: Trip, now = new Date()): TripWithStatus {
  return { ...trip, status: deriveTripStatus(trip.cancelledAt, trip.startAt, trip.endAt, now) };
}

export async function createTrip(userId: string, data: TripInsert): Promise<TripWithStatus> {
  const [row] = await db
    .insert(trips)
    .values({
      ...data,
      color: data.color ?? randomTripColor(),
      userId,
    })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return withStatus(row);
}

export async function getTrips(userId: string): Promise<TripWithStatus[]> {
  const now = new Date();
  const rows = await db.select().from(trips).where(eq(trips.userId, userId)).orderBy(asc(trips.startAt), asc(trips.id));
  return rows.map((r) => withStatus(r, now));
}

export async function getAccessibleTrips(userId: string): Promise<AccessibleTrip[]> {
  const now = new Date();
  const baseWhere = or(eq(trips.userId, userId), eq(tripShares.sharedWithUserId, userId));

  const rows = await db
    .select({
      trip: trips,
      ownerUserId: trips.userId,
      ownerName: users.name,
      ownerEmail: users.email,
      accessRole: sql<'owner' | 'viewer'>`case when ${trips.userId} = ${userId} then 'owner' else 'viewer' end`,
      permission: sql<TripSharePermission>`coalesce(${tripShares.permission}, ${TripSharePermissions.View})`,
    })
    .from(trips)
    .leftJoin(
      tripShares,
      and(
        eq(tripShares.tripId, trips.id),
        eq(tripShares.sharedWithUserId, userId),
        eq(tripShares.ownerUserId, trips.userId),
      ),
    )
    .innerJoin(users, eq(users.id, trips.userId))
    .where(baseWhere)
    .orderBy(asc(trips.startAt), asc(trips.id));

  return rows.map((row) => ({
    trip: withStatus(row.trip, now),
    ownerUserId: row.ownerUserId,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    accessRole: row.accessRole,
    permission: row.permission,
  }));
}

export async function getTripById(userId: string, tripId: number): Promise<TripWithStatus | null> {
  const [row] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.userId, userId), eq(trips.id, tripId)));
  return row ? withStatus(row) : null;
}

export async function getTripByIdAccessible(userId: string, tripId: number): Promise<TripWithStatus | null> {
  const [row] = await db
    .select({ trip: trips })
    .from(trips)
    .leftJoin(
      tripShares,
      and(
        eq(tripShares.tripId, trips.id),
        eq(tripShares.sharedWithUserId, userId),
        eq(tripShares.ownerUserId, trips.userId),
      ),
    )
    .where(and(eq(trips.id, tripId), or(eq(trips.userId, userId), eq(tripShares.sharedWithUserId, userId))));

  return row ? withStatus(row.trip) : null;
}

export async function updateTrip(userId: string, tripId: number, data: TripUpdate): Promise<TripWithStatus | null> {
  const [row] = await db
    .update(trips)
    .set({
      ...omitNullish(data),
      updatedAt: new Date(),
    })
    .where(and(eq(trips.userId, userId), eq(trips.id, tripId)))
    .returning();

  return row ? withStatus(row) : null;
}

export async function deleteTrip(userId: string, tripId: number): Promise<TripWithStatus | null> {
  const [row] = await db
    .delete(trips)
    .where(and(eq(trips.userId, userId), eq(trips.id, tripId)))
    .returning();

  return row ? withStatus(row) : null;
}

export async function deleteAllUserTrips(userId: string): Promise<number> {
  const rows = await db.delete(trips).where(eq(trips.userId, userId)).returning({ id: trips.id });

  return rows.length;
}

export async function getNextTrip(userId: string, now = new Date()): Promise<TripWithStatus | null> {
  const [row] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.userId, userId), gte(trips.startAt, now), isNull(trips.cancelledAt)))
    .orderBy(asc(trips.startAt), asc(trips.id))
    .limit(1);

  return row ? withStatus(row, now) : null;
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

export async function getTripBookingRangesByTripIds(tripIds: number[]): Promise<TripBookingRange[]> {
  if (tripIds.length === 0) return [];

  return db
    .select({
      tripId: tripBookings.tripId,
      fromAt: sql<Date | null>`min(${tripBookings.startAt})`,
      toAt: sql<Date | null>`max(coalesce(${tripBookings.endAt}, ${tripBookings.startAt}))`,
    })
    .from(tripBookings)
    .where(inArray(tripBookings.tripId, tripIds))
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

export async function verifyTripAccess(userId: string, tripId: number): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trips)
    .leftJoin(
      tripShares,
      and(
        eq(tripShares.tripId, trips.id),
        eq(tripShares.sharedWithUserId, userId),
        eq(tripShares.ownerUserId, trips.userId),
      ),
    )
    .where(and(eq(trips.id, tripId), or(eq(trips.userId, userId), eq(tripShares.sharedWithUserId, userId))));

  return (row?.count ?? 0) > 0;
}
