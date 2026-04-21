import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { getApiaryHives, createApiaryHive, updateApiaryHive, getApiaryHiveStatus } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

export const CreateHiveSchema = z.object({
  name: z.string().trim().min(1).describe('Name of the hive (e.g. "Hive #3", "Blue Hive")'),
  yardId: z.number().int().positive().optional().describe('ID of the yard this hive belongs to'),
  queenStatus: z.string().optional().describe('Queen status (e.g. "queenright", "queenless", "requeened")'),
  queenMarked: z.boolean().optional().describe('Whether the queen is marked'),
  queenYear: z.number().int().optional().describe('Year the queen was introduced'),
  boxes: z.number().int().positive().optional().describe('Number of boxes/supers'),
  notes: z.string().optional().describe('Optional notes about this hive'),
});

export const ListHivesSchema = z.object({
  yardId: z.number().int().positive().optional().describe('Filter by yard ID'),
  active: z.boolean().optional().describe('Filter by active status'),
});

export const UpdateHiveSchema = z.object({
  hiveId: z.number().int().positive().describe('ID of the hive to update'),
  name: z.string().trim().min(1).optional().describe('New name for the hive'),
  yardId: z.number().int().positive().optional().describe('New yard assignment'),
  queenStatus: z.string().optional().describe('Updated queen status'),
  queenMarked: z.boolean().optional().describe('Whether the queen is marked'),
  queenYear: z.number().int().optional().describe('Year the queen was introduced'),
  boxes: z.number().int().positive().optional().describe('Updated number of boxes'),
  notes: z.string().optional().describe('Updated notes'),
  isActive: z.boolean().optional().describe('Whether the hive is active'),
});

export const GetHiveStatusSchema = z.object({
  hiveId: z.number().int().positive().describe('ID of the hive to get full status for'),
});

export const createHiveTool: ToolHandler<typeof CreateHiveSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const hive = await createApiaryHive(userId, {
    name: input.name,
    ...omitNullish({
      yardId: input.yardId,
      queenStatus: input.queenStatus,
      queenMarked: input.queenMarked,
      queenYear: input.queenYear,
      boxes: input.boxes,
      notes: input.notes,
    }),
  });
  return toolResponse(hive);
};

export const listHivesTool: ToolHandler<typeof ListHivesSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const hives = await getApiaryHives(userId, omitNullish({ yardId: input.yardId, active: input.active }));
  return toolResponse({ hives, count: hives.length });
};

export const updateHiveTool: ToolHandler<typeof UpdateHiveSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const hive = await updateApiaryHive(
    userId,
    input.hiveId,
    omitNullish({
      name: input.name,
      yardId: input.yardId,
      queenStatus: input.queenStatus,
      queenMarked: input.queenMarked,
      queenYear: input.queenYear,
      boxes: input.boxes,
      notes: input.notes,
      isActive: input.isActive,
    }),
  );
  if (!hive) throw new Error(`Hive with id ${input.hiveId} not found`);
  return toolResponse(hive);
};

export const getHiveStatusTool: ToolHandler<typeof GetHiveStatusSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;
  const status = await getApiaryHiveStatus(userId, input.hiveId);
  if (!status) throw new Error(`Hive with id ${input.hiveId} not found`);
  return toolResponse(status);
};
