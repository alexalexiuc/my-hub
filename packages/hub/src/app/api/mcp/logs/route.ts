import { z } from 'zod';
import { route } from '@/lib/api/route';
import { getLogs } from '@my-hub/shared/services';
import { McpServerName } from '@my-hub/shared/constants';

const VALID_SERVERS = new Set<string>(Object.values(McpServerName));

const GetQuerySchema = z.object({
  server: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const GET = route({ query: GetQuerySchema })(async ({ user, query }) => {
  const server =
    query.server !== undefined && VALID_SERVERS.has(query.server) ? (query.server as McpServerName) : undefined;

  const logs = await getLogs({
    userId: user.id,
    server,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to + 'T23:59:59.999Z') : undefined,
    limit: query.limit,
  });

  return { logs };
});
