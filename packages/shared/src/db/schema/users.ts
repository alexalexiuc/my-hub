import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  active: boolean('active').notNull().default(true),
  country: text('country'), // ISO 3166-1 alpha-2, e.g. 'US', 'GB' — shared across services
  timezone: text('timezone'), // UTC offset string, e.g. '+2', '-5', '+5:30'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
