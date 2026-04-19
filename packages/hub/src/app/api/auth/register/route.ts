import { NextResponse } from 'next/server';
import {
  createUserWithPassword,
  claimInviteToken,
  bindInviteTokenToUser,
  createEmailVerificationToken,
  sendEmailVerificationEmail,
} from '@my-hub/shared/services';
import { PASSWORD_RULES, EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS } from '@my-hub/shared/constants';
import { withErrorLogging } from '@/lib/api/with-error-logging';
import { hubEnvConfig } from '@/config/env';

async function registerHandler(req: Request) {
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
  if (
    password.length < PASSWORD_RULES.minLength ||
    !PASSWORD_RULES.hasUppercase.test(password) ||
    !PASSWORD_RULES.hasLowercase.test(password) ||
    !PASSWORD_RULES.hasNumber.test(password) ||
    !PASSWORD_RULES.hasSpecial.test(password)
  ) {
    return NextResponse.json(
      {
        error:
          'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character',
      },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const emailAllowed = hubEnvConfig.ALLOWED_EMAILS.length > 0 && hubEnvConfig.ALLOWED_EMAILS.includes(normalizedEmail);
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

    // Send email verification unless this is a known e2e test address.
    const isTestEmail = hubEnvConfig.E2E_TEST_EMAILS.includes(normalizedEmail);
    if (!isTestEmail) {
      try {
        const verificationToken = await createEmailVerificationToken(user.id);
        const verifyUrl = `${hubEnvConfig.HUB_URL}/auth/verify-email?token=${verificationToken}`;
        await sendEmailVerificationEmail(normalizedEmail, {
          verifyUrl,
          expiryHours: EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS,
        });
      } catch {
        // Swallow — user is created; they can request a re-send later.
      }
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

export const POST = withErrorLogging(registerHandler);
