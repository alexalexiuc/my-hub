import { pgTable, serial, text, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const todos = pgTable('todos', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  done: boolean('done').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
