import { ToolHandler } from '../../shared/types';
import { z } from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { buildDailySummary } from '../models/daily';

export const GetDailySummarySchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Date to summarize (YYYY-MM-DD). Defaults to today.'),
});

export const getDailySummaryTool: ToolHandler<typeof GetDailySummarySchema.shape> = async (input, context) => {
  const { userId } = context;
  const date = input.date ?? new Date().toISOString().split('T')[0]!;
  const summary = await buildDailySummary(userId, date);
  return toolResponse(summary);
};
