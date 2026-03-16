import { pgTable, serial, text, timestamp, real, uuid, index } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// Body Measurements tables
// ---------------------------------------------------------------------------

export const measurementTypeKeys = ['weight', 'height', 'neck', 'waist', 'hips', 'chest', 'bicep', 'body_fat'] as const;

export type MeasurementTypeKey = (typeof measurementTypeKeys)[number];

/** Lookup table for measurement types (weight, height, neck, etc.) */
export const measurementTypes = pgTable('measurement_types', {
  key: text('key').$type<MeasurementTypeKey>().primaryKey(), // e.g. 'weight', 'height', 'neck'
  label: text('label').notNull(), // e.g. 'Weight', 'Height', 'Neck circumference'
  unit: text('unit').notNull(), // e.g. 'kg', 'cm', '%'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Time-series body measurements per user */
export const bodyMeasurements = pgTable(
  'body_measurements',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    typeKey: text('type_key')
      .$type<MeasurementTypeKey>()
      .notNull()
      .references(() => measurementTypes.key),
    date: text('date').notNull(), // YYYY-MM-DD
    value: real('value').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_body_measurements_user').on(table.userId),
    dateIdx: index('idx_body_measurements_date').on(table.date),
    userDateIdx: index('idx_body_measurements_user_date').on(table.userId, table.date),
    userTypeIdx: index('idx_body_measurements_user_type').on(table.userId, table.typeKey),
  }),
);
