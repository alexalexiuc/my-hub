import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { updateUserName, findUserById } from '@my-hub/shared/services';

export const GET = route(async ({ user }) => {
  const fullUser = await findUserById(user.id);
  if (!fullUser) routeHttpError(401, { error: 'Unauthorized' });

  return {
    id: fullUser.id,
    email: fullUser.email,
    name: fullUser.name,
    createdAt: fullUser.createdAt,
    emailVerified: fullUser.emailVerified,
  };
});

export const PUT = route({ body: z.object({ name: z.string().min(1) }) })(async ({ user, body }) => {
  const updated = await updateUserName(user.id, body.name.trim());
  return { id: updated.id, email: updated.email, name: updated.name };
});
