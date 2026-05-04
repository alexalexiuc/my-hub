import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { createInviteToken, listInviteTokens } from '@my-hub/shared/services';

export const GET = route(async ({ user }) => {
  const invites = await listInviteTokens(user.id);
  return { invites };
});

export const POST = route({ body: z.object({ expiresInDays: z.number().optional() }) })(async ({ user, body }) => {
  const invite = await createInviteToken(user.id, body.expiresInDays);
  return created({ invite });
});
