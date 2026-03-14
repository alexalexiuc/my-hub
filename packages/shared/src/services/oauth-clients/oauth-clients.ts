import { eq } from 'drizzle-orm';
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

async function decryptRow(row: OAuthClient): Promise<DecryptedOAuthClient> {
  const { value: tokenSigningSecret } = await decrypt(row.tokenSigningSecret);
  return { ...row, tokenSigningSecret };
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
