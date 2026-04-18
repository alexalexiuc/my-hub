import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { addTripDocument, deleteTripDocument } from '@my-hub/shared/services';
import type { TripDocumentType } from '@my-hub/shared/types';
import { TripDocumentTypes, tripDocumentTypeValues } from '@my-hub/shared/constants';

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = Number(body.tripId);
  const { bookingId: bookingIdRaw } = body;
  const bookingId =
    bookingIdRaw === null || bookingIdRaw === undefined || bookingIdRaw === '' ? null : Number(bookingIdRaw);
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
  }
  if (bookingId !== null && (!Number.isInteger(bookingId) || bookingId <= 0)) {
    return NextResponse.json({ error: 'bookingId must be a positive integer' }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const type =
    typeof body.type === 'string' && tripDocumentTypeValues.includes(body.type as TripDocumentType)
      ? (body.type as TripDocumentType)
      : TripDocumentTypes.Other;

  let document;
  try {
    document = await addTripDocument(user.id, tripId, {
      type,
      bookingId,
      title,
      notes: typeof body.notes === 'string' ? body.notes : null,
      sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : null,
      originalName: null,
      mimeType: null,
      byteSize: null,
      storagePath: null,
      publicUrl: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create document';
    if (message === 'Trip not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'bookingId does not belong to this trip') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ document }, { status: 201 });
});

export const DELETE = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const document = await deleteTripDocument(user.id, id);
  if (!document) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  return NextResponse.json({ document });
});
