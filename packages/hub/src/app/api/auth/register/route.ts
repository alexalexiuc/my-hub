import { z } from 'zod';
import {
  createUserWithPassword,
  claimInviteToken,
  bindInviteTokenToUser,
  createEmailVerificationToken,
  sendEmailVerificationEmail,
} from '@my-hub/shared/services';
import { PASSWORD_RULES, EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES } from '@my-hub/shared/constants';
import { created, route, routeHttpError } from '@/lib/api/route';
import { hubEnvConfig } from '@/config/env';
import { logger } from '@my-hub/shared/utils';

const RegisterBodySchema = z.object({
  email: z.string().min(1, 'email is required'),
  password: z.string().min(1, 'password is required'),
  name: z.string().optional(),
  inviteToken: z.string().optional(),
});

export const POST = route({ public: true, body: RegisterBodySchema })(async ({ body }) => {
  const { email, password, name, inviteToken } = body;

  if (
    password.length < PASSWORD_RULES.minLength ||
    !PASSWORD_RULES.hasUppercase.test(password) ||
    !PASSWORD_RULES.hasLowercase.test(password) ||
    !PASSWORD_RULES.hasNumber.test(password) ||
    !PASSWORD_RULES.hasSpecial.test(password)
  ) {
    return routeHttpError(
      400,
      `Password must be at least ${PASSWORD_RULES.minLength} characters and include uppercase, lowercase, a number, and a special character`,
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const emailAllowed = hubEnvConfig.ALLOWED_EMAILS.length > 0 && hubEnvConfig.ALLOWED_EMAILS.includes(normalizedEmail);
  const needsToken = !emailAllowed;

  // Atomically claim the token before creating the user — eliminates the TOCTOU race
  // where two concurrent requests could both pass a non-atomic validate+consume check.
  if (needsToken) {
    if (!inviteToken) {
      return routeHttpError(403, 'An invite link is required to register');
    }
    const claimed = await claimInviteToken(inviteToken);
    if (!claimed) {
      return routeHttpError(403, 'Invite link is invalid or already used');
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
          expiryHours: EMAIL_VERIFICATION_TOKEN_EXPIRY_MINUTES / 60,
        });
      } catch (err) {
        // Registration succeeds even if verification delivery fails, but this
        // must be reported because no resend flow is implemented here.
        logger.error('Failed to send email verification after registration', {
          userId: user.id,
          email: normalizedEmail,
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    return created({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    if (message === 'Email already registered') {
      return routeHttpError(409, message);
    }
    return routeHttpError(500, message);
  }
});
