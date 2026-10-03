/**
 * Finance transaction CRUD
 * Money rules (see transaction-money.ts): amount is always in the source account's currency; transfers carry toAmount in the
 * destination currency; reportingAmount (budget default currency) is frozen at write time and is what reports sum.
 * - addTransaction(userId, budgetId, data) — inserts a transaction (amount optionally in data.amountCurrency at data.rate / market rate; transfers take data.toAmount); updates account balances
 * - addCorrectionTransaction(userId, budgetId, data) — balance correction by target value (account currency); delta computed atomically from live DB balance; returns CorrectionResult (with currency) or null if already at target
 * - getTransactions(userId, budgetId, opts?) — lists transactions with optional filters (accountId, categoryId, type, fromDate, toDate, includeCorrections, search, itemName, label [string | null — null finds transactions with no labels], amountGte, amountLte, limit, offset)
 * - getTransactionListItems(userId, budgetId, opts?) — same filters as getTransactions; returns pre-resolved display fields (accountName/Currency, toAccountName/Currency, categoryId/Name/Color/Icon, payeeId/Name, addedByUserId/Initials, createdAt, balances) via JOIN
 * - getTransactionListItemById(userId, budgetId, transactionId) — single TransactionListItem with resolved display fields; null if not found
 * - countTransactions(userId, budgetId, opts?) — same filters; returns total count
 * - getTransactionById(userId, budgetId, transactionId) — single transaction with access check
 * - updateTransaction(userId, budgetId, transactionId, data) — partial update; re-resolves money only when type/accounts/amount/currency/rate/toAmount/date change (reporting value otherwise stays frozen); recomputes account balances
 * - deleteTransaction(userId, budgetId, transactionId) — hard delete; reverses account balance effects; decrements payee stats
 * - checkDuplicateTransaction(userId, budgetId, opts) — checks for existing transaction matching (accountId, date, amount in account currency, payeeId), optionally excluding one id
 * Types: TransactionInsert, TransactionUpdate, GetTransactionsOpts, DuplicateCheckOpts, TransactionListItem, CorrectionInsert, CorrectionResult
 */
import { and, desc, eq, gte, ilike, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, type DbOrTx } from '../../db/client';
import {
  financeAccounts,
  financeCategories,
  financeGroups,
  financePayees,
  financeTransactions,
} from '../../db/schema/finances';
import { users } from '../../db/schema/users';
import { logger, omitUndefined } from '../../utils';
import { getBudgetDefaultCurrency, hasAccessToBudget } from './budgets';
import { syncTransactionWithPlan } from './monthly-plans';
import { resolveTransactionMoney, round4, transferToAmount, withConversion } from './transaction-money';
import type { FinanceTransaction, NewFinanceTransaction, TransactionDetails } from '../../types';
import {
  CategoryIcon,
  FxRateSources,
  TransactionTypes,
  type SupportedCurrency,
  type TransactionType,
} from '../../constants/finances';

/**
 * Money columns derived by the service (never taken from callers): exchangeRate, toExchangeRate,
 * reportingAmount and the balance snapshots. `amount` is in `amountCurrency` when given (default:
 * the source account's currency) and is converted into the account currency at `rate` or the
 * transaction-date market rate. Transfers between accounts in different currencies need `toAmount`
 * (received, destination currency) — see resolveTransactionMoney for the full rules.
 */
export type TransactionInsert = Omit<
  NewFinanceTransaction,
  | 'id'
  | 'budgetId'
  | 'addedByUserId'
  | 'createdAt'
  | 'updatedAt'
  | 'exchangeRate'
  | 'toExchangeRate'
  | 'reportingAmount'
  | 'fromAccountBalanceAfter'
  | 'toAccountBalanceAfter'
> & {
  amountCurrency?: string | null;
  /** 1 amountCurrency = rate × account currency. Only when amountCurrency differs from the account's. */
  rate?: number | null;
};
export type TransactionUpdate = Partial<
  Pick<
    TransactionInsert,
    | 'type'
    | 'accountId'
    | 'toAccountId'
    | 'amount'
    | 'amountCurrency'
    | 'rate'
    | 'toAmount'
    | 'date'
    | 'categoryId'
    | 'payeeId'
    | 'notes'
    | 'labels'
    | 'extras'
    | 'isCorrection'
  >
