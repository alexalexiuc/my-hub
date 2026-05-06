/**
 * Finance monthly plan service
 * - checkMonthlyPlanExists(userId, budgetId, month) — returns true if a plan row exists for that month (without creating one)
 * - getOrCreateMonthlyPlan(userId, budgetId, month) — fetch or create the plan row for a given YYYY-MM month
 * - getMonthlyPlanFull(userId, budgetId, month) — plan + items + computed summary (planned, remaining potential/real, progress)
 * - updateMonthlyPlan(userId, budgetId, planId, patch) — update plan metadata (availableAmount and/or incomeAccountId)
 * - addPlanItem(userId, budgetId, planId, data) — append a new line item to the plan
 * - updatePlanItem(userId, budgetId, itemId, data) — partial update of a plan item
 * - deletePlanItem(userId, budgetId, itemId) — hard delete a plan item
 * - togglePlanItemAssigned(userId, budgetId, itemId, isAssigned) — manual done/undone override
 * - bulkAssignAll(userId, budgetId, planId) — mark all items in the plan as assigned
 * - copyToNextMonth(userId, budgetId, month) — create next month's plan from current; amounts copied as-is; no-op if already exists
 * - tryAutoMatchPlanItems(userId, budgetId, transaction) — called after transaction insert to auto-assign matching items and auto-add income into monthly available funds for the selected income account
 * - reconcileAutoMatchPlanItemsForTransactionUpdate(userId, budgetId, before, after) — reverses old transaction effect then applies new one so plan availableAmount/assigned amounts stay consistent on transaction edits
 * Types: PlanItemInsert, PlanItemUpdate, MonthlyPlanFull, MonthlyPlanSummary, PlanItemWithMeta
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  financeBudgets,
  financeMonthlyPlans,
  financeMonthlyPlanItems,
  financeAccounts,
  financeCategories,
  financePayees,
} from '../../db/schema/finances';
import { omitNullish } from '../../utils';
import { shiftMonthStr, toUTCDateStr } from '../../utils/dates';
import { verifyBudgetAccess } from './budgets';
import { getExchangeRate } from './exchangeRates';
import type { FinanceMonthlyPlan, FinanceMonthlyPlanItem, FinanceTransaction } from '../../types';
import { PromiseCacheX } from 'promise-cachex';
import { TransactionTypes } from '../../constants/finances';

const monthlyPlanCache = new PromiseCacheX<FinanceMonthlyPlan | undefined>({ ttl: 1000 * 60 * 60 }); // 1 hour cache for plan fetches

export type PlanItemInsert = {
  name: string;
  amount: number;
  currency: string;
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
  > & { assignedAmount: number }
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
  currency: string;
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type AutoMatchTx = Pick<
  FinanceTransaction,
  'id' | 'type' | 'accountId' | 'toAccountId' | 'categoryId' | 'amount' | 'date'
>;

export async function computeSummary(
  plan: FinanceMonthlyPlan,
  items: FinanceMonthlyPlanItem[],
  budgetCurrency: string,
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

async function resolveBudgetCurrency(budgetId: number): Promise<string> {
  const rows = await db
    .select({ defaultCurrency: financeBudgets.defaultCurrency })
    .from(financeBudgets)
    .where(eq(financeBudgets.id, budgetId))
    .limit(1);
  return rows[0]?.defaultCurrency ?? 'MDL';
}

export async function getMonthlyPlan(
  userId: string,
  budgetId: number,
  month: string,
): Promise<FinanceMonthlyPlan | undefined> {
  await verifyBudgetAccess(userId, budgetId);
  return monthlyPlanCache.get(`${budgetId}-${month}`, async () => {
    const rows = await db
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
  await verifyBudgetAccess(userId, budgetId);
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
  await verifyBudgetAccess(userId, budgetId);

  const existing = await getMonthlyPlan(userId, budgetId, month);

  if (existing) return existing;

  return createMonthlyPlan(userId, budgetId, month);
}

export async function getMonthlyPlanFull(userId: string, budgetId: number, month: string): Promise<MonthlyPlanFull> {
  await verifyBudgetAccess(userId, budgetId);

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

export async function updateMonthlyPlan(
  userId: string,
  budgetId: number,
  planId: number,
  patch: { availableAmount?: number; incomeAccountId?: number | null },
): Promise<FinanceMonthlyPlan> {
  await verifyBudgetAccess(userId, budgetId);
  const updatePatch = omitNullish({ ...patch, updatedAt: new Date() });

  const rows = await db
    .update(financeMonthlyPlans)
    .set(updatePatch)
    .where(and(eq(financeMonthlyPlans.id, planId), eq(financeMonthlyPlans.budgetId, budgetId)))
    .returning();
  if (!rows[0]) throw new Error('Plan not found');
  monthlyPlanCache.set(`${budgetId}-${rows[0].month}`, rows[0]);
  return rows[0];
}

export async function addPlanItem(
  userId: string,
  budgetId: number,
  planId: number,
  data: PlanItemInsert,
): Promise<FinanceMonthlyPlanItem> {
  await verifyBudgetAccess(userId, budgetId);

  const planRows = await db
    .select({ id: financeMonthlyPlans.id })
    .from(financeMonthlyPlans)
    .where(and(eq(financeMonthlyPlans.id, planId), eq(financeMonthlyPlans.budgetId, budgetId)))
    .limit(1);
  if (!planRows[0]) throw new Error('Plan not found');

  const rows = await db
    .insert(financeMonthlyPlanItems)
    .values({
      planId,
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      categoryId: data.categoryId ?? null,
      merchantId: data.merchantId ?? null,
      linkedAccountId: data.linkedAccountId ?? null,
      assignedAmount: 0,
      sortOrder: data.sortOrder ?? 0,
      notes: data.notes ?? null,
    })
    .returning();
  if (!rows[0]) throw new Error('Failed to create plan item');
  return rows[0];
}

function getPlanIdsSubquery(budgetId: number) {
  return db
    .select({ id: financeMonthlyPlans.id })
    .from(financeMonthlyPlans)
    .where(eq(financeMonthlyPlans.budgetId, budgetId));
}

type ExistingItemWithMonth = Pick<
  FinanceMonthlyPlanItem,
  'id' | 'linkedAccountId' | 'assignedAmount' | 'amount' | 'currency'
> & { month: string };

/**
 * Fetches item, applies patch, returns updated row. Used by updatePlanItem and
 * togglePlanItemAssigned to avoid duplicating the pattern.
 * makePatch receives the current DB row and returns the fields to set.
 */
