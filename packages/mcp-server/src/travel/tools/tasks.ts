import { HandledError } from '../../shared/errors';
import { ToolHandler } from '../../shared/types';
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
import type { TripPlace } from '@my-hub/shared/types';
import { TripDocumentTypes, tripDocumentTypeValues } from '@my-hub/shared/constants';
import type { TripDocumentType } from '@my-hub/shared/types';
import { toolResponse } from '../../shared/toolsUtils';

const DocumentTypeSchema = z.enum(tripDocumentTypeValues as [TripDocumentType, ...TripDocumentType[]]);

export const TravelPlanTripSchema = z.object({
  name: z.string().trim().min(1).describe('Trip name, for example: "Spring in Rome"'),
  destination: z.string().trim().min(1).describe('Main destination city or region'),
  startAt: z.string().datetime().optional().describe('Trip start datetime in ISO 8601. Optional.'),
  endAt: z.string().datetime().optional().describe('Trip end datetime in ISO 8601. Optional.'),
  notes: z.string().optional().describe('Optional travel notes or constraints.'),
  autoPrepareChecklist: z
    .boolean()
    .default(true)
    .optional()
    .describe('If true, create a starter checklist template automatically.'),
});

export const TravelPrepareTripChecklistSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID to prepare checklist for.'),
  includeDefaults: z.boolean().default(true).optional().describe('Include default trip-preparation checklist items.'),
});

const CompanionInputSchema = z.object({
  id: z.number().int().positive().optional().describe('Existing companion id for update actions.'),
  name: z.string().trim().min(1).describe('Companion name'),
  email: z.string().email().optional().describe('Companion email, optional'),
  phone: z.string().optional().describe('Companion phone number, optional'),
  notes: z.string().optional().describe('Extra notes, optional'),
});

export const TravelWhoIsTravelingSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID to manage companions for.'),
  add: z.array(CompanionInputSchema).optional().describe('Add one or more companions.'),
  update: z.array(CompanionInputSchema).optional().describe('Update existing companions (requires id).'),
  removeIds: z
    .array(z.number().int().positive())
    .optional()
    .describe('Companion ids to remove. If omitted, no removals happen.'),
});

const TripBriefSectionSchema = z.enum(['bookings', 'checklist', 'companions', 'documents', 'day_notes', 'places']);

export const TravelGetTripBriefSchema = z.object({
  tripId: z.number().int().positive().optional().describe('Trip ID. If omitted, use the next upcoming trip.'),
  include: z
    .array(TripBriefSectionSchema)
    .optional()
    .describe(
      'Sections to include in the response. ' +
        'Omit for a lightweight summary (trip info + counts only). ' +
        'Pass specific sections when you need full data: ' +
        '"bookings", "checklist", "companions", "documents", "day_notes", "places". ' +
        'When "day_notes" is included, each day is enriched with its linked place details.',
    ),
});

export const TravelAttachDocumentLinkSchema = z.object({
  tripId: z.number().int().positive().describe('Trip ID for the document.'),
  title: z.string().trim().min(1).describe('Document title, for example "Boarding pass".'),
  type: DocumentTypeSchema.default(TripDocumentTypes.Other).optional().describe('Document category.'),
  sourceUrl: z.string().url().describe('Link to the document (cloud drive, booking site, etc).'),
  notes: z.string().optional().describe('Optional notes about this document.'),
});

export const travelPlanTripTool: ToolHandler<typeof TravelPlanTripSchema.shape> = async (input, context) => {
  const { userId } = context;

  const trip = await createTrip(userId, {
    name: input.name,
    destination: input.destination,
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
    notes: input.notes ?? null,
    coverImageUrl: null,
  });

  const seededChecklist: string[] = [];

  if (input.autoPrepareChecklist ?? true) {
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
    seededChecklist,
  });
};

export const travelPrepareTripChecklistTool: ToolHandler<typeof TravelPrepareTripChecklistSchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;
  const trips = await getTrips(userId);
  const trip = trips.find(t => t.id === input.tripId);
  if (!trip) throw new HandledError(`Trip with id ${input.tripId} not found`);

  const added: string[] = [];

  if (input.includeDefaults ?? true) {
    const template = suggestChecklistTemplate(trip.destination ?? undefined);
    for (const title of template) {
      await addChecklistItem(userId, trip.id, { title, done: false });
      added.push(title);
    }
  }

  const overview = await getTripOverview(userId, trip.id);

  return toolResponse({
    message: 'Checklist prepared.',
    addedCount: added.length,
    addedItems: added,
    checklist: overview?.checklist ?? [],
  });
};

export const travelWhoIsTravelingTool: ToolHandler<typeof TravelWhoIsTravelingSchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;

  for (const companion of input.add ?? []) {
    await addTripCompanion(userId, input.tripId, {
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

  for (const companionId of input.removeIds ?? []) {
    await deleteTripCompanion(userId, companionId);
  }

  const companions = await getTripCompanions(userId, input.tripId);

  return toolResponse({
    message: 'Companion list updated.',
    companions,
  });
};

export const travelGetTripBriefTool: ToolHandler<typeof TravelGetTripBriefSchema.shape> = async (input, context) => {
  const { userId } = context;
  const overview = await getTripBrief(userId, input.tripId);

  if (!overview) {
    return toolResponse({ message: 'No matching trip found.', trip: null });
  }

  const include = new Set(input.include ?? []);
  const placesById = new Map<number, TripPlace>(overview.places.map(p => [p.id, p]));

  const response: Record<string, unknown> = {
    message: 'Trip brief generated.',
    trip: overview.trip,
    counts: {
      bookings: overview.bookings.length,
      places: overview.places.length,
      checklist: overview.checklist.length,
      companions: overview.companions.length,
      documents: overview.documents.length,
      dayNotes: overview.dayNotes.length,
    },
  };

  if (include.has('bookings')) response.bookings = overview.bookings;
  if (include.has('checklist')) response.checklist = overview.checklist;
  if (include.has('companions')) response.companions = overview.companions;
  if (include.has('documents')) response.documents = overview.documents;
  if (include.has('places')) response.places = overview.places;
  if (include.has('day_notes')) {
    response.dayNotes = overview.dayNotes.map(day => ({
      ...day,
      places: (day.placeIds ?? []).map(id => placesById.get(id)).filter(Boolean),
    }));
  }

  return toolResponse(response);
};

export const travelAttachDocumentLinkTool: ToolHandler<typeof TravelAttachDocumentLinkSchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;

  const document = await addTripDocument(userId, input.tripId, {
    type: (input.type ?? TripDocumentTypes.Other) as TripDocumentType,
    title: input.title,
    notes: input.notes ?? null,
    sourceUrl: input.sourceUrl,
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
