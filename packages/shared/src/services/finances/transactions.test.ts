/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addTransaction, updateTransaction, deleteTransaction } from './transactions';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', () => ({
  db: { transaction: vi.fn() },
}));
vi.mock('./budgets.js', () => ({ verifyBudgetAccess: vi.fn() }));
vi.mock('./payees.js', () => ({ incrementPayeeStats: vi.fn(), decrementPayeeStats: vi.fn() }));
vi.mock('./exchangeRates.js', () => ({ getExchangeRate: vi.fn() }));

import { db } from '../../db/client.js';
import { verifyBudgetAccess } from './budgets.js';
import { incrementPayeeStats, decrementPayeeStats } from './payees.js';
import { getExchangeRate } from './exchangeRates.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SelectChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
};

/**
 * Build a mock Drizzle transaction object.
 * selectResults: results returned by sequential tx.select() calls (each is a row array).
 * insertResult: the row returned by tx.insert().values().returning().
 */
function makeTx(selectResults: unknown[][], insertResult?: unknown) {
  let callIndex = 0;
  const selectChains: SelectChain[] = selectResults.map(rows => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  }));

  return {
    select: vi.fn(() => {
      const chain = selectChains[callIndex++] ?? {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      return chain;
    }),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn(() => {
        const p = Promise.resolve([]);
        return Object.assign(p, {
          returning: vi.fn().mockResolvedValue(insertResult !== undefined ? [insertResult] : []),
        });
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(insertResult !== undefined ? [insertResult] : []),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  };
}

function useTx(tx: ReturnType<typeof makeTx>) {
  (vi.mocked(db) as any).transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(tx));
}

function getUpdateSetCall(tx: ReturnType<typeof makeTx>, callIndex: number) {
  return (tx.update.mock.results[callIndex]!.value as { set: ReturnType<typeof vi.fn> }).set;
}

function getInsertValuesCall(tx: ReturnType<typeof makeTx>) {
  return (tx.insert.mock.results[0]!.value as { values: ReturnType<typeof vi.fn> }).values;
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    budgetId: 1,
    type: 'expense',
    accountId: 10,
    toAccountId: null,
    amount: 100,
    exchangeRate: 1,
    date: '2026-04-28',
    categoryId: null,
    payeeId: null,
    notes: null,
    extras: null,
    isCorrection: false,
    fromAccountBalanceAfter: 900,
    toAccountBalanceAfter: null,
    addedByUserId: 'user-1',
    createdAt: new Date('2026-04-28T10:00:00Z'),
    updatedAt: new Date('2026-04-28T10:00:00Z'),
    ...overrides,
  };
}

// ─── addTransaction ───────────────────────────────────────────────────────────

