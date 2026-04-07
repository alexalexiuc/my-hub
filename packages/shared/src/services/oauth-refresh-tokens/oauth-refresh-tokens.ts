import { eq, and, gt, lt } from 'drizzle-orm';
import { db } from '../../db/client';
import { oauthRefreshTokens } from '../../db/schema/oauth-refresh-tokens';
import { hashSecret, verifySecret } from '../../crypto/';
import type { OAuthRefreshToken } from '../../types';

/** 30-day refresh token lifetime in milliseconds. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Issue a new refresh token for the given client/user pair.
 * Returns the plain token — the caller must include it in the token response.
 * The token itself is stored as a scrypt hash and is never retrievable afterwards.
 */
export async function createRefreshToken(clientId: string, userId: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const plain = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const tokenHash = await hashSecret(plain);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.insert(oauthRefreshTokens).values({ clientId, userId, tokenHash, expiresAt });
  return plain;
}

/**
 * Look up a refresh token row by scanning all tokens for this client and
 * verifying the scrypt hash.  Returns the row if valid and not expired,
 * null otherwise.
 *
 * Note: This is O(n) per client, but clients rarely accumulate more than
 * a handful of active refresh tokens so it is acceptable.
 */
export async function findRefreshToken(clientId: string, plainToken: string): Promise<OAuthRefreshToken | null> {
  const rows = await db.query.oauthRefreshTokens.findMany({
    where: and(
      eq(oauthRefreshTokens.clientId, clientId),
      // Only consider tokens that have not yet expired
      gt(oauthRefreshTokens.expiresAt, new Date()),
    ),
  });

  for (const row of rows) {
    const match = await verifySecret(plainToken, row.tokenHash);
    if (match) return row;
  }
  return null;
}

/** Delete a single refresh token by its database id (single-use rotation). */
export async function deleteRefreshToken(id: number): Promise<void> {
  await db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.id, id));
}

/** Delete all refresh tokens for a given client (e.g. when the client is revoked). */
export async function deleteRefreshTokensByClient(clientId: string): Promise<void> {
  await db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.clientId, clientId));
}

/** Delete all refresh tokens for a given user (e.g. when the account is deleted). */
export async function deleteRefreshTokensByUser(userId: string): Promise<void> {
  await deleteAllUserOAuthRefreshTokens(userId);
}

export async function deleteAllUserOAuthRefreshTokens(userId: string): Promise<number> {
  const rows = await db
    .delete(oauthRefreshTokens)
    .where(eq(oauthRefreshTokens.userId, userId))
    .returning({ id: oauthRefreshTokens.id });

  return rows.length;
}

/** Remove expired refresh tokens for a given client. */
export async function pruneExpiredRefreshTokens(clientId: string): Promise<void> {
  await db
    .delete(oauthRefreshTokens)
    .where(and(eq(oauthRefreshTokens.clientId, clientId), lt(oauthRefreshTokens.expiresAt, new Date())));
}
