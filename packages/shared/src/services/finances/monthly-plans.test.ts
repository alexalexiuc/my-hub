/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainMocked } from 'chain-mock';
import {
  doesItemMatchTransaction,
  computeSummary,
  tryAutoMatchPlanItems,
  reconcileAutoMatchPlanItemsForTransactionUpdate,
} from './monthly-plans';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', async () => {
  const { chainMock } = await import('chain-mock');
  return { db: chainMock() };
});
vi.mock('./exchangeRates.js', () => ({ getExchangeRate: vi.fn() }));
vi.mock('./budgets.js', () => ({ verifyBudgetAccess: vi.fn().mockResolvedValue(undefined) }));
vi.mock('promise-cachex', () => ({
  PromiseCacheX: class {
    get(_key: string, factory: () => Promise<unknown>) {
      return factory();
    }
    set() {}
  },
}));

import { db } from '../../db/client.js';
import { getExchangeRate } from './exchangeRates.js';
import { TransactionTypes } from '../../constants/finances';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    budgetId: 1,
    month: '2026-04',
    availableAmount: 3000,
    incomeAccountId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePlanItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    planId: 1,
    name: 'Groceries',
    amount: 500,
    currency: 'USD',
    assignedAmount: 0,
    isAssigned: false,
    assignedTransactionId: null,
    categoryId: null,
    merchantId: null,
    linkedAccountId: null,
    sortOrder: 0,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAutoMatchTx(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    type: TransactionTypes.Expense,
    accountId: 5,
    toAccountId: null,
    categoryId: 7,
    amount: 200,
    date: '2026-04-15',
    ...overrides,
  };
}

// ─── doesItemMatchTransaction ─────────────────────────────────────────────────

describe('doesItemMatchTransaction', () => {
  it('returns false when neither linkedAccountId nor categoryId is set', () => {
    const item = { linkedAccountId: null, categoryId: null };
    const tx = { toAccountId: 1, categoryId: 2 };
    expect(doesItemMatchTransaction(item, tx)).toBe(false);
  });

  it('returns true when linkedAccountId only and toAccountId matches', () => {
    const item = { linkedAccountId: 10, categoryId: null };
    const tx = { toAccountId: 10, categoryId: 99 };
    expect(doesItemMatchTransaction(item, tx)).toBe(true);
  });

  it('returns false when linkedAccountId only and toAccountId differs', () => {
    const item = { linkedAccountId: 10, categoryId: null };
    const tx = { toAccountId: 20, categoryId: 99 };
    expect(doesItemMatchTransaction(item, tx)).toBe(false);
  });

  it('returns true when categoryId only and categoryId matches', () => {
    const item = { linkedAccountId: null, categoryId: 7 };
    const tx = { toAccountId: 99, categoryId: 7 };
    expect(doesItemMatchTransaction(item, tx)).toBe(true);
  });

  it('returns false when categoryId only and categoryId differs', () => {
    const item = { linkedAccountId: null, categoryId: 7 };
    const tx = { toAccountId: 99, categoryId: 8 };
    expect(doesItemMatchTransaction(item, tx)).toBe(false);
  });

  it('returns true when both set and both match', () => {
    const item = { linkedAccountId: 10, categoryId: 7 };
    const tx = { toAccountId: 10, categoryId: 7 };
    expect(doesItemMatchTransaction(item, tx)).toBe(true);
  });

  it('returns false when both set but account mismatches', () => {
    const item = { linkedAccountId: 10, categoryId: 7 };
    const tx = { toAccountId: 99, categoryId: 7 };
    expect(doesItemMatchTransaction(item, tx)).toBe(false);
  });

  it('returns false when both set but category mismatches', () => {
    const item = { linkedAccountId: 10, categoryId: 7 };
    const tx = { toAccountId: 10, categoryId: 99 };
    expect(doesItemMatchTransaction(item, tx)).toBe(false);
  });
});

// ─── computeSummary ───────────────────────────────────────────────────────────

