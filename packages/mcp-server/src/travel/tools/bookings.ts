import { HandledError } from '../../shared/errors';
import { ToolHandler } from '../../shared/types';
import { z } from 'zod';
import {
  addTripBooking,
  deleteTripBooking,
  getTripBookingById,
  linkBookingToFlightData,
  updateTripBooking,
  upsertFlightData,
} from '@my-hub/shared/services';
import type {
  AccommodationDetails,
  BaseBookingDetails,
  FlightDetails,
  TransportDetails,
  TransportLocation,
  TripBookingType,
} from '@my-hub/shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import { transportBookingTypes, TripBookingTypes, tripBookingTypeValues } from '@my-hub/shared/constants';
import { isTransportBookingType, omitUndefined } from '@my-hub/shared/utils';

const BookingTypeSchema = z.enum(tripBookingTypeValues as [TripBookingType, ...TripBookingType[]]);

// ---------------------------------------------------------------------------
// travel_add_reservation_from_text
// ---------------------------------------------------------------------------

export const TravelAddReservationFromTextInputSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID where the reservation should be added.'),
  bookingText: z
    .string()
    .min(5)
    .describe('Raw confirmation text from chat/email/notes. The full text is stored for later extraction.'),
  bookingType: BookingTypeSchema.exclude([TripBookingTypes.Flight])
    .optional()
    .describe('Optional booking type if known. Flights are not supported here — use travel_add_flight instead.'),
  title: z.string().optional().describe('Short reservation title. If omitted, fallback title is generated.'),
  provider: z.string().optional().describe('Airline/hotel/provider name if already known.'),
  location: z.string().optional().describe('Location or route summary for this reservation.'),
  startAt: z.string().datetime().optional().describe('Start datetime in ISO 8601 if known.'),
  endAt: z.string().datetime().optional().describe('End datetime in ISO 8601 if known.'),
  confirmationNumber: z.string().optional().describe('Confirmation reference if available.'),
  contactName: z.string().optional().describe('Name of the property/provider contact person if present in the text.'),
  contactEmail: z
    .string()
    .email()
    .optional()
    .describe('Contact email for the property/provider if present in the text.'),
  contactPhone: z
    .string()
    .optional()
    .describe('Contact phone number for the property/provider if present in the text.'),
  referenceLink: z
    .string()
    .url()
    .optional()
    .describe(
      'Direct URL for this booking/reservation if present in source text (for example booking.com, airline manage booking, ticket portal). Provide when available.',
    ),
  timezone: z
    .string()
    .optional()
    .describe(
      'IANA timezone string for this booking location, e.g. "Europe/Chisinau". Infer from location text when possible.',
    ),
  lat: z.number().optional().describe('Latitude of the booking location (decimal degrees).'),
  lng: z.number().optional().describe('Longitude of the booking location (decimal degrees).'),
  origin: z
    .object({
      name: z.string().trim().min(1).describe('Departure/pickup place name extracted from the confirmation text.'),
      address: z.string().optional(),
      iataCode: z.string().length(3).optional(),
      uicCode: z.string().optional(),
      googlePlaceId: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional()
    .describe(
      'Origin location for transport bookings (train, bus, ferry, taxi, transfer, car, rental_car). Extract from text when possible.',
    ),
  destination: z
    .object({
      name: z.string().trim().min(1).describe('Arrival/drop-off place name extracted from the confirmation text.'),
      address: z.string().optional(),
      iataCode: z.string().length(3).optional(),
      uicCode: z.string().optional(),
      googlePlaceId: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional()
    .describe('Destination location for transport bookings. Extract from text when possible.'),
  source: z
    .string()
    .optional()
    .describe(
      'Human-readable origin of this reservation — something that lets the user trace it back. For emails, use the subject line (e.g. "Your Hilton booking confirmation – Ref #12345"). For SMS, the sender name. For apps, the app name. Omit only if truly unknown.',
    ),
  mealType: z
    .object({
      short: z.string().describe('Short label shown in the UI, e.g. "BB", "HB", "AI", "Breakfast included".'),
      description: z
        .string()
        .describe(
          'Full description shown in the detail panel, e.g. "Bed & Breakfast — daily breakfast included in the room rate".',
        ),
    })
    .optional()
    .describe('Meal plan included with the reservation, if any. Primarily for hotels/accommodation.'),
  extra: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Any additional fields extracted from the text that you consider relevant.'),
});

export const TravelAddReservationFromTextSchema = TravelAddReservationFromTextInputSchema.superRefine((input, ctx) => {
  const bookingType = input.bookingType ?? TripBookingTypes.Other;
  if (!isTransportBookingType(bookingType)) return;

  if (!input.origin) {
    ctx.addIssue({
      code: 'custom',
      path: ['origin'],
      message: `origin is required for transport bookingType "${bookingType}".`,
    });
  }

  if (!input.destination) {
    ctx.addIssue({
      code: 'custom',
      path: ['destination'],
      message: `destination is required for transport bookingType "${bookingType}".`,
    });
  }
});

export const travelAddReservationFromTextTool: ToolHandler<
  typeof TravelAddReservationFromTextInputSchema.shape
> = async (input, context) => {
  const { userId } = context;

  const bookingType = input.bookingType ?? TripBookingTypes.Other;
  const isTransport = isTransportBookingType(bookingType);
  const hasRoute = input.origin && input.destination;

  const title =
    input.title ??
    (isTransport && hasRoute
      ? `${input.origin!.name} → ${input.destination!.name}`
      : `Imported ${bookingType} reservation`);

  const source = input.source ?? 'nl_import';

  const details: TransportDetails | AccommodationDetails | BaseBookingDetails =
    isTransport && hasRoute
      ? {
          kind: 'transport',
          origin: input.origin as TransportLocation,
          destination: input.destination as TransportLocation,
          source,
          rawText: input.bookingText,
          ...(input.extra && { extra: input.extra }),
        }
      : bookingType === TripBookingTypes.Accommodation
        ? {
            kind: 'accommodation',
            source,
            rawText: input.bookingText,
            ...(input.mealType && { mealType: input.mealType }),
            ...(input.extra && { extra: input.extra }),
          }
        : {
            kind: 'base',
            source,
            rawText: input.bookingText,
            ...(input.extra && { extra: input.extra }),
          };

  const booking = await addTripBooking(userId, input.tripId, {
    bookingType,
    title,
    provider: input.provider ?? null,
    confirmationNumber: input.confirmationNumber ?? null,
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
    status: 'imported',
    costAmount: null,
    costCurrency: 'EUR',
    location: input.location ?? (hasRoute ? `${input.origin!.name} → ${input.destination!.name}` : null),
    referenceLink: input.referenceLink ?? null,
    notes: null,
    timezone: input.timezone ?? null,
    lat: input.lat ?? input.origin?.lat ?? null,
    lng: input.lng ?? input.origin?.lng ?? null,
    details,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
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
  tripId: z.number().int().positive().describe('Trip ID to add the flight to.'),
  flightNumber: z
    .string()
    .min(2)
    .describe('IATA flight number, e.g. "BA2490". Required — used for live tracking and status updates.'),
  originIata: z.string().length(3).describe('3-letter IATA code of the departure airport, e.g. "LHR".'),
  destinationIata: z.string().length(3).describe('3-letter IATA code of the arrival airport, e.g. "CDG".'),
  departureAt: z.string().datetime().describe('Scheduled departure datetime in ISO 8601, e.g. "2026-06-15T09:30:00Z".'),
  arrivalAt: z.string().datetime().optional().describe('Scheduled arrival datetime in ISO 8601.'),
  seat: z.string().optional().describe('Seat assignment, e.g. "14A".'),
  terminal: z.string().optional().describe('Departure terminal, e.g. "T5".'),
  gate: z.string().optional().describe('Departure gate, e.g. "B42".'),
  aircraftType: z.string().optional().describe('Aircraft model, e.g. "A320".'),
  provider: z.string().optional().describe('Airline name, e.g. "British Airways".'),
  confirmationNumber: z.string().optional().describe('Booking reference or PNR.'),
  referenceLink: z
    .string()
    .url()
    .optional()
    .describe('Direct booking URL (airline/OTA portal) if available. Provide when you have one.'),
  title: z
    .string()
    .optional()
    .describe(
      'Short label shown in the itinerary. Defaults to "{flightNumber}: {originIata} → {destinationIata}" if omitted.',
    ),
  notes: z.string().optional().describe('Any extra notes about this flight.'),
  timezone: z
    .string()
    .optional()
    .describe('IANA timezone override for this booking. Normally derived automatically from IATA codes.'),
  lat: z.number().optional().describe('Latitude of the departure location (decimal degrees).'),
  lng: z.number().optional().describe('Longitude of the departure location (decimal degrees).'),
  extra: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Any additional fields you consider relevant (e.g. baggage allowance, meal preference).'),
});

export const travelAddFlightTool: ToolHandler<typeof TravelAddFlightSchema.shape> = async (input, context) => {
  const { userId } = context;

  const flightNumber = input.flightNumber.toUpperCase();
  const originIata = input.originIata.toUpperCase();
  const destIata = input.destinationIata.toUpperCase();
  const title = input.title ?? `${flightNumber}: ${originIata} → ${destIata}`;

  const booking = await addTripBooking(userId, input.tripId, {
    bookingType: TripBookingTypes.Flight,
    title,
    provider: input.provider ?? null,
    confirmationNumber: input.confirmationNumber ?? null,
    startAt: new Date(input.departureAt),
    endAt: input.arrivalAt ? new Date(input.arrivalAt) : null,
    status: 'confirmed',
    costAmount: null,
    costCurrency: 'EUR',
    location: `${originIata} → ${destIata}`,
    referenceLink: input.referenceLink ?? null,
    notes: input.notes ?? null,
    timezone: input.timezone ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    details: {
      kind: 'flight' as const,
      flightNumber,
      originIata,
      destinationIata: destIata,
      ...(input.seat && { seat: input.seat }),
      ...(input.terminal && { terminal: input.terminal }),
      ...(input.gate && { gate: input.gate }),
      ...(input.aircraftType && { aircraftType: input.aircraftType }),
      ...(input.extra && { extra: input.extra }),
    },
  });

  // Register with flight tracker so the worker starts polling immediately.
  try {
    const flightDate = input.departureAt.slice(0, 10);
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
// travel_add_transport
// ---------------------------------------------------------------------------

const TransportLocationSchema = z.object({
  name: z.string().trim().min(1).describe('Place name, e.g. "Paris Gare du Nord" or "Hilton Hotel lobby".'),
  address: z.string().optional().describe('Freeform address string.'),
  iataCode: z.string().length(3).optional().describe('3-letter IATA airport code, e.g. "CDG".'),
  uicCode: z.string().optional().describe('UIC railway station code, e.g. "8711300".'),
  googlePlaceId: z.string().optional().describe('Google Place ID, e.g. "ChIJ...".'),
  lat: z.number().optional().describe('Latitude in decimal degrees.'),
  lng: z.number().optional().describe('Longitude in decimal degrees.'),
});

const TransportBookingTypeSchema = z.enum(transportBookingTypes);

export const TravelAddTransportSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID to add the booking to.'),
  bookingType: TransportBookingTypeSchema.describe(
    'Type of transport: train, bus, ferry, taxi, transfer, rental_car, or car.',
  ),
  origin: TransportLocationSchema.describe('Departure/pickup location.'),
  destination: TransportLocationSchema.describe('Arrival/drop-off location.'),
  departureAt: z.string().datetime().describe('Departure datetime in ISO 8601, e.g. "2026-06-15T09:30:00Z".'),
  arrivalAt: z.string().datetime().optional().describe('Estimated/scheduled arrival datetime in ISO 8601.'),
  timezone: z
    .string()
    .optional()
    .describe('IANA timezone string for the departure location, e.g. "Europe/Paris". Infer from origin when possible.'),
  title: z
    .string()
    .optional()
    .describe('Short label for the itinerary. Defaults to "Origin → Destination" if omitted.'),
  provider: z.string().optional().describe('Operator/carrier name, e.g. "Eurostar", "Uber".'),
  confirmationNumber: z.string().optional().describe('Booking reference.'),
  referenceLink: z
    .string()
    .url()
    .optional()
    .describe('Direct booking URL (carrier/agency/ride portal) if available. Provide when you have one.'),
  serviceNumber: z.string().optional().describe('Train/bus/ferry service number, e.g. "TGV 6201".'),
  seat: z.string().optional().describe('Seat, berth, or carriage assignment, e.g. "Car 4 Seat 22".'),
  class: z.string().optional().describe('Travel class, e.g. "Business", "1st class".'),
  vehicleType: z.string().optional().describe('Vehicle model or type, e.g. "Mercedes E-Class", "Coach".'),
  meetingPoint: z.string().optional().describe('Where to meet the driver/transfer (for taxi/transfer).'),
  vesselName: z.string().optional().describe('Ship or vessel name (for ferries).'),
  cabin: z.string().optional().describe('Cabin number or deck (for ferries).'),
  distanceKm: z.number().optional().describe('Approximate distance in kilometres (for car/rental_car).'),
  costAmount: z.number().optional().describe('Total cost amount.'),
  costCurrency: z.string().length(3).optional().describe('ISO 4217 currency code, e.g. "EUR".'),
  notes: z.string().optional().describe('Any extra notes.'),
  extra: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Any additional fields you consider relevant (e.g. driver contact, vehicle plate).'),
});

export const travelAddTransportTool: ToolHandler<typeof TravelAddTransportSchema.shape> = async (input, context) => {
  const { userId } = context;

  const title = input.title ?? `${input.origin.name} → ${input.destination.name}`;

  const details: TransportDetails = {
    kind: 'transport',
    origin: input.origin as TransportLocation,
    destination: input.destination as TransportLocation,
    ...(input.serviceNumber && { serviceNumber: input.serviceNumber }),
    ...(input.seat && { seat: input.seat }),
    ...(input.class && { class: input.class }),
    ...(input.vehicleType && { vehicleType: input.vehicleType }),
    ...(input.meetingPoint && { meetingPoint: input.meetingPoint }),
    ...(input.vesselName && { vesselName: input.vesselName }),
    ...(input.cabin && { cabin: input.cabin }),
    ...(input.distanceKm !== undefined && { distanceKm: input.distanceKm }),
    ...(input.extra && { extra: input.extra }),
  };

  const booking = await addTripBooking(userId, input.tripId, {
    bookingType: input.bookingType,
    title,
    provider: input.provider ?? null,
    confirmationNumber: input.confirmationNumber ?? null,
    startAt: new Date(input.departureAt),
    endAt: input.arrivalAt ? new Date(input.arrivalAt) : null,
    status: 'confirmed',
    costAmount: input.costAmount ?? null,
    costCurrency: input.costCurrency ?? 'EUR',
    location: `${input.origin.name} → ${input.destination.name}`,
    referenceLink: input.referenceLink ?? null,
    notes: input.notes ?? null,
    timezone: input.timezone ?? null,
    lat: input.origin.lat ?? null,
    lng: input.origin.lng ?? null,
    details,
  });

  return toolResponse({
    message: 'Transport booking added.',
    booking,
  });
};

// ---------------------------------------------------------------------------
// travel_edit_booking
// ---------------------------------------------------------------------------

export const TravelEditBookingSchema = z.object({
  bookingId: z
    .number()
    .int()
    .positive()
    .describe('ID of the booking to update. Must not be a flight — use travel_edit_flight for flights.'),
  title: z.string().optional().describe('New title for the booking.'),
  provider: z.string().optional().describe('Updated provider/hotel/operator name.'),
  location: z.string().optional().describe('Updated location or route summary.'),
  startAt: z.string().datetime().optional().describe('Updated start datetime in ISO 8601.'),
  endAt: z.string().datetime().optional().describe('Updated end datetime in ISO 8601.'),
  confirmationNumber: z.string().optional().describe('Updated booking reference.'),
  referenceLink: z.string().url().optional().describe('Updated direct booking URL.'),
  notes: z.string().optional().describe('Updated notes.'),
  status: z.string().optional().describe('Updated booking status, e.g. "confirmed", "cancelled", "planned".'),
  timezone: z.string().optional().describe('Updated IANA timezone string for the booking location.'),
  lat: z.number().optional().describe('Updated latitude of the booking location.'),
  lng: z.number().optional().describe('Updated longitude of the booking location.'),
  contactName: z
    .string()
    .nullable()
    .optional()
    .describe('Name of the contact person for this booking. Pass null to clear.'),
  contactEmail: z
    .string()
    .email()
    .nullable()
    .optional()
    .describe('Contact email for the property/provider. Pass null to clear.'),
  contactPhone: z
    .string()
    .nullable()
    .optional()
    .describe('Contact phone number for the property/provider. Pass null to clear.'),
});

export const travelEditBookingTool: ToolHandler<typeof TravelEditBookingSchema.shape> = async (input, context) => {
  const { userId } = context;

  const existing = await getTripBookingById(userId, input.bookingId);
  if (!existing) throw new HandledError(`Booking ${input.bookingId} not found.`);
  if (existing.bookingType === TripBookingTypes.Flight)
    throw new HandledError('Use travel_edit_flight to update flight bookings.');

  const updated = await updateTripBooking(
    userId,
    input.bookingId,
    omitUndefined({
      title: input.title,
      provider: input.provider,
      location: input.location,
      startAt: input.startAt ? new Date(input.startAt) : undefined,
      endAt: input.endAt ? new Date(input.endAt) : undefined,
      confirmationNumber: input.confirmationNumber,
      referenceLink: input.referenceLink,
      notes: input.notes,
      status: input.status,
      timezone: input.timezone,
      lat: input.lat,
      lng: input.lng,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
    }),
  );

  if (!updated) throw new HandledError(`Failed to update booking ${input.bookingId}.`);

  return toolResponse({
    message: 'Booking updated.',
    booking: updated,
  });
};

// ---------------------------------------------------------------------------
// travel_edit_flight
// ---------------------------------------------------------------------------

export const TravelEditFlightSchema = z.object({
  bookingId: z.number().int().positive().describe('ID of the flight booking to update.'),
  flightNumber: z
    .string()
    .min(2)
    .optional()
    .describe(
      'Updated IATA flight number, e.g. "BA2491". If changed, live tracking is re-linked to the new flight automatically.',
    ),
  departureAt: z.string().datetime().optional().describe('Updated scheduled departure datetime in ISO 8601.'),
  arrivalAt: z.string().datetime().optional().describe('Updated scheduled arrival datetime in ISO 8601.'),
  seat: z.string().optional().describe('Updated seat assignment, e.g. "22C".'),
  terminal: z.string().optional().describe('Updated departure terminal, e.g. "T5".'),
  gate: z.string().optional().describe('Updated departure gate, e.g. "B42".'),
  provider: z.string().optional().describe('Updated airline name.'),
  confirmationNumber: z.string().optional().describe('Updated booking reference or PNR.'),
  referenceLink: z.string().url().optional().describe('Updated direct booking URL.'),
  notes: z.string().optional().describe('Updated notes.'),
  title: z.string().optional().describe('Updated itinerary label.'),
  timezone: z.string().optional().describe('Updated IANA timezone override for this flight booking.'),
  lat: z.number().optional().describe('Updated latitude of the departure location.'),
  lng: z.number().optional().describe('Updated longitude of the departure location.'),
});

export const travelEditFlightTool: ToolHandler<typeof TravelEditFlightSchema.shape> = async (input, context) => {
  const { userId } = context;

  const existing = await getTripBookingById(userId, input.bookingId);
  if (!existing) throw new HandledError(`Booking ${input.bookingId} not found.`);
  if (existing.bookingType !== TripBookingTypes.Flight)
    throw new HandledError('Use travel_edit_booking to update non-flight bookings.');

  // Merge flight detail fields with existing so unmentioned fields are preserved.
  const existingDetails = (existing.details as Partial<FlightDetails>) ?? {};
  const newFlightNumber = input.flightNumber ? input.flightNumber.toUpperCase() : undefined;
  const mergedDetails: FlightDetails = {
    ...existingDetails,
    kind: 'flight' as const,
    ...omitUndefined({
      flightNumber: newFlightNumber,
      seat: input.seat,
      terminal: input.terminal,
      gate: input.gate,
    }),
  };

  const updated = await updateTripBooking(userId, input.bookingId, {
    ...omitUndefined({
      title: input.title,
      provider: input.provider,
      startAt: input.departureAt ? new Date(input.departureAt) : undefined,
      endAt: input.arrivalAt ? new Date(input.arrivalAt) : undefined,
      confirmationNumber: input.confirmationNumber,
      referenceLink: input.referenceLink,
      notes: input.notes,
      timezone: input.timezone,
      lat: input.lat,
      lng: input.lng,
    }),
    details: mergedDetails,
  });

  if (!updated) throw new HandledError(`Failed to update flight booking ${input.bookingId}.`);

  // Re-link live tracking if the flight number changed.
  if (newFlightNumber) {
    const departureDate = (input.departureAt ?? existing.startAt?.toISOString() ?? '').slice(0, 10);
    if (departureDate) {
      try {
        const fd = await upsertFlightData(newFlightNumber, departureDate);
        await linkBookingToFlightData(input.bookingId, fd.id);
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
  bookingId: z.number().int().positive().describe('ID of the booking to remove.'),
});

export const travelRemoveBookingTool: ToolHandler<typeof TravelRemoveBookingSchema.shape> = async (input, context) => {
  const { userId } = context;

  const removed = await deleteTripBooking(userId, input.bookingId);
  if (!removed) throw new HandledError(`Booking ${input.bookingId} not found or already removed.`);

  return toolResponse({
    message: 'Booking removed.',
    bookingId: removed.id,
    title: removed.title,
  });
};
