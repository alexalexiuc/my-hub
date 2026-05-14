import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import { AccountTypes } from '@my-hub/shared/constants';
import {
  getUserActiveBudget,
  getAccounts,
  getCategories,
  getGroups,
  getPayees,
  getLoanBalanceSnapshotForAccount,
} from '@my-hub/shared/services';

// ─── list_context ─────────────────────────────────────────────────────────────

export const ListContextSchema = z.object({
  includeArchived: z
    .boolean()
    .optional()
    .describe('Whether to include archived accounts in the response. Defaults to false.'),
});

export const listContextTool: ToolHandler<typeof ListContextSchema.shape> = async ({ includeArchived }, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const [accounts, categories, groups] = await Promise.all([
    getAccounts(userId, budget.id, { includeArchived }),
    getCategories(userId, budget.id),
    getGroups(userId, budget.id),
  ]);

  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  const accountCurrencyById = new Map(accounts.map(account => [account.id, account.currency]));

  const accountsOut = await Promise.all(
    accounts.map(async account => {
      const loanSnapshot =
        account.type === AccountTypes.Loan
          ? await getLoanBalanceSnapshotForAccount(userId, budget.id, account, { accountCurrencyById })
          : null;

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balance: loanSnapshot?.balance ?? account.balance,
        archived: account.archived,
        ...(loanSnapshot ? { amortizationSummary: loanSnapshot.amortizationSummary } : {}),
      };
    }),
  );

  return toolResponse({
    accounts: accountsOut,
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      group: c.groupId != null ? (groupMap.get(c.groupId) ?? null) : null,
      monthlyTarget: c.monthlyTarget ?? null,
    })),
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
    })),
  });
};
