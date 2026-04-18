import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  TripDocumentTypes,
  TripPlacePriorities,
  TripSharePermissions,
  type TripBookingType,
  type TripDocumentType,
  type TripPlacePriority,
  type TripSharePermission,
} from '../../constants/travel';
import { users } from './users';

export const flightData = pgTable(
  'flight_data',
  {
    id: serial('id').primaryKey(),
    flightNumber: text('flight_number').notNull(),
    flightDate: date('flight_date').notNull(),
    // Airport
    originIata: text('origin_iata'),
    destinationIata: text('destination_iata'),
    // Scheduled times
    scheduledDepartureAt: timestamp('scheduled_departure_at'),
    scheduledArrivalAt: timestamp('scheduled_arrival_at'),
    // Actual / estimated times
    actualDepartureAt: timestamp('actual_departure_at'),
    actualArrivalAt: timestamp('actual_arrival_at'),
    // Gate info
    departureTerminal: text('departure_terminal'),
    departureGate: text('departure_gate'),
    arrivalTerminal: text('arrival_terminal'),
    // Status
    status: text('status'),
    // Aircraft
    aircraftType: text('aircraft_type'),
    aircraftRegistration: text('aircraft_registration'),
    // Airline
    airlineIata: text('airline_iata'),
    airlineName: text('airline_name'),
    // Fetch metadata
    lastFetchedAt: timestamp('last_fetched_at'),
    nextFetchAt: timestamp('next_fetch_at').notNull(),
    autoUpdateEnabled: boolean('auto_update_enabled').notNull().default(true),
    rawResponse: jsonb('raw_response'),
    finished: boolean('finished').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    flightDateUniqueIdx: uniqueIndex('uniq_flight_data_number_date').on(table.flightNumber, table.flightDate),
    nextFetchAtIdx: index('idx_flight_data_next_fetch_at').on(table.nextFetchAt),
    finishedIdx: index('idx_flight_data_finished').on(table.finished),
  }),
);

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
    cancelledAt: timestamp('cancelled_at'),
    notes: text('notes'),
    coverImageUrl: text('cover_image_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
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
    referenceLink: text('reference_link'),
    notes: text('notes'),
    details: jsonb('details'),
    flightDataId: integer('flight_data_id').references(() => flightData.id, { onDelete: 'set null' }),
    timezone: text('timezone'), // IANA timezone string, e.g. 'Europe/Chisinau'
    lat: real('lat'),
    lng: real('lng'),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
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
    priority: text('priority').$type<TripPlacePriority>().notNull().default(TripPlacePriorities.Medium),
    lat: real('lat'),
    lng: real('lng'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
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
  table => ({
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
  table => ({
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
    bookingId: integer('booking_id').references(() => tripBookings.id, { onDelete: 'set null' }),
    type: text('type').$type<TripDocumentType>().notNull().default(TripDocumentTypes.Other),
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
  table => ({
    tripIdIdx: index('idx_trip_documents_trip_id').on(table.tripId),
    bookingIdIdx: index('idx_trip_documents_booking_id').on(table.bookingId),
    userIdIdx: index('idx_trip_documents_user_id').on(table.userId),
  }),
);

export const tripDays = pgTable(
  'trip_days',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    date: date('date').notNull(), // calendar date, e.g. '2026-06-21'
    title: text('title'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    tripDayUniqueIdx: uniqueIndex('uniq_trip_days_trip_date').on(table.tripId, table.date),
    tripIdIdx: index('idx_trip_days_trip_id').on(table.tripId),
    userIdIdx: index('idx_trip_days_user_id').on(table.userId),
  }),
);

export const tripShares = pgTable(
  'trip_shares',
  {
    id: serial('id').primaryKey(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    sharedWithUserId: uuid('shared_with_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').$type<TripSharePermission>().notNull().default(TripSharePermissions.View),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    ownerTripUniqueIdx: uniqueIndex('uniq_trip_shares_owner_trip_shared_with').on(
      table.ownerUserId,
      table.tripId,
      table.sharedWithUserId,
    ),
    tripIdIdx: index('idx_trip_shares_trip_id').on(table.tripId),
    sharedWithUserIdIdx: index('idx_trip_shares_shared_with_user_id').on(table.sharedWithUserId),
  }),
);
