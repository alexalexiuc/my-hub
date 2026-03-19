import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { INVITE_COOKIE_NAME } from '../../../../lib/auth-constants';

const INVITE_COOKIE_MAX_AGE = 600; // 10 minutes — enough to complete OAuth flow

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { inviteToken } = body as { inviteToken?: string };

  if (!inviteToken || typeof inviteToken !== 'string') {
    return NextResponse.json({ error: 'inviteToken is required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(INVITE_COOKIE_NAME, inviteToken, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: INVITE_COOKIE_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
