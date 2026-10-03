import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import {
  getUserActiveBudget,
  getAccounts,
  getNetWorthHistory,
  convertBalanceToDefaultCurrency,
} from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../currency.schema';

export const netWorthItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(AccountTypes),
  /** In the account's own currency. */
  balance: z.number(),
  currency: supportedCurrencySchema,
  /** balance in the budget currency at the current rate (equals balance for budget-currency accounts); null when no rate is known. */
  balanceInDefaultCurrency: z.number().nullable(),
  /** Only for accounts not in the budget currency; null when no rate is known. */
  rate: z.number().nullable().optional(),
  rateDate: z.string().nullable().optional(),
});

export const netWorthHistoryPointSchema = z.object({
  month: z.string(),
  label: z.string(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
});

export const netWorthResponseSchema = z.object({
  currency: supportedCurrencySchema,
  netWorth: z.number(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  assets: z.array(netWorthItemSchema),
  liabilities: z.array(netWorthItemSchema),
  history: z.array(netWorthHistoryPointSchema),
  deltaVsLastMonth: z.number().nullable(),
});

export type NetWorthData = z.infer<typeof netWorthResponseSchema>;

const LIABILITY_TYPES = new Set<string>([AccountTypes.Loan, AccountTypes.CreditCard]);

export const GET = route({ response: netWorthResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const [accounts, snapshots] = await Promise.all([
    getAccounts(user.id, budgetId),
    getNetWorthHistory(user.id, budgetId, 12),
  ]);
  let totalAssets = 0;
  let totalLiabilities = 0;
  const assets: NetWorthData['assets'] = [];
  const liabilities: NetWorthData['liabilities'] = [];

  for (const account of accounts) {
    // Loans store a negative balance (-remaining principal). Take absolute value so
    // totalLiabilities and the breakdown item show the conventional positive debt amount.
    const balance = account.type === AccountTypes.Loan ? Math.abs(account.balance) : account.balance;
    // Totals are in the budget currency: a current-rate view that never touches cashflow/spending.
    const conversion = await convertBalanceToDefaultCurrency(
      balance,
      account.currency,
      budget.defaultCurrency,
      undefined,
      {
        accountId: account.id,
      },
    );
    const valueInDefault = conversion.balanceInDefaultCurrency ?? 0; // no rate known → left out of totals
    const isForeign = account.currency !== budget.defaultCurrency;
    const item = {
      id: account.id,
      name: account.name,
      type: account.type,
      balance,
      currency: account.currency,
      balanceInDefaultCurrency: conversion.balanceInDefaultCurrency,
      ...(isForeign ? { rate: conversion.rate, rateDate: conversion.rateDate } : {}),
    };
    if (LIABILITY_TYPES.has(account.type)) {
      totalLiabilities += valueInDefault;
      liabilities.push(item);
    } else {
      totalAssets += valueInDefault;
      assets.push(item);
    }
  }

  const netWorth = totalAssets - totalLiabilities;

  const history = snapshots.map(s => ({
    month: s.month,
    label: new Date(s.month + '-01').toLocaleDateString('en-IE', { month: 'short' }),
    totalAssets: s.totalAssets,
    totalLiabilities: s.totalLiabilities,
    netWorth: s.netWorth,
  }));

  const prev = history[history.length - 2];
  const last = history[history.length - 1];
  const deltaVsLastMonth = prev && last ? last.netWorth - prev.netWorth : null;

  const data: NetWorthData = {
    currency: budget.defaultCurrency,
    netWorth,
    totalAssets,
    totalLiabilities,
    assets,
    liabilities,
    history,
    deltaVsLastMonth,
  };

  return data;
});