>;

export interface GetTransactionsOpts {
  accountId?: number;
  categoryId?: number | null;
  payeeId?: number | null;
  type?: TransactionType;
  fromDate?: string;
  toDate?: string;
  includeCorrections?: boolean;
  search?: string;
  itemName?: string;
  label?: string | null;
  addedByUserId?: string;
  amountGte?: number;
  amountLte?: number;
  limit?: number;
  offset?: number;
}

export interface DuplicateCheckOpts {
  accountId: number;
  date: string;
  /** In the account's currency (the stored amount). */
  amount: number;
  payeeId: number | null;
  /** Ignore this transaction — lets callers check right after inserting it. */
  excludeTransactionId?: number;
}

export interface TransactionListItem {
  id: number;
  date: string;
  /** In the source account's currency (accountCurrency). */
  amount: number;
  /** Transfers: amount received, in toAccountCurrency. */
  toAmount: number | null;
  /** Value in the budget's default currency, frozen at write time. */
  reportingAmount: number;
  type: TransactionType;
  isCorrection: boolean;
  notes: string | null;
  labels: string[];
  accountId: number;
  accountName: string;
  accountCurrency: SupportedCurrency;
  toAccountId: number | null;
  toAccountName: string | null;
  toAccountCurrency: SupportedCurrency | null;
  categoryId: number | null;
  groupName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: CategoryIcon | null;
  payeeId: number | null;
  payeeName: string | null;
  addedByUserId: string;
  addedByInitials: string | null;
  createdAt: Date;
  fromAccountBalanceAfter: number | null;
  toAccountBalanceAfter: number | null;
  extras: TransactionDetails | null;
}

function computeInitials(name: string | null, email: string): string {
  const raw = name?.trim() || email;
  const parts = raw.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length >= 2 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return parts.length >= 2 ? (first + last).toUpperCase() : raw.slice(0, 2).toUpperCase();
}

function buildListConditions(budgetId: number, opts: GetTransactionsOpts) {
  const conditions = [eq(financeTransactions.budgetId, budgetId)];
  if (opts.accountId !== undefined) {
    conditions.push(
      or(eq(financeTransactions.accountId, opts.accountId), eq(financeTransactions.toAccountId, opts.accountId))!,
    );
  }
  if (opts.categoryId === null) {
    conditions.push(isNull(financeTransactions.categoryId));
  } else if (opts.categoryId !== undefined) {
    conditions.push(eq(financeTransactions.categoryId, opts.categoryId));
  }
  if (opts.payeeId === null) {
    conditions.push(isNull(financeTransactions.payeeId));
  } else if (opts.payeeId !== undefined) {
    conditions.push(eq(financeTransactions.payeeId, opts.payeeId));
  }
  if (opts.type !== undefined) {
    conditions.push(eq(financeTransactions.type, opts.type));
  }
  if (opts.fromDate !== undefined) {
    conditions.push(gte(financeTransactions.date, opts.fromDate));
  }
  if (opts.toDate !== undefined) {
    conditions.push(lte(financeTransactions.date, opts.toDate));
  }
  if (!opts.includeCorrections) {
    conditions.push(eq(financeTransactions.isCorrection, false));
  }
  if (opts.search !== undefined && opts.search.trim() !== '') {
    conditions.push(ilike(financeTransactions.notes, `%${opts.search}%`));
  }
  if (opts.itemName !== undefined && opts.itemName.trim() !== '') {
    // Fuzzy match against receipt line item names stored in extras.items[].name (see TransactionDetails).
    conditions.push(sql`EXISTS (
      SELECT 1 FROM jsonb_array_elements(${financeTransactions.extras}->'items') AS item
      WHERE item->>'name' ILIKE ${`%${opts.itemName.trim()}%`}
    )`);
  }
  if (opts.label === null) {
    conditions.push(sql`jsonb_array_length(${financeTransactions.labels}) = 0`);
  } else if (opts.label !== undefined) {
    conditions.push(sql`${financeTransactions.labels} @> ${JSON.stringify([opts.label])}::jsonb`);
  }
  if (opts.addedByUserId !== undefined) {
    conditions.push(eq(financeTransactions.addedByUserId, opts.addedByUserId));
  }
  if (opts.amountGte !== undefined) {
    conditions.push(gte(financeTransactions.amount, opts.amountGte));
  }
  if (opts.amountLte !== undefined) {
    conditions.push(lte(financeTransactions.amount, opts.amountLte));
  }
  return conditions;
}

