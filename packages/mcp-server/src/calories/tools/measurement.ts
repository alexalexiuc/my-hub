import { ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  deleteMeasurement,
  getMeasurements,
  getMeasurementTypeByKey,
  getMeasurementTypes,
  logMeasurement,
} from '@my-hub/shared/services';
import { MeasurementTypeKey } from '@my-hub/shared/types';
import z from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { rowToMeasurementEntry } from '../models/measurements';

export const LogMeasurementSchema = z.object({
  type: z
    .string()
    .describe(
      'Measurement type key, e.g. "weight", "height", "waist". Use calories_get_measurement_types to list available types.',
    ),
  value: z.number().positive().describe("Measurement value in the type's unit (e.g. kg for weight, cm for height)"),
  date: yyyyMmDdSchema.optional().describe('Date of measurement (YYYY-MM-DD). Defaults to today.'),
  notes: z.string().optional().describe('Optional notes about this measurement'),
});

export const GetMeasurementsSchema = z.object({
  type: z.string().optional().describe('Filter by measurement type key (e.g. "weight")'),
  date_from: yyyyMmDdSchema.optional().describe('Start date filter (YYYY-MM-DD)'),
  date_to: yyyyMmDdSchema.optional().describe('End date filter (YYYY-MM-DD)'),
  limit: z.number().int().positive().max(500).default(100).optional().describe('Max entries to return (default: 100)'),
});

export const DeleteMeasurementSchema = z.object({
  id: z.number().int().positive().describe('The measurement entry ID to delete'),
});

export const logMeasurementTool: ToolCallback<typeof LogMeasurementSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  const measurementType = await getMeasurementTypeByKey(input.type as MeasurementTypeKey);
  if (!measurementType) {
    const types = await getMeasurementTypes();
    throw new Error(`Unknown measurement type "${input.type}". Available types: ${types.map((t) => t.key).join(', ')}`);
  }

  const today = new Date().toISOString().split('T')[0]!;
  const row = await logMeasurement({
    userId,
    typeKey: measurementType.key,
    date: input.date ?? today,
    value: input.value,
    notes: input.notes ?? null,
  });

  return toolResponse({
    id: row.id,
    type: measurementType.key,
    label: measurementType.label,
    value: row.value,
    unit: measurementType.unit,
    date: row.date,
  });
};

export const getMeasurementsTool: ToolCallback<typeof GetMeasurementsSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');

  let typeKey: MeasurementTypeKey | undefined;
  if (input.type) {
    const mt = await getMeasurementTypeByKey(input.type as MeasurementTypeKey);
    if (!mt) throw new Error(`Unknown measurement type "${input.type}"`);
    typeKey = mt.key;
  }

  const rows = await getMeasurements(userId, {
    typeKey,
    dateFrom: input.date_from,
    dateTo: input.date_to,
    limit: input.limit ?? 100,
  });

  return toolResponse({
    entries: rows.map(rowToMeasurementEntry),
    count: rows.length,
  });
};

export const deleteMeasurementTool: ToolCallback<typeof DeleteMeasurementSchema.shape> = async (input, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
  if (!userId) throw new Error('Authentication required');
  const deleted = await deleteMeasurement(input.id, userId);
  if (!deleted) {
    throw new Error(`Measurement with id ${input.id} not found.`);
  }
  return toolResponse({ deleted: true, id: input.id });
};
