import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { revokeInviteToken } from '@my-hub/shared/services';

export const DELETE = withAuth<{ id: string }>(async ({ user, params }) => {
  const { id } = await params;
  await revokeInviteToken(id, user.id);
  return NextResponse.json({ ok: true });
});
