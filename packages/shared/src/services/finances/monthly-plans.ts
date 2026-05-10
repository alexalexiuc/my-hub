/**
 * Finance monthly plan service
 * - getMonthlyPlan(userId, budgetId, month, tx?) — fetch plan row for a given YYYY-MM month, returns undefined if not found
 * - createMonthlyPlan(userId, budgetId, month, availableAmount?) — create a new plan row for the given month
 * - checkMonthlyPlanExists(userId, budgetId, month) — returns true if a plan row exists for that month (without creating one)
 * - getOrCreateMonthlyPlan(userId, budgetId, month) — fetch or create the plan row for a given YYYY-MM month
 * - getMonthlyPlanFull(userId, budgetId, month) — plan + items + computed summary (planned, remaining potential/real, progress)
 * - computeSummary(plan, items, budgetCurrency) — compute planned/remaining/assigned summary in budget currency
 * - updateMonthlyPlan(userId, budgetId, planId, patch) — update plan metadata (availableAmount, amountToAdd, and/or incomeAccountId)
 * - addPlanItem(userId, planId, data) — append a new line item (or array of items) to the plan
 * - updatePlanItem(userId, itemId, data, tx?) — partial update of a plan item; accepts an optional Drizzle tx for use inside transactions
 * - deletePlanItem(userId, itemId) — hard delete a plan item
 * - bulkAssignAll(userId, planId) — mark all unassigned items in the plan as assigned
 * - copyToNextMonth(userId, budgetId, month) — create next month's plan from current; amounts copied as-is; no-op if already exists
 * - doesItemMatchTransaction(item, transaction) — returns true if a plan item's linkedAccountId/categoryId matches a transaction
 * - syncTransactionWithPlan(userId, budgetId, before, after) — syncs plan items and availableAmount when a transaction is created, updated, or deleted
 * Types: PlanItemInsert, PlanItemUpdate, MonthlyPlanFull, MonthlyPlanSummary, PlanItemWithMeta
 */
import { and, eq, sql } from 'drizzle-orm';
import { db, DbOrTx, DbTx } from '../../db/client';
import {
  financeBudgets,
  financeMonthlyPlans,
  financeMonthlyPlanItems,
  financeAccounts,
  financeCategories,
  financePayees,
} from '../../db/schema/finances';
import { arrayfy, logger, omitUndefined } from '../../utils';
import { shiftMonthStr, toUTCDateStr } from '../../utils/dates';
import { enforceBudgetAccess } from './budgets';
import { getExchangeRate } from './exchangeRates';
import type { FinanceMonthlyPlan, FinanceMonthlyPlanItem, FinanceTransaction } from '../../types';
import { PromiseCacheX } from 'promise-cachex';
import { TransactionTypes, type SupportedCurrency } from '../../constants/finances';

const monthlyPlanCache = new PromiseCacheX<FinanceMonthlyPlan | undefined>({ ttl: 1000 * 60 * 60 }); // 1 hour cache for plan fetches
const monthlyPlanAccessCache = new PromiseCacheX<number | undefined>({ ttl: 1000 * 60 * 60 }); // 1 hour cache for plan item fetches

export type PlanItemInsert = {
  name: string;
  amount: number;
  currency: SupportedCurrency;
  categoryId?: number | null;
  merchantId?: number | null;
  linkedAccountId?: number | null;
  sortOrder?: number;
  notes?: string | null;
};

export type PlanItemUpdate = Partial<
  Pick<
    PlanItemInsert,
    'name' | 'amount' | 'currency' | 'categoryId' | 'merchantId' | 'linkedAccountId' | 'sortOrder' | 'notes'
  > & { assignedAmount: number; isAssigned: boolean; assignedTransactionId: number | null }
>;

export interface MonthlyPlanSummary {
  planned: number;
  remainingPotential: number;
  remainingReal: number;
  assignedCount: number;
  totalCount: number;
}

export interface PlanItemWithMeta extends FinanceMonthlyPlanItem {
  categoryName: string | null;
  merchantName: string | null;
  linkedAccountName: string | null;
}

