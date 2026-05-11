import { ResourceHandler } from '../../shared/types';
import { resourceResponse } from '../../shared/resourcesUtils';
import { getUserActiveBudget, getAccounts, getCategories, getGroups } from '@my-hub/shared/services';
export const getFinancesContextResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) {
    return resourceResponse(uri, { error: 'No active budget. Set an active budget in the Hub first.' });
  }

  const [accounts, categories, groups] = await Promise.all([
    getAccounts(userId, budget.id, { includeArchived: false }),
    getCategories(userId, budget.id),
    getGroups(userId, budget.id),
  ]);

  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  const accountsOut = accounts.map(acct => {
    const details = acct.details as { cardLastFour?: string; cardName?: string; targetAmount?: number } | null;
    return {
      id: acct.id,
      name: acct.name,
      type: acct.type,
      currency: acct.currency,
      balance: acct.balance,
      isArchived: acct.archived,
      ...(details?.cardLastFour ? { cardLastFour: details.cardLastFour } : {}),
      ...(details?.cardName ? { cardName: details.cardName } : {}),
      ...(details?.targetAmount != null ? { targetAmount: String(details.targetAmount) } : {}),
    };
  });

  const categoriesOut = categories.map(cat => {
    const groupName = cat.groupId ? groupMap.get(cat.groupId) : null;
    return {
      id: cat.id,
      name: cat.name,
      parentId: cat.groupId,
      monthlyTarget: cat.monthlyTarget,
      displayName: groupName ? `${groupName} > ${cat.name}` : cat.name,
    };
  });

  return resourceResponse(uri, {
    budget: {
      id: budget.id,
      name: budget.name,
      defaultCurrency: budget.defaultCurrency,
    },
    accounts: accountsOut,
    categories: categoriesOut,
  });
};
