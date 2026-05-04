import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteTripShare, verifyTripOwnership } from '@my-hub/shared/services';

export const DELETE = route({
  params: z.object({ id: z.coerce.number().int().positive(), shareId: z.coerce.number().int().positive() }),
})(async ({ user, params }) => {
  const isOwner = await verifyTripOwnership(user.id, params.id);
  if (!isOwner) routeHttpError(404, { error: 'Trip not found' });

  const deleted = await deleteTripShare(user.id, params.id, params.shareId);
  if (!deleted) routeHttpError(404, { error: 'Share not found' });

  return { share: deleted };
});
