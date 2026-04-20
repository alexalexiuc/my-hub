import { NextResponse } from 'next/server';
import { PromiseCacheX } from 'promise-cachex';
import { createPasswordResetToken, sendPasswordResetEmail } from '@my-hub/shared/services';
import { PASSWORD_RESET_TOKEN_EXPIRY_MINUTES, RETRY_PWD_RESET_AFTER_MINS } from '@my-hub/shared/constants';
import { ForgotPasswordSchema } from '@my-hub/shared/schemas';
import { withErrorLogging, formatZodError } from '@/lib/api/with-error-logging';
import { hubEnvConfig } from '@/config/env';

const RATE_LIMIT_TTL_MS = RETRY_PWD_RESET_AFTER_MINS * 60 * 1000;

// One cached promise per email for the TTL window — concurrent requests coalesce,
// and repeat requests within the window get the cached result without re-sending.
const resetCache = new PromiseCacheX({ ttl: RATE_LIMIT_TTL_MS, maxEntries: 1000 });

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

  // Cached per email for the TTL window: concurrent requests coalesce onto one promise
  // (no duplicate emails sent), and repeat requests within the window return immediately
  // without re-triggering token creation or email delivery.
  // createPasswordResetToken returns null if the user doesn't exist or is blocked.
  // We always respond with 200 to prevent user enumeration.
  const requestSentAt = await resetCache.get(normalizedEmail, async () => {
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
    return Date.now();
  });

  const retryAfter = Math.ceil((RATE_LIMIT_TTL_MS - (Date.now() - requestSentAt)) / 1000);
  return NextResponse.json({ ok: true, ...(retryAfter !== undefined && { retryAfter }) });
}

export const POST = withErrorLogging(forgotPasswordHandler);
