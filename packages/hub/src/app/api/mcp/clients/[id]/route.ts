import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { deleteUserOAuthClient, setOAuthClientEnabled } from '@my-hub/shared/services';

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  await deleteUserOAuthClient(numId, user.id);
  return new NextResponse(null, { status: 204 });
});

export const PATCH = withAuth<{ id: string }>(async ({ req, user, params }) => {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = (await req.json()) as { enabled?: boolean };
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 });
  }

  const row = await setOAuthClientEnabled(numId, user.id, body.enabled);
  return NextResponse.json(row);
});
