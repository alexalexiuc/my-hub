import { ToolHandler } from '../../shared/types';
import { z } from 'zod';
import { addTripPlace, deleteTripPlace, getTripPlaces, updateTripPlace } from '@my-hub/shared/services';
import { TripPlacePriorities, tripPlacePriorityValues } from '@my-hub/shared/constants';
import type { TripPlacePriority } from '@my-hub/shared/types';
import { omitUndefined } from '@my-hub/shared/utils';
import { toolResponse } from '../../shared/toolsUtils';

const PrioritySchema = z.enum(tripPlacePriorityValues as [TripPlacePriority, ...TripPlacePriority[]]);

const locationGuidance =
  'Provide a precise address or landmark with city, e.g. "Piazza del Colosseo 1, 00184 Rome, Italy". ' +
  'If you have lat/lng, include those too — they produce a more accurate map pin.';

const PlaceAddSchema = z.object({
  name: z.string().trim().min(1).describe('Place name, e.g. "Colosseum" or "Hilton Roma Est".'),
  location: z.string().optional().describe(`Full address or landmark description. ${locationGuidance}`),
  notes: z.string().optional().describe('Optional notes about the place.'),
  priority: PrioritySchema.optional().describe('Visit priority: low, medium (default), or high.'),
  visited: z.boolean().optional().describe('Mark as already visited. Default false.'),
  lat: z.number().optional().describe('Latitude in decimal degrees.'),
  lng: z.number().optional().describe('Longitude in decimal degrees.'),
});

const PlaceUpdateSchema = PlaceAddSchema.partial().extend({
  id: z.number().int().positive().describe('ID of the place to update.'),
});

// ---------------------------------------------------------------------------
// travel_manage_places
// ---------------------------------------------------------------------------

export const TravelManagePlacesSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID to manage places for.'),
  add: z
    .array(PlaceAddSchema)
    .optional()
    .describe(
      `Places to add. ${locationGuidance} ` +
        'After adding, the returned place IDs can be passed to travel_upsert_day_note to link places to days.',
    ),
  update: z
    .array(PlaceUpdateSchema)
    .optional()
    .describe('Places to update (requires id). Only provided fields are changed; omitted fields are preserved.'),
  removeIds: z
    .array(z.number().int().positive())
    .optional()
    .describe('IDs of places to remove. Use when a location is no longer relevant.'),
});

export const travelManagePlacesTool: ToolHandler<typeof TravelManagePlacesSchema.shape> = async (input, context) => {
  const { userId } = context;

  for (const place of input.add ?? []) {
    await addTripPlace(userId, input.tripId, {
      name: place.name,
      location: place.location ?? null,
      notes: place.notes ?? null,
      priority: place.priority ?? TripPlacePriorities.Medium,
      visited: place.visited ?? false,
      lat: place.lat ?? null,
      lng: place.lng ?? null,
    });
  }

  for (const place of input.update ?? []) {
    await updateTripPlace(
      userId,
      place.id,
      omitUndefined({
        name: place.name,
        location: place.location,
        notes: place.notes,
        priority: place.priority,
        visited: place.visited,
        lat: place.lat,
        lng: place.lng,
      }),
    );
  }

  for (const placeId of input.removeIds ?? []) {
    await deleteTripPlace(userId, placeId);
  }

  const places = await getTripPlaces(userId, input.tripId);

  return toolResponse({ message: 'Places updated.', places });
};

// ---------------------------------------------------------------------------
// travel_get_places
// ---------------------------------------------------------------------------

export const TravelGetPlacesSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID to retrieve places for.'),
});

export const travelGetPlacesTool: ToolHandler<typeof TravelGetPlacesSchema.shape> = async (input, context) => {
  const { userId } = context;
  const places = await getTripPlaces(userId, input.tripId);
  return toolResponse({ places });
};
