import { NextResponse } from 'next/server';
import { createPasswordResetToken, sendPasswordResetEmail } from '@my-hub/shared/services';
import { withErrorLogging } from '@/lib/api/with-error-logging';
import { hubEnvConfig } from '@/config/env';

const TOKEN_EXPIRY_MINUTES = 60;

async function forgotPasswordHandler(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email } = body as { email?: string };

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // createPasswordResetToken returns null if the user doesn't exist.
  // We always respond with 200 to prevent user enumeration.
  const token = await createPasswordResetToken(normalizedEmail);

  if (token) {
    const resetUrl = `${hubEnvConfig.HUB_URL}/auth/reset-password?token=${token}`;
    await sendPasswordResetEmail(normalizedEmail, {
      resetUrl,
      expiryMinutes: TOKEN_EXPIRY_MINUTES,
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging(forgotPasswordHandler);
