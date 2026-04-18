import { createHash, randomBytes } from 'crypto';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { passwordResetTokens } from '../../db/schema/password-reset-tokens';
import { users } from '../../db/schema/users';
import { hashSecret } from '../../crypto/';
import { findUserByEmail } from '../users/users';
import { PASSWORD_RESET_TOKEN_EXPIRY_MINUTES } from '../../constants/auth';

/**
 * Hash a plain token using SHA-256 for secure database storage.
 * @param plainToken - The raw token string to hash
 * @returns Hex-encoded SHA-256 hash of the token
 */
function hashToken(plainToken: string): string {
  return createHash('sha256').update(plainToken).digest('hex');
}

/**
 * Creates a password reset token for the given email address.
 * The token is hashed before storage; the plain token is returned to be sent via email.
 * Returns null if the user doesn't exist.
 * To prevent user enumeration, callers should treat both cases identically in responses.
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const plainToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(plainToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: tokenHash,
    expiresAt,
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
 * Returns true if the token was valid and the password was updated, false otherwise.
 */
export async function consumePasswordResetToken(token: string, newPassword: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  return db.transaction(async (tx) => {
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

    const passwordHash = await hashSecret(newPassword);

    // Update the user's password in the same transaction so the token
    // claim and password change either both succeed or both roll back.
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, rows[0].userId));

    return true;
  });
}
