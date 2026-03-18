import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { oauthClients } from '../../db/schema/oauth-clients';
import type { OAuthClient, NewOAuthClient } from '../../types/index';
import { encrypt, decrypt, hashSecret, verifySecret } from '../../crypto/index';

// clientSecret is a one-way scrypt hash — it is never returned after creation.
export type DecryptedOAuthClient = Omit<OAuthClient, 'clientSecret' | 'tokenSigningSecret'> & {
  tokenSigningSecret: string;
};

export type CreateOAuthClientData = Omit<
  NewOAuthClient,
  'id' | 'userId' | 'createdAt' | 'clientSecret' | 'tokenSigningSecret'
> & {
  clientSecret: string;
  tokenSigningSecret: string;
};

/** Public view of an OAuth client — no secrets at all. */
export type PublicOAuthClient = Omit<OAuthClient, 'clientSecret' | 'tokenSigningSecret'>;

/** Returned only at creation time — contains the one-time plain secret. */
export type CreatedOAuthClient = PublicOAuthClient & { plainClientSecret: string };

async function decryptRow(row: OAuthClient): Promise<DecryptedOAuthClient> {
  const { value: tokenSigningSecret } = await decrypt(row.tokenSigningSecret);
  return { ...row, tokenSigningSecret };
}

function toPublic(row: OAuthClient): PublicOAuthClient {
  const { clientSecret: _cs, tokenSigningSecret: _tss, ...rest } = row;
  return rest;
}

export async function findOAuthClient(clientId: string): Promise<DecryptedOAuthClient | undefined> {
  const row = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.clientId, clientId),
  });
  if (!row) return undefined;
  return decryptRow(row);
}

export async function verifyClientSecret(clientId: string, plainSecret: string): Promise<boolean> {
  const row = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.clientId, clientId),
  });
  if (!row) return false;
  return verifySecret(plainSecret, row.clientSecret);
}

export async function createOAuthClient(data: CreateOAuthClientData): Promise<DecryptedOAuthClient> {
  const [clientSecret, tokenSigningSecret] = await Promise.all([
    hashSecret(data.clientSecret),
    encrypt({ value: data.tokenSigningSecret, encrypted: false }),
  ]);
  const [row] = await db
    .insert(oauthClients)
    .values({ ...data, clientSecret, tokenSigningSecret })
    .returning();
  if (!row) throw new Error('Insert did not return a row');
  return decryptRow(row);
}

export async function bindOAuthClientToUser(clientId: string, userId: string): Promise<void> {
  await db.update(oauthClients).set({ userId }).where(eq(oauthClients.clientId, clientId));
}

/** List all OAuth clients for a user (no secrets returned). */
export async function listUserOAuthClients(userId: string): Promise<PublicOAuthClient[]> {
  const rows = await db.query.oauthClients.findMany({
    where: eq(oauthClients.userId, userId),
    orderBy: oauthClients.createdAt,
  });
  return rows.map(toPublic);
}

/**
 * Create a new OAuth client pre-bound to a user.
 * Returns the plain client secret ONE time — it is hashed and never stored in plain form.
 */
export async function createUserOAuthClient(
  userId: string,
  name: string | null,
  clientId?: string,
  plainClientSecret?: string,
): Promise<CreatedOAuthClient> {
  const id = clientId ?? `hub_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const secret = plainClientSecret ?? crypto.randomUUID();
  const tokenSigningSecret = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()].join('').replace(/-/g, '');

  const [hashedSecret, encryptedTss] = await Promise.all([
    hashSecret(secret),
    encrypt({ value: tokenSigningSecret, encrypted: false }),
  ]);

  const [row] = await db
    .insert(oauthClients)
    .values({
      clientId: id,
      clientSecret: hashedSecret,
      tokenSigningSecret: encryptedTss,
      userId,
      clientName: name,
      redirectUris: [],
      enabled: true,
    })
    .returning();
  if (!row) throw new Error('Insert did not return a row');

  return { ...toPublic(row), plainClientSecret: secret };
}

/** Delete (revoke) an OAuth client owned by the given user. */
export async function deleteUserOAuthClient(id: number, userId: string): Promise<void> {
  await db.delete(oauthClients).where(and(eq(oauthClients.id, id), eq(oauthClients.userId, userId)));
}

/** Delete all OAuth clients for a user. Returns the count deleted. */
export async function deleteAllUserOAuthClients(userId: string): Promise<number> {
  const result = await db
    .delete(oauthClients)
    .where(eq(oauthClients.userId, userId))
    .returning({ id: oauthClients.id });
  return result.length;
}

/** Toggle enabled state for an OAuth client owned by the given user. */
export async function setOAuthClientEnabled(id: number, userId: string, enabled: boolean): Promise<PublicOAuthClient> {
  const [row] = await db
    .update(oauthClients)
    .set({ enabled })
    .where(and(eq(oauthClients.id, id), eq(oauthClients.userId, userId)))
    .returning();
  if (!row) throw new Error('OAuth client not found');
  return toPublic(row);
}
