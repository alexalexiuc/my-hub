import { z } from 'zod';
import { route } from '@/lib/api/route';
import { getLogs } from '@my-hub/shared/services';
import { McpServerNames } from '@my-hub/shared/constants';

const GetQuerySchema = z.object({
  server: z.enum(McpServerNames).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const GET = route({ query: GetQuerySchema })(async ({ user, query }) => {
  const logs = await getLogs({
    userId: user.id,
    server: query.server,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to + 'T23:59:59.999Z') : undefined,
    limit: query.limit,
  });

  return { logs };
});
