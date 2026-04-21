import { ResourceHandler } from '../../shared/types';
import { findUserById } from '@my-hub/shared/services';
import { currentDateString, dateStringDaysAgo } from '@my-hub/shared/utils';
import { resourceResponse } from '../../shared/resourcesUtils';
import { buildHistoryPeriod } from '../models/history';

export const getHistory7DaysResource: ResourceHandler = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Authentication required');
  }
  const userRecord = await findUserById(userId);
  const timezone = userRecord?.timezone ?? null;
  const endDate = currentDateString(timezone);
  const data = await buildHistoryPeriod(userId, dateStringDaysAgo(6, timezone), endDate);
  return resourceResponse(uri, data);
};
