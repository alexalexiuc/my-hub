import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createTrip, getAccessibleTrips, getTripBookingRangesByTripIds } from '@my-hub/shared/services';
import { parseAndValidateDate } from '@/lib/api/date-validation';
import { TripCreateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ user }) => {
  const accessibleTrips = await getAccessibleTrips(user.id);
  const ranges = await getTripBookingRangesByTripIds(accessibleTrips.map((item) => item.trip.id));

  return NextResponse.json({
    trips: accessibleTrips.map((item) => ({
      ...item.trip,
      owner_user_id: item.ownerUserId,
      owner_name: item.ownerName,
      owner_email: item.ownerEmail,
      access_role: item.accessRole,
      can_edit: item.accessRole === 'owner',
      permission: item.permission,
    })),
    booking_ranges: ranges,
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
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const { date: startAt, error: startAtError } = parseAndValidateDate(data.start_at, 'start_at');
  if (startAtError) return NextResponse.json({ error: startAtError }, { status: 400 });

  const { date: endAt, error: endAtError } = parseAndValidateDate(data.end_at, 'end_at');
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
