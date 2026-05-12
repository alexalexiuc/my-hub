import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getAccounts, getNetWorthHistory } from '@my-hub/shared/services';
import { AccountTypes } from '@my-hub/shared/constants';
import { supportedCurrencySchema } from '../currency.schema';

export const netWorthItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(AccountTypes),
  balance: z.number(),
  currency: supportedCurrencySchema,
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

  for (const a of accounts) {
    const bal = a.balance;
    const item = { id: a.id, name: a.name, type: a.type, balance: bal, currency: a.currency };
    if (LIABILITY_TYPES.has(a.type)) {
      totalLiabilities += bal;
      liabilities.push(item);
    } else {
      totalAssets += bal;
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
