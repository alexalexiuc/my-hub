import { NextResponse } from 'next/server';
import { createUserWithPassword, validateInviteToken, consumeInviteToken } from '@my-hub/shared/services';

const ALLOWED_EMAILS = (process.env['ALLOWED_EMAILS'] ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password, name, inviteToken } = body as {
    email?: string;
    password?: string;
    name?: string;
    inviteToken?: string;
  };

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'password is required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const emailAllowed = ALLOWED_EMAILS.length > 0 && ALLOWED_EMAILS.includes(normalizedEmail);
  const tokenValid = inviteToken ? await validateInviteToken(inviteToken) : false;

  if (!emailAllowed && !tokenValid) {
    return NextResponse.json({ error: 'An invite link is required to register' }, { status: 403 });
  }

  try {
    const user = await createUserWithPassword(normalizedEmail, password, name?.trim() || null);
    if (tokenValid && inviteToken) {
      await consumeInviteToken(inviteToken, user.id);
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    if (message === 'Email already registered') {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
