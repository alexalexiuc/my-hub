import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { updateApiaryTask, deleteApiaryTask } from '@my-hub/shared/services';
import { TaskUpdateSchema } from '@/lib/schemas/apiary';

export const PATCH = route({ params: z.object({ id: z.coerce.number().int().positive() }), body: TaskUpdateSchema })(
  async ({ user, params, body }) => {
    const { dueAt: dueAtStr, ...rest } = body;
    const task = await updateApiaryTask(user.id, params.id, {
      ...rest,
      ...(dueAtStr !== undefined ? { dueAt: dueAtStr ? new Date(dueAtStr) : null } : {}),
    });
    if (!task) routeHttpError(404, { error: 'Not found' });
    return { task };
  },
);

export const DELETE = route({ params: z.object({ id: z.coerce.number().int().positive() }) })(async ({
  user,
  params,
}) => {
  const task = await deleteApiaryTask(user.id, params.id);
  if (!task) routeHttpError(404, { error: 'Not found' });
  return { task };
});
