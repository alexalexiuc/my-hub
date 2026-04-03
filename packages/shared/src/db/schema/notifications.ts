import { pgTable, serial, text, boolean, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Stores per-user notification subscription preferences.
 * Absence of a row means the user is subscribed (default behaviour).
 * A row with subscribed=false means the user has opted out.
 */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subscriptionKey: text('subscription_key').notNull(),
    subscribed: boolean('subscribed').notNull().default(true),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userKeyIdx: uniqueIndex('notif_user_key_idx').on(table.userId, table.subscriptionKey),
  }),
);
