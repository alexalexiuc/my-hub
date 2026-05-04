import { route, created } from '@/lib/api/route';
import { getApiaryHives, createApiaryHive } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { HiveCreateSchema } from '@/lib/schemas/apiary';
import { z } from 'zod';

const HiveQuerySchema = z.object({
  yardId: z.coerce.number().int().positive().optional(),
  active: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
});

export const GET = route({ query: HiveQuerySchema })(async ({ user, query }) => {
  const hives = await getApiaryHives(user.id, omitNullish({ yardId: query.yardId, active: query.active }));
  return { hives };
});

export const POST = route({ body: HiveCreateSchema })(async ({ user, body }) => {
  const hive = await createApiaryHive(user.id, {
    name: body.name,
    ...omitNullish({
      yardId: body.yardId,
      queenStatus: body.queenStatus,
      queenMarked: body.queenMarked,
      queenYear: body.queenYear,
      boxes: body.boxes,
      notes: body.notes,
    }),
  });
  return created({ hive });
});
