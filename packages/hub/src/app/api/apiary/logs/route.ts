import { route, created } from '@/lib/api/route';
import { getApiaryLogs, createApiaryLog } from '@my-hub/shared/services';
import { omitNullish } from '@my-hub/shared/utils';
import { LogCreateSchema } from '@/lib/schemas/apiary';
import { z } from 'zod';

const LogQuerySchema = z.object({
  hiveId: z.coerce.number().int().positive().optional(),
  type: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export const GET = route({ query: LogQuerySchema })(async ({ user, query }) => {
  const logs = await getApiaryLogs(
    user.id,
    omitNullish({ hiveId: query.hiveId, type: query.type, limit: query.limit, offset: query.offset }),
  );
  return { logs };
});

export const POST = route({ body: LogCreateSchema })(async ({ user, body }) => {
  const loggedAt = body.loggedAt ? new Date(body.loggedAt) : new Date();

  const log = await createApiaryLog(user.id, {
    type: body.type,
    loggedAt,
    ...omitNullish({
      hiveId: body.hiveId,
      notes: body.notes,
      data: body.data,
    }),
  });
  return created({ log });
});
