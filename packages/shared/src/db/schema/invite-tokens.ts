import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const inviteTokens = pgTable('invite_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  usedBy: uuid('used_by').references(() => users.id),
  usedAt: timestamp('used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
