import { NextResponse } from 'next/server';
import {
  createUserWithPassword,
  claimInviteToken,
  bindInviteTokenToUser,
  createVerificationToken,
} from '@my-hub/shared/services';
import { sendVerificationEmail } from '../../../../lib/email';

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
  const needsToken = !emailAllowed;

  // Atomically claim the token before creating the user — eliminates the TOCTOU race
  // where two concurrent requests could both pass a non-atomic validate+consume check.
  if (needsToken) {
    if (!inviteToken) {
      return NextResponse.json({ error: 'An invite link is required to register' }, { status: 403 });
    }
    const claimed = await claimInviteToken(inviteToken);
    if (!claimed) {
      return NextResponse.json({ error: 'Invite link is invalid or already used' }, { status: 403 });
    }
  }

  try {
    const user = await createUserWithPassword(normalizedEmail, password, name?.trim() || null);
    if (needsToken && inviteToken) {
      await bindInviteTokenToUser(inviteToken, user.id);
    }

    // Send verification email (non-blocking — registration succeeds even if email fails)
    try {
      const verificationToken = await createVerificationToken(user.id);
      await sendVerificationEmail(user.email, verificationToken.token);
    } catch (emailErr) {
      console.error('[register] Failed to send verification email:', emailErr);
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