describe('addTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyBudgetAccess).mockResolvedValue(true);
    vi.mocked(getExchangeRate).mockResolvedValue(1);
  });

  it('throws if budget not found', async () => {
    vi.mocked(verifyBudgetAccess).mockResolvedValue(false);

    await expect(
      addTransaction('user-1', 1, {
        type: 'expense',
        accountId: 10,
        toAccountId: null,
        amount: 50,
        exchangeRate: 1,
        date: '2026-04-28',
        categoryId: null,
        payeeId: null,
        notes: null,
        extras: null,
        isCorrection: false,
        fromAccountBalanceAfter: 0,
        toAccountBalanceAfter: null,
      }),
    ).rejects.toThrow('Budget not found');
  });

  it('throws if transfer has no destination account', async () => {
    await expect(
      addTransaction('user-1', 1, {
        type: 'transfer',
        accountId: 10,
        toAccountId: null,
        amount: 50,
        exchangeRate: 1,
        date: '2026-04-28',
        categoryId: null,
        payeeId: null,
        notes: null,
        extras: null,
        isCorrection: false,
        fromAccountBalanceAfter: 0,
        toAccountBalanceAfter: null,
      }),
    ).rejects.toThrow('Transfer transactions require a destination account (toAccountId)');
  });

  it('deducts amount from source account on expense', async () => {
    const insertedRow = makeTransaction({ fromAccountBalanceAfter: 900 });
    const tx = makeTx([[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'USD' }]], insertedRow);
    useTx(tx);

    const result = await addTransaction('user-1', 1, {
      type: 'expense',
      accountId: 10,
      toAccountId: null,
      amount: 100,
      exchangeRate: 1,
      date: '2026-04-28',
      categoryId: null,
      payeeId: null,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    // Balance updated with 1000 - 100 = 900
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 900 }));
    expect(result.fromAccountBalanceAfter).toBe(900);
  });

  it('credits source account on income', async () => {
    const insertedRow = makeTransaction({ type: 'income', fromAccountBalanceAfter: 1100 });
    const tx = makeTx([[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'USD' }]], insertedRow);
    useTx(tx);

    await addTransaction('user-1', 1, {
      type: 'income',
      accountId: 10,
      toAccountId: null,
      amount: 100,
      exchangeRate: 1,
      date: '2026-04-28',
      categoryId: null,
      payeeId: null,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    // Balance updated with 1000 + 100 = 1100
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 1100 }));
  });

  it('updates both accounts on transfer', async () => {
    const insertedRow = makeTransaction({
      type: 'transfer',
      toAccountId: 20,
      fromAccountBalanceAfter: 900,
      toAccountBalanceAfter: 600,
    });
    // select[0] = budget, select[1] = fromAccount, select[2] = toAccount
    const tx = makeTx(
      [[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'USD' }], [{ balance: 500, currency: 'USD' }]],
      insertedRow,
    );
    useTx(tx);

    await addTransaction('user-1', 1, {
      type: 'transfer',
      accountId: 10,
      toAccountId: 20,
      amount: 100,
      exchangeRate: 1,
      toExchangeRate: 1,
      date: '2026-04-28',
      categoryId: null,
      payeeId: null,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    // First update: from 1000 - 100 = 900
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 900 }));
    // Second update: from 500 + 100 = 600
    expect(getUpdateSetCall(tx, 1)).toHaveBeenCalledWith(expect.objectContaining({ balance: 600 }));
  });

  it('applies exchange rate when crediting destination on transfer', async () => {
    const insertedRow = makeTransaction({ type: 'transfer', toAccountId: 20 });
    // 100 EUR transferred at destination rate 1.1 → destination gets 110 USD
    const tx = makeTx(
      [[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'EUR' }], [{ balance: 500, currency: 'USD' }]],
      insertedRow,
    );
    useTx(tx);

    await addTransaction('user-1', 1, {
      type: 'transfer',
      accountId: 10,
      toAccountId: 20,
      amount: 100,
      exchangeRate: 1.1,
      toExchangeRate: 1.1,
      date: '2026-04-28',
      categoryId: null,
      payeeId: null,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    // 500 + 100 * 1.1 = 610
    expect(getUpdateSetCall(tx, 1)).toHaveBeenCalledWith(expect.objectContaining({ balance: 610 }));
  });

  it('resolves reporting and transfer rates when not provided', async () => {
    const insertedRow = makeTransaction({ type: 'transfer', toAccountId: 20 });
    const tx = makeTx(
      [[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'EUR' }], [{ balance: 500, currency: 'RON' }]],
      insertedRow,
    );
    useTx(tx);
    vi.mocked(getExchangeRate)
      .mockResolvedValueOnce(1.08 as never) // EUR -> USD
      .mockResolvedValueOnce(4.95 as never); // EUR -> RON

    await addTransaction('user-1', 1, {
      type: 'transfer',
      accountId: 10,
      toAccountId: 20,
      amount: 100,
      date: '2026-04-28',
      categoryId: null,
      payeeId: null,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    expect(getExchangeRate).toHaveBeenNthCalledWith(1, 'EUR', 'USD', '2026-04-28');
    expect(getExchangeRate).toHaveBeenNthCalledWith(2, 'EUR', 'RON', '2026-04-28');
    expect(getInsertValuesCall(tx)).toHaveBeenCalledWith(
      expect.objectContaining({
        exchangeRate: 1.08,
        toExchangeRate: 4.95,
      }),
    );
  });

  it('converts amount from amountCurrency into account currency', async () => {
    const insertedRow = makeTransaction({ type: 'expense' });
    const tx = makeTx([[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'USD' }]], insertedRow);
    useTx(tx);
    vi.mocked(getExchangeRate).mockResolvedValueOnce(1.2 as never); // EUR -> USD

    await addTransaction('user-1', 1, {
      type: 'expense',
      accountId: 10,
      toAccountId: null,
      amount: 100,
      date: '2026-04-28',
      categoryId: null,
      payeeId: null,
      notes: 'Trip expense',
      amountCurrency: 'EUR',
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    expect(getExchangeRate).toHaveBeenCalledWith('EUR', 'USD', '2026-04-28');
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 880 }));
    expect(getInsertValuesCall(tx)).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 120,
        extras: expect.objectContaining({
          conversion: expect.objectContaining({
            originalAmount: 100,
            originalCurrency: 'EUR',
            accountCurrency: 'USD',
            originalToAccountRate: 1.2,
            convertedAmount: 120,
          }),
        }),
      }),
    );
  });

  it('increments payee stats when payeeId is provided', async () => {
    const insertedRow = makeTransaction({ payeeId: 5, categoryId: 3 });
    const tx = makeTx([[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'USD' }]], insertedRow);
    useTx(tx);
    vi.mocked(incrementPayeeStats).mockResolvedValue(undefined);

    await addTransaction('user-1', 1, {
      type: 'expense',
      accountId: 10,
      toAccountId: null,
      amount: 50,
      exchangeRate: 1,
      date: '2026-04-28',
      categoryId: 3,
      payeeId: 5,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    expect(incrementPayeeStats).toHaveBeenCalledWith(tx, 5, 'user-1', 3);
  });

  it('skips payee stats when payeeId is null', async () => {
    const insertedRow = makeTransaction();
    const tx = makeTx([[{ defaultCurrency: 'USD' }], [{ balance: 1000, currency: 'USD' }]], insertedRow);
    useTx(tx);

    await addTransaction('user-1', 1, {
      type: 'expense',
      accountId: 10,
      toAccountId: null,
      amount: 50,
      exchangeRate: 1,
      date: '2026-04-28',
      categoryId: null,
      payeeId: null,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 0,
      toAccountBalanceAfter: null,
    });

    expect(incrementPayeeStats).not.toHaveBeenCalled();
  });
});

