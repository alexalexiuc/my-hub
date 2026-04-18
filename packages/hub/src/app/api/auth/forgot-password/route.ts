import { NextResponse } from 'next/server';
import { createPasswordResetToken, sendPasswordResetEmail } from '@my-hub/shared/services';
import { PASSWORD_RESET_TOKEN_EXPIRY_MINUTES } from '@my-hub/shared/constants';
import { ForgotPasswordSchema } from '@my-hub/shared/schemas';
import { withErrorLogging, formatZodError } from '@/lib/api/with-error-logging';
import { hubEnvConfig } from '@/config/env';

async function forgotPasswordHandler(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  // createPasswordResetToken returns null if the user doesn't exist.
  // We always respond with 200 to prevent user enumeration.
  const token = await createPasswordResetToken(normalizedEmail);

  if (token) {
    const resetUrl = `${hubEnvConfig.HUB_URL}/auth/reset-password?token=${token}`;
    await sendPasswordResetEmail(normalizedEmail, {
      resetUrl,
      expiryMinutes: PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging(forgotPasswordHandler);
