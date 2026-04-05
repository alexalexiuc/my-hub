import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  addTripBooking,
  deleteTripBooking,
  getTripBookingById,
  linkBookingToFlightData,
  updateTripBooking,
  upsertFlightData,
} from '@my-hub/shared/services';
import type { FlightDetails } from '@my-hub/shared/types';
import { toolResponse } from '../../shared/toolsUtils';

const BookingTypeSchema = z.enum([
  'flight',
  'accommodation',
  'rental_car',
  'train',
  'bus',
  'ferry',
  'taxi',
  'restaurant',
  'tour',
  'activity',
  'ticket',
  'other',
]);

// ---------------------------------------------------------------------------
// travel_add_reservation_from_text
// ---------------------------------------------------------------------------

export const TravelAddReservationFromTextSchema = z.object({
  trip_id: z.number().int().positive().describe('Trip ID where the reservation should be added.'),
  booking_text: z
    .string()
    .min(5)
    .describe('Raw confirmation text from chat/email/notes. The full text is stored for later extraction.'),
  booking_type: BookingTypeSchema.exclude(['flight'])
    .optional()
    .describe('Optional booking type if known. Flights are not supported here — use travel_add_flight instead.'),
  title: z.string().optional().describe('Short reservation title. If omitted, fallback title is generated.'),
  provider: z.string().optional().describe('Airline/hotel/provider name if already known.'),
  location: z.string().optional().describe('Location or route summary for this reservation.'),
  start_at: z.string().datetime().optional().describe('Start datetime in ISO 8601 if known.'),
  end_at: z.string().datetime().optional().describe('End datetime in ISO 8601 if known.'),
  confirmation_number: z.string().optional().describe('Confirmation reference if available.'),
  timezone: z
    .string()
    .optional()
    .describe(
      'IANA timezone string for this booking location, e.g. "Europe/Chisinau". Infer from location text when possible.',
    ),
  lat: z.number().optional().describe('Latitude of the booking location (decimal degrees).'),
  lng: z.number().optional().describe('Longitude of the booking location (decimal degrees).'),
});

export const travelAddReservationFromTextTool: ToolCallback<typeof TravelAddReservationFromTextSchema.shape> = async (
  input,
  extra,
) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const bookingType = input.booking_type ?? 'other';
  const title = input.title ?? `Imported ${bookingType} reservation`;

  const booking = await addTripBooking(userId, input.trip_id, {
    bookingType,
    title,
    provider: input.provider ?? null,
    confirmationNumber: input.confirmation_number ?? null,
    startAt: input.start_at ? new Date(input.start_at) : null,
    endAt: input.end_at ? new Date(input.end_at) : null,
    status: 'imported',
    costAmount: null,
    costCurrency: 'EUR',
    location: input.location ?? null,
    notes: null,
    timezone: input.timezone ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    details: {
      source: 'nl_import',
      raw_text: input.booking_text,
    },
  });

  return toolResponse({
    message: 'Reservation captured from text.',
    booking,
  });
};

// ---------------------------------------------------------------------------
// travel_add_flight
// ---------------------------------------------------------------------------

export const TravelAddFlightSchema = z.object({
  trip_id: z.number().int().positive().describe('Trip ID to add the flight to.'),
  flight_number: z
    .string()
    .min(2)
    .describe('IATA flight number, e.g. "BA2490". Required — used for live tracking and status updates.'),
  origin_iata: z.string().length(3).describe('3-letter IATA code of the departure airport, e.g. "LHR".'),
  destination_iata: z.string().length(3).describe('3-letter IATA code of the arrival airport, e.g. "CDG".'),
  departure_at: z
    .string()
    .datetime()
    .describe('Scheduled departure datetime in ISO 8601, e.g. "2026-06-15T09:30:00Z".'),
  arrival_at: z.string().datetime().optional().describe('Scheduled arrival datetime in ISO 8601.'),
  seat: z.string().optional().describe('Seat assignment, e.g. "14A".'),
  terminal: z.string().optional().describe('Departure terminal, e.g. "T5".'),
  gate: z.string().optional().describe('Departure gate, e.g. "B42".'),
  aircraft_type: z.string().optional().describe('Aircraft model, e.g. "A320".'),
  provider: z.string().optional().describe('Airline name, e.g. "British Airways".'),
  confirmation_number: z.string().optional().describe('Booking reference or PNR.'),
  title: z
    .string()
    .optional()
    .describe(
      'Short label shown in the itinerary. Defaults to "{flight_number}: {origin_iata} → {destination_iata}" if omitted.',
    ),
  notes: z.string().optional().describe('Any extra notes about this flight.'),
  timezone: z
    .string()
    .optional()
    .describe('IANA timezone override for this booking. Normally derived automatically from IATA codes.'),
  lat: z.number().optional().describe('Latitude of the departure location (decimal degrees).'),
  lng: z.number().optional().describe('Longitude of the departure location (decimal degrees).'),
});

