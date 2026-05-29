import { HandledError } from '../../shared/errors';
import { ToolHandler } from '../../shared/types';
import { z } from 'zod';
import { deleteTripDay, getTripDays, getTripPlaces, upsertTripDay } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';

// ---------------------------------------------------------------------------
// travel_upsert_day_note
// ---------------------------------------------------------------------------

export const TravelUpsertDayNoteSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID the day belongs to.'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be an ISO date string, e.g. "2026-06-21"')
    .describe('Calendar date for this day entry, e.g. "2026-06-21".'),
  title: z.string().optional().describe('Short label for the day, e.g. "Travel day" or "Day at the beach".'),
  notes: z
    .string()
    .optional()
    .describe(
      'Free-text notes for the day. Markdown is supported. ' +
        'When referencing places in the notes, first ensure they exist as trip places (use travel_get_trip_brief to see existing places). ' +
        'Then pass their IDs via placeIds — this links them as interactive map chips in the UI.',
    ),
  placeIds: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      'IDs of trip places to associate with this day. ' +
        'Obtain IDs from existing places returned by travel_get_trip_brief. ' +
        'If a place does not exist yet and the user mentions visiting a specific location, ' +
        'create it first (with precise coordinates or a full address) so it can be linked here. ' +
        'Location should be a specific street address, landmark name with city, or lat/lng coordinates — ' +
        'not a vague description. Omit to preserve the current place associations.',
    ),
});

export const travelUpsertDayNoteTool: ToolHandler<typeof TravelUpsertDayNoteSchema.shape> = async (input, context) => {
  const { userId } = context;

  const day = await upsertTripDay(userId, input.tripId, input.date, {
    title: input.title ?? null,
    notes: input.notes ?? null,
    placeIds: input.placeIds,
  });

  return toolResponse({ message: 'Day note saved.', day });
};

// ---------------------------------------------------------------------------
// travel_get_day_notes
// ---------------------------------------------------------------------------

export const TravelGetDayNotesSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID to retrieve day notes for.'),
});

export const travelGetDayNotesTool: ToolHandler<typeof TravelGetDayNotesSchema.shape> = async (input, context) => {
  const { userId } = context;

  const [days, places] = await Promise.all([getTripDays(userId, input.tripId), getTripPlaces(userId, input.tripId)]);

  const placesById = new Map(places.map(p => [p.id, p]));

  const daysWithPlaces = days.map(day => ({
    ...day,
    places: (day.placeIds ?? []).map(id => placesById.get(id)).filter(Boolean),
  }));

  return toolResponse({ days: daysWithPlaces });
};

// ---------------------------------------------------------------------------
// travel_delete_day_note
// ---------------------------------------------------------------------------

export const TravelDeleteDayNoteSchema = z.object({
  id: z.number().int().positive().describe('ID of the day note to delete.'),
});

export const travelDeleteDayNoteTool: ToolHandler<typeof TravelDeleteDayNoteSchema.shape> = async (input, context) => {
  const { userId } = context;

  const removed = await deleteTripDay(userId, input.id);
  if (!removed) throw new HandledError(`Day note ${input.id} not found or already removed.`);

  return toolResponse({ message: 'Day note deleted.', id: removed.id, date: removed.date });
};
