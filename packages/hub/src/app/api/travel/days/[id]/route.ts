import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteTripDay } from '@my-hub/shared/services';

const DaysParamsSchema = z.object({ id: z.coerce.number().int().positive('Invalid item id') });

export const DELETE = route({ params: DaysParamsSchema })(async ({ user, params }) => {
  const { id } = params;
  if (!id) routeHttpError(400, { error: 'Invalid day id' });
  const removed = await deleteTripDay(user.id, id);
  if (!removed) routeHttpError(404, { error: 'Day note not found' });
  return { id: removed.id };
});
