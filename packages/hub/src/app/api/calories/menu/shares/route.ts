import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { createMenuShare, findUserByEmail, listMenuShares, listSharedWithMe } from '@my-hub/shared/services';

const ShareCreateSchema = z.object({
  email: z.string().trim().email(),
});

export const GET = route(async ({ user }) => {
  const [shares, sharedWithMe] = await Promise.all([listMenuShares(user.id), listSharedWithMe(user.id)]);

  return {
    shares: shares.map(s => ({ id: s.share.id, name: s.userName, email: s.userEmail })),
    sharedWithMe: sharedWithMe.map(s => ({ id: s.share.id, name: s.userName, email: s.userEmail })),
  };
});

export const POST = route({ body: ShareCreateSchema })(async ({ user, body }) => {
  const email = body.email.trim().toLowerCase();
  const found = await findUserByEmail(email);
  if (!found) routeHttpError(404, { error: 'User not found' });

  try {
    const share = await createMenuShare(user.id, found.id);
    return created({ share });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to share weekly menu';
    routeHttpError(400, { error: message });
  }
});
