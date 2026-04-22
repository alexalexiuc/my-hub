import { ResourceHandler } from '../../shared/types';
import { currentDateString } from '@my-hub/shared/utils';
import { buildDailySummary } from '../models/daily';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getTodayResource: ResourceHandler = async (uri, context) => {
  const { userId, timezone } = context;
  const date = currentDateString(timezone ?? null);
  const summary = await buildDailySummary(userId, date);
  return resourceResponse(uri, summary);
};
