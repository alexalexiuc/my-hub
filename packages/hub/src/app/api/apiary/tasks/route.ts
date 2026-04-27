import { route, created } from '@/lib/api/route';
import { getApiaryTasks, createApiaryTask } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { TaskCreateSchema } from '@/lib/schemas/apiary';
import { z } from 'zod';

const TaskQuerySchema = z.object({
  hiveId: z.coerce.number().int().positive().optional(),
  yardId: z.coerce.number().int().positive().optional(),
  completed: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const GET = route({ query: TaskQuerySchema })(async ({ user, query }) => {
  const tasks = await getApiaryTasks(
    user.id,
    omitNullish({ hiveId: query.hiveId, yardId: query.yardId, completed: query.completed, limit: query.limit }),
  );
  return { tasks };
});

export const POST = route({ body: TaskCreateSchema })(async ({ user, body }) => {
  const dueAt = body.dueAt ? new Date(body.dueAt) : undefined;

  const task = await createApiaryTask(user.id, {
    title: body.title,
    ...omitNullish({
      hiveId: body.hiveId,
      yardId: body.yardId,
      dueAt,
    }),
  });
  return created({ task });
});
