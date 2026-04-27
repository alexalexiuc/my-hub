import { PromiseCacheX } from 'promise-cachex';
import { findUserById, createEmailVerificationToken, sendEmailVerificationEmail } from '@my-hub/shared/services';
import { EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES } from '@my-hub/shared/constants';
import { route, routeHttpError } from '@/lib/api/route';
import { hubEnvConfig } from '@/config/env';

const RATE_LIMIT_TTL_MS = 5 * 60 * 1000; // 5 minutes between resends

const resendCache = new PromiseCacheX({ ttl: RATE_LIMIT_TTL_MS, maxEntries: 1000 });

export const POST = route(async ({ user }) => {
  const fullUser = await findUserById(user.id);
  if (!fullUser) routeHttpError(401, { error: 'Unauthorized' });

  if (fullUser.emailVerified) {
    routeHttpError(400, { error: 'Email is already verified' });
  }

  const requestSentAt = await resendCache.get(user.id, async () => {
    const token = await createEmailVerificationToken(user.id);
    const verifyUrl = `${hubEnvConfig.HUB_URL}/auth/verify-email?token=${token}`;
    await sendEmailVerificationEmail(fullUser.email, {
      verifyUrl,
      expiryHours: EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES / 60,
    });
    return Date.now();
  });

  const retryAfter = Math.ceil((RATE_LIMIT_TTL_MS - (Date.now() - requestSentAt)) / 1000);
  return { ok: true, retryAfter };
});
