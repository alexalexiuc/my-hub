/**
 * Travel domain utilities
 * - deriveTripStatus(cancelledAt, startAt, endAt, now?) — computes Cancelled/Planned/Active/Completed from timeline fields
 * - isTransportBookingType(bookingType) — true if bookingType is in the transport booking types list
 * - bookingDateRange(bookings) — earliest booking start and latest booking end/start
 * - inheritTripDates(trip, range) — fills a trip's missing start/end from its bookings' date range
 */

import { TripStatuses, type TripStatus, transportBookingTypes } from '../constants';

/**
 * Derive a trip status from timeline fields. Status is computed, not persisted.
 */
export function deriveTripStatus(
  cancelledAt: Date | null,
  startAt: Date | null,
  endAt: Date | null,
  now = new Date(),
): TripStatus {
  if (cancelledAt != null) return TripStatuses.Cancelled;
  if (!startAt || startAt > now) return TripStatuses.Planned;
  if (!endAt || endAt >= now) return TripStatuses.Active;
  return TripStatuses.Completed;
}

export const isTransportBookingType = (bookingType: string): boolean => {
  // @ts-expect-error - TypeScript doesn't understand the const assertion here, but we know it's correct
  return transportBookingTypes.includes(bookingType);
};

/** Earliest/latest moment covered by a set of bookings (null when none of them is dated). */
export interface BookingDateRange {
  fromAt: Date | null;
  toAt: Date | null;
}

/**
 * Date range spanned by a trip's bookings: the earliest `startAt` and the latest `endAt` (or `startAt` when a
 * booking has no end). Same rule as the SQL ranges in `getTripBookingRanges`.
 */
export function bookingDateRange(bookings: readonly { startAt: Date | null; endAt: Date | null }[]): BookingDateRange {
  let fromAt: Date | null = null;
  let toAt: Date | null = null;
  for (const b of bookings) {
    if (b.startAt && (!fromAt || b.startAt < fromAt)) fromAt = b.startAt;
    const end = b.endAt ?? b.startAt;
    if (end && (!toAt || end > toAt)) toAt = end;
  }
  return { fromAt, toAt };
}

/**
 * A trip with its missing `startAt` / `endAt` taken from its bookings' date range, the way the Hub shows it.
 * Dates set on the trip itself always win.
 */
export function inheritTripDates<T extends { startAt: Date | null; endAt: Date | null }>(
  trip: T,
  range: BookingDateRange | null | undefined,
): T {
  return { ...trip, startAt: trip.startAt ?? range?.fromAt ?? null, endAt: trip.endAt ?? range?.toAt ?? null };
}
