import { z } from 'zod';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getApiaryActiveTreatments,
  getApiaryOverdueInspections,
  moveApiaryHives,
  getApiaryYardBriefing,
} from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const GetActiveTreatmentsSchema = z.object({
  hive_id: z.number().int().positive().optional().describe('Filter by hive ID. Omit for all hives.'),
});

export const GetOverdueInspectionsSchema = z.object({
  threshold_days: z
    .number()
    .int()
    .positive()
    .default(14)
    .optional()
    .describe('Number of days since last inspection to consider overdue (default: 14)'),
});

export const MoveHivesSchema = z.object({
  hive_ids: z.array(z.number().int().positive()).min(1).describe('IDs of the hives to move'),
  to_yard_id: z.number().int().positive().describe('ID of the destination yard'),
  reason: z.string().optional().describe('Reason for the move (e.g. "spring season start", "winter shelter")'),
  moved_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Date of the move (YYYY-MM-DD). Defaults to today.'),
});

export const GetYardBriefingSchema = z.object({
  yard_id: z.number().int().positive().describe('ID of the yard to get a briefing for'),
});

export const getActiveTreatmentsTool: ToolCallback<typeof GetActiveTreatmentsSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const treatments = await getApiaryActiveTreatments(userId, omitNullish({ hiveId: input.hive_id }));
  return toolResponse({ treatments, count: treatments.length });
};

export const getOverdueInspectionsTool: ToolCallback<typeof GetOverdueInspectionsSchema.shape> = async (
  input,
  extra,
) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const overdue = await getApiaryOverdueInspections(userId, omitNullish({ thresholdDays: input.threshold_days }));
  return toolResponse({ hives: overdue, count: overdue.length });
};

export const moveHivesTool: ToolCallback<typeof MoveHivesSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const movedAt = input.moved_at ? new Date(input.moved_at) : undefined;
  const result = await moveApiaryHives(userId, {
    hiveIds: input.hive_ids,
    toYardId: input.to_yard_id,
    ...omitNullish({ reason: input.reason, movedAt }),
  });
  return toolResponse(result);
};

export const getYardBriefingTool: ToolCallback<typeof GetYardBriefingSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const briefing = await getApiaryYardBriefing(userId, input.yard_id);
  if (!briefing) throw new Error(`Yard with id ${input.yard_id} not found`);
  return toolResponse(briefing);
};
