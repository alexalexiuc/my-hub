import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { listUserOAuthClients, createUserOAuthClient } from '@my-hub/shared/services';

export const GET = route(async ({ user }) => {
  const clients = await listUserOAuthClients(user.id);
  return clients;
});

export const POST = route({ body: z.object({ name: z.string().optional() }) })(async ({ user, body }) => {
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;

  const newClient = await createUserOAuthClient(user.id, name);
  // plainClientSecret is returned ONCE here — it is not stored and cannot be retrieved later.
  return created(newClient);
});
