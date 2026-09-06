import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AddTransactionsSchema,
  UpdateTransactionSchema,
  ItemizeTransactionSchema,
  addTransactionsTool,
  queryTransactionsTool,
  updateTransactionTool,
  itemizeTransactionTool,
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

  it('rejects itemize schema when no receipt fields are provided', () => {
    const parsed = ItemizeTransactionSchema.safeParse({ transactionId: 10 });

    expect(parsed.success).toBe(false);
  });

  it('accepts itemize schema with only items provided', () => {
    const parsed = ItemizeTransactionSchema.safeParse({
      transactionId: 10,
      items: [{ name: 'Milk', totalPrice: 20 }],
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

  it('stores null extras when none are provided and suggests itemizing an expense with no items', async () => {
    const result = await addTransactionsTool(
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

    const payload = parseToolPayload(result) as { results: Array<{ itemsCount: number; suggestion?: string }> };
    expect(payload.results[0]?.itemsCount).toBe(0);
    expect(payload.results[0]?.suggestion).toContain('finances_itemize_transaction');
  });

  it('infers receipt extras kind when receipt fields are present and reports itemsCount without a suggestion', async () => {
    const result = await addTransactionsTool(
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

    const payload = parseToolPayload(result) as { results: Array<{ itemsCount: number; suggestion?: string }> };
    expect(payload.results[0]?.itemsCount).toBe(1);
    expect(payload.results[0]?.suggestion).toBeUndefined();
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
      details: { principal: 10000, interestRate: 6, termMonths: 60, firstPaymentDate: '2026-01-01' },
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
      results: Array<{ toAccountBalanceAfter?: number; itemsCount: number; suggestion?: string }>;
      account: { balance: number };
    };

    expect(payload.results[0]?.toAccountBalanceAfter).toBe(1500);
    expect(payload.account.balance).toBe(800);
    // Transfers structurally never carry receipt items — itemsCount is still reported, but no nudge to itemize.
    expect(payload.results[0]?.itemsCount).toBe(0);
    expect(payload.results[0]?.suggestion).toBeUndefined();
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
      results: Array<{ error: string }>;
      account: { balance: number };
      categoryProgress: unknown[];
    };

    expect(payload.results[0]).toHaveProperty('error');
    expect(payload.account.balance).toBe(1000);
    expect(payload.categoryProgress).toEqual([]);
  });
});

describe('updateTransactionTool', () => {
  const baseTransaction = {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'USD' } as never);
  });

  it('throws when changing to transfer without a destination account', async () => {
    vi.mocked(getTransactionById).mockResolvedValue(baseTransaction as never);

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
    vi.mocked(getTransactionById).mockResolvedValue(baseTransaction as never);

    vi.mocked(updateTransaction).mockResolvedValue({
      id: 10,
      accountId: 2,
      type: TransactionTypes.Expense,
      categoryId: null,
      extras: null,
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
    const payload = parseToolPayload(result) as { resolvedAccount: string; itemsCount: number; suggestion?: string };

    expect(payload.resolvedAccount).toBe('Primary Checking');
    expect(getAccountById).toHaveBeenCalledWith('user-1', 1, 2);
    // Closes the RCA gap: a generic update on a transaction with no items now surfaces that fact,
    // instead of silently succeeding with no visibility into missing receipt data.
    expect(payload.itemsCount).toBe(0);
    expect(payload.suggestion).toContain('finances_itemize_transaction');
  });

  it('reports existing itemsCount without a suggestion when the transaction already has items', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      ...baseTransaction,
      notes: 'Groceries',
      extras: { kind: 'receipt', items: [{ name: 'Milk', totalPrice: 20 }] },
    } as never);

    vi.mocked(updateTransaction).mockResolvedValue({
      id: 10,
      accountId: 1,
      type: TransactionTypes.Expense,
      categoryId: null,
      extras: { kind: 'receipt', items: [{ name: 'Milk', totalPrice: 20 }] },
      fromAccountBalanceAfter: 950,
      toAccountBalanceAfter: null,
    } as never);

    vi.mocked(getAccountById).mockResolvedValue({ id: 1, name: 'Checking' } as never);

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
    const payload = parseToolPayload(result) as { itemsCount: number; suggestion?: string };

    expect(payload.itemsCount).toBe(1);
    expect(payload.suggestion).toBeUndefined();
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

describe('finances_itemize_transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'USD' } as never);
  });

  const baseTransaction = {
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
    notes: 'Groceries',
    isCorrection: false,
    fromAccountBalanceAfter: 950,
    toAccountBalanceAfter: null,
    addedByUserId: 'user-1',
    createdAt: new Date('2026-04-27T10:00:00.000Z'),
    updatedAt: new Date('2026-04-27T10:00:00.000Z'),
  };

  const baseItemizeInput = {
    payeeAddress: undefined,
    receiptNumber: undefined,
    taxAmount: undefined,
    tipAmount: undefined,
    deliveryAmount: undefined,
    discountAmount: undefined,
    items: undefined,
  };

  it('sets kind to receipt and merges provided items onto a manual transaction', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      ...baseTransaction,
      extras: { kind: 'manual', source: 'mcp' },
    } as never);
    vi.mocked(updateTransaction).mockResolvedValue({
      ...baseTransaction,
      extras: { kind: 'receipt', source: 'mcp', items: [{ name: 'Milk', totalPrice: 20 }] },
    } as never);

    const result = await itemizeTransactionTool(
      { ...baseItemizeInput, transactionId: 10, items: [{ name: 'Milk', totalPrice: 20 }] },
      financesContext,
    );

    expect(updateTransaction).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
      expect.objectContaining({
        extras: expect.objectContaining({
          kind: 'receipt',
          source: 'mcp',
          items: [{ name: 'Milk', totalPrice: 20 }],
        }),
      }),
    );

    const payload = parseToolPayload(result) as { transactionId: number; itemsCount: number; suggestion?: string };
    expect(payload.transactionId).toBe(10);
    expect(payload.itemsCount).toBe(1);
    expect(payload.suggestion).toBeUndefined();
  });

  it('replaces the existing items array rather than merging it', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      ...baseTransaction,
      extras: {
        kind: 'receipt',
        items: [
          { name: 'Milk', totalPrice: 20 },
          { name: 'Bread', totalPrice: 15 },
        ],
      },
    } as never);
    vi.mocked(updateTransaction).mockResolvedValue({
      ...baseTransaction,
      extras: { kind: 'receipt', items: [{ name: 'Eggs', totalPrice: 30 }] },
    } as never);

    await itemizeTransactionTool(
      { ...baseItemizeInput, transactionId: 10, items: [{ name: 'Eggs', totalPrice: 30 }] },
      financesContext,
    );

    expect(updateTransaction).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
      expect.objectContaining({
        extras: expect.objectContaining({ items: [{ name: 'Eggs', totalPrice: 30 }] }),
      }),
    );
  });

  it('preserves existing fields not included in the call', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      ...baseTransaction,
      extras: {
        kind: 'receipt',
        receiptNumber: 'R-100',
        items: [{ name: 'Milk', totalPrice: 20 }],
      },
    } as never);
    vi.mocked(updateTransaction).mockResolvedValue({
      ...baseTransaction,
      extras: {
        kind: 'receipt',
        receiptNumber: 'R-100',
        taxAmount: 5,
        items: [{ name: 'Milk', totalPrice: 20 }],
      },
    } as never);

    await itemizeTransactionTool({ ...baseItemizeInput, transactionId: 10, taxAmount: 5 }, financesContext);

    expect(updateTransaction).toHaveBeenCalledWith(
      'user-1',
      1,
      10,
      expect.objectContaining({
        extras: expect.objectContaining({
          receiptNumber: 'R-100',
          taxAmount: 5,
          items: [{ name: 'Milk', totalPrice: 20 }],
        }),
      }),
    );
  });

  it('throws when the transaction was not added by the current user', async () => {
    vi.mocked(getTransactionById).mockResolvedValue({
      ...baseTransaction,
      extras: null,
      addedByUserId: 'someone-else',
    } as never);

    await expect(
      itemizeTransactionTool({ ...baseItemizeInput, transactionId: 10, taxAmount: 5 }, financesContext),
    ).rejects.toThrow('You can only edit your own transactions');
    expect(updateTransaction).not.toHaveBeenCalled();
  });

  it('throws when the transaction does not exist', async () => {
    vi.mocked(getTransactionById).mockResolvedValue(null as never);

    await expect(
      itemizeTransactionTool({ ...baseItemizeInput, transactionId: 999, taxAmount: 5 }, financesContext),
    ).rejects.toThrow('Transaction not found');
    expect(updateTransaction).not.toHaveBeenCalled();
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
