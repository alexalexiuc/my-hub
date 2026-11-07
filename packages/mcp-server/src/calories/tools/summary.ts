import { ToolHandler } from '../../shared/types';
import { currentDateString } from '@my-hub/shared/utils';
import { z } from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { buildDailySummary } from '../models/daily';

export const GetDailySummarySchema = z.object({
  date: yyyyMmDdSchema.optional().describe('Date to summarize (YYYY-MM-DD). Defaults to today.'),
});

export const getDailySummaryTool: ToolHandler<typeof GetDailySummarySchema.shape> = async (input, context) => {
  const { userId, timezone } = context;
  // Today in the user's timezone, not UTC: just after midnight in Chișinău is still yesterday in UTC.
  const today = currentDateString(timezone);
  const date = input.date ?? today;
  const summary = await buildDailySummary(userId, date, today);
  return toolResponse(summary);
};
