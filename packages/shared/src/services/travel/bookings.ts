import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { tripBookings } from '../../db/schema/travel';
import type { NewTripBooking, TripBooking, TripBookingType } from '../../types/index';
import { verifyTripOwnership } from './trips';

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
    | 'notes'
    | 'details'
  >
>;

export interface GetTripBookingsOpts {
  bookingType?: TripBookingType;
}

export async function addTripBooking(userId: string, tripId: number, data: TripBookingInsert): Promise<TripBooking> {
  if (!(await verifyTripOwnership(userId, tripId))) {
    throw new Error('Trip not found');
  }
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

export async function getUpcomingTripBookings(userId: string, hoursAhead = 48): Promise<TripBooking[]> {
  const now = new Date();
  const until = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return db
    .select()
    .from(tripBookings)
    .where(and(eq(tripBookings.userId, userId), gte(tripBookings.startAt, now), lte(tripBookings.startAt, until)))
    .orderBy(asc(tripBookings.startAt), asc(tripBookings.id));
}

export async function updateTripBooking(
  userId: string,
  bookingId: number,
  data: TripBookingUpdate,
): Promise<TripBooking | null> {
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

export async function deleteTripBooking(userId: string, bookingId: number): Promise<TripBooking | null> {
  const [row] = await db
    .delete(tripBookings)
    .where(and(eq(tripBookings.userId, userId), eq(tripBookings.id, bookingId)))
    .returning();

  return row ?? null;
}
