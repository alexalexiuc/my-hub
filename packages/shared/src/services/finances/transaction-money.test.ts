import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTransactionMoney, transferToAmount, withConversion, TransactionMoneyError } from './transaction-money';
import { TransactionTypes } from '../../constants/finances';

vi.mock('./exchangeRates.js', () => {
  class ExchangeRateUnavailableError extends Error {
    constructor(from: string, to: string, date: string) {
      super(`No ${from}→${to} exchange rate available for ${date}.`);
    }
  }
  return { getExchangeRateQuote: vi.fn(), ExchangeRateUnavailableError };
});

import { ExchangeRateUnavailableError, getExchangeRateQuote } from './exchangeRates.js';

const DATE = '2026-10-03';

/** Mocks market rates as a lookup table keyed "FROM:TO". */
function mockRates(rates: Record<string, number>) {
  vi.mocked(getExchangeRateQuote).mockImplementation(async (from: string, to: string, date: string) => {
    const rate = rates[`${from}:${to}`];
    if (rate == null) throw new ExchangeRateUnavailableError(from, to, date);
    return { rate, rateDate: date };
  });
}

describe('resolveTransactionMoney', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRates({});
  });

  it('MDL → EUR transfer: each leg in its own currency, effective rate derived, reporting = MDL leg', async () => {
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Transfer,
      date: DATE,
      inputAmount: 6033.03,
      toAmount: 300,
      accountCurrency: 'MDL',
      toAccountCurrency: 'EUR',
      budgetCurrency: 'MDL',
    });

    expect(money.amount).toBe(6033.03);
    expect(money.toAmount).toBe(300);
    expect(money.reportingAmount).toBe(6033.03);
    expect(money.conversion).toBeNull();
    // MDL per EUR, as the user reads it
    expect(Math.round((money.amount / money.toAmount!) * 10000) / 10000).toBe(20.1101);
    expect(money.toExchangeRate).toBeCloseTo(300 / 6033.03, 8);
    expect(getExchangeRateQuote).not.toHaveBeenCalled();
  });

  it('expense of 50 EUR on the EUR account: stored 50 EUR, reporting at the transaction-date rate', async () => {
    mockRates({ 'EUR:MDL': 20.1 });
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Expense,
      date: DATE,
      inputAmount: 50,
      accountCurrency: 'EUR',
      budgetCurrency: 'MDL',
    });

    expect(money.amount).toBe(50);
    expect(money.reportingAmount).toBe(1005);
    expect(money.exchangeRate).toBe(20.1);
    expect(getExchangeRateQuote).toHaveBeenCalledWith('EUR', 'MDL', DATE);
  });

  it('expense entered as 100 RON on the EUR account: stored in EUR, original kept as metadata', async () => {
    mockRates({ 'RON:EUR': 0.2011, 'EUR:MDL': 20 });
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Expense,
      date: DATE,
      inputAmount: 100,
      inputCurrency: 'RON',
      accountCurrency: 'EUR',
      budgetCurrency: 'MDL',
    });

    expect(money.amount).toBe(20.11);
    expect(money.reportingAmount).toBe(402.2);
    expect(money.conversion).toEqual({
      originalAmount: 100,
      originalCurrency: 'RON',
      accountCurrency: 'EUR',
      originalToAccountRate: 0.2011,
      convertedAmount: 20.11,
      rateSource: 'market',
      rateDate: DATE,
    });
  });

  it('USD charge on an MDL account at a user-entered rate (current behaviour + manual rate)', async () => {
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Expense,
      date: DATE,
      inputAmount: 24,
      inputCurrency: 'usd',
      rate: 17.4669,
      accountCurrency: 'MDL',
      budgetCurrency: 'MDL',
    });

    expect(money.amount).toBe(419.2056);
    expect(money.reportingAmount).toBe(419.2056);
    expect(money.conversion).toMatchObject({
      originalCurrency: 'USD',
      originalToAccountRate: 17.4669,
      rateSource: 'user',
    });
    expect(money.conversion).not.toHaveProperty('rateDate');
    expect(getExchangeRateQuote).not.toHaveBeenCalled();
  });

  it('USD charge on an MDL account without a rate uses the market rate (unchanged behaviour)', async () => {
    mockRates({ 'USD:MDL': 17.5 });
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Expense,
      date: DATE,
      inputAmount: 24,
      inputCurrency: 'USD',
      accountCurrency: 'MDL',
      budgetCurrency: 'MDL',
    });
    expect(money.amount).toBe(420);
    expect(money.reportingAmount).toBe(420);
    expect(money.exchangeRate).toBe(1);
  });

  it('MDL paid from the EUR account: reporting value is the exact MDL entered', async () => {
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Expense,
      date: DATE,
      inputAmount: 100,
      inputCurrency: 'MDL',
      rate: 0.0497,
      accountCurrency: 'EUR',
      budgetCurrency: 'MDL',
    });
    expect(money.amount).toBe(4.97);
    expect(money.reportingAmount).toBe(100);
    expect(getExchangeRateQuote).not.toHaveBeenCalled();
  });

  it('transfer entered in the destination currency uses that as the received amount', async () => {
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Transfer,
      date: DATE,
      inputAmount: 300,
      inputCurrency: 'EUR',
      rate: 20.1101,
      accountCurrency: 'MDL',
      toAccountCurrency: 'EUR',
      budgetCurrency: 'MDL',
    });
    expect(money.amount).toBe(6033.03);
    expect(money.toAmount).toBe(300);
    expect(money.reportingAmount).toBe(6033.03);
  });

  it('EUR → MDL transfer reports the MDL leg exactly', async () => {
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Transfer,
      date: DATE,
      inputAmount: 50,
      toAmount: 1003.5,
      accountCurrency: 'EUR',
      toAccountCurrency: 'MDL',
      budgetCurrency: 'MDL',
    });
    expect(money.reportingAmount).toBe(1003.5);
    expect(money.exchangeRate).toBe(20.07);
    expect(getExchangeRateQuote).not.toHaveBeenCalled();
  });

  it('EUR → USD transfer (neither leg in MDL) reports the sent leg at the EUR→MDL rate', async () => {
    mockRates({ 'EUR:MDL': 20 });
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Transfer,
      date: DATE,
      inputAmount: 100,
      toAmount: 108,
      accountCurrency: 'EUR',
      toAccountCurrency: 'USD',
      budgetCurrency: 'MDL',
    });
    expect(money.reportingAmount).toBe(2000);
    expect(money.toExchangeRate).toBe(1.08);
  });

  it('same-currency transfer: toAmount defaults to amount and must match when given', async () => {
    const base = {
      type: TransactionTypes.Transfer,
      date: DATE,
      inputAmount: 500,
      accountCurrency: 'MDL',
      toAccountCurrency: 'MDL',
      budgetCurrency: 'MDL',
    } as const;
    await expect(resolveTransactionMoney(base)).resolves.toMatchObject({ toAmount: 500, toExchangeRate: 1 });
    await expect(resolveTransactionMoney({ ...base, toAmount: 500 })).resolves.toMatchObject({ toAmount: 500 });
    await expect(resolveTransactionMoney({ ...base, toAmount: 499 })).rejects.toThrow(TransactionMoneyError);
  });

  it('rejects a cross-currency transfer without the received amount — never guesses', async () => {
    mockRates({ 'MDL:EUR': 0.05 });
    await expect(
      resolveTransactionMoney({
        type: TransactionTypes.Transfer,
        date: DATE,
        inputAmount: 6033.03,
        accountCurrency: 'MDL',
        toAccountCurrency: 'EUR',
        budgetCurrency: 'MDL',
      }),
    ).rejects.toThrow('provide the amount received in EUR');
  });

  it('rejects invalid combinations', async () => {
    const expense = {
      type: TransactionTypes.Expense,
      date: DATE,
      accountCurrency: 'EUR',
      budgetCurrency: 'MDL',
    } as const;
    await expect(resolveTransactionMoney({ ...expense, inputAmount: 10, rate: 20 })).rejects.toThrow(
      'only applies when the amount is in a different currency',
    );
    await expect(
      resolveTransactionMoney({ ...expense, inputAmount: 10, inputCurrency: 'RON', rate: 0 }),
    ).rejects.toThrow('positive');
    await expect(resolveTransactionMoney({ ...expense, inputAmount: -1 })).rejects.toThrow('non-negative');
    await expect(resolveTransactionMoney({ ...expense, inputAmount: 10, toAmount: 5 })).rejects.toThrow(
      'only be set on transfers',
    );
  });

  it('propagates a missing market rate instead of falling back to 1.0', async () => {
    mockRates({});
    await expect(
      resolveTransactionMoney({
        type: TransactionTypes.Expense,
        date: DATE,
        inputAmount: 50,
        accountCurrency: 'EUR',
        budgetCurrency: 'MDL',
      }),
    ).rejects.toThrow('No EUR→MDL exchange rate');
  });

  it('never blocks a correction on a missing rate: any known rate, else a 0 reporting value', async () => {
    mockRates({});
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Income,
      date: '2099-01-01',
      inputAmount: 250,
      accountCurrency: 'EUR',
      budgetCurrency: 'MDL',
      isCorrection: true,
    });
    expect(money.amount).toBe(250);
    expect(money.reportingAmount).toBe(0);
    expect(getExchangeRateQuote).toHaveBeenCalledWith('EUR', 'MDL', '2099-01-01', { maxAgeDays: Infinity });

    mockRates({ 'EUR:MDL': 20 });
    const withRate = await resolveTransactionMoney({
      type: TransactionTypes.Income,
      date: '2099-01-01',
      inputAmount: 250,
      accountCurrency: 'EUR',
      budgetCurrency: 'MDL',
      isCorrection: true,
    });
    expect(withRate.reportingAmount).toBe(5000);
  });

  it('reuses a stored conversion rate (update path) without a lookup', async () => {
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Expense,
      date: DATE,
      inputAmount: 30,
      inputCurrency: 'USD',
      accountCurrency: 'MDL',
      budgetCurrency: 'MDL',
      reuseConversion: {
        originalAmount: 24,
        originalCurrency: 'USD',
        accountCurrency: 'MDL',
        originalToAccountRate: 17.4669,
        rateSource: 'user',
      },
    });
    expect(money.amount).toBe(524.007);
    expect(money.conversion?.rateSource).toBe('user');
    expect(getExchangeRateQuote).not.toHaveBeenCalled();
  });

  it('does not reuse a stored conversion for a different currency pair', async () => {
    mockRates({ 'EUR:MDL': 20 });
    const money = await resolveTransactionMoney({
      type: TransactionTypes.Expense,
      date: DATE,
      inputAmount: 10,
      inputCurrency: 'EUR',
      accountCurrency: 'MDL',
      budgetCurrency: 'MDL',
      reuseConversion: { originalCurrency: 'USD', accountCurrency: 'MDL', originalToAccountRate: 17 },
    });
    expect(money.amount).toBe(200);
  });
});

describe('withConversion', () => {
  it('adds, replaces and removes conversion while keeping other extras', () => {
    const extras = { kind: 'receipt', time: '10:00' };
    const conv = { originalAmount: 1, originalCurrency: 'RON' };
    expect(withConversion(null, conv)).toEqual({ kind: 'base', conversion: conv });
    expect(withConversion(extras, conv)).toEqual({ ...extras, conversion: conv });
    expect(withConversion({ ...extras, conversion: conv }, null)).toEqual(extras);
    expect(withConversion(null, null)).toBeNull();
  });
});

describe('transferToAmount', () => {
  it('prefers toAmount and falls back to amount × toExchangeRate for legacy rows', () => {
    expect(transferToAmount({ amount: 100, toAmount: 5, toExchangeRate: 0.05 })).toBe(5);
    expect(transferToAmount({ amount: 100, toAmount: null, toExchangeRate: 0.0497 })).toBe(4.97);
    expect(transferToAmount({ amount: 100, toAmount: null, toExchangeRate: null })).toBe(100);
  });
});
