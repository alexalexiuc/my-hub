import type React from 'react';
import { TripBookingTypes } from '@my-hub/shared/constants';
import type { TripBookingType } from '@my-hub/shared/types';

export const bookingTypeLabels: Record<TripBookingType, string> = {
  [TripBookingTypes.Flight]: 'Flight',
  [TripBookingTypes.Accommodation]: 'Accommodation',
  [TripBookingTypes.RentalCar]: 'Rental Car',
  [TripBookingTypes.Train]: 'Train',
  [TripBookingTypes.Bus]: 'Bus',
  [TripBookingTypes.Ferry]: 'Ferry',
  [TripBookingTypes.Taxi]: 'Taxi',
  [TripBookingTypes.Transfer]: 'Transfer',
  [TripBookingTypes.Car]: 'Car',
  [TripBookingTypes.Restaurant]: 'Restaurant',
  [TripBookingTypes.Tour]: 'Tour',
  [TripBookingTypes.Activity]: 'Activity',
  [TripBookingTypes.Other]: 'Other',
};

export function FieldCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block cursor-default rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2.5">
      <span className="mb-[3px] block text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">{label}</span>
      {children}
    </label>
  );
}
