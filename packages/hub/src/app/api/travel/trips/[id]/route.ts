import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTrip, updateTrip } from '@my-hub/shared/services';
import { parseAndValidateDateForPatch } from '@/lib/api/date-validation';
import { TripUpdateSchema } from '@my-hub/shared/schemas';
import { omitUndefined, trimOrNull } from '@my-hub/shared/utils';

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TripUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;

  const { date: startAt, error: startAtError } = parseAndValidateDateForPatch(data.startAt, 'startAt');
  if (startAtError) return NextResponse.json({ error: startAtError }, { status: 400 });

  const { date: endAt, error: endAtError } = parseAndValidateDateForPatch(data.endAt, 'endAt');
  if (endAtError) return NextResponse.json({ error: endAtError }, { status: 400 });

  const { date: cancelledAt, error: cancelledAtError } = parseAndValidateDateForPatch(data.cancelledAt, 'cancelledAt');
  if (cancelledAtError) return NextResponse.json({ error: cancelledAtError }, { status: 400 });

  const trip = await updateTrip(
    user.id,
    tripId,
    omitUndefined({
      name: data.name,
      destination: trimOrNull(data.destination),
      color: data.color,
      startAt,
      endAt,
      cancelledAt,
      notes: data.notes,
      coverImageUrl: data.coverImageUrl,
    }),
  );

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