export const travelAddFlightTool: ToolCallback<typeof TravelAddFlightSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const flightNumber = input.flight_number.toUpperCase();
  const originIata = input.origin_iata.toUpperCase();
  const destIata = input.destination_iata.toUpperCase();
  const title = input.title ?? `${flightNumber}: ${originIata} → ${destIata}`;

  const booking = await addTripBooking(userId, input.trip_id, {
    bookingType: 'flight',
    title,
    provider: input.provider ?? null,
    confirmationNumber: input.confirmation_number ?? null,
    startAt: new Date(input.departure_at),
    endAt: input.arrival_at ? new Date(input.arrival_at) : null,
    status: 'confirmed',
    costAmount: null,
    costCurrency: 'EUR',
    location: `${originIata} → ${destIata}`,
    notes: input.notes ?? null,
    timezone: input.timezone ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    details: {
      flight_number: flightNumber,
      origin_iata: originIata,
      destination_iata: destIata,
      ...(input.seat && { seat: input.seat }),
      ...(input.terminal && { terminal: input.terminal }),
      ...(input.gate && { gate: input.gate }),
      ...(input.aircraft_type && { aircraft_type: input.aircraft_type }),
    },
  });

  // Register with flight tracker so the worker starts polling immediately.
  try {
    const flightDate = input.departure_at.slice(0, 10);
    const fd = await upsertFlightData(flightNumber, flightDate);
    await linkBookingToFlightData(booking.id, fd.id);
  } catch {
    // Non-fatal: live tracking can be linked later.
  }

  return toolResponse({
    message: 'Flight added and live tracking enabled.',
    booking,
  });
};

// ---------------------------------------------------------------------------
// travel_edit_booking
// ---------------------------------------------------------------------------

export const TravelEditBookingSchema = z.object({
  booking_id: z
    .number()
    .int()
    .positive()
    .describe('ID of the booking to update. Must not be a flight — use travel_edit_flight for flights.'),
  title: z.string().optional().describe('New title for the booking.'),
  provider: z.string().optional().describe('Updated provider/hotel/operator name.'),
  location: z.string().optional().describe('Updated location or route summary.'),
  start_at: z.string().datetime().optional().describe('Updated start datetime in ISO 8601.'),
  end_at: z.string().datetime().optional().describe('Updated end datetime in ISO 8601.'),
  confirmation_number: z.string().optional().describe('Updated booking reference.'),
  notes: z.string().optional().describe('Updated notes.'),
  status: z.string().optional().describe('Updated booking status, e.g. "confirmed", "cancelled", "planned".'),
  timezone: z.string().optional().describe('Updated IANA timezone string for the booking location.'),
  lat: z.number().optional().describe('Updated latitude of the booking location.'),
  lng: z.number().optional().describe('Updated longitude of the booking location.'),
});

export const travelEditBookingTool: ToolCallback<typeof TravelEditBookingSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const existing = await getTripBookingById(userId, input.booking_id);
  if (!existing) throw new Error(`Booking ${input.booking_id} not found.`);
  if (existing.bookingType === 'flight') throw new Error('Use travel_edit_flight to update flight bookings.');

  const updated = await updateTripBooking(userId, input.booking_id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.provider !== undefined && { provider: input.provider }),
    ...(input.location !== undefined && { location: input.location }),
    ...(input.start_at !== undefined && { startAt: new Date(input.start_at) }),
    ...(input.end_at !== undefined && { endAt: new Date(input.end_at) }),
    ...(input.confirmation_number !== undefined && { confirmationNumber: input.confirmation_number }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.timezone !== undefined && { timezone: input.timezone }),
    ...(input.lat !== undefined && { lat: input.lat }),
    ...(input.lng !== undefined && { lng: input.lng }),
  });

  if (!updated) throw new Error(`Failed to update booking ${input.booking_id}.`);

  return toolResponse({
    message: 'Booking updated.',
    booking: updated,
  });
};

