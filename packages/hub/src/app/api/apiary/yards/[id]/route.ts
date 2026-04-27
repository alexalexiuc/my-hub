import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getApiaryYard, updateApiaryYard, deleteApiaryYard } from '@my-hub/shared/services';
import { YardUpdateSchema } from '@/lib/schemas/apiary';

export const GET = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({ user, params }) => {
  const yard = await getApiaryYard(user.id, params.id);
  if (!yard) routeHttpError(404, { error: 'Not found' });
  return { yard };
});

export const PATCH = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: YardUpdateSchema })(
  async ({ user, params, body }) => {
    const yard = await updateApiaryYard(user.id, params.id, body);
    if (!yard) routeHttpError(404, { error: 'Not found' });
    return { yard };
  },
);

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const yard = await deleteApiaryYard(user.id, params.id);
  if (!yard) routeHttpError(404, { error: 'Not found' });
  return { yard };
});
