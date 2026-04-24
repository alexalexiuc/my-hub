// ---- Booking details (trip_bookings.details) ────────────────────────────
// Discriminated union — kind drives which shape is expected.
// Use BookingDetails as the root; extend for each booking type.
// Use BaseBookingDetails for types without a dedicated shape yet.

export interface BookingDetails {
  readonly kind: string;
  source?: string;
  rawText?: string;
  /** Open bag — AI may add any extra fields it considers relevant. */
  extra?: Record<string, unknown>;
}

// Flight metadata stored in trip_bookings.details (user-provided / AI-extracted fallback)
export interface FlightDetails extends BookingDetails {
  readonly kind: 'flight';
  flightNumber?: string;
  seat?: string;
  originIata?: string;
  destinationIata?: string;
  terminal?: string;
  gate?: string;
  aircraftType?: string;
}

// Location for transport bookings (train, bus, ferry, taxi, transfer, car, rental_car)
export interface TransportLocation {
  name: string;
  address?: string;
  iataCode?: string;
  uicCode?: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
}

// Transport booking details stored in trip_bookings.details
export interface TransportDetails extends BookingDetails {
  readonly kind: 'transport';
  origin: TransportLocation;
  destination: TransportLocation;
  serviceNumber?: string;
  seat?: string;
  class?: string;
  vehicleType?: string;
  meetingPoint?: string;
  vesselName?: string;
  cabin?: string;
  distanceKm?: number;
}

// Fallback shape for booking types without a dedicated details interface yet.
// kind: 'base' signals that only the common BookingDetails fields are expected.
export interface BaseBookingDetails extends BookingDetails {
  readonly kind: 'base';
}
