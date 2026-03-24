import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { createTrip, getAccessibleTrips, getTripBookingRangesByTripIds } from '@my-hub/shared/services';
import type { TripStatus } from '@my-hub/shared/types';
import { parseAndValidateDate } from '@/lib/api/date-validation';

const tripStatuses: TripStatus[] = ['planned', 'active', 'completed', 'cancelled'];
const hexColorRe = /^#[0-9A-F]{6}$/i;

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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const destination = typeof body.destination === 'string' ? body.destination.trim() : null;
  const status =
    typeof body.status === 'string' && tripStatuses.includes(body.status as TripStatus)
      ? (body.status as TripStatus)
      : 'planned';
  const notes = typeof body.notes === 'string' ? body.notes : null;
  const { date: startAt, error: startAtError } = parseAndValidateDate(body.start_at, 'start_at');
  if (startAtError) {
    return NextResponse.json({ error: startAtError }, { status: 400 });
  }

  const { date: endAt, error: endAtError } = parseAndValidateDate(body.end_at, 'end_at');
  if (endAtError) {
    return NextResponse.json({ error: endAtError }, { status: 400 });
  }
  const color = typeof body.color === 'string' && hexColorRe.test(body.color) ? body.color : undefined;

  const trip = await createTrip(user.id, {
    name,
    color,
    destination,
    startAt,
    endAt,
    status,
    notes,
    coverImageUrl: null,
  });

  return NextResponse.json({ trip }, { status: 201 });
});
