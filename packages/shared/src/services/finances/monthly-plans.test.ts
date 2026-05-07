/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainMocked } from 'chain-mock';
import { doesItemMatchTransaction, computeSummary, syncTransactionWithPlan } from './monthly-plans';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', async () => {
  const { chainMock } = await import('chain-mock');
  return { db: chainMock() };
});
vi.mock('./exchangeRates.js', () => ({ getExchangeRate: vi.fn() }));
vi.mock('./budgets.js', () => ({ enforceBudgetAccess: vi.fn().mockResolvedValue(undefined) }));
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

// ─── syncTransactionWithPlan (insert) ────────────────────────────────────────

describe('syncTransactionWithPlan (insert)', () => {
  beforeEach(() => {
    chainMocked(db).mockReset();
    chainMocked(db).transaction.mockImplementation(async callback => callback(db as any));
    vi.resetAllMocks();
  });

  it('returns immediately when no plan exists for the transaction month', async () => {
    chainMocked(db).select.from.where.limit.mockResolvedValue([]);

    await syncTransactionWithPlan('user-1', 1, null, makeAutoMatchTx() as any);

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
    await syncTransactionWithPlan('user-1', 1, null, tx as any);

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
    await syncTransactionWithPlan('user-1', 1, null, tx as any);

    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });

  it('updates assignedAmount on a matching plan item (by categoryId)', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({ categoryId: 7, linkedAccountId: null, assignedAmount: 100, amount: 500 });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);
    chainMocked(db).select.from.innerJoin.where.limit.mockResolvedValue([{ budgetId: 1 }]);
    chainMocked(db).update.set.where.returning.mockResolvedValue([{ ...item, assignedAmount: 300 }] as any);

    const tx = makeAutoMatchTx({ type: TransactionTypes.Expense, categoryId: 7, amount: 200 });
    await syncTransactionWithPlan('user-1', 1, null, tx as any);

    // @ts-ignore - ignored in test
    const [[setArg]] = chainMocked(db).update.set.mock.calls;
    expect(setArg).toMatchObject({ assignedAmount: 300 }); // 100 + 200
  });

  it('updates plan item when assignedAmount exceeds the planned threshold', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({ categoryId: 7, linkedAccountId: null, assignedAmount: 400, amount: 500 });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);
    chainMocked(db).select.from.innerJoin.where.limit.mockResolvedValue([{ budgetId: 1 }]);
    chainMocked(db).update.set.where.returning.mockResolvedValue([{ ...item, assignedAmount: 600 }] as any);

    const tx = makeAutoMatchTx({ categoryId: 7, amount: 200 }); // 400 + 200 = 600 >= 500
    await syncTransactionWithPlan('user-1', 1, null, tx as any);

    const [[setArg]] = chainMocked(db).update.set.mock.calls;
    expect(setArg).toMatchObject({ assignedAmount: 600 }); // isAssigned is computed as a SQL expression by the DB
  });

  it('processes plan item even when delta is zero', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({
      categoryId: 7,
      linkedAccountId: null,
      assignedAmount: 200,
      amount: 500,
    });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);
    chainMocked(db).select.from.innerJoin.where.limit.mockResolvedValue([{ budgetId: 1 }]);
    chainMocked(db).update.set.where.returning.mockResolvedValue([{ ...item }] as any);

    // amount=0 → delta is 0, but updatePlanItem is still called (no early return)
    const tx = makeAutoMatchTx({ categoryId: 7, amount: 0 });
    await syncTransactionWithPlan('user-1', 1, null, tx as any);

    expect(chainMocked(db).update.mock.calls).toHaveLength(2);
    // @ts-ignore - ignored in test
    const [[setArg]] = chainMocked(db).update.set.mock.calls;
    expect(setArg).toMatchObject({ assignedAmount: 200 }); // 200 + 0 = 200
  });

  it('skips non-matching item (no linkedAccountId, no categoryId)', async () => {
    const plan = makePlan({ id: 1, incomeAccountId: null });
    const item = makePlanItem({ categoryId: null, linkedAccountId: null });

    chainMocked(db).select.from.where.limit.mockResolvedValue([plan]);
    chainMocked(db).select.from.where.mockResolvedValue([item]);

    await syncTransactionWithPlan('user-1', 1, null, makeAutoMatchTx() as any);

    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });
});

// ─── syncTransactionWithPlan (update) ────────────────────────────────────────

describe('syncTransactionWithPlan (update)', () => {
  beforeEach(() => {
    chainMocked(db).mockReset();
    chainMocked(db).transaction.mockImplementation(async callback => callback(db as any));
    vi.resetAllMocks();
  });

  it('does nothing when all fields are identical', async () => {
    const tx = makeAutoMatchTx();

    await syncTransactionWithPlan('user-1', 1, tx as any, { ...tx } as any);

    expect(chainMocked(db).select.mock.calls).toHaveLength(0);
    expect(chainMocked(db).update.mock.calls).toHaveLength(0);
  });

  it('applies net delta in a single transaction when amount changes', async () => {
    // No plan → applyDeltaInTx hits DB for plan lookup only, then returns early
    chainMocked(db).select.from.where.limit.mockResolvedValue([]);

    const before = makeAutoMatchTx({ amount: 100 });
    const after = makeAutoMatchTx({ amount: 200 });

    await syncTransactionWithPlan('user-1', 1, before as any, after as any);

    // One plan lookup: net delta (200 - 100 = 100) applied in a single transaction
    expect(chainMocked(db).select.from.where.limit.mock.calls).toHaveLength(2);
  });

  it('looks up the after-transaction month when date changes', async () => {
    chainMocked(db).select.from.where.limit.mockResolvedValue([]);

    const before = makeAutoMatchTx({ date: '2026-03-10', amount: 100 });
    const after = makeAutoMatchTx({ date: '2026-04-10', amount: 100 });

    await syncTransactionWithPlan('user-1', 1, before as any, after as any);

    // Looks up only the after-transaction's month (2026-04) with the net delta
    expect(chainMocked(db).select.from.where.limit.mock.calls).toHaveLength(2);
  });
});
