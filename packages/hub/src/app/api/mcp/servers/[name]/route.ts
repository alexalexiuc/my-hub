import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { setMcpServerEnabled } from '@my-hub/shared/services';
import { McpServerName } from '@my-hub/shared/constants';

const VALID_NAMES = new Set<string>(Object.values(McpServerName));

export const PATCH = route({ params: z.object({ name: z.string() }), body: z.object({ enabled: z.boolean() }) })(
  async ({ user, params, body }) => {
    if (!VALID_NAMES.has(params.name)) {
      routeHttpError(400, { error: 'Unknown server name' });
    }

    const row = await setMcpServerEnabled(user.id, params.name as McpServerName, body.enabled);
    return row;
  },
);
