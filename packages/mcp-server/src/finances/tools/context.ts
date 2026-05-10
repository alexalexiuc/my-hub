import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import { getUserActiveBudget, getAccounts, getCategories, getGroups, getPayees } from '@my-hub/shared/services';

// ─── list_context ─────────────────────────────────────────────────────────────

export const ListContextSchema = z.object({});

export const listContextTool: ToolHandler<typeof ListContextSchema.shape> = async (_input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const [accounts, categories, groups, payees] = await Promise.all([
    getAccounts(userId, budget.id, { includeArchived: true }),
    getCategories(userId, budget.id),
    getGroups(userId, budget.id),
    getPayees(userId, budget.id),
  ]);

  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  return toolResponse({
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: a.balance,
      archived: a.archived,
    })),
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
    payees: payees.map(p => ({
      id: p.id,
      name: p.name,
      aliases: p.aliases,
    })),
  });
};
