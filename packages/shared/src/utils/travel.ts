/**
 * Travel domain utilities
 * - deriveTripStatus(cancelledAt, startAt, endAt, now?) — computes Cancelled/Planned/Active/Completed from timeline fields
 * - isTransportBookingType(bookingType) — true if bookingType is in the transport booking types list
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