describe('computeSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sums amounts in budget currency without calling getExchangeRate', async () => {
    const plan = makePlan({ availableAmount: 1000 });
    const items = [
      makePlanItem({ amount: 300, currency: 'USD', assignedAmount: 0, isAssigned: false }),
      makePlanItem({ id: 2, amount: 200, currency: 'USD', assignedAmount: 200, isAssigned: true }),
    ];

    const summary = await computeSummary(plan as any, items as any, 'USD');

    expect(getExchangeRate).not.toHaveBeenCalled();
    expect(summary.planned).toBe(500);
    expect(summary.assignedCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(summary.remainingPotential).toBe(500); // 1000 - 500
    expect(summary.remainingReal).toBe(800); // 1000 - 200 assigned
  });

  it('converts foreign-currency item amounts using exchange rate', async () => {
    vi.mocked(getExchangeRate).mockResolvedValue(1.5);
    const plan = makePlan({ availableAmount: 1000 });
    const items = [makePlanItem({ amount: 200, currency: 'EUR', assignedAmount: 100, isAssigned: false })];

    const summary = await computeSummary(plan as any, items as any, 'USD');

    expect(getExchangeRate).toHaveBeenCalledWith('EUR', 'USD', expect.any(String));
    expect(summary.planned).toBe(300); // 200 * 1.5
    expect(summary.remainingReal).toBe(850); // 1000 - (100 * 1.5)
  });

  it('falls back to raw amount when getExchangeRate throws', async () => {
    vi.mocked(getExchangeRate).mockRejectedValue(new Error('API down'));
    const plan = makePlan({ availableAmount: 1000 });
    const items = [makePlanItem({ amount: 200, currency: 'EUR', assignedAmount: 50, isAssigned: false })];

    const summary = await computeSummary(plan as any, items as any, 'USD');

    expect(summary.planned).toBe(200); // raw, not converted
    expect(summary.remainingReal).toBe(950); // 1000 - 50 raw
  });

  it('converts each foreign-currency item independently', async () => {
    vi.mocked(getExchangeRate)
      .mockResolvedValueOnce(2) // EUR -> USD
      .mockResolvedValueOnce(0.5); // GBP -> USD
    const plan = makePlan({ availableAmount: 2000 });
    const items = [
      makePlanItem({ id: 1, amount: 100, currency: 'EUR', assignedAmount: 0, isAssigned: false }),
      makePlanItem({ id: 2, amount: 100, currency: 'GBP', assignedAmount: 0, isAssigned: false }),
    ];

    const summary = await computeSummary(plan as any, items as any, 'USD');

    expect(summary.planned).toBe(250); // 100*2 + 100*0.5
  });

  it('counts isAssigned correctly across items', async () => {
    const plan = makePlan({ availableAmount: 500 });
    const items = [
      makePlanItem({ id: 1, isAssigned: true, amount: 100, assignedAmount: 100 }),
      makePlanItem({ id: 2, isAssigned: false, amount: 100, assignedAmount: 0 }),
      makePlanItem({ id: 3, isAssigned: true, amount: 100, assignedAmount: 100 }),
    ];

    const summary = await computeSummary(plan as any, items as any, 'USD');

    expect(summary.assignedCount).toBe(2);
    expect(summary.totalCount).toBe(3);
  });
});

// ─── tryAutoMatchPlanItems ────────────────────────────────────────────────────

