import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { today } from '../../shared/dateUtils';
import { toolResponse } from '../../shared/toolsUtils';
import { buildHistoryPeriod } from '../models/history';

export const GetHistorySchema = z.object({
  start_date: yyyyMmDdSchema
    .optional()
    .describe('Start of the period (YYYY-MM-DD). Defaults to today when omitted.'),
  end_date: yyyyMmDdSchema
    .optional()
    .describe('End of the period (YYYY-MM-DD). Defaults to today when omitted.'),
});

export const getHistoryTool: ToolCallback<typeof GetHistorySchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  const startDate = input.start_date ?? today();
  const endDate = input.end_date ?? today();

  const data = await buildHistoryPeriod(userId, startDate, endDate);
  return toolResponse(data);
};
