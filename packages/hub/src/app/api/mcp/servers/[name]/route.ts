import { z } from 'zod';
import { route } from '@/lib/api/route';
import { setMcpServerEnabled } from '@my-hub/shared/services';
import { McpServerNames } from '@my-hub/shared/constants';

export const PATCH = route({
  params: z.object({ name: z.enum(McpServerNames) }),
  body: z.object({ enabled: z.boolean() }),
})(async ({ user, params, body }) => {
  const row = await setMcpServerEnabled(user.id, params.name, body.enabled);
  return row;
});
