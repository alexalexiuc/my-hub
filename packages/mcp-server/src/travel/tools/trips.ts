import { z } from 'zod';
import {
  addChecklistItem,
  deleteChecklistItem,
  deleteTrip,
  getChecklistItems,
  listTripSummaries,
  updateChecklistItem,
  updateTripDetails,
  verifyTripOwnership,
} from '@my-hub/shared/services';
import { tripStatusValues } from '@my-hub/shared/constants';
import type { TripStatus } from '@my-hub/shared/types';
import { omitUndefined } from '@my-hub/shared/utils';
import { HandledError } from '../../shared/errors';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import type { ToolHandler } from '../../shared/types';

const TripStatusSchema = z.enum(tripStatusValues as [TripStatus, ...TripStatus[]]);
const tripIdSchema = z.number().int().positive();

/** ISO datetime → Date, null → null (clear), undefined → undefined (keep). */
function toDateOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

// ---------------------------------------------------------------------------
// travel_list_trips
// ---------------------------------------------------------------------------

export const TravelListTripsSchema = z.object({
  status: z
    .array(TripStatusSchema)
    .optional()
    .describe(
      'Keep only trips with these statuses: "planned" (not started yet — upcoming), "active" (in progress), ' +
        '"completed", "cancelled". Omit for all.',
    ),
  from: yyyyMmDdSchema
    .optional()
    .describe('Keep only trips that end on or after this date (YYYY-MM-DD). Undated trips are left out.'),
  to: yyyyMmDdSchema
    .optional()
    .describe('Keep only trips that start on or before this date (YYYY-MM-DD). Undated trips are left out.'),
});

export const travelListTripsTool: ToolHandler<typeof TravelListTripsSchema.shape> = async (input, { userId }) => {
  const trips = await listTripSummaries(userId, {
    statuses: input.status,
    from: input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined,
    to: input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined,
  });

  return toolResponse({
    message: trips.length ? `Found ${trips.length} trip(s).` : 'No matching trips.',
    trips,
  });
};

// ---------------------------------------------------------------------------
// travel_update_trip
// ---------------------------------------------------------------------------

export const TravelUpdateTripSchema = z.object({
  tripId: tripIdSchema.describe('ID of the trip to change (see travel_list_trips).'),
  name: z.string().trim().min(1).optional().describe('New trip name.'),
  destination: z.string().trim().min(1).nullable().optional().describe('New main destination. null clears it.'),
  startAt: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional()
    .describe('Trip start in ISO 8601. null clears it (the trip then takes its dates from its bookings).'),
  endAt: z.string().datetime({ offset: true }).nullable().optional().describe('Trip end in ISO 8601. null clears it.'),
  notes: z.string().nullable().optional().describe('Replace the trip notes. null clears them.'),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Must be a hex color (#RRGGBB)')
    .optional()
    .describe('Trip colour as #RRGGBB.'),
  cancelled: z
    .boolean()
    .optional()
    .describe('true marks the trip cancelled (keeps all its data); false reinstates it.'),
});

export const travelUpdateTripTool: ToolHandler<typeof TravelUpdateTripSchema.shape> = async (input, { userId }) => {
  const trip = await updateTripDetails(
    userId,
    input.tripId,
    omitUndefined({
      name: input.name,
      destination: input.destination,
      startAt: toDateOrNull(input.startAt),
      endAt: toDateOrNull(input.endAt),
      notes: input.notes,
      color: input.color,
      cancelledAt: input.cancelled === undefined ? undefined : input.cancelled ? new Date() : null,
    }),
  );

  return toolResponse({ message: 'Trip updated.', trip });
};

// ---------------------------------------------------------------------------
// travel_delete_trip
// ---------------------------------------------------------------------------

export const TravelDeleteTripSchema = z.object({
  tripId: tripIdSchema.describe('ID of the trip to delete permanently.'),
});

export const travelDeleteTripTool: ToolHandler<typeof TravelDeleteTripSchema.shape> = async (input, { userId }) => {
  const deleted = await deleteTrip(userId, input.tripId);
  if (!deleted) throw new HandledError(`Trip ${input.tripId} not found.`);

  return toolResponse({
    message: `Trip "${deleted.name}" and everything in it (bookings, places, checklist, day notes, documents) was deleted.`,
    deletedTripId: deleted.id,
  });
};

// ---------------------------------------------------------------------------
// travel_manage_checklist
// ---------------------------------------------------------------------------

const ChecklistUpdateSchema = z.object({
  id: z.number().int().positive().describe('Checklist item ID.'),
  title: z.string().trim().min(1).optional().describe('New item text.'),
  done: z.boolean().optional().describe('true checks the item off, false un-checks it.'),
});

export const TravelManageChecklistSchema = z.object({
  tripId: tripIdSchema.describe('Trip ID whose checklist to change.'),
  add: z.array(z.string().trim().min(1)).optional().describe('Titles of new checklist items.'),
  update: z.array(ChecklistUpdateSchema).optional().describe('Items to rename or check off / un-check.'),
  removeIds: z.array(z.number().int().positive()).optional().describe('IDs of checklist items to remove.'),
});

export const travelManageChecklistTool: ToolHandler<typeof TravelManageChecklistSchema.shape> = async (
  input,
  { userId },
) => {
  if (!(await verifyTripOwnership(userId, input.tripId))) throw new HandledError(`Trip ${input.tripId} not found.`);

  const owned = new Set((await getChecklistItems(userId, input.tripId)).map(item => item.id));
  const foreign = [...(input.update ?? []).map(u => u.id), ...(input.removeIds ?? [])].filter(id => !owned.has(id));
  if (foreign.length) {
    throw new HandledError(`Checklist item(s) ${foreign.join(', ')} not found on trip ${input.tripId}.`);
  }

  for (const title of input.add ?? []) {
    await addChecklistItem(userId, input.tripId, { title, done: false });
  }
  for (const item of input.update ?? []) {
    await updateChecklistItem(userId, item.id, omitUndefined({ title: item.title, done: item.done }));
  }
  for (const id of input.removeIds ?? []) {
    await deleteChecklistItem(userId, id);
  }

  const checklist = await getChecklistItems(userId, input.tripId);
  return toolResponse({
    message: 'Checklist updated.',
    remaining: checklist.filter(item => !item.done).length,
    checklist,
  });
};
