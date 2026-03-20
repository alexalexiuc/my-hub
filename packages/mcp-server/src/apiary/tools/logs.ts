import { z } from 'zod';
import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createApiaryLog, getApiaryLogs, deleteApiaryLog, updateApiaryHive } from '@my-hub/shared/services';
import { toolResponse } from '../../shared/toolsUtils';
import { omitNullish } from '@my-hub/shared/utils';

// ---------------------------------------------------------------------------
// Typed logging tools — each enforces a specific JSONB shape
// ---------------------------------------------------------------------------

export const LogInspectionSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive inspected'),
  temperament: z.string().optional().describe('Bee temperament (e.g. "calm", "aggressive", "nervous")'),
  brood_pattern: z.string().optional().describe('Brood pattern quality (e.g. "solid", "spotty", "empty")'),
  queen_seen: z.boolean().optional().describe('Whether the queen was spotted during inspection'),
  population: z.string().optional().describe('Colony population estimate (e.g. "strong", "moderate", "weak")'),
  disease_signs: z.string().optional().describe('Any disease signs observed (e.g. "possible chalkbrood", null if none)'),
  notes: z.string().optional().describe('Additional inspection notes'),
  logged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date of inspection (YYYY-MM-DD). Defaults to today.'),
});

export const LogTreatmentSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive treated'),
  product: z.string().describe('Treatment product name (e.g. "Apivar", "Formic Pro", "Oxalic acid")'),
  method: z.string().optional().describe('Application method (e.g. "strip", "pad", "dribble", "vaporization")'),
  duration_days: z.number().int().positive().optional().describe('Treatment duration in days (used to compute active treatment end date)'),
  notes: z.string().optional().describe('Additional treatment notes'),
  logged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date of treatment (YYYY-MM-DD). Defaults to today.'),
});

export const LogFeedingSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive fed'),
  feed_type: z.string().describe('Type of feed (e.g. "sugar_syrup", "fondant", "pollen_patty")'),
  ratio: z.string().optional().describe('Feed ratio if applicable (e.g. "1:1", "2:1")'),
  amount_liters: z.number().positive().optional().describe('Amount of feed in liters'),
  notes: z.string().optional().describe('Additional feeding notes'),
  logged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date of feeding (YYYY-MM-DD). Defaults to today.'),
});

export const LogHarvestSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive harvested'),
  frames: z.number().int().positive().optional().describe('Number of frames harvested'),
  weight_kg: z.number().positive().optional().describe('Total weight of harvest in kilograms'),
  honey_type: z.string().optional().describe('Type of honey (e.g. "wildflower", "acacia", "clover")'),
  notes: z.string().optional().describe('Additional harvest notes'),
  logged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date of harvest (YYYY-MM-DD). Defaults to today.'),
});

export const LogQueenEventSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive'),
  event: z.enum(['requeened', 'lost', 'seen', 'emerged', 'superseded']).describe('Type of queen event'),
  queen_source: z.string().optional().describe('Source of the new queen (e.g. "local breeder", "split", "swarm cell")'),
  marked: z.boolean().optional().describe('Whether the queen is marked'),
  color: z.string().optional().describe('Mark color (e.g. "blue", "white", "yellow", "red", "green")'),
  notes: z.string().optional().describe('Additional queen event notes'),
  logged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date of queen event (YYYY-MM-DD). Defaults to today.'),
});

export const LogRelocationSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive being relocated'),
  from_yard_id: z.number().int().positive().optional().describe('ID of the yard the hive is moving from'),
  to_yard_id: z.number().int().positive().describe('ID of the yard the hive is moving to'),
  reason: z.string().optional().describe('Reason for the move (e.g. "summer flow", "winter shelter")'),
  notes: z.string().optional().describe('Additional relocation notes'),
  logged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date of relocation (YYYY-MM-DD). Defaults to today.'),
});

export const AddNoteSchema = z.object({
  hive_id: z.number().int().positive().optional().describe('ID of the hive (optional — can be a general note)'),
  notes: z.string().describe('Note text'),
  logged_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date (YYYY-MM-DD). Defaults to today.'),
});