// ─── updateTransaction ────────────────────────────────────────────────────────

describe('updateTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyBudgetAccess).mockResolvedValue(true);
  });

  it('throws if budget not found', async () => {
    vi.mocked(verifyBudgetAccess).mockResolvedValue(false);

    await expect(updateTransaction('user-1', 1, 1, { amount: 50 })).rejects.toThrow('Budget not found');
  });

  it('throws if updating type to transfer without a destination account', async () => {
    const existing = makeTransaction({ type: 'expense', toAccountId: null });
    // select[0] = existing transaction
    // select[1] = oldFromAcct (to reverse old balance)
    // select[2] = newFromAcct (to apply new balance)
    const tx = makeTx([[existing], [{ balance: 900 }], [{ balance: 900 }]]);
    useTx(tx);

    await expect(updateTransaction('user-1', 1, 1, { type: 'transfer' })).rejects.toThrow(
      'Transfer transactions require a destination account (toAccountId)',
    );
  });

  it('reverses old balance and applies new amount on expense update', async () => {
    const existing = makeTransaction({ type: 'expense', accountId: 10, amount: 100, toAccountId: null });
    const updatedRow = makeTransaction({ amount: 200, fromAccountBalanceAfter: 800 });
    // select[0] = existing tx, select[1] = oldFromAcct, select[2] = newFromAcct
    const tx = makeTx([[existing], [{ balance: 900 }], [{ balance: 900 }]], updatedRow);
    useTx(tx);

    await updateTransaction('user-1', 1, 1, { amount: 200 });

    // Reverse: expense → restore balance: 900 + 100 = 1000
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 1000 }));
    // Apply new: expense → deduct: 900 - 200 = 700
    expect(getUpdateSetCall(tx, 1)).toHaveBeenCalledWith(expect.objectContaining({ balance: 700 }));
  });

  it('reverses old balance and applies new amount on income update', async () => {
    const existing = makeTransaction({ type: 'income', accountId: 10, amount: 100, toAccountId: null });
    const updatedRow = makeTransaction({ type: 'income', amount: 50, fromAccountBalanceAfter: 950 });
    const tx = makeTx([[existing], [{ balance: 1100 }], [{ balance: 1100 }]], updatedRow);
    useTx(tx);

    await updateTransaction('user-1', 1, 1, { amount: 50 });

    // Reverse income: 1100 - 100 = 1000
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 1000 }));
    // Apply new income: 1100 + 50 = 1150
    expect(getUpdateSetCall(tx, 1)).toHaveBeenCalledWith(expect.objectContaining({ balance: 1150 }));
  });

  it('decrements old payee and increments new payee on payee change', async () => {
    const existing = makeTransaction({ payeeId: 5, categoryId: 3 });
    const updatedRow = makeTransaction({ payeeId: 7, categoryId: 3 });
    const tx = makeTx([[existing], [{ balance: 900 }], [{ balance: 900 }]], updatedRow);
    useTx(tx);
    vi.mocked(decrementPayeeStats).mockResolvedValue(undefined);
    vi.mocked(incrementPayeeStats).mockResolvedValue(undefined);

    await updateTransaction('user-1', 1, 1, { payeeId: 7 });

    expect(decrementPayeeStats).toHaveBeenCalledWith(tx, 5, 'user-1');
    expect(incrementPayeeStats).toHaveBeenCalledWith(tx, 7, 'user-1', 3);
  });

  it('increments payee stats on category change without payee change', async () => {
    const existing = makeTransaction({ payeeId: 5, categoryId: 3 });
    const updatedRow = makeTransaction({ payeeId: 5, categoryId: 8 });
    const tx = makeTx([[existing], [{ balance: 900 }], [{ balance: 900 }]], updatedRow);
    useTx(tx);
    vi.mocked(incrementPayeeStats).mockResolvedValue(undefined);

    await updateTransaction('user-1', 1, 1, { categoryId: 8 });

    expect(decrementPayeeStats).not.toHaveBeenCalled();
    expect(incrementPayeeStats).toHaveBeenCalledWith(tx, 5, 'user-1', 8);
  });
});

