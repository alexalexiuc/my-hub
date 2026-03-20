import { z } from 'zod';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiaryLogs, createApiaryLog, deleteApiaryLog } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

const logTypeEnum = z.enum(['inspection', 'treatment', 'feeding', 'harvest', 'relocation', 'queen_event', 'note']);

export const LogEventSchema = z.object({
  hive_id: z.number().int().positive().optional().describe('ID of the hive this event relates to'),
  type: logTypeEnum.describe('Type of event: inspection, treatment, feeding, harvest, relocation, queen_event, or note'),
  notes: z.string().optional().describe('Free-text notes about the event'),
  data: z.record(z.unknown()).optional().describe('Type-specific payload (e.g. inspection details, treatment info)'),
  logged_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Date of the event (YYYY-MM-DD). Defaults to today.'),
});

export const GetLogsSchema = z.object({
  hive_id: z.number().int().positive().optional().describe('Filter by hive ID'),
  type: z.string().optional().describe('Filter by event type'),
  limit: z.number().int().positive().max(200).default(50).optional().describe('Max entries to return (default: 50, max: 200)'),
  offset: z.number().int().min(0).default(0).optional().describe('Pagination offset'),
});

export const DeleteLogSchema = z.object({
  log_id: z.number().int().positive().describe('ID of the log entry to delete'),
});

export const logEventTool: ToolCallback<typeof LogEventSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const loggedAt = input.logged_at ? new Date(input.logged_at) : new Date();
  const log = await createApiaryLog(userId, {
    type: input.type,
    loggedAt,
    ...omitNullish({
      hiveId: input.hive_id,
      notes: input.notes,
      data: input.data,
    }),
  });
  return toolResponse(log);
};

export const getLogsTool: ToolCallback<typeof GetLogsSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const logs = await getApiaryLogs(
    userId,
    omitNullish({
      hiveId: input.hive_id,
      type: input.type,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return toolResponse({ logs, count: logs.length });
};

export const deleteLogTool: ToolCallback<typeof DeleteLogSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const deleted = await deleteApiaryLog(userId, input.log_id);
  if (!deleted) throw new Error(`Log entry with id ${input.log_id} not found`);
  return toolResponse({ deleted: true, log_id: input.log_id });
};
