import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTrip, updateTrip } from '@my-hub/shared/services';
import type { TripStatus } from '@my-hub/shared/types';

const tripStatuses: TripStatus[] = ['planned', 'active', 'completed', 'cancelled'];
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

  const trip = await updateTrip(user.id, tripId, {
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    destination: typeof body.destination === 'string' ? body.destination.trim() || null : undefined,
    color: typeof body.color === 'string' && hexColorRe.test(body.color) ? body.color : undefined,
    startAt:
      typeof body.start_at === 'string'
        ? body.start_at
          ? new Date(body.start_at)
          : null
        : body.start_at === null
          ? null
          : undefined,
    endAt:
      typeof body.end_at === 'string'
        ? body.end_at
          ? new Date(body.end_at)
          : null
        : body.end_at === null
          ? null
          : undefined,
    status:
      typeof body.status === 'string' && tripStatuses.includes(body.status as TripStatus)
        ? (body.status as TripStatus)
        : undefined,
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
