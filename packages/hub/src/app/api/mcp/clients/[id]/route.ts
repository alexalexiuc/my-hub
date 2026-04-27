import { z } from 'zod';
import { route, routeHttpError, noContent } from '@/lib/api/route';
import { deleteUserOAuthClient, setOAuthClientEnabled } from '@my-hub/shared/services';

export const DELETE = route({ params: z.object({ id: z.string() }) })(async ({ user, params }) => {
  const numId = Number(params.id);
  if (!Number.isInteger(numId) || numId <= 0) {
    routeHttpError(400, { error: 'Invalid id' });
  }

  await deleteUserOAuthClient(numId, user.id);
  return noContent();
});

export const PATCH = route({ params: z.object({ id: z.string() }), body: z.object({ enabled: z.boolean() }) })(async ({
  user,
  params,
  body,
}) => {
  const numId = Number(params.id);
  if (!Number.isInteger(numId) || numId <= 0) {
    routeHttpError(400, { error: 'Invalid id' });
  }

  const row = await setOAuthClientEnabled(numId, user.id, body.enabled);
  return row;
});
