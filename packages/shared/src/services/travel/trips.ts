/**
 * Trip CRUD and access-control queries
 * - createTrip(userId, data) — creates a trip with a random colour
 * - getTrips(userId) — lists owned trips with computed status
 * - getAccessibleTrips(userId) — owned + shared trips with access role and permission info
 * - getTripById(userId, tripId) — owned trip with status, throws if not found
 * - getTripByIdAccessible(userId, tripId) — owned or shared trip with status
 * - updateTrip(userId, tripId, data) — partial update
 * - deleteTrip(userId, tripId) — hard delete
 * - deleteAllUserTrips(userId) — bulk delete for account removal
 * - getNextTrip(userId, now?) — soonest upcoming non-cancelled trip (undated trips use their bookings' dates)
 * - getTripBookingRanges(userId) — min/max booking dates and booking count per trip (owned)
 * - getTripBookingRangesByTripIds(tripIds) — same, for a specific set of trip IDs
 * - listTripSummaries(userId, filters?) — owned + shared trips with dates inherited from bookings, booking count,
 *   filtered by status and/or overlap with a date range
 * - updateTripDetails(userId, tripId, data) — owner-only partial update that rejects an end before the start
 * - verifyTripOwnership(userId, tripId) — throws if user does not own the trip
 * - verifyTripAccess(userId, tripId) — throws if user has neither ownership nor a share
 * Types: TripInsert, TripUpdate, TripBookingRange, AccessibleTrip, TripSummary, TripSummaryFilters
 * Errors: TripInputError
 */
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { PromiseCacheX } from 'promise-cachex';
import { db } from '../../db/client';
import { users } from '../../db/schema/users';
import { tripBookings, tripShares, trips } from '../../db/schema/travel';
import { deriveTripStatus, inheritTripDates, omitUndefined, UserInputError } from '../../utils';
import type { NewTrip, Trip, TripSharePermission, TripStatus, TripWithStatus } from '../../types';
import { TripSharePermissions } from '../../constants';

/** A trip that does not exist for the user, or an invalid trip change. */
export class TripInputError extends UserInputError {}