export interface MonthlyPlanFull {
  plan: FinanceMonthlyPlan;
  items: PlanItemWithMeta[];
  summary: MonthlyPlanSummary;
  currency: SupportedCurrency;
}

type AutoMatchTx = Pick<
  FinanceTransaction,
  'id' | 'type' | 'accountId' | 'toAccountId' | 'categoryId' | 'amount' | 'date'
>;

/** Checks if the user has access to a specific plan item */
async function enforcePlanItemAccess(userId: string, itemId: number, tx: DbOrTx = db): Promise<void> {
  const budgetId = await monthlyPlanAccessCache.get(`${userId}-item-${itemId}`, async () => {
    const rows = await tx
      .select({ budgetId: financeMonthlyPlans.budgetId })
      .from(financeMonthlyPlanItems)
      .innerJoin(financeMonthlyPlans, eq(financeMonthlyPlanItems.planId, financeMonthlyPlans.id))
      .where(eq(financeMonthlyPlanItems.id, itemId))
      .limit(1);
    return rows[0]?.budgetId;
  });

  if (budgetId === undefined) {
    logger.warn(`Unauthorized access attempt by user ${userId} to plan item ${itemId}`);
    throw new Error('Plan item not found');
  }
  await enforceBudgetAccess(userId, budgetId);
}

async function enforceMonthlyPlanAccess(userId: string, planId: number, tx: DbOrTx = db): Promise<void> {
  const budgetId = await monthlyPlanAccessCache.get(`${userId}-plan-${planId}`, async () => {
    const rows = await tx
      .select({ budgetId: financeMonthlyPlans.budgetId })
      .from(financeMonthlyPlans)
      .where(eq(financeMonthlyPlans.id, planId))
      .limit(1);
    return rows[0]?.budgetId;
  });

  if (budgetId === undefined) {
    logger.warn(`Unauthorized access attempt by user ${userId} to monthly plan ${planId}`);
    throw new Error('Monthly plan not found');
  }
  await enforceBudgetAccess(userId, budgetId);
}

export async function computeSummary(
  plan: FinanceMonthlyPlan,
  items: FinanceMonthlyPlanItem[],
  budgetCurrency: SupportedCurrency,
): Promise<MonthlyPlanSummary> {
  const today = toUTCDateStr(new Date());

  const converted = await Promise.all(
    items.map(async item => {
      if (item.currency === budgetCurrency) return { amount: item.amount, paid: item.assignedAmount };
      try {
        const rate = await getExchangeRate(item.currency, budgetCurrency, today);
        return { amount: item.amount * rate, paid: item.assignedAmount * rate };
      } catch {
        return { amount: item.amount, paid: item.assignedAmount };
      }
    }),
  );

  const { planned, assignedTotal } = converted.reduce(
    (acc, val) => {
      acc.planned += val.amount;
      acc.assignedTotal += val.paid;
      return acc;
    },
    { planned: 0, assignedTotal: 0 },
  );

  return {
    planned,
    remainingPotential: plan.availableAmount - planned,
    remainingReal: plan.availableAmount - assignedTotal,
    assignedCount: items.filter(i => i.isAssigned).length,
    totalCount: items.length,
  };
}

async function resolveBudgetCurrency(budgetId: number): Promise<SupportedCurrency> {
  const rows = await db
    .select({ defaultCurrency: financeBudgets.defaultCurrency })
    .from(financeBudgets)
    .where(eq(financeBudgets.id, budgetId))
    .limit(1);
  return (rows[0]?.defaultCurrency ?? 'MDL') as SupportedCurrency;
}

export async function getMonthlyPlan(
  userId: string,
  budgetId: number,
  month: string,
  tx: DbOrTx = db,
): Promise<FinanceMonthlyPlan | undefined> {
  await enforceBudgetAccess(userId, budgetId);

  return monthlyPlanCache.get(`${budgetId}-${month}`, async () => {
    const rows = await tx
      .select()
      .from(financeMonthlyPlans)
      .where(and(eq(financeMonthlyPlans.budgetId, budgetId), eq(financeMonthlyPlans.month, month)))
      .limit(1);
    return rows[0];
  });
}

