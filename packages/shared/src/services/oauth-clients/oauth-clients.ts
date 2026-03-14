import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { oauthClients } from '../../db/schema/oauth-clients';
import type { OAuthClient, NewOAuthClient } from '../../types/index';

export type CreateOAuthClientData = Omit<NewOAuthClient, 'id' | 'userId' | 'createdAt'>;

export async function findOAuthClient(clientId: string): Promise<OAuthClient | undefined> {
  return db.query.oauthClients.findFirst({
    where: eq(oauthClients.clientId, clientId),
  });
}

export async function createOAuthClient(data: CreateOAuthClientData): Promise<OAuthClient> {
  const [row] = await db.insert(oauthClients).values(data).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function bindOAuthClientToUser(clientId: string, userId: string): Promise<void> {
  await db.update(oauthClients).set({ userId }).where(eq(oauthClients.clientId, clientId));
}
