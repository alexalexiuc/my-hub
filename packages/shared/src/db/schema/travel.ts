import { boolean, index, integer, jsonb, pgTable, real, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const TripStatuses = {
  Planned: 'planned',
  Active: 'active',
  Completed: 'completed',
  Cancelled: 'cancelled',
} as const;
export type TripStatus = (typeof TripStatuses)[keyof typeof TripStatuses];
export const tripStatusValues: TripStatus[] = Object.values(TripStatuses);

export const TripBookingTypes = {
  Flight: 'flight',
  Accommodation: 'accommodation',
  RentalCar: 'rental_car',
  Train: 'train',
  Bus: 'bus',
  Ferry: 'ferry',
  Taxi: 'taxi',
  Restaurant: 'restaurant',
  Tour: 'tour',
  Activity: 'activity',
  Ticket: 'ticket',
  Other: 'other',
} as const;
export type TripBookingType = (typeof TripBookingTypes)[keyof typeof TripBookingTypes];
export const tripBookingTypeValues = Object.values(TripBookingTypes) as TripBookingType[];

export const TripPlacePriorities = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;
export type TripPlacePriority = (typeof TripPlacePriorities)[keyof typeof TripPlacePriorities];
export const tripPlacePriorityValues = Object.values(TripPlacePriorities) as TripPlacePriority[];

export const TripDocumentTypes = {
  Passport: 'passport',
  Visa: 'visa',
  BoardingPass: 'boarding_pass',
  Voucher: 'voucher',
  Ticket: 'ticket',
  Other: 'other',
} as const;
export type TripDocumentType = (typeof TripDocumentTypes)[keyof typeof TripDocumentTypes];
export const tripDocumentTypeValues = Object.values(TripDocumentTypes) as TripDocumentType[];

export const trips = pgTable(
  'trips',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#3B82F6'),
    destination: text('destination'),
    startAt: timestamp('start_at'),
    endAt: timestamp('end_at'),
    status: text('status').$type<TripStatus>().notNull().default('planned'),
    notes: text('notes'),
    coverImageUrl: text('cover_image_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_trips_user_id').on(table.userId),
    startAtIdx: index('idx_trips_start_at').on(table.startAt),
  }),
);

export const tripBookings = pgTable(
  'trip_bookings',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    bookingType: text('booking_type').$type<TripBookingType>().notNull(),
    title: text('title').notNull(),
    provider: text('provider'),
    confirmationNumber: text('confirmation_number'),
    startAt: timestamp('start_at'),
    endAt: timestamp('end_at'),
    status: text('status'),
    costAmount: real('cost_amount'),
    costCurrency: text('cost_currency').notNull().default('EUR'),
    location: text('location'),
    notes: text('notes'),
    details: jsonb('details'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tripIdIdx: index('idx_trip_bookings_trip_id').on(table.tripId),
    userIdIdx: index('idx_trip_bookings_user_id').on(table.userId),
    startAtIdx: index('idx_trip_bookings_start_at').on(table.startAt),
  }),
);

export const tripPlaces = pgTable(
  'trip_places',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    location: text('location'),
    notes: text('notes'),
    visited: boolean('visited').notNull().default(false),
    priority: text('priority').$type<TripPlacePriority>().notNull().default('medium'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tripIdIdx: index('idx_trip_places_trip_id').on(table.tripId),
    userIdIdx: index('idx_trip_places_user_id').on(table.userId),
  }),
);

export const tripChecklistItems = pgTable(
  'trip_checklist_items',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    done: boolean('done').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tripIdIdx: index('idx_trip_checklist_items_trip_id').on(table.tripId),
    userIdIdx: index('idx_trip_checklist_items_user_id').on(table.userId),
  }),
);

export const tripCompanions = pgTable(
  'trip_companions',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tripIdIdx: index('idx_trip_companions_trip_id').on(table.tripId),
    userIdIdx: index('idx_trip_companions_user_id').on(table.userId),
  }),
);

export const tripDocuments = pgTable(
  'trip_documents',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    type: text('type').$type<TripDocumentType>().notNull().default('other'),
    title: text('title').notNull(),
    notes: text('notes'),
    sourceUrl: text('source_url'),
    originalName: text('original_name'),
    mimeType: text('mime_type'),
    byteSize: integer('byte_size'),
    storagePath: text('storage_path'),
    publicUrl: text('public_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tripIdIdx: index('idx_trip_documents_trip_id').on(table.tripId),
    userIdIdx: index('idx_trip_documents_user_id').on(table.userId),
  }),
);