const tripAccessCache = new PromiseCacheX<boolean>({ ttl: 300_000 });

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
  bookingCount: number;
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
  return rows.map(r => withStatus(r, now));
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

  return rows.map(row => ({
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
      ...omitUndefined(data),
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
  // A trip without its own dates inherits them from its bookings, as in the Hub.
  const ranges = db
    .select({
      tripId: tripBookings.tripId,
      fromAt: sql<Date | null>`min(${tripBookings.startAt})`.mapWith(trips.startAt).as('from_at'),
      toAt: sql<Date | null>`max(coalesce(${tripBookings.endAt}, ${tripBookings.startAt}))`
        .mapWith(trips.endAt)
        .as('to_at'),
    })
    .from(tripBookings)
    .groupBy(tripBookings.tripId)
    .as('booking_ranges');
  const effectiveStart = sql`coalesce(${trips.startAt}, ${ranges.fromAt})`;

  const [row] = await db
    .select({ trip: trips, fromAt: ranges.fromAt, toAt: ranges.toAt })
    .from(trips)
    .leftJoin(ranges, eq(ranges.tripId, trips.id))
    .where(
      and(
        eq(trips.userId, userId),
        isNull(trips.cancelledAt),
        // timestamp columns store UTC ISO strings (drizzle's encoding), so compare against the same
        sql`${effectiveStart} >= ${now.toISOString()}::timestamp`,
      ),
    )
    .orderBy(asc(effectiveStart), asc(trips.id))
    .limit(1);

  return row ? withStatus(inheritTripDates(row.trip, row), now) : null;
}

export async function getTripBookingRanges(userId: string): Promise<TripBookingRange[]> {
  return db
    .select({
      tripId: tripBookings.tripId,
      fromAt: sql<Date | null>`min(${tripBookings.startAt})`.mapWith(trips.startAt),
      toAt: sql<Date | null>`max(coalesce(${tripBookings.endAt}, ${tripBookings.startAt}))`.mapWith(trips.endAt),
      bookingCount: sql<number>`count(*)`.mapWith(Number),
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
      fromAt: sql<Date | null>`min(${tripBookings.startAt})`.mapWith(trips.startAt),
      toAt: sql<Date | null>`max(coalesce(${tripBookings.endAt}, ${tripBookings.startAt}))`.mapWith(trips.endAt),
      bookingCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(tripBookings)
    .where(inArray(tripBookings.tripId, tripIds))
    .groupBy(tripBookings.tripId)
    .orderBy(asc(tripBookings.tripId));
}

export interface TripSummaryFilters {
  /** Keep only trips with one of these statuses (computed after inheriting dates from bookings). */
  statuses?: readonly TripStatus[];
  /** Keep only trips that end on/after this moment (undated trips are dropped when a range is given). */
  from?: Date;
  /** Keep only trips that start on/before this moment (undated trips are dropped when a range is given). */
  to?: Date;
}

export interface TripSummary {
  id: number;
  name: string;
  destination: string | null;
  startAt: Date | null;
  endAt: Date | null;
  /** True when startAt/endAt (or one of them) come from the bookings because the trip has none of its own. */
  datesFromBookings: boolean;
  status: TripStatus;
  bookingCount: number;
  accessRole: 'owner' | 'viewer';
}

/**
 * Every trip the user owns or has been shared, ordered by start date (undated last), with dates inherited from
 * bookings the way the Hub shows them, a booking count, and optional status / date-range filters.
 */
export async function listTripSummaries(userId: string, filters: TripSummaryFilters = {}): Promise<TripSummary[]> {
  const now = new Date();
  const accessible = await getAccessibleTrips(userId);
  const ranges = await getTripBookingRangesByTripIds(accessible.map(item => item.trip.id));
  const rangeByTrip = new Map(ranges.map(r => [r.tripId, r]));
  const hasRange = filters.from !== undefined || filters.to !== undefined;

  const summaries = accessible.map(({ trip, accessRole }): TripSummary => {
    const range = rangeByTrip.get(trip.id);
    const dated = inheritTripDates(trip, range);
    return {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startAt: dated.startAt,
      endAt: dated.endAt,
      datesFromBookings: dated.startAt !== trip.startAt || dated.endAt !== trip.endAt,
      status: deriveTripStatus(trip.cancelledAt, dated.startAt, dated.endAt, now),
      bookingCount: range?.bookingCount ?? 0,
      accessRole,
    };
  });

  return summaries
    .filter(t => !filters.statuses?.length || filters.statuses.includes(t.status))
    .filter(t => {
      if (!hasRange) return true;
      const start = t.startAt ?? t.endAt;
      const end = t.endAt ?? t.startAt;
      if (!start || !end) return false;
      return (!filters.from || end >= filters.from) && (!filters.to || start <= filters.to);
    })
    .sort(
      (a, b) =>
        (a.startAt?.getTime() ?? Number.POSITIVE_INFINITY) - (b.startAt?.getTime() ?? Number.POSITIVE_INFINITY) ||
        a.id - b.id,
    );
}

/**
 * Owner-only partial trip update for tools: `undefined` leaves a field alone, `null` clears it. Throws
 * `TripInputError` when the trip does not exist for the user or the resulting end is before the start.
 */
export async function updateTripDetails(userId: string, tripId: number, data: TripUpdate): Promise<TripWithStatus> {
  const existing = await getTripById(userId, tripId);
  if (!existing) throw new TripInputError(`Trip ${tripId} not found.`);

  const startAt = data.startAt === undefined ? existing.startAt : data.startAt;
  const endAt = data.endAt === undefined ? existing.endAt : data.endAt;
  if (startAt && endAt && endAt < startAt) {
    throw new TripInputError('The trip end must not be before its start.');
  }

  const updated = await updateTrip(userId, tripId, data);
  if (!updated) throw new TripInputError(`Trip ${tripId} not found.`);
  return updated;
}

export async function verifyTripOwnership(userId: string, tripId: number): Promise<boolean> {
  return tripAccessCache.get(`own:${userId}:${tripId}`, async () => {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(trips)
      .where(and(eq(trips.userId, userId), eq(trips.id, tripId)));

    return (row?.count ?? 0) > 0;
  });
}

export async function verifyTripAccess(userId: string, tripId: number): Promise<boolean> {
  return tripAccessCache.get(`access:${userId}:${tripId}`, async () => {
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
  });
}
