import { route, routeHttpError, created } from '@/lib/api/route';
import { addTripDocument, deleteTripDocument } from '@my-hub/shared/services';
import type { TripDocumentType } from '@my-hub/shared/types';
import { TripDocumentTypes, tripDocumentTypeValues } from '@my-hub/shared/constants';
import { z } from 'zod';

const DocumentCreateSchema = z.object({
  tripId: z.number().int().positive('tripId is required'),
  bookingId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1, 'title is required'),
  type: z.enum(tripDocumentTypeValues as [string, ...string[]]).optional(),
  notes: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
});

const DocumentDeleteQuerySchema = z.object({
  id: z.coerce.number().int().positive('id is required'),
});

export const POST = route({ body: DocumentCreateSchema })(async ({ user, body }) => {
  const type = (body.type as TripDocumentType | undefined) ?? TripDocumentTypes.Other;

  let document;
  try {
    document = await addTripDocument(user.id, body.tripId, {
      type,
      bookingId: body.bookingId ?? null,
      title: body.title,
      notes: body.notes ?? null,
      sourceUrl: body.sourceUrl ?? null,
      originalName: null,
      mimeType: null,
      byteSize: null,
      storagePath: null,
      publicUrl: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create document';
    if (message === 'Trip not found') {
      routeHttpError(404, { error: message });
    }
    if (message === 'bookingId does not belong to this trip') {
      routeHttpError(400, { error: message });
    }
    throw error;
  }

  return created({ document });
});

export const DELETE = route({ query: DocumentDeleteQuerySchema })(async ({ user, query }) => {
  const document = await deleteTripDocument(user.id, query.id);
  if (!document) routeHttpError(404, { error: 'Document not found' });
  return { document };
});
