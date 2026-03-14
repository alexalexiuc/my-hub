import { sql } from 'drizzle-orm';
import { pgTable, serial, text, uuid, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import type { EncryptedString } from '../../crypto/index';

export const oauthClients = pgTable('oauth_clients', {
  id: serial('id').primaryKey(),
  clientId: text('client_id').notNull().unique(),
  // Client sends this to /token for authentication
  clientSecret: jsonb('client_secret').notNull().$type<EncryptedString>(),
  // Server-only secret used to HMAC-sign auth codes and access tokens (never sent to client)
  tokenSigningSecret: jsonb('token_signing_secret').notNull().$type<EncryptedString>(),
  // null until the user completes /authorize
  userId: uuid('user_id').references(() => users.id),
  clientName: text('client_name'),
  redirectUris: text('redirect_uris')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