export const GetHiveLogsSchema = z.object({
  hive_id: z.number().int().positive().describe('ID of the hive to get logs for'),
  type: z.string().optional().describe('Filter by event type (inspection, treatment, feeding, harvest, relocation, queen_event, note)'),
  limit: z.number().int().positive().max(200).default(50).optional().describe('Max entries to return (default: 50, max: 200)'),
  offset: z.number().int().min(0).default(0).optional().describe('Pagination offset'),
});

export const DeleteLogSchema = z.object({
  log_id: z.number().int().positive().describe('ID of the log entry to delete'),
});

// ---------------------------------------------------------------------------
// Tool callbacks
// ---------------------------------------------------------------------------

function parseLogDate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

export const logInspectionTool: ToolCallback<typeof LogInspectionSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const log = await createApiaryLog(userId, {
    type: 'inspection',
    loggedAt: parseLogDate(input.logged_at),
    hiveId: input.hive_id,
    notes: input.notes ?? null,
    data: omitNullish({
      temperament: input.temperament,
      brood_pattern: input.brood_pattern,
      queen_seen: input.queen_seen,
      population: input.population,
      disease_signs: input.disease_signs,
    }),
  });
  return toolResponse(log);
};

export const logTreatmentTool: ToolCallback<typeof LogTreatmentSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const log = await createApiaryLog(userId, {
    type: 'treatment',
    loggedAt: parseLogDate(input.logged_at),
    hiveId: input.hive_id,
    notes: input.notes ?? null,
    data: { product: input.product, ...omitNullish({ method: input.method, duration_days: input.duration_days }) },
  });
  return toolResponse(log);
};

export const logFeedingTool: ToolCallback<typeof LogFeedingSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const log = await createApiaryLog(userId, {
    type: 'feeding',
    loggedAt: parseLogDate(input.logged_at),
    hiveId: input.hive_id,
    notes: input.notes ?? null,
    data: { feed_type: input.feed_type, ...omitNullish({ ratio: input.ratio, amount_liters: input.amount_liters }) },
  });
  return toolResponse(log);
};

export const logHarvestTool: ToolCallback<typeof LogHarvestSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const log = await createApiaryLog(userId, {
    type: 'harvest',
    loggedAt: parseLogDate(input.logged_at),
    hiveId: input.hive_id,
    notes: input.notes ?? null,
    data: omitNullish({ frames: input.frames, weight_kg: input.weight_kg, honey_type: input.honey_type }),
  });
  return toolResponse(log);
};

export const logQueenEventTool: ToolCallback<typeof LogQueenEventSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const log = await createApiaryLog(userId, {
    type: 'queen_event',
    loggedAt: parseLogDate(input.logged_at),
    hiveId: input.hive_id,
    notes: input.notes ?? null,
    data: { event: input.event, ...omitNullish({ queen_source: input.queen_source, marked: input.marked, color: input.color }) },
  });
  return toolResponse(log);
};

export const logRelocationTool: ToolCallback<typeof LogRelocationSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const loggedAt = parseLogDate(input.logged_at);
  const log = await createApiaryLog(userId, {
    type: 'relocation',
    loggedAt,
    hiveId: input.hive_id,
    notes: input.notes ?? null,
    data: { to_yard_id: input.to_yard_id, ...omitNullish({ from_yard_id: input.from_yard_id, reason: input.reason }) },
  });

  // Atomically update the hive's yard_id
  await updateApiaryHive(userId, input.hive_id, { yardId: input.to_yard_id });

  return toolResponse(log);
};

export const addNoteTool: ToolCallback<typeof AddNoteSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const log = await createApiaryLog(userId, {
    type: 'note',
    loggedAt: parseLogDate(input.logged_at),
    notes: input.notes,
    ...omitNullish({ hiveId: input.hive_id }),
  });
  return toolResponse(log);
};

export const getHiveLogsTool: ToolCallback<typeof GetHiveLogsSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const logs = await getApiaryLogs(userId, {
    hiveId: input.hive_id,
    ...omitNullish({ type: input.type, limit: input.limit, offset: input.offset }),
  });
  return toolResponse({ logs, count: logs.length });
};

export const deleteLogTool: ToolCallback<typeof DeleteLogSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const deleted = await deleteApiaryLog(userId, input.log_id);
  if (!deleted) throw new Error(`Log entry with id ${input.log_id} not found`);
  return toolResponse({ deleted: true, log_id: input.log_id });
};
