import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getTripDays, upsertTripDay } from '@my-hub/shared/services';

export const GET = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  const days = await getTripDays(user.id, tripId);
  return NextResponse.json({ days });
});

export const POST = withAuth<{ id: string }>(async ({ req, user, params }) => {
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

  const date = typeof body.date === 'string' ? body.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title : null;
  const notes = typeof body.notes === 'string' ? body.notes : null;

  const day = await upsertTripDay(user.id, tripId, date, { title, notes });
  return NextResponse.json({ day });
});
