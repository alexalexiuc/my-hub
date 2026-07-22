import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AddTransactionsSchema,
  UpdateTransactionSchema,
  addTransactionsTool,
  queryTransactionsTool,
  updateTransactionTool,
} from './transactions';
import {
  addTransaction,
  checkDuplicateTransaction,
  findPayeeByNameOrAlias,
  getUserActiveBudget,
  getTransactionById,
  updateTransaction,
  getAccountById,
  getTransactions,
  countTransactions,
  getCategories,
  getBudgetProgress,
  getLoanBalanceSnapshotForAccount,
  getLoanDisplayBalance,
} from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';
import { financesContext, parseToolPayload } from './test-utils';

vi.mock('@my-hub/shared/services', () => ({
  getUserActiveBudget: vi.fn(),
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactions: vi.fn(),
  countTransactions: vi.fn(),
  checkDuplicateTransaction: vi.fn(),
  findPayeeByNameOrAlias: vi.fn(),
  upsertPayee: vi.fn(),
  getAccountById: vi.fn(),
  getAccounts: vi.fn(),
  getCategories: vi.fn(),
  getGroups: vi.fn(),
  getTransactionById: vi.fn(),
  getExchangeRate: vi.fn(),
  getBudgetProgress: vi.fn(),
  getLoanBalanceSnapshotForAccount: vi.fn(),
  getLoanDisplayBalance: vi.fn(),
}));

