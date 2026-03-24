import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { addTripDocument, deleteTripDocument } from '@my-hub/shared/services';
import type { TripDocumentType } from '@my-hub/shared/types';

const documentTypes: TripDocumentType[] = ['passport', 'visa', 'boarding_pass', 'voucher', 'ticket', 'other'];

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = Number(body.trip_id);
  const bookingIdRaw = body.booking_id;
  const bookingId =
    bookingIdRaw === null || bookingIdRaw === undefined || bookingIdRaw === '' ? null : Number(bookingIdRaw);
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
  }
  if (bookingId !== null && (!Number.isInteger(bookingId) || bookingId <= 0)) {
    return NextResponse.json({ error: 'booking_id must be a positive integer' }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const type =
    typeof body.type === 'string' && documentTypes.includes(body.type as TripDocumentType)
      ? (body.type as TripDocumentType)
      : 'other';

  const document = await addTripDocument(user.id, tripId, {
    type,
    bookingId,
    title,
    notes: typeof body.notes === 'string' ? body.notes : null,
    sourceUrl: typeof body.source_url === 'string' ? body.source_url : null,
    originalName: null,
    mimeType: null,
    byteSize: null,
    storagePath: null,
    publicUrl: null,
  });

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