export async function createMonthlyPlan(
  userId: string,
  budgetId: number,
  month: string,
  availableAmount = 0,
): Promise<FinanceMonthlyPlan> {
  await enforceBudgetAccess(userId, budgetId);

  const rows = await db.insert(financeMonthlyPlans).values({ budgetId, month, availableAmount }).returning();
  monthlyPlanCache.set(`${budgetId}-${month}`, rows[0]);
  if (!rows[0]) throw new Error('Failed to create monthly plan');
  return rows[0];
}

export async function checkMonthlyPlanExists(userId: string, budgetId: number, month: string): Promise<boolean> {
  return !!(await getMonthlyPlan(userId, budgetId, month));
}

export async function getOrCreateMonthlyPlan(
  userId: string,
  budgetId: number,
  month: string,
): Promise<FinanceMonthlyPlan> {
  await enforceBudgetAccess(userId, budgetId);

  const existing = await getMonthlyPlan(userId, budgetId, month);

  if (existing) return existing;

  return createMonthlyPlan(userId, budgetId, month);
}

/**
 * Fetches the monthly plan along with its items and computed summary.
 * If the plan for the given month doesn't exist, it will be created with an availableAmount of 0.
 */
export async function getMonthlyPlanFull(userId: string, budgetId: number, month: string): Promise<MonthlyPlanFull> {
  await enforceBudgetAccess(userId, budgetId);

  const plan = await getOrCreateMonthlyPlan(userId, budgetId, month);

  const rawItems = await db
    .select({
      item: financeMonthlyPlanItems,
      categoryName: financeCategories.name,
      merchantName: financePayees.name,
      linkedAccountName: financeAccounts.name,
    })
    .from(financeMonthlyPlanItems)
    .leftJoin(financeCategories, eq(financeMonthlyPlanItems.categoryId, financeCategories.id))
    .leftJoin(financePayees, eq(financeMonthlyPlanItems.merchantId, financePayees.id))
    .leftJoin(financeAccounts, eq(financeMonthlyPlanItems.linkedAccountId, financeAccounts.id))
    .where(eq(financeMonthlyPlanItems.planId, plan.id))
    .orderBy(financeMonthlyPlanItems.sortOrder, financeMonthlyPlanItems.id);

  const items: PlanItemWithMeta[] = rawItems.map(r => ({
    ...r.item,
    categoryName: r.categoryName ?? null,
    merchantName: r.merchantName ?? null,
    linkedAccountName: r.linkedAccountName ?? null,
  }));

  const budgetCurrency = await resolveBudgetCurrency(budgetId);
  const summary = await computeSummary(plan, items, budgetCurrency);

  return { plan, items, summary, currency: budgetCurrency };
}

/**
 * Updates a monthly plan
 * if availableAmount is provided, it will be set as the new available amount (can be used to directly set next month's funds based on this month's remainingPotential)
 * if amountToAdd is provided, it will be added to the existing available amount (can be used to add this month's remainingReal as next month's available funds in the copyToNextMonth flow without needing to compute the new total on the client)
 * if both are provided, availableAmount takes precedence and amountToAdd is ignored
 * incomeAccountId can be updated separately to change which account's transactions are auto-matched to plan items and included in the plan summary calculations
 */
export async function updateMonthlyPlan(
  userId: string,
  budgetId: number,
  planId: number,
  patch: { availableAmount?: number; incomeAccountId?: number | null; amountToAdd?: number },
  tx: DbOrTx = db,
): Promise<FinanceMonthlyPlan> {
  await enforceMonthlyPlanAccess(userId, planId, tx);

  const { availableAmount, incomeAccountId, amountToAdd } = patch;
  const a =
    availableAmount !== undefined
      ? availableAmount
      : amountToAdd !== undefined
        ? sql`${financeMonthlyPlans.availableAmount} + ${amountToAdd}`
        : undefined;

  const rows = await tx
    .update(financeMonthlyPlans)
    .set(
      omitUndefined({
        incomeAccountId,
        availableAmount: a,
        updatedAt: new Date(),
      }),
    )
    .where(and(eq(financeMonthlyPlans.id, planId)))
    .returning();
  if (!rows[0]) throw new Error('Plan not found');
  monthlyPlanCache.set(`${budgetId}-${rows[0].month}`, rows[0]);
  return rows[0];
}

