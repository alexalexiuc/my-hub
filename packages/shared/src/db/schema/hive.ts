import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Hive Manager tables
// ---------------------------------------------------------------------------

export const hives = pgTable('hives', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  location: text('location'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const hiveLogs = pgTable('hive_logs', {
  id: serial('id').primaryKey(),
  hiveId: integer('hive_id')
    .notNull()
    .references(() => hives.id, { onDelete: 'cascade' }),
  loggedAt: timestamp('logged_at').notNull().defaultNow(),
  type: text('type').notNull(), // inspection | treatment | feeding | relocation | note
  notes: text('notes'),
  data: jsonb('data'), // flexible payload per log type
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const hiveTodos = pgTable('hive_todos', {
  id: serial('id').primaryKey(),
  hiveId: integer('hive_id').references(() => hives.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  completed: boolean('completed').notNull().default(false),
  dueAt: timestamp('due_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
