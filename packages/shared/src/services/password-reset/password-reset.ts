import { createHash, randomBytes } from 'crypto';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { passwordResetTokens } from '../../db/schema/password-reset-tokens';
import { users } from '../../db/schema/users';
import { hashSecret } from '../../crypto/';
import { findUserByEmail } from '../users/users';
import { PASSWORD_RESET_TOKEN_EXPIRY_MINUTES, MAX_FAILED_RESET_ATTEMPTS } from '../../constants/auth';

function hashToken(plainToken: string): string {
  return createHash('sha256').update(plainToken).digest('hex');
}

/**
 * Creates a password reset token for the given email address.
 * Returns null if the user doesn't exist or is blocked.
 * Increments failedResetAttempts on each new request; resets when a token is successfully consumed.
 * To prevent user enumeration, callers should treat null and non-null responses identically.
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  if (user.blockedAt) return null;

  const newResetCount = user.failedResetAttempts + 1;
  if (newResetCount > MAX_FAILED_RESET_ATTEMPTS) {
    await db.update(users).set({ blockedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    return null;
  }

  const plainToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await db.transaction(async tx => {
    await tx.insert(passwordResetTokens).values({ userId: user.id, token: tokenHash, expiresAt });
    await tx
      .update(users)
      .set({ failedResetAttempts: newResetCount, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  });

  return plainToken;
}

/**
 * Verifies a password reset token and returns the associated user ID if valid.
 * Returns null if the token is invalid, expired, or already used.
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const now = new Date();
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, tokenHash),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now),
    ),
  });
  return row?.userId ?? null;
}

/**
 * Consumes a password reset token (marks it as used) and updates the user's password.
 * Resets failedResetAttempts to 0 on success.
 * Returns true if the token was valid and the password was updated, false otherwise.
 */
export async function consumePasswordResetToken(token: string, newPassword: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  return db.transaction(async tx => {
    const now = new Date();

    // Atomically claim the token and get the associated user ID.
    const rows = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.token, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });

    if (rows.length === 0) return false;

    const { userId } = rows[0]!;
    const passwordHash = await hashSecret(newPassword);

    // Update password and reset the failed-reset counter in the same transaction.
    await tx
      .update(users)
      .set({ passwordHash, failedResetAttempts: 0, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return true;
  });
}
