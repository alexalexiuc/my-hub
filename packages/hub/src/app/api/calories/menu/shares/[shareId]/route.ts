import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteMenuShare } from '@my-hub/shared/services';

export const DELETE = route({
  params: z.object({ shareId: z.coerce.number().int().positive() }),
})(async ({ user, params }) => {
  const deleted = await deleteMenuShare(user.id, params.shareId);
  if (!deleted) routeHttpError(404, { error: 'Share not found' });

  return { share: deleted };
});