export async function addPlanItem(
  userId: string,
  planId: number,
  data: PlanItemInsert[],
): Promise<FinanceMonthlyPlanItem[]>;
export async function addPlanItem(
  userId: string,
  planId: number,
  data: PlanItemInsert,
): Promise<FinanceMonthlyPlanItem>;
export async function addPlanItem(
  userId: string,
  planId: number,
  data: PlanItemInsert | PlanItemInsert[],
): Promise<FinanceMonthlyPlanItem | FinanceMonthlyPlanItem[]> {
  await enforceMonthlyPlanAccess(userId, planId);

  const rows = await db
    .insert(financeMonthlyPlanItems)
    .values(
      arrayfy(data).map(i => ({
        planId,
        name: i.name,
        amount: i.amount,
        currency: i.currency,
        categoryId: i.categoryId,
        merchantId: i.merchantId,
        linkedAccountId: i.linkedAccountId,
        assignedAmount: 0,
        sortOrder: i.sortOrder ?? 0,
        notes: i.notes,
      })),
    )
    .returning();
  if (!rows[0]) throw new Error('Failed to create plan item');
  return Array.isArray(data) ? rows : rows[0];
}

export async function updatePlanItem(
  userId: string,
  itemId: number,
  data: PlanItemUpdate,
  tx: DbOrTx = db,
): Promise<FinanceMonthlyPlanItem> {
  await enforcePlanItemAccess(userId, itemId, tx);

  // When toggling assigned without an explicit amount: copy the planned amount column (avoids a read).
  // When marking as not assigned: zero out and clear the auto-match attribution.
  const assignedAmount =
    data.isAssigned === true && data.assignedAmount === undefined
      ? sql`${financeMonthlyPlanItems.amount}`
      : data.isAssigned === false && data.assignedAmount === undefined
        ? 0
        : data.assignedAmount;
  const assignedTransactionId =
    data.isAssigned === false && data.assignedTransactionId === undefined ? null : data.assignedTransactionId;

  const rows = await tx
    .update(financeMonthlyPlanItems)
    .set(
      omitUndefined({
        updatedAt: new Date(),
        ...data,
        assignedAmount,
        assignedTransactionId,
      }),
    )
    .where(eq(financeMonthlyPlanItems.id, itemId))
    .returning();

  const [row] = rows;
  if (!row) throw new Error('Plan item not found');

  if (data.isAssigned === undefined && row.amount > 0) {
    const newIsAssigned = row.assignedAmount >= row.amount;
    await tx
      .update(financeMonthlyPlanItems)
      .set({ isAssigned: newIsAssigned })
      .where(eq(financeMonthlyPlanItems.id, row.id));
    return { ...row, isAssigned: newIsAssigned };
  }

  return row;
}

export async function deletePlanItem(userId: string, itemId: number): Promise<void> {
  await enforcePlanItemAccess(userId, itemId);
  await db.delete(financeMonthlyPlanItems).where(eq(financeMonthlyPlanItems.id, itemId));
  monthlyPlanAccessCache.delete(`${userId}-item-${itemId}`);
}

export async function bulkAssignAll(userId: string, planId: number): Promise<void> {
  await enforceMonthlyPlanAccess(userId, planId);

  await db
    .update(financeMonthlyPlanItems)
    .set({ isAssigned: true, assignedAmount: sql`${financeMonthlyPlanItems.amount}`, updatedAt: new Date() })
    .where(and(eq(financeMonthlyPlanItems.planId, planId), eq(financeMonthlyPlanItems.isAssigned, false)));
}

