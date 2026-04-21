import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { deleteTripDay, getTripDays, upsertTripDay } from '@my-hub/shared/services';
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
  notes: z.string().optional().describe('Free-text notes for the day. Markdown is supported.'),
});

export const travelUpsertDayNoteTool: ToolCallback<typeof TravelUpsertDayNoteSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;

  const day = await upsertTripDay(userId, input.tripId, input.date, {
    title: input.title ?? null,
    notes: input.notes ?? null,
  });

  return toolResponse({ message: 'Day note saved.', day });
};

// ---------------------------------------------------------------------------
// travel_get_day_notes
// ---------------------------------------------------------------------------

export const TravelGetDayNotesSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID to retrieve day notes for.'),
});

export const travelGetDayNotesTool: ToolCallback<typeof TravelGetDayNotesSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;

  const days = await getTripDays(userId, input.tripId);

  return toolResponse({ days });
};

// ---------------------------------------------------------------------------
// travel_delete_day_note
// ---------------------------------------------------------------------------

export const TravelDeleteDayNoteSchema = z.object({
  id: z.number().int().positive().describe('ID of the day note to delete.'),
});

export const travelDeleteDayNoteTool: ToolCallback<typeof TravelDeleteDayNoteSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;

  const removed = await deleteTripDay(userId, input.id);
  if (!removed) throw new Error(`Day note ${input.id} not found or already removed.`);

  return toolResponse({ message: 'Day note deleted.', id: removed.id, date: removed.date });
};