function buildListQuery(budgetId: number, opts: GetTransactionsOpts, extraConditions: SQL[] = []) {
  const fromAcct = alias(financeAccounts, 'from_acct');
  const toAcct = alias(financeAccounts, 'to_acct');
  const conditions = [...buildListConditions(budgetId, opts), ...extraConditions];

  let q = db
    .select({
      id: financeTransactions.id,
      date: financeTransactions.date,
      amount: financeTransactions.amount,
      toAmount: financeTransactions.toAmount,
      toExchangeRate: financeTransactions.toExchangeRate,
      reportingAmount: financeTransactions.reportingAmount,
      type: financeTransactions.type,
      isCorrection: financeTransactions.isCorrection,
      notes: financeTransactions.notes,
      labels: financeTransactions.labels,
      accountId: financeTransactions.accountId,
      accountName: fromAcct.name,
      accountCurrency: fromAcct.currency,
      toAccountId: financeTransactions.toAccountId,
      toAccountName: toAcct.name,
      toAccountCurrency: toAcct.currency,
      categoryId: financeTransactions.categoryId,
      categoryName: financeCategories.name,
      categoryColor: financeCategories.color,
      categoryIcon: financeCategories.icon,
      groupName: financeGroups.name,
      payeeId: financeTransactions.payeeId,
      payeeName: financePayees.name,
      addedByUserId: financeTransactions.addedByUserId,
      addedByUserName: users.name,
      addedByUserEmail: users.email,
      createdAt: financeTransactions.createdAt,
      fromAccountBalanceAfter: financeTransactions.fromAccountBalanceAfter,
      toAccountBalanceAfter: financeTransactions.toAccountBalanceAfter,
      extras: financeTransactions.extras,
    })
    .from(financeTransactions)
    .innerJoin(fromAcct, eq(financeTransactions.accountId, fromAcct.id))
    .leftJoin(toAcct, eq(financeTransactions.toAccountId, toAcct.id))
    .leftJoin(financeCategories, eq(financeTransactions.categoryId, financeCategories.id))
    .leftJoin(financePayees, eq(financeTransactions.payeeId, financePayees.id))
    .leftJoin(financeGroups, eq(financeCategories.groupId, financeGroups.id))
    .innerJoin(users, eq(financeTransactions.addedByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(financeTransactions.date), desc(financeTransactions.id));

  if (opts.limit !== undefined) {
    q = q.limit(opts.limit) as typeof q;
  }
  if (opts.offset !== undefined) {
    q = q.offset(opts.offset) as typeof q;
  }
  return q;
}

function rowToListItem(row: Awaited<ReturnType<typeof buildListQuery>>[number]): TransactionListItem {
  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    toAmount: row.type === TransactionTypes.Transfer ? transferToAmount(row) : null,
    reportingAmount: row.reportingAmount,
    type: row.type,
    isCorrection: row.isCorrection,
    notes: row.notes ?? null,
    labels: (row.labels as string[]) ?? [],
    accountId: row.accountId,
    accountName: row.accountName,
    accountCurrency: row.accountCurrency,
    toAccountId: row.toAccountId ?? null,
    toAccountName: row.toAccountName ?? null,
    toAccountCurrency: row.toAccountCurrency ?? null,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    categoryColor: row.categoryColor ?? null,
    categoryIcon: row.categoryIcon ?? null,
    groupName: row.groupName ?? null,
    payeeId: row.payeeId ?? null,
    payeeName: row.payeeName ?? null,
    addedByUserId: row.addedByUserId,
    addedByInitials: computeInitials(row.addedByUserName, row.addedByUserEmail),
    createdAt: row.createdAt,
    fromAccountBalanceAfter: row.fromAccountBalanceAfter ?? null,
    toAccountBalanceAfter: row.toAccountBalanceAfter ?? null,
    extras: row.extras ?? null,
  };
}

