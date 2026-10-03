import {
  pgTable,
  serial,
  text,
  timestamp,
  date,
  integer,
  real,
  uuid,
  boolean,
  index,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type {
  HolidayKind,
  HolidaySource,
  LeaveStatus,
  LeaveUnit,
  RateBasis,
  RuleSetStatus,
  SalaryKind,
  TaxRegimeKind,
} from '../../constants/vacation';
import { users } from './users';

// ---------------------------------------------------------------------------
// Vacation planner tables. All amounts are MDL; all dates are YYYY-MM-DD.
// Overlap rules (rule sets, tax regimes, leave periods) are enforced in the service layer.
// ---------------------------------------------------------------------------

export const vacationProfiles = pgTable('vacation_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  country: text('country').notNull(), // ISO 3166-1 alpha-2, e.g. 'MD'
  region: text('region'), // locality whose hram day applies, e.g. 'Chisinau'; null = national only
  employer: text('employer').notNull(),
  // Balance is a snapshot: leave before openingBalanceDate is already reflected in it.
  openingBalanceDays: real('opening_balance_days').notNull(),
  openingBalanceDate: date('opening_balance_date').notNull(),
  // Accrual begins the day after max(openingBalanceDate, accrualStart).
  accrualStart: date('accrual_start'),
  // Gross monthly base salary for months with no salary row and no earlier projected row, instead of
  // carrying the latest actual row forward. Null = carry forward, with a warning.
  baseSalaryMdl: real('base_salary_mdl'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const vacationRuleSets = pgTable(
  'vacation_rule_sets',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    country: text('country').notNull(),
    region: text('region'), // null = applies to the whole country
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'), // inclusive; null = open-ended
    leaveUnit: text('leave_unit').$type<LeaveUnit>().notNull(),
    annualEntitlementDays: real('annual_entitlement_days').notNull(),
    avgWindowMonths: integer('avg_window_months').notNull().default(3),
    rateBasis: text('rate_basis').$type<RateBasis>().notNull(),
    // HG 426: a base-salary raise inside the averaging window restarts the window at the raise month.
    raiseResetsWindow: boolean('raise_resets_window').notNull().default(true),
    status: text('status').$type<RuleSetStatus>().notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => [index('vacation_rule_sets_user_idx').on(table.userId)],
);

export const vacationTaxRegimes = pgTable(
  'vacation_tax_regimes',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    employer: text('employer').notNull(),
    regime: text('regime').$type<TaxRegimeKind>().notNull(),
    medicalRate: real('medical_rate').notNull(), // AOAM, withheld from gross
    incomeTaxRate: real('income_tax_rate').notNull(), // applied to gross − AOAM
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),
  },
  table => [index('vacation_tax_regimes_user_idx').on(table.userId)],
);

export const vacationSalaryMonths = pgTable(
  'vacation_salary_months',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: date('month').notNull(), // first day of the month the salary was earned in
    // Gross monthly base salary for a fully worked month. A projected row carries forward to later
    // months without a row; after an actual row they use the profile's baseSalaryMdl when set.
    baseMdl: real('base_mdl').notNull(),
    // Other gross earnings attributed to this month that HG 426 counts (bonuses, allowances). Never carried forward.
    extraMdl: real('extra_mdl').notNull().default(0),
    kind: text('kind').$type<SalaryKind>().notNull(),
    notes: text('notes'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => [primaryKey({ columns: [table.userId, table.month] })],
);

export const vacationLeavePeriods = pgTable(
  'vacation_leave_periods',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(), // inclusive
    status: text('status').$type<LeaveStatus>().notNull(),
    payReceivedMdl: real('pay_received_mdl'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => [index('vacation_leave_periods_user_start_idx').on(table.userId, table.startDate)],
);

export const vacationHolidays = pgTable(
  'vacation_holidays',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    country: text('country').notNull(),
    region: text('region').notNull().default(''), // '' = national; otherwise the locality (hram day)
    kind: text('kind').$type<HolidayKind>().notNull(),
    name: text('name').notNull(),
    source: text('source').$type<HolidaySource>().notNull(),
  },
  table => [unique('uq_vacation_holidays_scope').on(table.userId, table.date, table.country, table.region)],
);
