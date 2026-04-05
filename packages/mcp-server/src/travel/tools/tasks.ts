import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  addChecklistItem,
  addTripCompanion,
  addTripDocument,
  createTrip,
  deleteTripCompanion,
  getTripBrief,
  getTripCompanions,
  getTripOverview,
  getTrips,
  suggestChecklistTemplate,
  updateTripCompanion,
} from '@my-hub/shared/services';
import type { TripDocumentType } from '@my-hub/shared/types';
import { toolResponse } from '../../shared/toolsUtils';

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
