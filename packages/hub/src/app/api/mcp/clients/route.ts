import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { listUserOAuthClients, createUserOAuthClient } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clients = await listUserOAuthClients(user.id);
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { name?: string };
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;

  const created = await createUserOAuthClient(user.id, name);
  // plainClientSecret is returned ONCE here — it is not stored and cannot be retrieved later.
  return NextResponse.json(created, { status: 201 });
}