export async function getTransactionListItems(
  userId: string,
  budgetId: number,
  opts: GetTransactionsOpts = {},
): Promise<TransactionListItem[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }
  const rows = await buildListQuery(budgetId, opts);
  return rows.map(rowToListItem);
}

export async function getTransactionListItemById(
  userId: string,
  budgetId: number,
  transactionId: number,
): Promise<TransactionListItem | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }
  const rows = await buildListQuery(budgetId, { includeCorrections: true }, [
    eq(financeTransactions.id, transactionId),
  ]);
  return rows[0] ? rowToListItem(rows[0]) : null;
}

/** Balance + currency of one account in the budget, read inside the caller's transaction. */
async function selectAccount(tx: DbOrTx, budgetId: number, accountId: number) {
  const [acct] = await tx
    .select({ balance: financeAccounts.balance, currency: financeAccounts.currency })
    .from(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.budgetId, budgetId)));
  return acct;
}

export async function addTransaction(
  userId: string,
  budgetId: number,
  data: TransactionInsert,
): Promise<FinanceTransaction> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  if (data.type === TransactionTypes.Transfer && data.toAccountId == null) {
    throw new Error('Transfer transactions require a destination account (toAccountId)');
  }
  if (data.type === TransactionTypes.Transfer && data.toAccountId === data.accountId) {
    throw new Error('Transfer source and destination must be different accounts');
  }

  const { amountCurrency, rate, toAmount: inputToAmount, ...dbData } = data;

  const result = await db.transaction(async tx => {
    const budgetCurrency = await getBudgetDefaultCurrency(budgetId, tx);

    const fromAccount = await selectAccount(tx, budgetId, data.accountId);
    if (!fromAccount) throw new Error('Account not found');

    const toAccount =
      data.type === TransactionTypes.Transfer && data.toAccountId != null
        ? await selectAccount(tx, budgetId, data.toAccountId)
        : undefined;
    if (data.type === TransactionTypes.Transfer && !toAccount) throw new Error('Destination account not found');

    const money = await resolveTransactionMoney({
      type: data.type,
      date: data.date,
      inputAmount: data.amount,
      // Legacy callers put the original currency in extras.conversion instead of amountCurrency.
      inputCurrency: amountCurrency ?? data.extras?.conversion?.originalCurrency ?? null,
      rate,
      toAmount: inputToAmount,
      accountCurrency: fromAccount.currency,
      toAccountCurrency: toAccount?.currency ?? null,
      budgetCurrency,
      isCorrection: data.isCorrection === true,
    });

    const fromBalanceAfter = round4(
      data.type === TransactionTypes.Income ? fromAccount.balance + money.amount : fromAccount.balance - money.amount,
    );

    await tx
      .update(financeAccounts)
      .set({ balance: fromBalanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    let toBalanceAfter: number | null = null;
    if (toAccount && data.toAccountId != null && money.toAmount != null) {
      toBalanceAfter = round4(toAccount.balance + money.toAmount);
      await tx
        .update(financeAccounts)
        .set({ balance: toBalanceAfter, updatedAt: new Date() })
        .where(and(eq(financeAccounts.id, data.toAccountId), eq(financeAccounts.budgetId, budgetId)));
    }

    const [row] = await tx
      .insert(financeTransactions)
      .values({
        ...dbData,
        toAccountId: data.type === TransactionTypes.Transfer ? data.toAccountId : null,
        amount: money.amount,
        exchangeRate: money.exchangeRate,
        toExchangeRate: money.toExchangeRate,
        toAmount: money.toAmount,
        reportingAmount: money.reportingAmount,
        extras: withConversion(data.extras, money.conversion),
        budgetId,
        addedByUserId: userId,
        fromAccountBalanceAfter: fromBalanceAfter,
        toAccountBalanceAfter: toBalanceAfter,
      })
      .returning();

    if (!row) throw new Error('Insert did not return a row');

    return row;
  });

  // Sync with monthly plan is nice to have, but we don't want to fail the whole transaction if it errors out.
  syncTransactionWithPlan(userId, budgetId, null, result).catch(err => {
    logger.error('Error syncing plan items after transaction insert:', err);
  });
  return result;
}

export interface CorrectionInsert {
  accountId: number;
  targetBalance: number;
  date: string;
  notes?: string | null;
  source: 'hub' | 'mcp';
}

export interface CorrectionResult {
  transaction: FinanceTransaction;
  /** Signed delta applied, in the account's currency: positive = credit, negative = debit. */
  correctionAmount: number;
  /** The account's currency — targetBalance, correctionAmount and the balance are all in it. */
  currency: string;
  /** correctionAmount in the budget default currency (signed, at the correction-date rate). */
  correctionAmountInDefaultCurrency: number;
  type: string;
}

/**
 * Create a balance-correction transaction by specifying the desired final balance.
 * The delta is computed atomically inside a DB transaction against the live balance,
 * preventing race conditions from stale UI or MCP data.
 * Returns null if the account balance already equals targetBalance.
 */
export async function addCorrectionTransaction(
  userId: string,
  budgetId: number,
  data: CorrectionInsert,
): Promise<CorrectionResult | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const result = await db.transaction(async tx => {
    const account = await selectAccount(tx, budgetId, data.accountId);
    if (!account) throw new Error('Account not found');

    const delta = data.targetBalance - account.balance;

    // Treat sub-0.0001 deltas as zero (matches 4-decimal DB precision)
    if (Math.abs(delta) < 0.00005) return null;

    const type = delta > 0 ? TransactionTypes.Income : TransactionTypes.Expense;
    const amount = round4(Math.abs(delta));
    const balanceAfter = round4(data.targetBalance);

    // targetBalance and the delta are in the account's own currency; only the reporting value is converted.
    const money = await resolveTransactionMoney({
      type,
      date: data.date,
      inputAmount: amount,
      accountCurrency: account.currency,
      isCorrection: true,
      budgetCurrency: await getBudgetDefaultCurrency(budgetId, tx),
    });

    await tx
      .update(financeAccounts)
      .set({ balance: balanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, data.accountId), eq(financeAccounts.budgetId, budgetId)));

    const [row] = await tx
      .insert(financeTransactions)
      .values({
        type,
        amount,
        date: data.date,
        accountId: data.accountId,
        budgetId,
        addedByUserId: userId,
        categoryId: null,
        payeeId: null,
        toAccountId: null,
        notes: data.notes ?? null,
        isCorrection: true,
        source: data.source,
        exchangeRate: money.exchangeRate,
        reportingAmount: money.reportingAmount,
        toExchangeRate: null,
        toAmount: null,
        fromAccountBalanceAfter: balanceAfter,
        toAccountBalanceAfter: null,
        extras: null,
        labels: [],
      })
      .returning();

    if (!row) throw new Error('Insert did not return a row');

    return {
      transaction: row,
      correctionAmount: round4(delta),
      currency: account.currency,
      correctionAmountInDefaultCurrency: Math.sign(delta) * money.reportingAmount,
      type,
    };
  });

  if (result == null) return null;

  syncTransactionWithPlan(userId, budgetId, null, result.transaction).catch(err => {
    logger.error('Error syncing plan items after correction:', err);
  });

  return result;
}

