import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildDailySummary } from '../models/daily';
import { today } from '../../shared/dateUTils';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getTodayResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const summary = await buildDailySummary(userId, today());
  return resourceResponse(uri, summary);
};