export async function copyToNextMonth(
  userId: string,
  budgetId: number,
  month: string,
): Promise<{ created: boolean; targetMonth: string }> {
  await enforceBudgetAccess(userId, budgetId);

  const nextMonthString = shiftMonthStr(month, 1);

  const [existsNextMonthPlan, current] = await Promise.all([
    checkMonthlyPlanExists(userId, budgetId, nextMonthString),
    getMonthlyPlan(userId, budgetId, month),
  ]);
  if (existsNextMonthPlan || !current) return { created: false, targetMonth: nextMonthString };

  const nextPlan = await createMonthlyPlan(userId, budgetId, nextMonthString, current.availableAmount);

  const items = await db
    .select()
    .from(financeMonthlyPlanItems)
    .where(eq(financeMonthlyPlanItems.planId, current.id))
    .orderBy(financeMonthlyPlanItems.sortOrder, financeMonthlyPlanItems.id);

  if (items.length) {
    await addPlanItem(
      userId,
      nextPlan.id,
      items.map(item => ({
        name: item.name,
        amount: item.amount,
        currency: item.currency,
        categoryId: item.categoryId,
        merchantId: item.merchantId,
        linkedAccountId: item.linkedAccountId,
        sortOrder: item.sortOrder,
        notes: item.notes,
      })),
    );
  }

  return { created: true, targetMonth: nextMonthString };
}

export function doesItemMatchTransaction(
  item: Pick<FinanceMonthlyPlanItem, 'linkedAccountId' | 'categoryId'>,
  transaction: Pick<FinanceTransaction, 'toAccountId' | 'categoryId'>,
): boolean {
  const hasAccount = item.linkedAccountId != null;
  const hasCategory = item.categoryId != null;
  if (!hasAccount && !hasCategory) return false;

  const accountMatches = hasAccount && transaction.toAccountId === item.linkedAccountId;
  const categoryMatches = hasCategory && transaction.categoryId === item.categoryId;

  if (hasAccount && hasCategory) return accountMatches && categoryMatches;
  if (hasAccount) return accountMatches;
  return categoryMatches;
}

async function applyDeltaInTx(
  tx: DbTx,
  userId: string,
  budgetId: number,
  transaction: AutoMatchTx,
  amountDelta: number,
): Promise<void> {
  const month = transaction.date.slice(0, 7);
  const plan = await getMonthlyPlan(userId, budgetId, month, tx);
  if (!plan) return;

  if (
    plan.incomeAccountId !== null &&
    ((transaction.type === TransactionTypes.Income && transaction.accountId === plan.incomeAccountId) ||
      (transaction.type === TransactionTypes.Transfer && transaction.toAccountId === plan.incomeAccountId))
  ) {
    await updateMonthlyPlan(userId, budgetId, plan.id, { amountToAdd: amountDelta }, tx);
  }

  const items = await tx.select().from(financeMonthlyPlanItems).where(eq(financeMonthlyPlanItems.planId, plan.id));
  for (const item of items) {
    if (!doesItemMatchTransaction(item, transaction)) continue;
    await updatePlanItem(userId, item.id, { assignedAmount: item.assignedAmount + amountDelta }, tx);
  }
}

/**
 * Syncs plan items and available amount when a transaction is created, updated, or deleted.
 * Pass before=null for inserts, after=null for deletes, both for updates.
 * Both deltas run in a single DB transaction so partial failure is impossible.
 */
export async function syncTransactionWithPlan(
  userId: string,
  budgetId: number,
  before: AutoMatchTx | null,
  after: AutoMatchTx | null,
): Promise<void> {
  await enforceBudgetAccess(userId, budgetId);

  if (
    before &&
    after &&
    before.type === after.type &&
    before.accountId === after.accountId &&
    before.toAccountId === after.toAccountId &&
    before.categoryId === after.categoryId &&
    before.date === after.date &&
    before.amount === after.amount
  )
    return;

  await db.transaction(async tx => {
    if (before) await applyDeltaInTx(tx, userId, budgetId, before, -before.amount);
    if (after) await applyDeltaInTx(tx, userId, budgetId, after, after.amount);
  });
}
