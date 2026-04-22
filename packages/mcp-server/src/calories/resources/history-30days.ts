import { ResourceHandler } from '../../shared/types';
import { currentDateString, dateStringDaysAgo } from '@my-hub/shared/utils';
import { resourceResponse } from '../../shared/resourcesUtils';
import { buildHistoryPeriod } from '../models/history';

export const getHistory30DaysResource: ResourceHandler = async (uri, context) => {
  const { userId, timezone } = context;
  const endDate = currentDateString(timezone);
  const data = await buildHistoryPeriod(userId, dateStringDaysAgo(29, timezone), endDate);
  return resourceResponse(uri, data);
};
