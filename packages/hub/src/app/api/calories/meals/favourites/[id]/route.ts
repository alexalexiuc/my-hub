import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { removeFavouriteMeal } from '@my-hub/shared/services';

const FavouriteIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** Unpin a favourite meal. */
export const DELETE = route({ params: FavouriteIdParamSchema })(async ({ user, params }) => {
  const removed = await removeFavouriteMeal(user.id, params.id);
  if (!removed) routeHttpError(404, { error: 'Not found' });
  return { deleted: true };
});
