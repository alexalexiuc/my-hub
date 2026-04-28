import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubAuthExtra } from '../../shared/types';
import {
  AddTransactionsSchema,
  UpdateTransactionSchema,
  queryTransactionsTool,
  updateTransactionTool,
} from './transactions';
import {
  getUserActiveBudget,
  getTransactionById,
  updateTransaction,
  getAccountById,
  getPayees,
  getTransactions,
  countTransactions,
} from '@my-hub/shared/services';

vi.mock('@my-hub/shared/services', () => ({
  getUserActiveBudget: vi.fn(),
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  getTransactions: vi.fn(),
  countTransactions: vi.fn(),
  checkDuplicateTransaction: vi.fn(),
  upsertPayee: vi.fn(),
  getAccountById: vi.fn(),
  getAccounts: vi.fn(),
  getCategories: vi.fn(),
  getGroups: vi.fn(),
  getTransactionById: vi.fn(),
  getPayees: vi.fn(),
  getCurrencyRate: vi.fn(),
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
          type: 'transfer',
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
      type: 'income',
    });

    expect(parsed.success).toBe(true);
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
      type: 'expense',
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
          type: 'transfer',
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
      type: 'expense',
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
      type: 'transfer',
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
        type: 'expense',
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
    vi.mocked(getPayees).mockResolvedValue([{ id: 1, name: 'Supermarket' }] as never);

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
    expect(getTransactions).not.toHaveBeenCalled();
    expect(countTransactions).not.toHaveBeenCalled();
  });
});
