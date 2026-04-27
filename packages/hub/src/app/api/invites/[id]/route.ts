import { z } from 'zod';
import { route } from '@/lib/api/route';
import { revokeInviteToken } from '@my-hub/shared/services';

export const DELETE = route({ params: z.object({ id: z.string() }) })(async ({ user, params }) => {
  await revokeInviteToken(params.id, user.id);
  return { ok: true };
});
