import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resourceResponse } from '../../shared/resourcesUtils';
import { buildHistoryPeriod } from '../models/history';
import { today, daysAgo } from '../../shared/dateUtils';

export const getHistory30DaysResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const data = await buildHistoryPeriod(userId, daysAgo(29), today());
  return resourceResponse(uri, data);
};
