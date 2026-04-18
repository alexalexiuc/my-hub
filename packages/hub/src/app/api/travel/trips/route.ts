import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { formatZodError } from '@/lib/api/with-error-logging';
import { createTrip, getAccessibleTrips, getTripBookingRangesByTripIds } from '@my-hub/shared/services';
import { parseAndValidateDate } from '@/lib/api/date-validation';
import { TripCreateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ user }) => {
  const accessibleTrips = await getAccessibleTrips(user.id);
  const ranges = await getTripBookingRangesByTripIds(accessibleTrips.map(item => item.trip.id));

  return NextResponse.json({
    trips: accessibleTrips.map(item => ({
      ...item.trip,
      ownerUserId: item.ownerUserId,
      ownerName: item.ownerName,
      ownerEmail: item.ownerEmail,
      accessRole: item.accessRole,
      canEdit: item.accessRole === 'owner',
      permission: item.permission,
    })),
    bookingRanges: ranges,
  });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TripCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { data } = parsed;

  const { date: startAt, error: startAtError } = parseAndValidateDate(data.startAt, 'startAt');
  if (startAtError) return NextResponse.json({ error: startAtError }, { status: 400 });

  const { date: endAt, error: endAtError } = parseAndValidateDate(data.endAt, 'endAt');
  if (endAtError) return NextResponse.json({ error: endAtError }, { status: 400 });

  const trip = await createTrip(user.id, {
    name: data.name,
    color: data.color,
    destination: data.destination?.trim() || null,
    startAt,
    endAt,
    notes: data.notes ?? null,
    coverImageUrl: null,
  });

  return NextResponse.json({ trip }, { status: 201 });
});
