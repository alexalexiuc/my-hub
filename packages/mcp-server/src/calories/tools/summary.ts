import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import z from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { buildDailySummary } from '../models/daily';

export const GetDailySummarySchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Date to summarize (YYYY-MM-DD). Defaults to today.'),
});

export const getDailySummaryTool: ToolCallback<typeof GetDailySummarySchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');
  const date = input.date ?? new Date().toISOString().split('T')[0]!;
  const summary = await buildDailySummary(userId, date);
  return toolResponse(summary);
};