export async function getTransactions(
  userId: string,
  budgetId: number,
  opts: GetTransactionsOpts = {},
): Promise<FinanceTransaction[]> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = buildListConditions(budgetId, opts);

  let query = db
    .select()
    .from(financeTransactions)
    .where(and(...conditions))
    .orderBy(desc(financeTransactions.date), desc(financeTransactions.id));

  if (opts.limit !== undefined) {
    query = query.limit(opts.limit) as typeof query;
  }
  if (opts.offset !== undefined) {
    query = query.offset(opts.offset) as typeof query;
  }

  return query;
}

export async function countTransactions(
  userId: string,
  budgetId: number,
  opts: GetTransactionsOpts = {},
): Promise<number> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const conditions = buildListConditions(budgetId, opts);

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(financeTransactions)
    .where(and(...conditions));

  return row?.count ?? 0;
}

export async function checkDuplicateTransaction(
  userId: string,
  budgetId: number,
  opts: DuplicateCheckOpts,
): Promise<FinanceTransaction | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const normalizedAmount = Math.round(opts.amount * 10000) / 10000;
  const conditions = [
    eq(financeTransactions.budgetId, budgetId),
    eq(financeTransactions.accountId, opts.accountId),
    eq(financeTransactions.date, opts.date),
    eq(financeTransactions.amount, normalizedAmount),
  ];

  if (opts.payeeId === null) {
    conditions.push(isNull(financeTransactions.payeeId));
  } else {
    conditions.push(eq(financeTransactions.payeeId, opts.payeeId));
  }
  if (opts.excludeTransactionId !== undefined) {
    conditions.push(ne(financeTransactions.id, opts.excludeTransactionId));
  }

  const [row] = await db
    .select()
    .from(financeTransactions)
    .where(and(...conditions))
    .limit(1);

  return row ?? null;
}

