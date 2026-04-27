import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteMeasurement } from '@my-hub/shared/services';

export const DELETE = route({ params: z.object({ id: z.string() }) })(async ({ user, params }) => {
  const numId = Number(params.id);
  if (isNaN(numId)) routeHttpError(400, { error: 'Invalid id' });

  const deleted = await deleteMeasurement(numId, user.id);
  if (!deleted) routeHttpError(404, { error: 'Not found' });

  return { deleted: true };
});
