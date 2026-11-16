import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUserActiveBudget,
  openDeposit,
  updateDepositMode,
  recordDepositInterest,
  closeDeposit,
  getAccountById,
  getDepositSummaryForAccount,
} from '@my-hub/shared/services';
import {
  AddDepositSchema,
  addDepositTool,
  closeDepositTool,
  recordDepositInterestTool,
  UpdateDepositSchema,
  updateDepositTool,
} from './deposits';
import { financesContext, parseToolPayload } from './test-utils';

vi.mock('@my-hub/shared/services', () => ({
  getUserActiveBudget: vi.fn(),
  getAccountById: vi.fn(),
  openDeposit: vi.fn(),
  updateDepositMode: vi.fn(),
  recordDepositInterest: vi.fn(),
  closeDeposit: vi.fn(),
  getDepositSummaryForAccount: vi.fn(),
}));

const micb = {
  name: 'MICB Maestro Online',
  institution: 'MICB',
  principal: 200_000,
  interestRate: 8,
  startDate: '2026-11-17',
  termMonths: 12,
  payout: 'monthly' as const,
  payoutAccountId: 1,
  sourceAccountId: 2,
};

const depositAccount = {
  id: 9,
  name: 'MICB Maestro Online',
  type: 'deposit',
  currency: 'MDL',
  archived: false,
  balance: 200_000,
  details: {
    type: 'deposit',
    ...micb,
    instrument: 'bank_deposit',
    rateType: 'fixed',
    taxRate: 6,
    status: 'active',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 1, defaultCurrency: 'MDL' } as never);
});

describe('AddDepositSchema', () => {
  it('rejects an unknown payout mode', () => {
    expect(AddDepositSchema.safeParse({ ...micb, payout: 'weekly' }).success).toBe(false);
  });
  it('rejects a non-positive principal', () => {
    expect(AddDepositSchema.safeParse({ ...micb, principal: 0 }).success).toBe(false);
  });
});

describe('addDepositTool', () => {
  it('defaults instrument, rate type, tax and currency, then returns the summary and schedule', async () => {
    vi.mocked(openDeposit).mockResolvedValue({ account: depositAccount, fundingTransactionId: 55 } as never);
    vi.mocked(getDepositSummaryForAccount).mockResolvedValue({ expectedNetInterest: 15_040 } as never);

    const result = (await parseToolPayload(await addDepositTool(AddDepositSchema.parse(micb), financesContext))) as {
      fundingTransactionId: number;
      schedule: unknown[];
      depositSummary: { expectedNetInterest: number };
    };

    expect(openDeposit).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({
        currency: 'MDL',
        sourceAccountId: 2,
        details: expect.objectContaining({ instrument: 'bank_deposit', rateType: 'fixed', taxRate: 6 }),
      }),
    );
    expect(result.fundingTransactionId).toBe(55);
    expect(result.schedule).toHaveLength(12);
    expect(result.depositSummary.expectedNetInterest).toBe(15_040);
  });

  it('defaults a capitalized deposit to monthly capitalization', async () => {
    vi.mocked(openDeposit).mockResolvedValue({ account: depositAccount, fundingTransactionId: 1 } as never);
    await addDepositTool(AddDepositSchema.parse({ ...micb, payout: 'capitalized' }), financesContext);
    expect(openDeposit).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({ details: expect.objectContaining({ capitalizationFrequency: 'monthly' }) }),
    );
  });

  it('uses zero tax by default for state bonds', async () => {
    vi.mocked(openDeposit).mockResolvedValue({ account: depositAccount, fundingTransactionId: 1 } as never);
    await addDepositTool(AddDepositSchema.parse({ ...micb, instrument: 'state_bond' }), financesContext);
    expect(openDeposit).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({ details: expect.objectContaining({ taxRate: 0 }) }),
    );
  });
});

describe('recordDepositInterestTool', () => {
  it('returns gross, tax and net of the recorded payout', async () => {
    vi.mocked(recordDepositInterest).mockResolvedValue({
      transaction: { id: 77 },
      gross: 1333.33,
      tax: 80,
      net: 1253.33,
    } as never);
    vi.mocked(getAccountById).mockResolvedValue(depositAccount as never);
    const result = (await parseToolPayload(
      await recordDepositInterestTool({ depositAccountId: 9 }, financesContext),
    )) as {
      transactionId: number;
      net: number;
    };
    expect(recordDepositInterest).toHaveBeenCalledWith('user-1', 1, 9, {});
    expect(result).toMatchObject({ transactionId: 77, net: 1253.33 });
  });
});

describe('closeDepositTool', () => {
  it('reports the returned amount and final status', async () => {
    vi.mocked(closeDeposit).mockResolvedValue({
      account: { ...depositAccount, archived: true, details: { ...depositAccount.details, status: 'matured' } },
      returnedAmount: 200_000,
      returnTransactionId: 88,
    } as never);
    const result = (await parseToolPayload(
      await closeDepositTool({ depositAccountId: 9, reason: 'matured' }, financesContext),
    )) as { status: string; archived: boolean; returnedAmount: number };
    expect(result).toMatchObject({ status: 'matured', archived: true, returnedAmount: 200_000 });
  });
});

describe('closeDepositTool forfeited interest', () => {
  it('reports the forfeited amount and its transaction', async () => {
    vi.mocked(closeDeposit).mockResolvedValue({
      account: { ...depositAccount, archived: true, details: { ...depositAccount.details, status: 'broken' } },
      returnedAmount: 185_000,
      returnTransactionId: 88,
      forfeitedAmount: 4_000,
      forfeitedTransactionId: 89,
    } as never);
    const result = (await parseToolPayload(
      await closeDepositTool({ depositAccountId: 9, reason: 'broken', returnAmount: 185_000 }, financesContext),
    )) as Record<string, unknown>;
    expect(closeDeposit).toHaveBeenCalledWith('user-1', 1, 9, { reason: 'broken', returnAmount: 185_000 });
    expect(result).toMatchObject({ status: 'broken', forfeitedAmount: 4_000, forfeitedTransactionId: 89 });
  });
});

describe('updateDepositTool', () => {
  it('passes the new mode and effective date and returns the recomputed schedule', async () => {
    vi.mocked(updateDepositMode).mockResolvedValue({
      account: depositAccount,
      effectiveDate: '2027-02-17',
      summary: { projectedMaturityBalance: 210_000 },
      schedule: [{ date: '2027-03-17' }],
    } as never);
    const input = UpdateDepositSchema.parse({
      depositAccountId: 9,
      payout: 'capitalized',
      effectiveDate: '2027-02-17',
    });
    const result = (await parseToolPayload(await updateDepositTool(input, financesContext))) as Record<string, unknown>;
    expect(updateDepositMode).toHaveBeenCalledWith('user-1', 1, 9, {
      payout: 'capitalized',
      effectiveDate: '2027-02-17',
    });
    expect(result).toMatchObject({
      effectiveDate: '2027-02-17',
      depositSummary: { projectedMaturityBalance: 210_000 },
    });
  });
});
