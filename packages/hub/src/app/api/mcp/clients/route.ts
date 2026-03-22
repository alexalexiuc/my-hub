import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { listUserOAuthClients, createUserOAuthClient } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const clients = await listUserOAuthClients(user.id);
  return NextResponse.json(clients);
});

export const POST = withAuth(async ({ req, user }) => {
  const body = (await req.json()) as { name?: string };
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;

  const created = await createUserOAuthClient(user.id, name);
  // plainClientSecret is returned ONCE here — it is not stored and cannot be retrieved later.
  return NextResponse.json(created, { status: 201 });
});
