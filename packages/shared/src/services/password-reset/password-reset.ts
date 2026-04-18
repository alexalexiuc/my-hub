import { randomBytes } from 'crypto';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { passwordResetTokens } from '../../db/schema/password-reset-tokens';
import { users } from '../../db/schema/users';
import { hashSecret } from '../../crypto/';
import { findUserByEmail } from '../users/users';

const TOKEN_EXPIRY_MINUTES = 60;

/**
 * Creates a password reset token for the given email address.
 * Returns the plain token (to be sent via email) or null if the user doesn't exist.
 * To prevent user enumeration, callers should treat both cases identically in responses.
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const plainToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: plainToken,
    expiresAt,
  });

  return plainToken;
}

/**
 * Verifies a password reset token and returns the associated user ID if valid.
 * Returns null if the token is invalid, expired, or already used.
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  const now = new Date();
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, token),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now),
    ),
  });
  return row?.userId ?? null;
}

/**
 * Consumes a password reset token (marks it as used) and updates the user's password.
 * Returns true if the token was valid and the password was updated, false otherwise.
 */
export async function consumePasswordResetToken(token: string, newPassword: string): Promise<boolean> {
  const userId = await verifyPasswordResetToken(token);
  if (!userId) return false;

  const passwordHash = await hashSecret(newPassword);
  const now = new Date();

  // Mark token as used
  const rows = await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokens.token, token),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .returning({ id: passwordResetTokens.id });

  if (rows.length === 0) return false;

  // Update the user's password
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

  return true;
}
