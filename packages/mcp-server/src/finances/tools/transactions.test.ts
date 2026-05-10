import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubAuthExtra } from '../../shared/types';
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
} from '@my-hub/shared/services';
import { TransactionTypes } from '@my-hub/shared/constants';

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
}));

const context: HubAuthExtra = {
  userId: 'user-1',
  email: 'user@example.com',
  clientId: 'client-1',
  serverName: 'finances',
  timezone: 'Europe/Bucharest',
};

function parseToolPayload(result: { content: Array<{ type: string; text?: string }> }): unknown {
  const textContent = result.content.find(item => item.type === 'text' && typeof item.text === 'string');
  if (!textContent?.text) {
    throw new Error('Expected text content in tool response');
  }

  return JSON.parse(textContent.text);
}

describe('finances transaction schemas', () => {
  it('rejects transfer items without a destination account', () => {
    const parsed = AddTransactionsSchema.safeParse({
      transactions: [
        {
          type: TransactionTypes.Transfer,
          amount: 125,
          accountId: 1,
          notes: 'Move funds',
        },
      ],
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
      transactions: [
        {
          type: TransactionTypes.Expense,
          amount: 42,
          accountId: 1,
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
    vi.mocked(getAccountById).mockResolvedValue({ id: 1, name: 'Checking', currency: 'USD' } as never);
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
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 50,
            accountId: 1,
            notes: 'Lunch',
            date: '2026-04-28',
          },
        ],
      },
      context,
    );

    expect(addTransaction).toHaveBeenCalledWith('user-1', 1, expect.objectContaining({ extras: null, notes: 'Lunch' }));
  });

  it('infers receipt extras kind when receipt fields are present', async () => {
    await addTransactionsTool(
      {
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 80,
            accountId: 1,
            notes: 'Groceries',
            date: '2026-04-28',
            extras: {
              rawInput: 'Milk x2, Bread x1',
              receiptNumber: 'R-100',
              items: [{ name: 'Milk', quantity: 2, totalPrice: 20 }],
            },
          },
        ],
      },
      context,
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

  it('returns category budget progress for categories with monthly targets', async () => {
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
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 20,
            accountId: 1,
            categoryId: 10,
            notes: 'Market',
            date: '2026-04-28',
          },
        ],
      },
      context,
    );

    const payload = parseToolPayload(result) as {
      results: Array<{
        categoryBudgetProgress?: {
          month: string;
          monthlyTarget: string;
          remaining: string;
          spentSoFar: string;
        };
      }>;
    };

    expect(payload.results[0]?.categoryBudgetProgress).toEqual({
      month: '2026-04',
      monthlyTarget: 300,
      remaining: 150,
      spentSoFar: 150,
    });
    expect(getBudgetProgress).toHaveBeenCalledWith('user-1', 1, '2026-04');
  });

  it('passes transfer payload and relies on shared service for FX resolution', async () => {
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'USD' } as never);
    vi.mocked(getAccountById).mockResolvedValue({ id: 1, name: 'EUR Account', currency: 'EUR' } as never);

    await addTransactionsTool(
      {
        transactions: [
          {
            type: TransactionTypes.Transfer,
            amount: 100,
            accountId: 1,
            toAccountId: 2,
            notes: 'Move funds',
            date: '2026-04-28',
          },
        ],
      },
      context,
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
  });

  it('includes original amount currency in extras for shared conversion', async () => {
    await addTransactionsTool(
      {
        transactions: [
          {
            type: TransactionTypes.Expense,
            amount: 100,
            currency: 'EUR',
            accountId: 1,
            notes: 'Taxi',
            date: '2026-04-28',
          },
        ],
      },
      context,
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
          isCorrection: undefined,
        },
        context,
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
        isCorrection: undefined,
      },
      context,
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
        isCorrection: undefined,
      },
      context,
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
        type: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        includeCorrections: undefined,
        search: undefined,
        limit: undefined,
        offset: undefined,
      },
      context,
    );
    const payload = parseToolPayload(result) as { transactions: unknown[]; total: number };

    expect(payload).toEqual({ transactions: [], total: 0 });
    expect(findPayeeByNameOrAlias).toHaveBeenCalledWith('user-1', 1, 'Unknown Payee');
    expect(getTransactions).not.toHaveBeenCalled();
    expect(countTransactions).not.toHaveBeenCalled();
  });
});
