import { ResourceHandler } from '../../shared/types';
import { currentDateString, dateStringDaysAgo } from '@my-hub/shared/utils';
import { resourceResponse } from '../../shared/resourcesUtils';
import { buildHistoryPeriod } from '../models/history';

export const getHistory7DaysResource: ResourceHandler = async (uri, context) => {
  const { userId, timezone } = context;
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Authentication required');
  }
  const endDate = currentDateString(timezone);
  const data = await buildHistoryPeriod(userId, dateStringDaysAgo(6, timezone), endDate);
  return resourceResponse(uri, data);
};