// ─── deleteTransaction ────────────────────────────────────────────────────────

describe('deleteTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyBudgetAccess).mockResolvedValue(true);
  });

  it('throws if budget not found', async () => {
    vi.mocked(verifyBudgetAccess).mockResolvedValue(false);

    await expect(deleteTransaction('user-1', 1, 1)).rejects.toThrow('Budget not found');
  });

  it('throws if transaction not found in db', async () => {
    // select returns empty array → no existing row
    const tx = makeTx([[]]);
    useTx(tx);

    await expect(deleteTransaction('user-1', 1, 99)).rejects.toThrow('Transaction not found');
  });

  it('reverses source balance on expense delete', async () => {
    const existing = makeTransaction({ type: 'expense', accountId: 10, amount: 100, toAccountId: null });
    const tx = makeTx([[existing], [{ balance: 900 }]]);
    useTx(tx);

    const result = await deleteTransaction('user-1', 1, 1);

    // Reverse expense: 900 + 100 = 1000
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 1000 }));
    expect(result).toEqual({ accountBalanceAfter: 1000 });
  });

  it('reverses source balance on income delete', async () => {
    const existing = makeTransaction({ type: 'income', accountId: 10, amount: 200, toAccountId: null });
    const tx = makeTx([[existing], [{ balance: 1200 }]]);
    useTx(tx);

    const result = await deleteTransaction('user-1', 1, 1);

    // Reverse income: 1200 - 200 = 1000
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 1000 }));
    expect(result).toEqual({ accountBalanceAfter: 1000 });
  });

  it('reverses both account balances on transfer delete', async () => {
    const existing = makeTransaction({
      type: 'transfer',
      accountId: 10,
      toAccountId: 20,
      amount: 100,
      exchangeRate: 1,
    });
    // select[0] = existing tx, select[1] = fromAcct, select[2] = toAcct
    const tx = makeTx([[existing], [{ balance: 900 }], [{ balance: 600 }]]);
    useTx(tx);

    await deleteTransaction('user-1', 1, 1);

    // Reverse from: 900 + 100 = 1000
    expect(getUpdateSetCall(tx, 0)).toHaveBeenCalledWith(expect.objectContaining({ balance: 1000 }));
    // Reverse to: 600 - 100 = 500
    expect(getUpdateSetCall(tx, 1)).toHaveBeenCalledWith(expect.objectContaining({ balance: 500 }));
  });

  it('decrements payee stats on delete', async () => {
    const existing = makeTransaction({ payeeId: 5 });
    const tx = makeTx([[existing], [{ balance: 900 }]]);
    useTx(tx);
    vi.mocked(decrementPayeeStats).mockResolvedValue(undefined);

    await deleteTransaction('user-1', 1, 1);

    expect(decrementPayeeStats).toHaveBeenCalledWith(tx, 5, 'user-1');
  });

  it('skips payee stats when payeeId is null', async () => {
    const existing = makeTransaction({ payeeId: null });
    const tx = makeTx([[existing], [{ balance: 900 }]]);
    useTx(tx);

    await deleteTransaction('user-1', 1, 1);

    expect(decrementPayeeStats).not.toHaveBeenCalled();
  });
});
