import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUserActiveBudget,
  createAccount,
  updateAccount,
  getAccountById,
  addTransaction,
} from '@my-hub/shared/services';
import { UpsertAccountSchema, upsertAccountTool } from './accounts';
import { financesContext, parseToolPayload } from './test-utils';

vi.mock('@my-hub/shared/services', () => ({
  getUserActiveBudget: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  getAccountById: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  getCategoryById: vi.fn(),
  getGroups: vi.fn(),
  createGroup: vi.fn(),
  addTransaction: vi.fn(),
}));

const baseInput = {
  id: undefined,
  name: undefined,
  type: undefined,
  currency: undefined,
  openingBalance: undefined,
  openingDate: undefined,
  archived: undefined,
  details: undefined,
};

describe('UpsertAccountSchema', () => {
  it('rejects an invalid account type', () => {
    const parsed = UpsertAccountSchema.safeParse({ name: 'Test', type: 'savings' });
    expect(parsed.success).toBe(false);
  });

  it('rejects openingDate that is not YYYY-MM-DD', () => {
    const parsed = UpsertAccountSchema.safeParse({
      name: 'Test',
      type: 'bank',
      openingBalance: 100,
      openingDate: '01/01/2026',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects credit_card details missing required fields', () => {
    const parsed = UpsertAccountSchema.safeParse({
      name: 'Visa',
      type: 'credit_card',
      details: { type: 'credit_card' },
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts valid credit_card details', () => {
    const parsed = UpsertAccountSchema.safeParse({
      name: 'Visa',
      type: 'credit_card',
      details: { type: 'credit_card', creditLimit: 5000, statementDay: 15 },
    });
    expect(parsed.success).toBe(true);
  });
});

describe('upsertAccountTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'EUR' } as never);
  });

  it('throws when there is no active budget', async () => {
    vi.mocked(getUserActiveBudget).mockResolvedValue(null as never);

    await expect(upsertAccountTool({ ...baseInput, name: 'Savings', type: 'bank' }, financesContext)).rejects.toThrow(
      'No active budget',
    );
  });

  it('throws when openingBalance is provided without openingDate', async () => {
    await expect(
      upsertAccountTool({ ...baseInput, name: 'Savings', type: 'bank', openingBalance: 500 }, financesContext),
    ).rejects.toThrow('openingDate is required when openingBalance is provided');
  });

  it('throws when openingDate is provided without openingBalance', async () => {
    await expect(
      upsertAccountTool({ ...baseInput, name: 'Savings', type: 'bank', openingDate: '2026-01-01' }, financesContext),
    ).rejects.toThrow('openingBalance is required when openingDate is provided');
  });

  it('throws when details.type does not match the account type', async () => {
    await expect(
      upsertAccountTool({ ...baseInput, name: 'Savings', type: 'bank', details: { type: 'cash' } }, financesContext),
    ).rejects.toThrow('details.type "cash" does not match account type "bank"');
  });

  it('throws when creating without a name', async () => {
    await expect(upsertAccountTool({ ...baseInput, type: 'bank' }, financesContext)).rejects.toThrow(
      'name is required when creating an account',
    );
  });

  it('throws when creating without a type', async () => {
    await expect(upsertAccountTool({ ...baseInput, name: 'Savings' }, financesContext)).rejects.toThrow(
      'type is required when creating an account',
    );
  });

  it('throws when creating a loan account (redirects to add_loan tool)', async () => {
    await expect(upsertAccountTool({ ...baseInput, name: 'Car Loan', type: 'loan' }, financesContext)).rejects.toThrow(
      'Use the finances_add_loan tool to create loan accounts.',
    );
  });

  it('creates a bank account and returns it', async () => {
    vi.mocked(createAccount).mockResolvedValue({
      id: 5,
      name: 'Main Savings',
      type: 'bank',
      currency: 'EUR',
      balance: 0,
      archived: false,
    } as never);

    const result = await upsertAccountTool({ ...baseInput, name: 'Main Savings', type: 'bank' }, financesContext);
    const payload = parseToolPayload(result) as { id: number; name: string; currency: string };

    expect(createAccount).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({ name: 'Main Savings', type: 'bank', currency: 'EUR' }),
    );
    expect(payload.id).toBe(5);
    expect(payload.name).toBe('Main Savings');
    expect(payload.currency).toBe('EUR');
  });

  it('uses the supplied currency instead of the budget default when creating', async () => {
    vi.mocked(createAccount).mockResolvedValue({
      id: 6,
      name: 'USD Account',
      type: 'bank',
      currency: 'USD',
      balance: 0,
      archived: false,
    } as never);

    await upsertAccountTool({ ...baseInput, name: 'USD Account', type: 'bank', currency: 'USD' }, financesContext);

    expect(createAccount).toHaveBeenCalledWith('user-1', 1, expect.objectContaining({ currency: 'USD' }));
  });

  it('updates an existing account', async () => {
    vi.mocked(getAccountById).mockResolvedValue({
      id: 3,
      name: 'Old Name',
      type: 'bank',
      currency: 'EUR',
      balance: 200,
      archived: false,
    } as never);
    vi.mocked(updateAccount).mockResolvedValue({
      id: 3,
      name: 'New Name',
      type: 'bank',
      currency: 'EUR',
      balance: 200,
      archived: false,
    } as never);

    const result = await upsertAccountTool({ ...baseInput, id: 3, name: 'New Name' }, financesContext);
    const payload = parseToolPayload(result) as { name: string };

    expect(getAccountById).toHaveBeenCalledWith('user-1', 1, 3);
    expect(updateAccount).toHaveBeenCalledWith('user-1', 1, 3, expect.objectContaining({ name: 'New Name' }));
    expect(payload.name).toBe('New Name');
  });

  it('throws when updating an account that does not exist', async () => {
    vi.mocked(getAccountById).mockResolvedValue(null as never);

    await expect(upsertAccountTool({ ...baseInput, id: 999, name: 'Ghost' }, financesContext)).rejects.toThrow(
      'Account id 999 not found',
    );
    expect(updateAccount).not.toHaveBeenCalled();
  });

  it('creates an income opening balance transaction for a positive balance', async () => {
    vi.mocked(createAccount).mockResolvedValue({
      id: 7,
      name: 'Checking',
      type: 'bank',
      currency: 'EUR',
      balance: 0,
      archived: false,
    } as never);
    vi.mocked(addTransaction).mockResolvedValue({
      id: 101,
      fromAccountBalanceAfter: 1000,
      toAccountBalanceAfter: null,
    } as never);
    vi.mocked(getAccountById).mockResolvedValue({
      id: 7,
      name: 'Checking',
      type: 'bank',
      currency: 'EUR',
      balance: 1000,
      archived: false,
    } as never);

    const result = await upsertAccountTool(
      { ...baseInput, name: 'Checking', type: 'bank', openingBalance: 1000, openingDate: '2026-01-01' },
      financesContext,
    );
    const payload = parseToolPayload(result) as {
      balance: number;
      openingTransaction: { type: string; amount: number; date: string };
    };

    expect(addTransaction).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({ type: 'income', amount: 1000, date: '2026-01-01', isCorrection: true }),
    );
    expect(payload.balance).toBe(1000);
    expect(payload.openingTransaction.type).toBe('income');
    expect(payload.openingTransaction.amount).toBe(1000);
    expect(payload.openingTransaction.date).toBe('2026-01-01');
  });

  it('creates an expense opening balance transaction for a negative balance', async () => {
    vi.mocked(createAccount).mockResolvedValue({
      id: 8,
      name: 'Credit Card',
      type: 'credit_card',
      currency: 'EUR',
      balance: 0,
      archived: false,
    } as never);
    vi.mocked(addTransaction).mockResolvedValue({
      id: 102,
      fromAccountBalanceAfter: -500,
      toAccountBalanceAfter: null,
    } as never);
    vi.mocked(getAccountById).mockResolvedValue({
      id: 8,
      name: 'Credit Card',
      type: 'credit_card',
      currency: 'EUR',
      balance: -500,
      archived: false,
    } as never);

    const result = await upsertAccountTool(
      {
        ...baseInput,
        name: 'Credit Card',
        type: 'credit_card',
        details: { type: 'credit_card', creditLimit: 5000, statementDay: 15 },
        openingBalance: -500,
        openingDate: '2026-01-01',
      },
      financesContext,
    );
    const payload = parseToolPayload(result) as { openingTransaction: { type: string; amount: number } };

    expect(addTransaction).toHaveBeenCalledWith('user-1', 1, expect.objectContaining({ type: 'expense', amount: 500 }));
    expect(payload.openingTransaction.type).toBe('expense');
    expect(payload.openingTransaction.amount).toBe(-500);
  });
});
