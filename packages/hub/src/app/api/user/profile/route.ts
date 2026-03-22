import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { updateUserName, findUserById } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const fullUser = await findUserById(user.id);
  if (!fullUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    id: fullUser.id,
    email: fullUser.email,
    name: fullUser.name,
    createdAt: fullUser.createdAt,
  });
});

export const PUT = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name } = body as { name?: string };
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const updated = await updateUserName(user.id, name.trim());
  return NextResponse.json({ id: updated.id, email: updated.email, name: updated.name });
});
