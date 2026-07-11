import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { getUserActiveBudget, getAccounts, getNetWorthHistory } from '@my-hub/shared/services';
import { AccountTypes, LIABILITY_ACCOUNT_TYPES } from '@my-hub/shared/constants';
import { computeNetWorthBreakdown } from '@my-hub/shared/utils';
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

export const GET = route({ response: netWorthResponseSchema })(async ({ user }) => {
  const budget = await getUserActiveBudget(user.id);
  if (!budget) routeHttpError(404, { error: 'No budget found' });

  const budgetId = budget.id;
  const [accounts, snapshots] = await Promise.all([
    getAccounts(user.id, budgetId),
    getNetWorthHistory(user.id, budgetId, 12),
  ]);

  const { totalAssets, totalLiabilities, netWorth, breakdown } = computeNetWorthBreakdown(accounts);
  const assets: NetWorthData['assets'] = [];
  const liabilities: NetWorthData['liabilities'] = [];
  for (const item of breakdown) {
    const entry = {
      id: item.accountId,
      name: item.name,
      type: item.type,
      balance: item.balance,
      currency: item.currency,
    };
    if (LIABILITY_ACCOUNT_TYPES.has(item.type)) {
      liabilities.push(entry);
    } else {
      assets.push(entry);
    }
  }

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
