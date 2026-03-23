import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getTripOverview } from '@my-hub/shared/services';

export const GET = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  const overview = await getTripOverview(user.id, tripId);
  if (!overview) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  return NextResponse.json(overview);
});
