import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { oauthClients } from '../../db/schema/oauth-clients';
import type { OAuthClient, NewOAuthClient } from '../../types/index';
import { encrypt, decrypt } from '../../crypto/index';

// Secrets are stored encrypted in the DB; service layer always returns plain strings.
export type DecryptedOAuthClient = Omit<OAuthClient, 'clientSecret' | 'tokenSigningSecret'> & {
  clientSecret: string;
  tokenSigningSecret: string;
};

export type CreateOAuthClientData = Omit<
  NewOAuthClient,
  'id' | 'userId' | 'createdAt' | 'clientSecret' | 'tokenSigningSecret'
> & {
  clientSecret: string;
  tokenSigningSecret: string;
};

async function encryptSecrets(
  data: CreateOAuthClientData,
): Promise<Omit<NewOAuthClient, 'id' | 'userId' | 'createdAt'>> {
  const [clientSecret, tokenSigningSecret] = await Promise.all([
    encrypt({ value: data.clientSecret, encrypted: false }),
    encrypt({ value: data.tokenSigningSecret, encrypted: false }),
  ]);
  return { ...data, clientSecret, tokenSigningSecret };
}

async function decryptSecrets(row: OAuthClient): Promise<DecryptedOAuthClient> {
  const [clientSecret, tokenSigningSecret] = await Promise.all([
    decrypt(row.clientSecret),
    decrypt(row.tokenSigningSecret),
  ]);
  return { ...row, clientSecret: clientSecret.value, tokenSigningSecret: tokenSigningSecret.value };
}

export async function findOAuthClient(clientId: string): Promise<DecryptedOAuthClient | undefined> {
  const row = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.clientId, clientId),
  });
  if (!row) return undefined;
  return decryptSecrets(row);
}

export async function createOAuthClient(data: CreateOAuthClientData): Promise<DecryptedOAuthClient> {
  const encrypted = await encryptSecrets(data);
  const [row] = await db.insert(oauthClients).values(encrypted).returning();
  if (!row) throw new Error('Insert did not return a row');
  return decryptSecrets(row);
}

export async function bindOAuthClientToUser(clientId: string, userId: string): Promise<void> {
  await db.update(oauthClients).set({ userId }).where(eq(oauthClients.clientId, clientId));
}
