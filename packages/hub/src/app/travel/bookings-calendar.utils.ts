import type { TripBooking, TripBookingType, Trip } from '@my-hub/shared/types';
import { TripBookingTypes } from '@my-hub/shared/constants';
import { toDate } from '@my-hub/shared/utils';

/**
 * Converts a 6-digit hex colour to an rgba() string with the given alpha.
 * Falls back to a default blue if the hex is invalid.
 */
export function withAlpha(hex: string, alpha: number): string {
  const valid = /^#([0-9a-fA-F]{6})$/.exec(hex);
  const raw = valid?.[1];
  if (!raw) return `rgba(59,130,246,${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Maps a booking type to the Tailwind dot colour class used in the calendar. */
export function bookingDotClass(bookingType: TripBookingType): string {
  switch (bookingType) {
    case TripBookingTypes.Flight:
      return 'bg-sky-400';
    case TripBookingTypes.Accommodation:
      return 'bg-emerald-400';
    case TripBookingTypes.RentalCar:
      return 'bg-amber-400';
    case TripBookingTypes.Train:
    case TripBookingTypes.Bus:
    case TripBookingTypes.Ferry:
    case TripBookingTypes.Taxi:
    case TripBookingTypes.Transfer:
    case TripBookingTypes.Car:
      return 'bg-indigo-400';
    default:
      return 'bg-zinc-400';
  }
}

/**
 * Returns the earliest date among all booking start dates and the trip start date.
 * Used to initialize the calendar month cursor.
 */
export function getMinBookingDate(bookings: TripBooking[], trip: Trip): Date {
  const dates = bookings
    .map(b => toDate(b.startAt))
    .concat(toDate(trip.startAt || Date.now()))
    .filter((d): d is Date => d !== null);

  if (dates.length === 0) return new Date();
  return new Date(Math.min(...dates.map(d => d.getTime())));
}