export async function getTransactionById(
  userId: string,
  budgetId: number,
  transactionId: number,
): Promise<FinanceTransaction | null> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const [row] = await db
    .select()
    .from(financeTransactions)
    .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

  return row ?? null;
}

/**
 * Whether an update actually changes what the stored money was derived from. Compares values, not
 * presence — the Hub form resends every field on save, and re-saving unchanged values must keep
 * the frozen reporting value untouched.
 */
function moneyInputChanged(
  existing: FinanceTransaction,
  data: TransactionUpdate,
  ctx: { newToAccountId: number | null; oldFromCurrency: string; newFromCurrency: string },
): boolean {
  const conversion = existing.extras?.conversion;
  const hasOriginal = conversion?.originalAmount != null && conversion.originalCurrency != null;
  const storedInputAmount = hasOriginal ? conversion!.originalAmount! : existing.amount;
  const storedInputCurrency = hasOriginal ? conversion!.originalCurrency!.toUpperCase() : ctx.oldFromCurrency;
  const nextInputCurrency = (
    data.amountCurrency ?? (data.amount !== undefined ? ctx.newFromCurrency : storedInputCurrency)
  ).toUpperCase();

  if (data.type !== undefined && data.type !== existing.type) return true;
  if (data.accountId !== undefined && data.accountId !== existing.accountId) return true;
  if (ctx.newToAccountId !== existing.toAccountId) return true;
  if (data.date !== undefined && data.date !== existing.date) return true;
  if (data.amount !== undefined && round4(data.amount) !== round4(storedInputAmount)) return true;
  if (nextInputCurrency !== storedInputCurrency) return true;
  if (data.rate === null && conversion?.rateSource === FxRateSources.User) return true;
  if (data.rate != null && data.rate !== conversion?.originalToAccountRate) return true;
  if (data.toAmount != null && existing.type === TransactionTypes.Transfer) {
    return round4(data.toAmount) !== transferToAmount(existing);
  }
  return data.toAmount != null;
}

