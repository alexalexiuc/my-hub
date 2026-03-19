import { randomBytes } from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db/client';
import { verificationTokens } from '../../db/schema/verification-tokens';
import { users } from '../../db/schema/users';
import type { VerificationToken } from '../../types/index';

const TOKEN_EXPIRY_HOURS = 24;

export async function createVerificationToken(userId: string): Promise<VerificationToken> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3_600_000);

  // Remove any existing tokens for this user before creating a new one
  await db.delete(verificationTokens).where(eq(verificationTokens.userId, userId));

  const [row] = await db.insert(verificationTokens).values({ token, userId, expiresAt }).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

/**
 * Atomically consume a verification token: marks the user's email as verified
 * and deletes the token in one operation.
 * Returns the userId on success, null if the token is missing or expired.
 */
export async function consumeVerificationToken(token: string): Promise<string | null> {
  const now = new Date();
  const rows = await db
    .select({ userId: verificationTokens.userId })
    .from(verificationTokens)
    .where(and(eq(verificationTokens.token, token), gt(verificationTokens.expiresAt, now)));

  if (rows.length === 0) return null;
  const userId = rows[0]!.userId;

  await db.update(users).set({ emailVerified: now, updatedAt: now }).where(eq(users.id, userId));
  await db.delete(verificationTokens).where(eq(verificationTokens.token, token));

  return userId;
}