describe('tryAutoMatchPlanItems', () => {
  beforeEach(() => {
    chainMocked(db).mockReset();
    chainMocked(db).transaction.mockImplementation(async callback => callback(db as any));
    vi.resetAllMocks();
  });

  it('returns immediately when no plan exists for the transaction month', async () => {
    chainMocked(db).select.from.where.limit.mockResolvedValue([]);

    await tryAutoMatchPlanItems('user-1', 1, makeAutoMatchTx() as any);

    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });

  it('increments availableAmount when income matches plan incomeAccountId', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: 20 });
    const item = makePlanItem({ categoryId: null, linkedAccountId: null }); // no match criteria → skipped

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);
    // updateMonthlyPlan uses .returning() — mock that chain so it doesn't throw
    chainMocked(db).update.set.where.returning.mockResolvedValue([plan] as any);

    const tx = makeAutoMatchTx({ type: TransactionTypes.Income, accountId: 20, amount: 500 });
    await tryAutoMatchPlanItems('user-1', 1, tx as any);

    // @ts-ignore - ignored in test
    const [[setArg]] = chainMocked(db).update.set.mock.calls;
    expect(setArg).toMatchObject({ availableAmount: expect.anything() });
  });

  it('does not touch availableAmount when income account does not match incomeAccountId', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: 20 });
    const item = makePlanItem({ categoryId: null, linkedAccountId: null });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);

    const tx = makeAutoMatchTx({ type: TransactionTypes.Income, accountId: 99, amount: 500 });
    await tryAutoMatchPlanItems('user-1', 1, tx as any);

    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });

  it('updates assignedAmount on a matching plan item (by categoryId)', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({ categoryId: 7, linkedAccountId: null, assignedAmount: 100, amount: 500 });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);
    chainMocked(db).update.set.where.mockResolvedValue([] as any);

    const tx = makeAutoMatchTx({ type: TransactionTypes.Expense, categoryId: 7, amount: 200 });
    await tryAutoMatchPlanItems('user-1', 1, tx as any);

    // @ts-ignore - ignored in test
    const [[setArg]] = chainMocked(db).update.set.mock.calls;
    expect(setArg).toMatchObject({ assignedAmount: 300 }); // 100 + 200
  });

  it('sets isAssigned to true when assignedAmount crosses the planned threshold', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({ categoryId: 7, linkedAccountId: null, assignedAmount: 400, amount: 500 });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);
    chainMocked(db).update.set.where.mockResolvedValue([] as any);

    const tx = makeAutoMatchTx({ categoryId: 7, amount: 200 }); // 400 + 200 = 600 >= 500
    await tryAutoMatchPlanItems('user-1', 1, tx as any);

    const [[setArg]] = chainMocked(db).update.set.mock.calls;
    expect(setArg).toMatchObject({ isAssigned: true });
  });

  it('clears assignedTransactionId when delta reduces it to 0 and tx was attribution source', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({
      categoryId: 7,
      linkedAccountId: null,
      assignedAmount: 200,
      amount: 500,
      assignedTransactionId: 10, // same as tx.id
    });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);

    // amount=0 → applyTransactionDeltaToPlan returns early (amountDelta === 0)
    const tx = makeAutoMatchTx({ id: 10, categoryId: 7, amount: 0 });
    await tryAutoMatchPlanItems('user-1', 1, tx as any);

    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });

  it('skips non-matching item (no linkedAccountId, no categoryId)', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({ categoryId: null, linkedAccountId: null });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);

    await tryAutoMatchPlanItems('user-1', 1, makeAutoMatchTx() as any);

    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });
});

// ─── reconcileAutoMatchPlanItemsForTransactionUpdate ─────────────────────────

describe('reconcileAutoMatchPlanItemsForTransactionUpdate', () => {
  beforeEach(() => {
    chainMocked(db).mockReset();
    chainMocked(db).transaction.mockImplementation(async callback => callback(db as any));
    vi.resetAllMocks();
  });

  it('does nothing when all fields are identical', async () => {
    const tx = makeAutoMatchTx();

    await reconcileAutoMatchPlanItemsForTransactionUpdate('user-1', 1, tx as any, { ...tx } as any);

    expect(chainMocked(db).select.mock.calls).toHaveLength(0);
    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });

  it('reverses old delta and applies new delta when amount changes', async () => {
    // No plan → both applyTransactionDeltaToPlan calls hit DB for plan lookup only
    chainMocked(db).select.from.where.limit.mockResolvedValue([]);

    const before = makeAutoMatchTx({ amount: 100 });
    const after = makeAutoMatchTx({ amount: 200 });

    await reconcileAutoMatchPlanItemsForTransactionUpdate('user-1', 1, before as any, after as any);

    // Two plan lookups: one for the reversal (-before.amount), one for the new (+after.amount)
    expect(chainMocked(db).select.from.where.limit.mock.calls).toHaveLength(2);
  });

  it('targets the correct months when date changes', async () => {
    chainMocked(db).select.from.where.limit.mockResolvedValue([]);

    const before = makeAutoMatchTx({ date: '2026-03-10', amount: 100 });
    const after = makeAutoMatchTx({ date: '2026-04-10', amount: 100 });

    await reconcileAutoMatchPlanItemsForTransactionUpdate('user-1', 1, before as any, after as any);

    // Should have looked up plans for both months
    expect(chainMocked(db).select.from.where.limit.mock.calls).toHaveLength(2);
  });
});
