import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteApiaryLog } from '@my-hub/shared/services';

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const log = await deleteApiaryLog(user.id, params.id);
  if (!log) routeHttpError(404, { error: 'Not found' });
  return { log };
});