// ---------------------------------------------------------------------------
// travel_edit_flight
// ---------------------------------------------------------------------------

export const TravelEditFlightSchema = z.object({
  booking_id: z.number().int().positive().describe('ID of the flight booking to update.'),
  flight_number: z
    .string()
    .min(2)
    .optional()
    .describe(
      'Updated IATA flight number, e.g. "BA2491". If changed, live tracking is re-linked to the new flight automatically.',
    ),
  departure_at: z.string().datetime().optional().describe('Updated scheduled departure datetime in ISO 8601.'),
  arrival_at: z.string().datetime().optional().describe('Updated scheduled arrival datetime in ISO 8601.'),
  seat: z.string().optional().describe('Updated seat assignment, e.g. "22C".'),
  terminal: z.string().optional().describe('Updated departure terminal, e.g. "T5".'),
  gate: z.string().optional().describe('Updated departure gate, e.g. "B42".'),
  provider: z.string().optional().describe('Updated airline name.'),
  confirmation_number: z.string().optional().describe('Updated booking reference or PNR.'),
  notes: z.string().optional().describe('Updated notes.'),
  title: z.string().optional().describe('Updated itinerary label.'),
  timezone: z.string().optional().describe('Updated IANA timezone override for this flight booking.'),
  lat: z.number().optional().describe('Updated latitude of the departure location.'),
  lng: z.number().optional().describe('Updated longitude of the departure location.'),
});

export const travelEditFlightTool: ToolCallback<typeof TravelEditFlightSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const existing = await getTripBookingById(userId, input.booking_id);
  if (!existing) throw new Error(`Booking ${input.booking_id} not found.`);
  if (existing.bookingType !== 'flight') throw new Error('Use travel_edit_booking to update non-flight bookings.');

  // Merge flight detail fields with existing so unmentioned fields are preserved.
  const existingDetails = (existing.details as FlightDetails | null) ?? {};
  const newFlightNumber = input.flight_number ? input.flight_number.toUpperCase() : undefined;
  const mergedDetails: FlightDetails = {
    ...existingDetails,
    ...(newFlightNumber && { flight_number: newFlightNumber }),
    ...(input.seat !== undefined && { seat: input.seat }),
    ...(input.terminal !== undefined && { terminal: input.terminal }),
    ...(input.gate !== undefined && { gate: input.gate }),
  };

  const updated = await updateTripBooking(userId, input.booking_id, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.provider !== undefined && { provider: input.provider }),
    ...(input.departure_at !== undefined && { startAt: new Date(input.departure_at) }),
    ...(input.arrival_at !== undefined && { endAt: new Date(input.arrival_at) }),
    ...(input.confirmation_number !== undefined && { confirmationNumber: input.confirmation_number }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.timezone !== undefined && { timezone: input.timezone }),
    ...(input.lat !== undefined && { lat: input.lat }),
    ...(input.lng !== undefined && { lng: input.lng }),
    details: mergedDetails,
  });

  if (!updated) throw new Error(`Failed to update flight booking ${input.booking_id}.`);

  // Re-link live tracking if the flight number changed.
  if (newFlightNumber) {
    const departureDate = (input.departure_at ?? existing.startAt?.toISOString() ?? '').slice(0, 10);
    if (departureDate) {
      try {
        const fd = await upsertFlightData(newFlightNumber, departureDate);
        await linkBookingToFlightData(input.booking_id, fd.id);
      } catch {
        // Non-fatal: booking is updated; tracking link can be fixed later.
      }
    }
  }

  return toolResponse({
    message: 'Flight booking updated.',
    booking: updated,
  });
};

// ---------------------------------------------------------------------------
// travel_remove_booking
// ---------------------------------------------------------------------------

export const TravelRemoveBookingSchema = z.object({
  booking_id: z.number().int().positive().describe('ID of the booking to remove.'),
});

export const travelRemoveBookingTool: ToolCallback<typeof TravelRemoveBookingSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const removed = await deleteTripBooking(userId, input.booking_id);
  if (!removed) throw new Error(`Booking ${input.booking_id} not found or already removed.`);

  return toolResponse({
    message: 'Booking removed.',
    booking_id: removed.id,
    title: removed.title,
  });
};
