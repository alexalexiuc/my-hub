import { ResourceHandler } from '../../shared/types';
import { getApiarySummary } from '@my-hub/shared/services';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getSummaryResource: ResourceHandler = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const summary = await getApiarySummary(userId);
  return resourceResponse(uri, summary);
};
