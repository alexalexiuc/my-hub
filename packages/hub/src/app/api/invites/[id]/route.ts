import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { revokeInviteToken } from '@my-hub/shared/services';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await revokeInviteToken(id, user.id);
  return NextResponse.json({ ok: true });
}
