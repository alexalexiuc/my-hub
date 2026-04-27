import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import type { AccountType, TransactionType, CategoryIcon } from '../../constants/finances';
import type { TransactionDetails } from '../../types/transaction-details';

// ─── Budget (household) ───────────────────────────────────────────────────

export const financeBudgets = pgTable('finance_budgets', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  defaultCurrency: text('default_currency').notNull().default('MDL'),
  // The user who created the budget — informational, does not imply elevated permissions.
  // All permission logic is driven by financeBudgetMembers.
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const financeBudgetMembers = pgTable(
  'finance_budget_members',
  {
    budgetId: integer('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  table => ({
    pk: primaryKey({ columns: [table.budgetId, table.userId] }),
    budgetIdIdx: index('idx_finance_budget_members_budget').on(table.budgetId),
    userIdIdx: index('idx_finance_budget_members_user').on(table.userId),
  }),
);

// ─── Accounts ─────────────────────────────────────────────────────────────

export const financeAccounts = pgTable(
  'finance_accounts',
  {
    id: serial('id').primaryKey(),
    budgetId: integer('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').$type<AccountType>().notNull(),
    currency: text('currency').notNull(),
    openingBalance: numeric('opening_balance', { precision: 18, scale: 4 }).notNull().default('0'),
    // Running balance — updated on every transaction insert/update/delete.
    // For Investment/Tracking: manually-overridden current value.
    balance: numeric('balance', { precision: 18, scale: 4 }).notNull().default('0'),
    archived: boolean('archived').notNull().default(false),
    // Type-specific fields — see BankAccountDetails, LoanAccountDetails, etc. in constants
    details: jsonb('details'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    budgetIdIdx: index('idx_finance_accounts_budget').on(table.budgetId),
    typeIdx: index('idx_finance_accounts_type').on(table.type),
  }),
);

// ─── Groups (replaces parentId on categories) ────────────────────────────

export const financeGroups = pgTable(
  'finance_groups',
  {
    id: serial('id').primaryKey(),
    budgetId: integer('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    budgetIdIdx: index('idx_finance_groups_budget').on(table.budgetId),
  }),
);

// ─── Categories ───────────────────────────────────────────────────────────

export const financeCategories = pgTable(
  'finance_categories',
  {
    id: serial('id').primaryKey(),
    budgetId: integer('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // null = ungrouped
    groupId: integer('group_id').references(() => financeGroups.id, { onDelete: 'set null' }),
    color: text('color'),
    // Icon key — maps to a UI component via CategoryIcons constant in the Hub package
    icon: text('icon').$type<CategoryIcon>(),
    // Optional monthly spending target — nullable, no envelope-style allocation
    monthlyTarget: numeric('monthly_target', { precision: 18, scale: 4 }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    budgetIdIdx: index('idx_finance_categories_budget').on(table.budgetId),
    groupIdIdx: index('idx_finance_categories_group').on(table.groupId),
  }),
);

// ─── Payees ───────────────────────────────────────────────────────────────
// Normalised payee list — powers autofill suggestions and spending-by-payee reports.
// Unique by (budgetId, normalizedName) for case-insensitive duplicate prevention.

export interface PayeeUserStats {
  count: number;
  lastUsedAt: string | null;
  lastUsedCategoryId: number | null;
}

export const financePayees = pgTable(
  'finance_payees',
  {
    id: serial('id').primaryKey(),
    budgetId: integer('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // lower(trim(name)) — used for case-insensitive uniqueness check
    normalizedName: text('normalized_name').notNull(),
    // keyed by userId string; tracks per-user usage for ranked suggestions
    statsByUser: jsonb('stats_by_user').$type<Record<string, PayeeUserStats>>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => ({
    budgetNormUniq: uniqueIndex('uq_finance_payees_budget_norm').on(table.budgetId, table.normalizedName),
    budgetIdx: index('idx_finance_payees_budget').on(table.budgetId),
  }),
);

// ─── Transactions ─────────────────────────────────────────────────────────

export const financeTransactions = pgTable(
  'finance_transactions',
  {
    id: serial('id').primaryKey(),
    budgetId: integer('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    type: text('type').$type<TransactionType>().notNull(),

    // For expense/income: the account. For transfer: the source account.
    accountId: integer('account_id')
      .notNull()
      .references(() => financeAccounts.id, { onDelete: 'restrict' }),
    // Transfer destination — null for expense/income.
    toAccountId: integer('to_account_id').references(() => financeAccounts.id, { onDelete: 'restrict' }),

    amount: numeric('amount', { precision: 18, scale: 4 }).notNull(), // in account currency
    // Exchange rate at insert time (account currency → budget default currency). 1.0 if same.
    exchangeRate: numeric('exchange_rate', { precision: 18, scale: 8 }).notNull().default('1'),

    date: date('date').notNull(), // YYYY-MM-DD, user-visible date
    categoryId: integer('category_id').references(() => financeCategories.id, { onDelete: 'set null' }),
    payeeId: integer('payee_id').references(() => financePayees.id, { onDelete: 'set null' }),

    // Human-readable note — shown in UI, indexed for search.
    // AI entries are encouraged to populate this with a plain-language summary.
    notes: text('notes'),

    // Structured metadata — optionally populated by MCP/AI at insert time.
    // See TransactionDetails in src/types/transaction-details.ts for typed shapes.
    // Human-entered transactions will typically leave this null.
    extras: jsonb('extras').$type<TransactionDetails>(),

    // Marks balance-correction entries (e.g. reconciliation adjustments).
    // Corrections are excluded from spending reports and cashflow summaries
    // but are visible in the account ledger view.
    isCorrection: boolean('is_correction').notNull().default(false),

    // Ledger snapshots — balance of the account immediately after this transaction.
    fromAccountBalanceAfter: numeric('from_account_balance_after', { precision: 18, scale: 4 }),
    toAccountBalanceAfter: numeric('to_account_balance_after', { precision: 18, scale: 4 }),

    // Owner — always assigned from session in the service layer, never from client input.
    addedByUserId: uuid('added_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    budgetIdIdx: index('idx_finance_txns_budget').on(table.budgetId),
    accountIdIdx: index('idx_finance_txns_account').on(table.accountId),
    toAccountIdx: index('idx_finance_txns_to_account').on(table.toAccountId),
    dateIdx: index('idx_finance_txns_date').on(table.date),
    categoryIdx: index('idx_finance_txns_category').on(table.categoryId),
    payeeIdx: index('idx_finance_txns_payee').on(table.payeeId),
    addedByIdx: index('idx_finance_txns_added_by').on(table.addedByUserId),
    // Composite — most common query pattern: budget + date range
    budgetDateIdx: index('idx_finance_txns_budget_date').on(table.budgetId, table.date),
  }),
);

// ─── Currency rates cache ─────────────────────────────────────────────────
// Cache-first: same (from, to, date) triple is never fetched twice.

export const financeCurrencyRates = pgTable(
  'finance_currency_rates',
  {
    fromCurrency: text('from_currency').notNull(),
    toCurrency: text('to_currency').notNull(),
    date: date('date').notNull(), // YYYY-MM-DD
    rate: numeric('rate', { precision: 18, scale: 8 }).notNull(),
    fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  },
  table => ({
    pk: primaryKey({ columns: [table.fromCurrency, table.toCurrency, table.date] }),
  }),
);

// ─── Net worth snapshots ──────────────────────────────────────────────────
// Written by a nightly/weekly job. One row per budget per month.

export const financeNetWorthSnapshots = pgTable(
  'finance_net_worth_snapshots',
  {
    id: serial('id').primaryKey(),
    budgetId: integer('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    month: text('month').notNull(), // YYYY-MM
    totalAssets: numeric('total_assets', { precision: 18, scale: 4 }).notNull(),
    totalLiabilities: numeric('total_liabilities', { precision: 18, scale: 4 }).notNull(),
    netWorth: numeric('net_worth', { precision: 18, scale: 4 }).notNull(),
    // Full per-account breakdown for history drilldown
    breakdown: jsonb('breakdown').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  table => ({
    budgetMonthUniq: uniqueIndex('uq_finance_net_worth_budget_month').on(table.budgetId, table.month),
    budgetIdIdx: index('idx_finance_net_worth_budget').on(table.budgetId),
  }),
);
