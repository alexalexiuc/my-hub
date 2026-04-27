import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import {
  createTripShare,
  findUserByEmail,
  findUsersByEmails,
  getTripCompanions,
  listTripShares,
  verifyTripOwnership,
} from '@my-hub/shared/services';
const ShareCreateSchema = z
  .object({
    userId: z.string().trim().optional(),
    email: z.string().trim().optional(),
  })
  .refine(data => data.userId || data.email, {
    message: 'userId or email is required',
  });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const GET = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({ user, params }) => {
  const tripId = params.id;

  const isOwner = await verifyTripOwnership(user.id, tripId);
  if (!isOwner) routeHttpError(404, { error: 'Trip not found' });

  const [shares, companions] = await Promise.all([listTripShares(user.id, tripId), getTripCompanions(user.id, tripId)]);

  const companionEmails = [...new Set(companions.map(companion => companion.email).filter(Boolean) as string[])].map(
    normalizeEmail,
  );
  const usersByCompanionEmail = await findUsersByEmails(companionEmails);
  const alreadySharedIds = new Set(shares.map(share => share.share.sharedWithUserId));

  const suggestions = usersByCompanionEmail
    .filter(candidate => candidate.id !== user.id && !alreadySharedIds.has(candidate.id))
    .map(candidate => ({ userId: candidate.id, name: candidate.name, email: candidate.email }));

  return {
    shares: shares.map(share => ({
      id: share.share.id,
      userId: share.share.sharedWithUserId,
      permission: share.share.permission,
      name: share.userName,
      email: share.userEmail,
    })),
    suggestions,
  };
});

export const POST = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: ShareCreateSchema })(
  async ({ user, params, body }) => {
    const tripId = params.id;

    const isOwner = await verifyTripOwnership(user.id, tripId);
    if (!isOwner) routeHttpError(404, { error: 'Trip not found' });

    let targetUserId: string | undefined;
    if (body.userId) {
      targetUserId = body.userId.trim();
    } else if (body.email) {
      const email = normalizeEmail(body.email);
      const found = await findUserByEmail(email);
      if (!found) routeHttpError(404, { error: 'User not found' });
      targetUserId = found.id;
    }

    if (!targetUserId) {
      routeHttpError(400, { error: 'userId or email is required' });
    }

    try {
      const share = await createTripShare(user.id, tripId, targetUserId);
      return created({ share });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share trip';
      routeHttpError(400, { error: message });
    }
  },
);
