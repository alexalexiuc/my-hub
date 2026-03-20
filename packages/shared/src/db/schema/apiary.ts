import { pgTable, serial, uuid, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// Apiary Management tables
// ---------------------------------------------------------------------------

export const apiaryYards = pgTable('apiary_yards', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  location: text('location'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const apiaryHives = pgTable('apiary_hives', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  yardId: integer('yard_id').references(() => apiaryYards.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  queenStatus: text('queen_status'),
  queenMarked: boolean('queen_marked'),
  queenYear: integer('queen_year'),
  boxes: integer('boxes'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const apiaryLogs = pgTable('apiary_logs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  hiveId: integer('hive_id').references(() => apiaryHives.id, { onDelete: 'set null' }),
  loggedAt: timestamp('logged_at').notNull().defaultNow(),
  type: text('type').notNull(),
  notes: text('notes'),
  data: jsonb('data'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const apiaryTasks = pgTable('apiary_tasks', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  hiveId: integer('hive_id').references(() => apiaryHives.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  completed: boolean('completed').notNull().default(false),
  dueAt: timestamp('due_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
