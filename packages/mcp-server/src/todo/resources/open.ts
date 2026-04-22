import { getOpenTodos } from '@my-hub/shared/services';
import { resourceResponse } from '../../shared/resourcesUtils';
import { ResourceHandler } from '../../shared/types';

export const getOpenTodosResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;
  const items = await getOpenTodos(userId);
  return resourceResponse(uri, { openTodos: items, count: items.length });
};
