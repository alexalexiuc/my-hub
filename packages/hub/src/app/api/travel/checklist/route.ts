import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { addChecklistItem } from '@my-hub/shared/services';

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = Number(body.trip_id);
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
  }

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const item = await addChecklistItem(user.id, tripId, { title, done: false });
  return NextResponse.json({ item }, { status: 201 });
});