export async function updateTransaction(
  userId: string,
  budgetId: number,
  transactionId: number,
  data: TransactionUpdate,
): Promise<FinanceTransaction> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const result = await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (!existing) throw new Error('Transaction not found');

    const newType = data.type ?? existing.type;
    const newAccountId = data.accountId ?? existing.accountId;
    const newToAccountId =
      newType === TransactionTypes.Transfer
        ? data.toAccountId === undefined
          ? existing.toAccountId
          : data.toAccountId
        : null;
    const newDate = data.date ?? existing.date;

    if (newType === TransactionTypes.Transfer && newToAccountId == null) {
      throw new Error('Transfer transactions require a destination account (toAccountId)');
    }
    if (newType === TransactionTypes.Transfer && newToAccountId === newAccountId) {
      throw new Error('Transfer source and destination must be different accounts');
    }

    // ── Reverse old balance effect ─────────────────────────────────────────
    const oldFromAcct = await selectAccount(tx, budgetId, existing.accountId);
    if (!oldFromAcct) throw new Error('Source account not found');
    const oldFromCurrency = oldFromAcct.currency;

    await tx
      .update(financeAccounts)
      .set({
        balance: round4(
          existing.type === TransactionTypes.Income
            ? oldFromAcct.balance - existing.amount
            : oldFromAcct.balance + existing.amount,
        ),
        updatedAt: new Date(),
      })
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    let oldToCurrency: string | null = null;
    if (existing.type === TransactionTypes.Transfer && existing.toAccountId != null) {
      const oldToAcct = await selectAccount(tx, budgetId, existing.toAccountId);
      if (oldToAcct) {
        oldToCurrency = oldToAcct.currency;
        await tx
          .update(financeAccounts)
          .set({ balance: round4(oldToAcct.balance - transferToAmount(existing)), updatedAt: new Date() })
          .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      }
    }

    // ── Resolve the new money fields ───────────────────────────────────────
    // Re-read after the reversal so self-referencing updates see the restored balances.
    const newFromAcct = await selectAccount(tx, budgetId, newAccountId);
    if (!newFromAcct) throw new Error('New source account not found');
    const newToAcct = newToAccountId != null ? await selectAccount(tx, budgetId, newToAccountId) : undefined;
    if (newToAccountId != null && !newToAcct) throw new Error('New destination account not found');

    const moneyChanged = moneyInputChanged(existing, data, {
      newToAccountId,
      oldFromCurrency,
      newFromCurrency: newFromAcct.currency,
    });
    const existingConversion = existing.extras?.conversion ?? null;
    const baseExtras = data.extras !== undefined ? data.extras : existing.extras;

    let money: {
      amount: number;
      toAmount: number | null;
      toExchangeRate: number | null;
      reportingAmount: number;
      exchangeRate: number;
    };
    let extras = baseExtras;

    if (!moneyChanged) {
      // Frozen: nothing that affects money changed, so the stored values (including the reporting
      // value) are kept exactly as they are.
      money = {
        amount: existing.amount,
        toAmount: existing.type === TransactionTypes.Transfer ? transferToAmount(existing) : null,
        toExchangeRate: existing.toExchangeRate,
        reportingAmount: existing.reportingAmount,
        exchangeRate: existing.exchangeRate,
      };
      if (data.extras !== undefined) extras = withConversion(data.extras, existingConversion);
    } else {
      // What the user originally typed: the new amount (in amountCurrency, default the new account's
      // currency), else the stored original input re-used as-is.
      let inputAmount: number;
      let inputCurrency: string;
      if (data.amount !== undefined) {
        inputAmount = data.amount;
        inputCurrency = data.amountCurrency ?? newFromAcct.currency;
      } else {
        inputAmount = existingConversion?.originalAmount ?? existing.amount;
        inputCurrency =
          data.amountCurrency ??
          (existingConversion?.originalAmount != null ? existingConversion.originalCurrency : null) ??
          oldFromCurrency;
      }

      // Keep a stored rate when the user did not supply a new one: always for user-entered rates,
      // and for market rates only while the date is unchanged.
      const reuseConversion =
        data.rate === undefined &&
        existingConversion != null &&
        (existingConversion.rateSource === FxRateSources.User || newDate === existing.date)
          ? existingConversion
          : null;

      // Keep the received amount of a transfer whose sent side and currencies are unchanged.
      const keepToAmount =
        existing.type === TransactionTypes.Transfer &&
        newType === TransactionTypes.Transfer &&
        data.amount === undefined &&
        data.amountCurrency === undefined &&
        data.rate === undefined &&
        newFromAcct.currency === oldFromCurrency &&
        newToAcct?.currency === oldToCurrency
          ? transferToAmount(existing)
          : null;

      const resolved = await resolveTransactionMoney({
        type: newType,
        date: newDate,
        inputAmount,
        inputCurrency,
        rate: data.rate ?? null,
        toAmount: data.toAmount ?? keepToAmount,
        accountCurrency: newFromAcct.currency,
        toAccountCurrency: newToAcct?.currency ?? null,
        budgetCurrency: await getBudgetDefaultCurrency(budgetId, tx),
        reuseConversion,
        isCorrection: data.isCorrection ?? existing.isCorrection,
      });
      money = resolved;
      extras = withConversion(baseExtras, resolved.conversion);
    }

    // ── Apply new balance effect ───────────────────────────────────────────
    const newFromBalanceAfter = round4(
      newType === TransactionTypes.Income ? newFromAcct.balance + money.amount : newFromAcct.balance - money.amount,
    );
    await tx
      .update(financeAccounts)
      .set({ balance: newFromBalanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, newAccountId), eq(financeAccounts.budgetId, budgetId)));

    let newToBalanceAfter: number | null = null;
    if (newToAccountId != null && newToAcct && money.toAmount != null) {
      newToBalanceAfter = round4(newToAcct.balance + money.toAmount);
      await tx
        .update(financeAccounts)
        .set({ balance: newToBalanceAfter, updatedAt: new Date() })
        .where(and(eq(financeAccounts.id, newToAccountId), eq(financeAccounts.budgetId, budgetId)));
    }

    // ── Persist updated transaction row ───────────────────────────────────
    const { amountCurrency: _amountCurrency, rate: _rate, ...rowData } = data;
    const [row] = await tx
      .update(financeTransactions)
      .set({
        ...omitUndefined(rowData),
        toAccountId: newToAccountId,
        amount: money.amount,
        toAmount: money.toAmount,
        exchangeRate: money.exchangeRate,
        toExchangeRate: money.toExchangeRate,
        reportingAmount: money.reportingAmount,
        extras,
        fromAccountBalanceAfter: newFromBalanceAfter,
        toAccountBalanceAfter: newToBalanceAfter,
        updatedAt: new Date(),
      })
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)))
      .returning();

    if (!row) throw new Error('Transaction not found');

    return { row, previous: existing };
  });

  // Sync with monthly plan is nice to have, but we don't want to fail the whole transaction if it errors out.
  syncTransactionWithPlan(userId, budgetId, result.previous, result.row).catch(err => {
    logger.error('Error syncing plan items after transaction update:', err);
  });
  return result.row;
}

