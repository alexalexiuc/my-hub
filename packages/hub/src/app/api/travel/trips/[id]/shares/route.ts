import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  createTripShare,
  findUserByEmail,
  findUsersByEmails,
  getTripCompanions,
  listTripShares,
  verifyTripOwnership,
} from '@my-hub/shared/services';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const GET = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  const isOwner = await verifyTripOwnership(user.id, tripId);
  if (!isOwner) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  const [shares, companions] = await Promise.all([listTripShares(user.id, tripId), getTripCompanions(user.id, tripId)]);

  const companionEmails = [...new Set(companions.map(companion => companion.email).filter(Boolean) as string[])].map(
    normalizeEmail,
  );
  const usersByCompanionEmail = await findUsersByEmails(companionEmails);
  const alreadySharedIds = new Set(shares.map(share => share.share.sharedWithUserId));

  const suggestions = usersByCompanionEmail
    .filter(candidate => candidate.id !== user.id && !alreadySharedIds.has(candidate.id))
    .map(candidate => ({
      userId: candidate.id,
      name: candidate.name,
      email: candidate.email,
    }));

  return NextResponse.json({
    shares: shares.map(share => ({
      id: share.share.id,
      userId: share.share.sharedWithUserId,
      permission: share.share.permission,
      name: share.userName,
      email: share.userEmail,
    })),
    suggestions,
  });
});

export const POST = withAuth<{ id: string }>(async ({ user, params, req }) => {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  const isOwner = await verifyTripOwnership(user.id, tripId);
  if (!isOwner) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let targetUserId: string | undefined;
  if (typeof body.userId === 'string' && body.userId.trim()) {
    targetUserId = body.userId.trim();
  } else if (typeof body.email === 'string' && body.email.trim()) {
    const email = normalizeEmail(body.email);
    const found = await findUserByEmail(email);
    if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    targetUserId = found.id;
  }

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
  }

  try {
    const share = await createTripShare(user.id, tripId, targetUserId);
    return NextResponse.json({ share }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to share trip';
    if (message === 'Cannot share with yourself') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
});
