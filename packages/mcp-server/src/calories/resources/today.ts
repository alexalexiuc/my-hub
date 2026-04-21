import { ResourceHandler } from '../../shared/types';
import { findUserById } from '@my-hub/shared/services';
import { currentDateString } from '@my-hub/shared/utils';
import { buildDailySummary } from '../models/daily';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getTodayResource: ResourceHandler = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Authentication required');
  }
  const userRecord = await findUserById(userId);
  const date = currentDateString(userRecord?.timezone ?? null);
  const summary = await buildDailySummary(userId, date);
  return resourceResponse(uri, summary);
};
