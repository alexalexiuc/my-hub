import { pgTable, serial, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { oauthClients } from './oauth-clients';
import { users } from './users';

export const oauthRefreshTokens = pgTable('oauth_refresh_tokens', {
  id: serial('id').primaryKey(),
  // FK to oauth_clients.client_id — cascade on client deletion
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  // FK to users — cascade on user deletion
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Scrypt-hashed refresh token — never stored in plain form
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
