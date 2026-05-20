import { ResourceHandler } from '../../shared/types';
import { resourceResponse } from '../../shared/resourcesUtils';
import { getUserActiveBudget, getAccountById, getNetWorthHistory } from '@my-hub/shared/services';

export const getFinancesAccountResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;

  // Extract account ID from URI: finances://accounts/{id}
  const uriStr = uri.toString();
  const match = /finances:\/\/accounts\/(\d+)/.exec(uriStr);
  if (!match) {
    return resourceResponse(uri, { error: 'Invalid account URI format. Expected finances://accounts/{id}' });
  }

  const accountId = parseInt(match[1]!, 10);

  const budget = await getUserActiveBudget(userId);
  if (!budget) {
    return resourceResponse(uri, { error: 'No active budget.' });
  }

  const account = await getAccountById(userId, budget.id, accountId);
  if (!account) {
    return resourceResponse(uri, { error: `Account ${accountId} not found.` });
  }

  const history = await getNetWorthHistory(userId, budget.id, 12);

  return resourceResponse(uri, {
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
      isArchived: account.archived,
      details: account.details,
      createdAt: account.createdAt,
    },
    netWorthHistory: history,
  });
};
