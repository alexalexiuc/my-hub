import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { addTripCompanion } from '@my-hub/shared/services';

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const tripId = Number(body.tripId);
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const companion = await addTripCompanion(user.id, tripId, {
    name,
    email: typeof body.email === 'string' ? body.email : null,
    phone: typeof body.phone === 'string' ? body.phone : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
  });

  return NextResponse.json({ companion }, { status: 201 });
});
