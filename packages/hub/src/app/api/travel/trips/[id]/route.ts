import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTrip, updateTrip } from '@my-hub/shared/services';
import { parseAndValidateDateForPatch } from '@/lib/api/date-validation';

const hexColorRe = /^#[0-9A-F]{6}$/i;

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { date: startAt, error: startAtError } = parseAndValidateDateForPatch(body.start_at, 'start_at');
  if (startAtError) {
    return NextResponse.json({ error: startAtError }, { status: 400 });
  }

  const { date: endAt, error: endAtError } = parseAndValidateDateForPatch(body.end_at, 'end_at');
  if (endAtError) {
    return NextResponse.json({ error: endAtError }, { status: 400 });
  }

  const { date: cancelledAt, error: cancelledAtError } = parseAndValidateDateForPatch(
    body.cancelled_at,
    'cancelled_at',
  );
  if (cancelledAtError) {
    return NextResponse.json({ error: cancelledAtError }, { status: 400 });
  }

  const trip = await updateTrip(user.id, tripId, {
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    destination: typeof body.destination === 'string' ? body.destination.trim() || null : undefined,
    color: typeof body.color === 'string' && hexColorRe.test(body.color) ? body.color : undefined,
    startAt,
    endAt,
    cancelledAt,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
    coverImageUrl: typeof body.cover_image_url === 'string' ? body.cover_image_url : undefined,
  });

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  return NextResponse.json({ trip });
});

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  const trip = await deleteTrip(user.id, tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  return NextResponse.json({ trip });
});