async function applyItemPatchInTx(
  tx: DbTx,
  budgetId: number,
  itemId: number,
  makePatch: (existing: ExistingItemWithMonth) => Record<string, unknown>,
): Promise<FinanceMonthlyPlanItem> {
  const existingRows = await tx
    .select({
      id: financeMonthlyPlanItems.id,
      linkedAccountId: financeMonthlyPlanItems.linkedAccountId,
      assignedAmount: financeMonthlyPlanItems.assignedAmount,
      amount: financeMonthlyPlanItems.amount,
      currency: financeMonthlyPlanItems.currency,
      month: financeMonthlyPlans.month,
    })
    .from(financeMonthlyPlanItems)
    .innerJoin(financeMonthlyPlans, eq(financeMonthlyPlanItems.planId, financeMonthlyPlans.id))
    .where(and(eq(financeMonthlyPlanItems.id, itemId), eq(financeMonthlyPlans.budgetId, budgetId)))
    .limit(1);

  const existing = existingRows[0];
  if (!existing) throw new Error('Plan item not found');

  const updatedRows = await tx
    .update(financeMonthlyPlanItems)
    .set(makePatch(existing))
    .where(
      and(
        eq(financeMonthlyPlanItems.id, itemId),
        inArray(financeMonthlyPlanItems.planId, getPlanIdsSubquery(budgetId)),
      ),
    )
    .returning();

  const updated = updatedRows[0];
  if (!updated) throw new Error('Plan item not found');

  return updated;
}

export async function updatePlanItem(
  userId: string,
  budgetId: number,
  itemId: number,
  data: PlanItemUpdate,
): Promise<FinanceMonthlyPlanItem> {
  await verifyBudgetAccess(userId, budgetId);
  return db.transaction(tx =>
    applyItemPatchInTx(tx, budgetId, itemId, () => omitNullish({ updatedAt: new Date(), ...data })),
  );
}

export async function deletePlanItem(userId: string, budgetId: number, itemId: number): Promise<void> {
  await verifyBudgetAccess(userId, budgetId);
  await db
    .delete(financeMonthlyPlanItems)
    .where(
      and(
        eq(financeMonthlyPlanItems.id, itemId),
        inArray(financeMonthlyPlanItems.planId, getPlanIdsSubquery(budgetId)),
      ),
    );
}

export async function togglePlanItemAssigned(
  userId: string,
  budgetId: number,
  itemId: number,
  isAssigned: boolean,
): Promise<FinanceMonthlyPlanItem> {
  await verifyBudgetAccess(userId, budgetId);
  return db.transaction(tx =>
    applyItemPatchInTx(tx, budgetId, itemId, existing => ({
      isAssigned,
      assignedAmount: isAssigned ? existing.amount : 0,
      assignedTransactionId: isAssigned ? undefined : null,
      updatedAt: new Date(),
    })),
  );
}