describe('finances transaction schemas', () => {
  it('rejects transfer items without a destination account', () => {
    const parsed = AddTransactionsSchema.safeParse({
      accountId: 1,
      transactions: [
        {
          type: TransactionTypes.Transfer,
          amount: 125,
          notes: 'Move funds',
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects schema when accountId is missing at root', () => {
    const parsed = AddTransactionsSchema.safeParse({
      transactions: [{ type: TransactionTypes.Expense, amount: 50, notes: 'Lunch' }],
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts type updates in update schema', () => {
    const parsed = UpdateTransactionSchema.safeParse({
      transactionId: 10,
      type: TransactionTypes.Income,
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts extras without kind for receipt details', () => {
    const parsed = AddTransactionsSchema.safeParse({
      accountId: 1,
      transactions: [
        {
          type: TransactionTypes.Expense,
          amount: 42,
          notes: 'Groceries',
          extras: {
            rawInput: 'Milk 2x, Bread 1x',
            items: [{ name: 'Milk', quantity: 2, totalPrice: 20 }],
          },
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});

describe('addTransactionsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'USD' } as never);
    vi.mocked(getAccountById).mockResolvedValue({
      id: 1,
      name: 'Checking',
      currency: 'USD',
      type: 'bank',
      balance: 1000,
      details: null,
    } as never);
    vi.mocked(getCategories).mockResolvedValue([] as never);
    vi.mocked(checkDuplicateTransaction).mockResolvedValue(null as never);
    vi.mocked(addTransaction).mockResolvedValue({
      id: 123,
      fromAccountBalanceAfter: 950,
      toAccountBalanceAfter: null,
    } as never);
  });

  it('stores null extras when none are provided', async () => {
    await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 50,
            notes: 'Lunch',
            date: '2026-04-28',
          },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    expect(addTransaction).toHaveBeenCalledWith('user-1', 1, expect.objectContaining({ extras: null, notes: 'Lunch' }));
  });

  it('infers receipt extras kind when receipt fields are present', async () => {
    await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 80,
            notes: 'Groceries',
            date: '2026-04-28',
            extras: {
              rawInput: 'Milk x2, Bread x1',
              receiptNumber: 'R-100',
              items: [{ name: 'Milk', quantity: 2, totalPrice: 20 }],
            },
          },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    expect(addTransaction).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({
        extras: expect.objectContaining({
          kind: 'receipt',
          source: 'mcp',
          receiptNumber: 'R-100',
        }),
      }),
    );
  });

  it('returns category budget progress in root summary for categories with monthly targets', async () => {
    vi.mocked(getCategories).mockResolvedValue([{ id: 10, monthlyTarget: 300 }] as never);
    vi.mocked(getBudgetProgress).mockResolvedValue({
      month: '2026-04',
      totalBudgeted: 300,
      totalSpent: 150,
      categories: [
        {
          id: 10,
          name: 'Groceries',
          displayName: 'Groceries',
          monthlyTarget: 300,
          spent: 150,
          remainingBudget: 150,
          percentUsed: 50,
        },
      ],
    } as never);

    const result = await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 20,
            categoryId: 10,
            notes: 'Market',
            date: '2026-04-28',
          },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    const payload = parseToolPayload(result) as {
      results: Array<Record<string, unknown>>;
      account: { id: number; name: string; balance: number; availableAfter: number | null };
      categoryProgress: Array<{
        categoryId: number;
        categoryName: string;
        month: string;
        monthlyTarget: number;
        spentSoFar: number;
        remaining: number;
      }>;
    };

    expect(payload.results[0]).not.toHaveProperty('categoryBudgetProgress');

    expect(payload.account).toEqual({
      id: 1,
      name: 'Checking',
      balance: 950,
      availableAfter: null,
    });

    expect(payload.categoryProgress).toHaveLength(1);
    expect(payload.categoryProgress[0]).toEqual({
      categoryId: 10,
      categoryName: 'Groceries',
      month: '2026-04',
      monthlyTarget: 300,
      spentSoFar: 150,
      remaining: 150,
    });

    expect(getBudgetProgress).toHaveBeenCalledTimes(1);
    expect(getBudgetProgress).toHaveBeenCalledWith('user-1', 1, '2026-04');
  });

  it('returns the amortization-derived remaining principal for a loan repayment with interest, not the raw ledger balance', async () => {
    const loanAccount = {
      id: 2,
      name: 'Car Loan',
      currency: 'USD',
      type: 'loan',
      balance: -9000,
      details: { principal: 10000, interestRate: 6, termMonths: 60, startDate: '2026-01-01' },
    };
    vi.mocked(getAccountById).mockResolvedValue(loanAccount as never);
    // The DB ledger simply subtracts the full payment amount, which overstates principal paydown
    // once part of the payment is interest — the raw fromAccountBalanceAfter is -9000 + 200 = -8800.
    vi.mocked(addTransaction).mockResolvedValue({
      id: 456,
      fromAccountBalanceAfter: -8800,
      toAccountBalanceAfter: null,
    } as never);
    vi.mocked(getLoanBalanceSnapshotForAccount).mockResolvedValue({
      balance: 8850,
      amortizationSummary: {} as never,
    } as never);
    vi.mocked(getLoanDisplayBalance).mockReturnValue(8850);

    const result = await addTransactionsTool(
      {
        accountId: 2,
        transactions: [
          {
            type: TransactionTypes.Income,
            amount: 200,
            notes: 'Monthly payment',
            date: '2026-04-28',
          },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    const payload = parseToolPayload(result) as { account: { balance: number } };

    expect(getLoanBalanceSnapshotForAccount).toHaveBeenCalledWith('user-1', 1, loanAccount);
    expect(getLoanDisplayBalance).toHaveBeenCalledWith(
      { balance: -8800, details: loanAccount.details },
      expect.objectContaining({ balance: 8850 }),
    );
    expect(payload.account.balance).toBe(8850);
  });

  it('returns empty categoryProgress when no categories are used', async () => {
    const result = await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 30,
            notes: 'Coffee',
            date: '2026-04-28',
          },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    const payload = parseToolPayload(result) as { categoryProgress: unknown[] };

    expect(payload.categoryProgress).toEqual([]);
    expect(getBudgetProgress).not.toHaveBeenCalled();
  });

  it('passes transfer payload with root accountId and relies on shared service for FX resolution', async () => {
    vi.mocked(addTransaction).mockResolvedValue({
      id: 55,
      fromAccountBalanceAfter: 800,
      toAccountBalanceAfter: 1500,
    } as never);

    const result = await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          {
            type: TransactionTypes.Transfer,
            amount: 100,
            toAccountId: 2,
            notes: 'Move funds',
            date: '2026-04-28',
          },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    expect(addTransaction).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({
        type: TransactionTypes.Transfer,
        accountId: 1,
        toAccountId: 2,
      }),
    );

    const payload = parseToolPayload(result) as {
      results: Array<{ toAccountBalanceAfter?: number }>;
      account: { balance: number };
    };

    expect(payload.results[0]?.toAccountBalanceAfter).toBe(1500);
    expect(payload.account.balance).toBe(800);
  });

  it('includes original amount currency in extras for shared conversion', async () => {
    await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 100,
            currency: 'EUR',
            notes: 'Taxi',
            date: '2026-04-28',
          },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    expect(addTransaction).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({
        amount: 100,
        amountCurrency: 'EUR',
      }),
    );
  });

  it('returns each transaction id in results for subsequent update or delete calls', async () => {
    vi.mocked(addTransaction)
      .mockResolvedValueOnce({ id: 10, fromAccountBalanceAfter: 980, toAccountBalanceAfter: null } as never)
      .mockResolvedValueOnce({ id: 11, fromAccountBalanceAfter: 960, toAccountBalanceAfter: null } as never);

    const result = await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          { type: TransactionTypes.Expense, amount: 20, notes: 'Coffee', date: '2026-04-28' },
          { type: TransactionTypes.Expense, amount: 20, notes: 'Lunch', date: '2026-04-28' },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    const payload = parseToolPayload(result) as {
      results: Array<{ transactionId: number; index: number }>;
      account: { balance: number };
    };

    expect(payload.results).toHaveLength(2);
    expect(payload.results[0]?.transactionId).toBe(10);
    expect(payload.results[1]?.transactionId).toBe(11);
    expect(payload.account.balance).toBe(960);
  });

  it('falls back to initial account balance when all transactions fail', async () => {
    vi.mocked(addTransaction).mockRejectedValue(new Error('DB error'));

    const result = await addTransactionsTool(
      {
        accountId: 1,
        transactions: [{ type: TransactionTypes.Expense, amount: 50, notes: 'Fail', date: '2026-04-28' }],
        createPayee: undefined,
      },
      financesContext,
    );

    const payload = parseToolPayload(result) as {
      results: unknown[];
      errors: Array<{ index: number; reason: string }>;
      account: { balance: number };
      categoryProgress: unknown[];
    };

    expect(payload.results).toEqual([]);
    expect(payload.errors[0]).toEqual({ index: 0, reason: 'DB error' });
    expect(payload.account.balance).toBe(1000);
    expect(payload.categoryProgress).toEqual([]);
  });

  it('reports payee_not_found in errors and still commits earlier succeeded items in the same batch', async () => {
    vi.mocked(addTransaction).mockResolvedValueOnce({
      id: 10,
      fromAccountBalanceAfter: 950,
      toAccountBalanceAfter: null,
    } as never);
    vi.mocked(findPayeeByNameOrAlias)
      .mockResolvedValueOnce({ id: 1, name: 'GitHub' } as never)
      .mockResolvedValueOnce(null as never);

    const result = await addTransactionsTool(
      {
        accountId: 1,
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 50,
            payeeName: 'GitHub',
            notes: 'Subscription',
            date: '2026-04-28',
          },
          { type: TransactionTypes.Expense, amount: 20, payeeName: 'GOG', notes: 'Game', date: '2026-04-28' },
        ],
        createPayee: undefined,
      },
      financesContext,
    );

    const payload = parseToolPayload(result) as {
      results: Array<{ index: number; transactionId: number }>;
      errors: Array<{ index: number; code: string; reason: string }>;
    };

    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({ index: 0, transactionId: 10 });
    expect(payload.errors).toHaveLength(1);
    expect(payload.errors[0]).toMatchObject({ index: 1, code: 'payee_not_found' });
    expect(addTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('updateTransactionTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'USD' } as never);
  });

  it('throws when changing to transfer without a destination account', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      id: 10,
      budgetId: 1,
      type: TransactionTypes.Expense,
      accountId: 1,
      toAccountId: null,
      amount: 50,
      exchangeRate: 1,
      date: '2026-04-27',
      categoryId: null,
      payeeId: null,
      notes: 'Lunch',
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 950,
      toAccountBalanceAfter: null,
      addedByUserId: 'user-1',
      createdAt: new Date('2026-04-27T10:00:00.000Z'),
      updatedAt: new Date('2026-04-27T10:00:00.000Z'),
    } as never);

    await expect(
      updateTransactionTool(
        {
          transactionId: 10,
          type: TransactionTypes.Transfer,
          amount: undefined,
          date: undefined,
          accountId: undefined,
          toAccountId: undefined,
          categoryId: undefined,
          payeeName: undefined,
          notes: undefined,
          labels: undefined,
          isCorrection: undefined,
        },
        financesContext,
      ),
    ).rejects.toThrow('Transfer transactions require toAccountId');

    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('returns resolved account name after update', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      id: 10,
      budgetId: 1,
      type: TransactionTypes.Expense,
      accountId: 1,
      toAccountId: null,
      amount: 50,
      exchangeRate: 1,
      date: '2026-04-27',
      categoryId: null,
      payeeId: null,
      notes: 'Lunch',
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 950,
      toAccountBalanceAfter: null,
      addedByUserId: 'user-1',
      createdAt: new Date('2026-04-27T10:00:00.000Z'),
      updatedAt: new Date('2026-04-27T10:00:00.000Z'),
    } as never);

    vi.mocked(updateTransaction).mockResolvedValue({
      id: 10,
      accountId: 2,
      categoryId: null,
      fromAccountBalanceAfter: 900,
      toAccountBalanceAfter: null,
    } as never);

    vi.mocked(getAccountById).mockResolvedValue({
      id: 2,
      name: 'Primary Checking',
    } as never);

    const result = await updateTransactionTool(
      {
        transactionId: 10,
        type: undefined,
        amount: undefined,
        date: undefined,
        accountId: undefined,
        toAccountId: undefined,
        categoryId: undefined,
        payeeName: undefined,
        notes: 'Updated note',
        labels: undefined,
        isCorrection: undefined,
      },
      financesContext,
    );
    const payload = parseToolPayload(result) as { resolvedAccount: string };

    expect(payload.resolvedAccount).toBe('Primary Checking');
    expect(getAccountById).toHaveBeenCalledWith('user-1', 1, 2);
  });

  it('clears destination account when updating a transfer to expense', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      id: 10,
      budgetId: 1,
      type: TransactionTypes.Transfer,
      accountId: 1,
      toAccountId: 5,
      amount: 200,
      exchangeRate: 1,
      date: '2026-04-27',
      categoryId: null,
      payeeId: null,
      notes: null,
      extras: null,
      isCorrection: false,
      fromAccountBalanceAfter: 800,
      toAccountBalanceAfter: 1200,
      addedByUserId: 'user-1',
      createdAt: new Date('2026-04-27T10:00:00.000Z'),
      updatedAt: new Date('2026-04-27T10:00:00.000Z'),
    } as never);

    vi.mocked(updateTransaction).mockResolvedValue({
      id: 10,
      accountId: 1,
      categoryId: null,
      fromAccountBalanceAfter: 800,
      toAccountBalanceAfter: null,
    } as never);

    vi.mocked(getAccountById).mockResolvedValue({ id: 1, name: 'Checking' } as never);

    await updateTransactionTool(
      {
        transactionId: 10,
        type: TransactionTypes.Expense,
        amount: undefined,
        date: undefined,
        accountId: undefined,
        toAccountId: undefined,
        categoryId: undefined,
        payeeName: undefined,
        notes: undefined,
        labels: undefined,
        isCorrection: undefined,
      },
      financesContext,
    );

    expect(updateTransaction).toHaveBeenCalledWith('user-1', 1, 10, expect.objectContaining({ toAccountId: null }));
  });
});

describe('queryTransactionsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'USD' } as never);
  });

  it('returns empty result when payee name is not found', async () => {
    vi.mocked(findPayeeByNameOrAlias).mockResolvedValue(null as never);

    const result = await queryTransactionsTool(
      {
        accountId: undefined,
        categoryId: undefined,
        payeeName: 'Unknown Payee',
        label: undefined,
        type: undefined,
        fromDate: undefined,
        toDate: undefined,
        amountGte: undefined,
        amountLte: undefined,
        includeCorrections: undefined,
        addedByUserId: undefined,
        search: undefined,
        limit: 50,
        offset: 0,
      },
      financesContext,
    );
    const payload = parseToolPayload(result) as { transactions: unknown[]; total: number };

    expect(payload).toEqual({ transactions: [], total: 0 });
    expect(findPayeeByNameOrAlias).toHaveBeenCalledWith('user-1', 1, 'Unknown Payee');
    expect(getTransactions).not.toHaveBeenCalled();
    expect(countTransactions).not.toHaveBeenCalled();
  });
});
