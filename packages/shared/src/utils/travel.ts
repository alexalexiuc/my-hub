import { TripStatuses, type TripStatus } from '../constants';

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
