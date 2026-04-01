import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  addChecklistItem,
  addTripBooking,
  addTripCompanion,
  addTripDocument,
  createTrip,
  deleteTripCompanion,
  getTripBrief,
  getTripCompanions,
  getTripOverview,
  getTrips,
  linkBookingToFlightData,
  suggestChecklistTemplate,
  updateTripCompanion,
  upsertFlightData,
} from '@my-hub/shared/services';
import type { TripBookingType, TripDocumentType } from '@my-hub/shared/types';
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

const DocumentTypeSchema = z.enum(['passport', 'visa', 'boarding_pass', 'voucher', 'ticket', 'other']);

export const TravelPlanTripSchema = z.object({
  name: z.string().min(1).describe('Trip name, for example: "Spring in Rome"'),
  destination: z.string().min(1).describe('Main destination city or region'),
  start_at: z.string().datetime().optional().describe('Trip start datetime in ISO 8601. Optional.'),
  end_at: z.string().datetime().optional().describe('Trip end datetime in ISO 8601. Optional.'),
  notes: z.string().optional().describe('Optional travel notes or constraints.'),
  auto_prepare_checklist: z
    .boolean()
    .default(true)
    .optional()
    .describe('If true, create a starter checklist template automatically.'),
});

export const TravelAddReservationFromTextSchema = z.object({
  trip_id: z.number().int().positive().describe('Trip ID where the reservation should be added.'),
  booking_text: z
    .string()
    .min(5)
    .describe('Raw confirmation text from chat/email/notes. The full text is stored for later extraction.'),
  booking_type: BookingTypeSchema.optional().describe('Optional booking type if known.'),
  title: z.string().optional().describe('Short reservation title. If omitted, fallback title is generated.'),
  provider: z.string().optional().describe('Airline/hotel/provider name if already known.'),
  location: z.string().optional().describe('Location or route summary for this reservation.'),
  start_at: z.string().datetime().optional().describe('Start datetime in ISO 8601 if known.'),
  end_at: z.string().datetime().optional().describe('End datetime in ISO 8601 if known.'),
  confirmation_number: z.string().optional().describe('Confirmation reference if available.'),
  // Flight-specific fields — extract from booking text when booking_type is "flight"
  flight_number: z
    .string()
    .optional()
    .describe('IATA flight number extracted from the booking text, e.g. "BA2490". Extract this whenever possible.'),
  seat: z.string().optional().describe('Seat assignment, e.g. "14A".'),
  origin_iata: z
    .string()
    .length(3)
    .optional()
    .describe('3-letter IATA code of the departure airport, e.g. "LHR". Extract from the booking text.'),
  destination_iata: z
    .string()
    .length(3)
    .optional()
    .describe('3-letter IATA code of the arrival airport, e.g. "CDG". Extract from the booking text.'),
  terminal: z.string().optional().describe('Departure terminal, if mentioned.'),
  gate: z.string().optional().describe('Departure gate, if mentioned.'),
  aircraft_type: z.string().optional().describe('Aircraft type or model, e.g. "A320", if mentioned.'),
});

export const TravelPrepareTripChecklistSchema = z.object({
  trip_id: z.number().int().positive().describe('Trip ID to prepare checklist for.'),
  include_defaults: z.boolean().default(true).optional().describe('Include default trip-preparation checklist items.'),
});

const CompanionInputSchema = z.object({
  id: z.number().int().positive().optional().describe('Existing companion id for update actions.'),
  name: z.string().min(1).describe('Companion name'),
  email: z.string().email().optional().describe('Companion email, optional'),
  phone: z.string().optional().describe('Companion phone number, optional'),
  notes: z.string().optional().describe('Extra notes, optional'),
});

export const TravelWhoIsTravelingSchema = z.object({
  trip_id: z.number().int().positive().describe('Trip ID to manage companions for.'),
  add: z.array(CompanionInputSchema).optional().describe('Add one or more companions.'),
  update: z.array(CompanionInputSchema).optional().describe('Update existing companions (requires id).'),
  remove_ids: z
    .array(z.number().int().positive())
    .optional()
    .describe('Companion ids to remove. If omitted, no removals happen.'),
});

export const TravelGetTripBriefSchema = z.object({
  trip_id: z.number().int().positive().optional().describe('Trip ID. If omitted, use the next upcoming trip.'),
});

export const TravelAttachDocumentLinkSchema = z.object({
  trip_id: z.number().int().positive().describe('Trip ID for the document.'),
  title: z.string().min(1).describe('Document title, for example "Boarding pass".'),
  type: DocumentTypeSchema.default('other').optional().describe('Document category.'),
  source_url: z.string().url().describe('Link to the document (cloud drive, booking site, etc).'),
  notes: z.string().optional().describe('Optional notes about this document.'),
});

