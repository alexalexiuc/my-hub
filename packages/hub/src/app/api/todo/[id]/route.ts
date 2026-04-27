import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { markTodoDone, deleteTodo } from '@my-hub/shared/services';

export const PATCH = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const todo = await markTodoDone(user.id, params.id);
  if (!todo) routeHttpError(404, { error: 'Not found' });
  return { todo };
});

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const todo = await deleteTodo(user.id, params.id);
  if (!todo) routeHttpError(404, { error: 'Not found' });
  return { todo };
});
