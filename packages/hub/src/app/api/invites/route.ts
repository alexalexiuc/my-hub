import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { createInviteToken, listInviteTokens } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invites = await listInviteTokens(user.id);
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  const expiresInDays = typeof body.expiresInDays === 'number' ? body.expiresInDays : undefined;
  const invite = await createInviteToken(user.id, expiresInDays);
  return NextResponse.json({ invite }, { status: 201 });
}