export async function deleteTransaction(
  userId: string,
  budgetId: number,
  transactionId: number,
): Promise<{ accountBalanceAfter: number }> {
  if (!(await hasAccessToBudget(userId, budgetId))) {
    throw new Error('Budget not found');
  }

  const result = await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    if (!existing) throw new Error('Transaction not found');

    // Reverse balance effect on source/from account
    const amt = existing.amount;

    const fromAcct = await selectAccount(tx, budgetId, existing.accountId);

    if (!fromAcct) throw new Error('Account not found');

    const fromBalanceAfter = round4(
      existing.type === TransactionTypes.Income ? fromAcct.balance - amt : fromAcct.balance + amt,
    );

    await tx
      .update(financeAccounts)
      .set({ balance: fromBalanceAfter, updatedAt: new Date() })
      .where(and(eq(financeAccounts.id, existing.accountId), eq(financeAccounts.budgetId, budgetId)));

    if (existing.type === TransactionTypes.Transfer && existing.toAccountId != null) {
      const toAcct = await selectAccount(tx, budgetId, existing.toAccountId);
      if (toAcct) {
        const toBalanceAfter = round4(toAcct.balance - transferToAmount(existing));
        await tx
          .update(financeAccounts)
          .set({ balance: toBalanceAfter, updatedAt: new Date() })
          .where(and(eq(financeAccounts.id, existing.toAccountId), eq(financeAccounts.budgetId, budgetId)));
      }
    }

    await tx
      .delete(financeTransactions)
      .where(and(eq(financeTransactions.id, transactionId), eq(financeTransactions.budgetId, budgetId)));

    return { accountBalanceAfter: fromBalanceAfter, deleted: existing };
  });

  // Sync with monthly plan is nice to have, but we don't want to fail the whole transaction if it errors out.
  syncTransactionWithPlan(userId, budgetId, result.deleted, null).catch(err => {
    logger.error('Error syncing plan items after transaction delete:', err);
  });

  return { accountBalanceAfter: result.accountBalanceAfter };
}
