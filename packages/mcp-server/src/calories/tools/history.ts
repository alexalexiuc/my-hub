import { ToolHandler } from '../../shared/types';
import { findUserById } from '@my-hub/shared/services';
import { currentDateString } from '@my-hub/shared/utils';
import { z } from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { buildHistoryPeriod } from '../models/history';

export const GetHistorySchema = z.object({
  startDate: yyyyMmDdSchema.optional().describe('Start of the period (YYYY-MM-DD). Defaults to today when omitted.'),
  endDate: yyyyMmDdSchema.optional().describe('End of the period (YYYY-MM-DD). Defaults to today when omitted.'),
});

export const getHistoryTool: ToolHandler<typeof GetHistorySchema.shape> = async (input, context) => {
  const { userId } = context;
  if (typeof userId !== 'string' || userId.length === 0) throw new Error('Authentication required');

  const userRecord = await findUserById(userId);
  const currentDate = currentDateString(userRecord?.timezone ?? null);
  const startDate = input.startDate ?? currentDate;
  const endDate = input.endDate ?? currentDate;

  const data = await buildHistoryPeriod(userId, startDate, endDate);
  return toolResponse(data);
};
