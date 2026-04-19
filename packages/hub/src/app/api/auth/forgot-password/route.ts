import { NextResponse } from 'next/server';
import { PromiseCacheX } from 'promise-cachex';
import { createPasswordResetToken, sendPasswordResetEmail } from '@my-hub/shared/services';
import { PASSWORD_RESET_TOKEN_EXPIRY_MINUTES, RETRY_PWD_RESET_AFTER_MINS } from '@my-hub/shared/constants';
import { ForgotPasswordSchema } from '@my-hub/shared/schemas';
import { withErrorLogging, formatZodError } from '@/lib/api/with-error-logging';
import { hubEnvConfig } from '@/config/env';

const RATE_LIMIT_TTL_MS = RETRY_PWD_RESET_AFTER_MINS * 60 * 1000;

// Keyed by normalised email → timestamp of first request. TTL = rate-limit window.
const resetRateLimitCache = new PromiseCacheX<number>({
  ttl: RATE_LIMIT_TTL_MS,
  maxEntries: 1000,
});

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

  // Rate-limit: if this email already has a pending window, return retryAfter.
  // We cache regardless of whether the email exists to prevent user enumeration.
  if (resetRateLimitCache.has(normalizedEmail)) {
    const requestedAt = await resetRateLimitCache.get(normalizedEmail, () => Date.now());
    const retryAfter = Math.max(1, Math.ceil((requestedAt + RATE_LIMIT_TTL_MS - Date.now()) / 1000));
    return NextResponse.json({ ok: true, retryAfter });
  }

  // Stamp the cache before the async work so concurrent requests are also rate-limited.
  await resetRateLimitCache.get(normalizedEmail, () => Date.now());

  // createPasswordResetToken returns null if the user doesn't exist or is blocked.
  // We always respond with 200 to prevent user enumeration.
  const token = await createPasswordResetToken(normalizedEmail);

  if (token) {
    const resetUrl = `${hubEnvConfig.HUB_URL}/auth/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(normalizedEmail, {
        resetUrl,
        expiryMinutes: PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
      });
    } catch {
      // Swallow email send errors — the response is always 200 to prevent user enumeration.
    }
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorLogging(forgotPasswordHandler);
