import { ResourceHandler } from '../../shared/types';
import { resourceResponse } from '../../shared/resourcesUtils';
import { getUserActiveBudget, getPayeesWithDescription } from '@my-hub/shared/services';

export const getFinancesPayeesResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) {
    return resourceResponse(uri, { error: 'No active budget.' });
  }

  const payees = await getPayeesWithDescription(userId, budget.id);

  return resourceResponse(uri, { payees });
};
