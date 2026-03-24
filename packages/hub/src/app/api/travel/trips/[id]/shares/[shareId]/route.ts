import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteTripShare, verifyTripOwnership } from '@my-hub/shared/services';

export const DELETE = withAuth<{ id: string; shareId: string }>(async ({ user, params }) => {
  const { id, shareId } = await params;
  const tripId = Number(id);
  const parsedShareId = Number(shareId);

  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }
  if (!Number.isInteger(parsedShareId) || parsedShareId <= 0) {
    return NextResponse.json({ error: 'Invalid share id' }, { status: 400 });
  }

  const isOwner = await verifyTripOwnership(user.id, tripId);
  if (!isOwner) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const deleted = await deleteTripShare(user.id, tripId, parsedShareId);
  if (!deleted) return NextResponse.json({ error: 'Share not found' }, { status: 404 });

  return NextResponse.json({ share: deleted });
});
