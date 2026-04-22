import { ResourceHandler } from '../../shared/types';
import { getApiarySummary } from '@my-hub/shared/services';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getSummaryResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;
  const summary = await getApiarySummary(userId);
  return resourceResponse(uri, summary);
};
