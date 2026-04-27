import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getApiaryHive, updateApiaryHive, deleteApiaryHive } from '@my-hub/shared/services';
import { HiveUpdateSchema } from '@/lib/schemas/apiary';

export const GET = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({ user, params }) => {
  const hive = await getApiaryHive(user.id, params.id);
  if (!hive) routeHttpError(404, { error: 'Not found' });
  return { hive };
});

export const PATCH = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: HiveUpdateSchema })(
  async ({ user, params, body }) => {
    const hive = await updateApiaryHive(user.id, params.id, body);
    if (!hive) routeHttpError(404, { error: 'Not found' });
    return { hive };
  },
);

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const hive = await deleteApiaryHive(user.id, params.id);
  if (!hive) routeHttpError(404, { error: 'Not found' });
  return { hive };
});
