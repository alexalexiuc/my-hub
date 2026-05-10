import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import {
  getApiaryActiveTreatments,
  getApiaryOverdueInspections,
  moveApiaryHives,
  getApiaryYardBriefing,
} from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const GetActiveTreatmentsSchema = z.object({
  hiveId: z.number().int().positive().optional().describe('Filter by hive ID. Omit for all hives.'),
});

export const GetOverdueInspectionsSchema = z.object({
  thresholdDays: z
    .number()
    .int()
    .positive()
    .default(14)
    .optional()
    .describe('Number of days since last inspection to consider overdue (default: 14)'),
});

export const MoveHivesSchema = z.object({
  hiveIds: z.array(z.number().int().positive()).min(1).describe('IDs of the hives to move'),
  toYardId: z.number().int().positive().describe('ID of the destination yard'),
  reason: z.string().optional().describe('Reason for the move (e.g. "spring season start", "winter shelter")'),
  movedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Date of the move (YYYY-MM-DD). Defaults to today.'),
});

export const GetYardBriefingSchema = z.object({
  yardId: z.number().int().positive().describe('ID of the yard to get a briefing for'),
});

export const getActiveTreatmentsTool: ToolHandler<typeof GetActiveTreatmentsSchema.shape> = async (input, context) => {
  const { userId } = context;
  const treatments = await getApiaryActiveTreatments(userId, omitNullish({ hiveId: input.hiveId }));
  return toolResponse({ treatments, count: treatments.length });
};

export const getOverdueInspectionsTool: ToolHandler<typeof GetOverdueInspectionsSchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;
  const overdue = await getApiaryOverdueInspections(userId, omitNullish({ thresholdDays: input.thresholdDays }));
  return toolResponse({ hives: overdue, count: overdue.length });
};

export const moveHivesTool: ToolHandler<typeof MoveHivesSchema.shape> = async (input, context) => {
  const { userId } = context;
  const movedAt = input.movedAt ? new Date(input.movedAt) : undefined;
  const result = await moveApiaryHives(userId, {
    hiveIds: input.hiveIds,
    toYardId: input.toYardId,
    ...omitNullish({ reason: input.reason, movedAt }),
  });
  return toolResponse(result);
};

export const getYardBriefingTool: ToolHandler<typeof GetYardBriefingSchema.shape> = async (input, context) => {
  const { userId } = context;
  const briefing = await getApiaryYardBriefing(userId, input.yardId);
  if (!briefing) throw new HandledError(`Yard with id ${input.yardId} not found`);
  return toolResponse(briefing);
};
