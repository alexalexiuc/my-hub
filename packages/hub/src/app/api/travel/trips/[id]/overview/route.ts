import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getTripOverview } from '@my-hub/shared/services';

export const GET = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({ user, params }) => {
  const overview = await getTripOverview(user.id, params.id);
  if (!overview) routeHttpError(404, { error: 'Trip not found' });

  return { ...overview, canEdit: overview.trip.userId === user.id };
});