export async function bulkAssignAll(userId: string, budgetId: number, planId: number): Promise<void> {
  await verifyBudgetAccess(userId, budgetId);

  // Set assignedAmount = amount for every item so "paid" = "planned"
  await db
    .update(financeMonthlyPlanItems)
    .set({
      isAssigned: true,
      assignedAmount: sql`${financeMonthlyPlanItems.amount}`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(financeMonthlyPlanItems.planId, planId),
        inArray(financeMonthlyPlanItems.planId, getPlanIdsSubquery(budgetId)),
      ),
    );
}

export async function copyToNextMonth(
  userId: string,
  budgetId: number,
  month: string,
): Promise<{ created: boolean; targetMonth: string }> {
  await verifyBudgetAccess(userId, budgetId);

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
    await db.insert(financeMonthlyPlanItems).values(
      items.map(item => ({
        planId: nextPlan.id,
        name: item.name,
        // Always carry the planned amount forward — user edits what changed
        amount: item.amount,
        currency: item.currency,
        categoryId: item.categoryId,
        merchantId: item.merchantId,
        linkedAccountId: item.linkedAccountId,
        assignedAmount: 0,
        isAssigned: false,
        assignedTransactionId: null,
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

async function applyTransactionDeltaToPlan(
  userId: string,
  budgetId: number,
  transaction: AutoMatchTx,
  amountDelta: number,
): Promise<void> {
  if (amountDelta === 0) return;

  const month = transaction.date.slice(0, 7); // YYYY-MM

  const plan = await getMonthlyPlan(userId, budgetId, month);
  if (!plan) return; // no plan for this month, nothing to update

  if (
    plan.incomeAccountId !== null &&
    ((transaction.type === TransactionTypes.Income && transaction.accountId === plan.incomeAccountId) ||
      (transaction.type === TransactionTypes.Transfer && transaction.toAccountId === plan.incomeAccountId))
  ) {
    await updateMonthlyPlan(userId, budgetId, plan.id, { availableAmount: plan.availableAmount + amountDelta });
  }

  const items = await db.select().from(financeMonthlyPlanItems).where(eq(financeMonthlyPlanItems.planId, plan.id));

  for (const item of items) {
    if (!doesItemMatchTransaction(item, transaction)) continue;

    // Keep manual/other assignment states stable: only force isAssigned from
    // threshold when this transaction is the attribution source for the row.
    const wasAttributedToThisTx = item.assignedTransactionId === transaction.id;
    const nextAssignedAmount = Math.max(0, item.assignedAmount + amountDelta);
    const thresholdDone = nextAssignedAmount >= item.amount;
    const nextIsAssigned = wasAttributedToThisTx ? thresholdDone : item.isAssigned || thresholdDone;
    const nextAssignedTransactionId =
      amountDelta > 0
        ? transaction.id
        : wasAttributedToThisTx && nextAssignedAmount === 0
          ? null
          : item.assignedTransactionId;

    await db
      .update(financeMonthlyPlanItems)
      .set({
        assignedAmount: nextAssignedAmount,
        isAssigned: nextIsAssigned,
        assignedTransactionId: nextAssignedTransactionId,
        updatedAt: new Date(),
      })
      .where(eq(financeMonthlyPlanItems.id, item.id));
  }
}

/**
 * Reconciles monthly-plan effects for an edited transaction by first removing
 * the old contribution and then applying the new one.
 */
export async function reconcileAutoMatchPlanItemsForTransactionUpdate(
  userId: string,
  budgetId: number,
  before: AutoMatchTx,
  after: AutoMatchTx,
): Promise<void> {
  if (
    before.type === after.type &&
    before.accountId === after.accountId &&
    before.toAccountId === after.toAccountId &&
    before.categoryId === after.categoryId &&
    before.date === after.date &&
    before.amount === after.amount
  ) {
    return;
  }

  await applyTransactionDeltaToPlan(userId, budgetId, before, -before.amount);
  await applyTransactionDeltaToPlan(userId, budgetId, after, after.amount);
}

/**
 * Called after a transaction is inserted. Finds unfinished plan items
 * for the same budget+month and accumulates assignedAmount from the transaction.
 *
 * Match rules (per item):
 *   - linkedAccountId only  → match if transaction.toAccountId = linkedAccountId
 *   - categoryId only        → match if transaction.categoryId = categoryId
 *   - both set               → BOTH must match
 *   - neither set            → no auto-match
 *
 * When assignedAmount crosses the planned amount the item is auto-marked done.
 * Already-done items (isAssigned = true AND assignedAmount >= amount) are skipped.
 */
export async function tryAutoMatchPlanItems(userId: string, budgetId: number, transaction: AutoMatchTx): Promise<void> {
  await applyTransactionDeltaToPlan(userId, budgetId, transaction, transaction.amount);
}
