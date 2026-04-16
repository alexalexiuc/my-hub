/**
 * Trip booking CRUD and query helpers
 * - addTripBooking(userId, tripId, data) — creates a booking; validates coordinates on insert
 * - getTripBookings(userId, tripId, opts?) — lists bookings, optionally filtered by bookingType
 * - getUpcomingTripBookings(userId, hoursAhead?, bookingType?) — bookings starting within the given window (default 48 h)
 * - getTripBookingById(userId, bookingId) — single booking with ownership check
 * - updateTripBooking(userId, bookingId, data) — partial update; re-validates coordinates if changed
 * - deleteTripBooking(userId, bookingId) — hard delete
 * - deleteAllUserTripBookings(userId) — bulk delete for account removal
 * Types: TripBookingInsert, TripBookingUpdate (includes contactName/contactEmail/contactPhone), GetTripBookingsOpts
 */
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripBookings } from '../../db/schema/travel';
import type { NewTripBooking, TripBooking, TripBookingType } from '../../types';
import { verifyTripOwnership } from './trips';
import { validateCoords } from '../../utils';

export type TripBookingInsert = Omit<NewTripBooking, 'id' | 'userId' | 'tripId' | 'createdAt' | 'updatedAt'>;
export type TripBookingUpdate = Partial<
  Pick<
    TripBookingInsert,
    | 'bookingType'
    | 'title'
    | 'provider'
    | 'confirmationNumber'
    | 'startAt'
    | 'endAt'
    | 'status'
    | 'costAmount'
    | 'costCurrency'
    | 'location'
    | 'referenceLink'
    | 'notes'
    | 'details'
    | 'timezone'
    | 'lat'
    | 'lng'
    | 'contactName'
    | 'contactEmail'
    | 'contactPhone'
  >
>;

export interface GetTripBookingsOpts {
  bookingType?: TripBookingType;
}

export async function addTripBooking(userId: string, tripId: number, data: TripBookingInsert): Promise<TripBooking> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }
  validateCoords({ lat: data.lat, lng: data.lng });
  const [row] = await db
    .insert(tripBookings)
    .values({
      ...data,
      userId,
      tripId,
    })
    .returning();

  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function getTripBookings(
  userId: string,
  tripId: number,
  opts: GetTripBookingsOpts = {},
): Promise<TripBooking[]> {
  const conditions = [eq(tripBookings.userId, userId), eq(tripBookings.tripId, tripId)];

  if (opts.bookingType) conditions.push(eq(tripBookings.bookingType, opts.bookingType));

  return db
    .select()
    .from(tripBookings)
    .where(and(...conditions))
    .orderBy(asc(tripBookings.startAt), asc(tripBookings.id));
}

/** Fetch upcoming trip bookings for a user within a specified time window (default: 48 hours) and optional booking type filter */
export async function getUpcomingTripBookings(
  userId: string,
  hoursAhead = 48,
  bookingType?: TripBookingType,
): Promise<TripBooking[]> {
  const now = new Date();
  const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const conditions = [
    eq(tripBookings.userId, userId),
    gte(tripBookings.startAt, now),
    lte(tripBookings.startAt, until),
  ];
  if (bookingType) conditions.push(eq(tripBookings.bookingType, bookingType));

  return db
    .select()
    .from(tripBookings)
    .where(and(...conditions))
    .orderBy(asc(tripBookings.startAt), asc(tripBookings.id));
}

export async function updateTripBooking(
  userId: string,
  bookingId: number,
  data: TripBookingUpdate,
): Promise<TripBooking | null> {
  if (data.lat !== undefined || data.lng !== undefined) {
    validateCoords({ lat: data.lat, lng: data.lng });
  }

  const updates: Partial<TripBookingInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      (updates as Record<string, unknown>)[key] = value;
    }
  }

  const [row] = await db
    .update(tripBookings)
    .set(updates)
    .where(and(eq(tripBookings.userId, userId), eq(tripBookings.id, bookingId)))
    .returning();

  return row ?? null;
}

export async function getTripBookingById(userId: string, bookingId: number): Promise<TripBooking | null> {
  const [row] = await db
    .select()
    .from(tripBookings)
    .where(and(eq(tripBookings.userId, userId), eq(tripBookings.id, bookingId)))
    .limit(1);
  return row ?? null;
}

export async function deleteTripBooking(userId: string, bookingId: number): Promise<TripBooking | null> {
  const [row] = await db
    .delete(tripBookings)
    .where(and(eq(tripBookings.userId, userId), eq(tripBookings.id, bookingId)))
    .returning();

  return row ?? null;
}

export async function deleteAllUserTripBookings(userId: string): Promise<number> {
  const rows = await db.delete(tripBookings).where(eq(tripBookings.userId, userId)).returning({ id: tripBookings.id });

  return rows.length;
}