export const travelPlanTripTool: ToolCallback<typeof TravelPlanTripSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const trip = await createTrip(userId, {
    name: input.name,
    destination: input.destination,
    startAt: input.start_at ? new Date(input.start_at) : null,
    endAt: input.end_at ? new Date(input.end_at) : null,
    notes: input.notes ?? null,
    coverImageUrl: null,
  });

  const seededChecklist: string[] = [];

  if (input.auto_prepare_checklist ?? true) {
    const template = suggestChecklistTemplate(input.destination);
    for (const title of template) {
      await addChecklistItem(userId, trip.id, {
        title,
        done: false,
      });
      seededChecklist.push(title);
    }
  }

  return toolResponse({
    message: 'Trip planned successfully.',
    trip,
    seeded_checklist: seededChecklist,
  });
};

export const travelAddReservationFromTextTool: ToolCallback<typeof TravelAddReservationFromTextSchema.shape> = async (
  input,
  extra,
) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const bookingType = (input.booking_type ?? 'other') as TripBookingType;
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
    details: {
      source: 'nl_import',
      raw_text: input.booking_text,
      ...(input.flight_number && { flight_number: input.flight_number }),
      ...(input.seat && { seat: input.seat }),
      ...(input.origin_iata && { origin_iata: input.origin_iata }),
      ...(input.destination_iata && { destination_iata: input.destination_iata }),
      ...(input.terminal && { terminal: input.terminal }),
      ...(input.gate && { gate: input.gate }),
      ...(input.aircraft_type && { aircraft_type: input.aircraft_type }),
    },
  });

  // When we have a flight number + departure date, create/find a flight_data row
  // so the background worker will start polling for live updates automatically.
  if (bookingType === 'flight' && input.flight_number && input.start_at) {
    try {
      const flightDate = input.start_at.slice(0, 10); // YYYY-MM-DD
      const fd = await upsertFlightData(input.flight_number, flightDate);
      await linkBookingToFlightData(booking.id, fd.id);
    } catch {
      // Non-fatal: booking is already saved; worker link can be added later.
    }
  }

  return toolResponse({
    message: 'Reservation captured from text.',
    booking,
  });
};

export const travelPrepareTripChecklistTool: ToolCallback<typeof TravelPrepareTripChecklistSchema.shape> = async (
  input,
  extra,
) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const trips = await getTrips(userId);
  const trip = trips.find((t) => t.id === input.trip_id);
  if (!trip) throw new Error(`Trip with id ${input.trip_id} not found`);

  const added: string[] = [];

  if (input.include_defaults ?? true) {
    const template = suggestChecklistTemplate(trip.destination ?? undefined);
    for (const title of template) {
      await addChecklistItem(userId, trip.id, { title, done: false });
      added.push(title);
    }
  }

  const overview = await getTripOverview(userId, trip.id);

  return toolResponse({
    message: 'Checklist prepared.',
    added_count: added.length,
    added_items: added,
    checklist: overview?.checklist ?? [],
  });
};

export const travelWhoIsTravelingTool: ToolCallback<typeof TravelWhoIsTravelingSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  for (const companion of input.add ?? []) {
    await addTripCompanion(userId, input.trip_id, {
      name: companion.name,
      email: companion.email ?? null,
      phone: companion.phone ?? null,
      notes: companion.notes ?? null,
    });
  }

  for (const companion of input.update ?? []) {
    if (!companion.id) continue;
    await updateTripCompanion(userId, companion.id, {
      name: companion.name,
      email: companion.email ?? null,
      phone: companion.phone ?? null,
      notes: companion.notes ?? null,
    });
  }

  for (const companionId of input.remove_ids ?? []) {
    await deleteTripCompanion(userId, companionId);
  }

  const companions = await getTripCompanions(userId, input.trip_id);

  return toolResponse({
    message: 'Companion list updated.',
    companions,
  });
};

export const travelGetTripBriefTool: ToolCallback<typeof TravelGetTripBriefSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const overview = await getTripBrief(userId, input.trip_id);

  if (!overview) {
    return toolResponse({
      message: 'No matching trip found.',
      trip: null,
    });
  }

  return toolResponse({
    message: 'Trip brief generated.',
    trip: overview.trip,
    counts: {
      bookings: overview.bookings.length,
      places: overview.places.length,
      checklist: overview.checklist.length,
      companions: overview.companions.length,
      documents: overview.documents.length,
    },
    bookings: overview.bookings,
    checklist: overview.checklist,
    companions: overview.companions,
  });
};

export const travelAttachDocumentLinkTool: ToolCallback<typeof TravelAttachDocumentLinkSchema.shape> = async (
  input,
  extra,
) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const document = await addTripDocument(userId, input.trip_id, {
    type: (input.type ?? 'other') as TripDocumentType,
    title: input.title,
    notes: input.notes ?? null,
    sourceUrl: input.source_url,
    originalName: null,
    mimeType: null,
    byteSize: null,
    storagePath: null,
    publicUrl: null,
  });

  return toolResponse({
    message: 'Document link attached to trip.',
    document,
  });
};
