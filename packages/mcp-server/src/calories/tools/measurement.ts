import { ToolHandler } from '../../shared/types';
import { deleteMeasurement, getMeasurements, logMeasurement } from '@my-hub/shared/services';
import { measurementTypeDefinitionsByKey, measurementTypeKeys } from '@my-hub/shared/constants';
import { localDateString } from '@my-hub/shared/utils';
import { z } from 'zod';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import { rowToMeasurementEntry } from '../models/measurements';

export const LogMeasurementSchema = z.object({
  type: z
    .enum(measurementTypeKeys)
    .describe(
      'Measurement type key, e.g. "weight", "height", "waist". Use calories_get_measurement_types to list available types.',
    ),
  value: z.number().positive().describe("Measurement value in the type's unit (e.g. kg for weight, cm for height)"),
  date: yyyyMmDdSchema.optional().describe('Date of measurement (YYYY-MM-DD). Defaults to today.'),
  notes: z.string().optional().describe('Optional notes about this measurement'),
});

export const GetMeasurementsSchema = z.object({
  type: z.enum(measurementTypeKeys).optional().describe('Filter by measurement type key (e.g. "weight")'),
  dateFrom: yyyyMmDdSchema.optional().describe('Start date filter (YYYY-MM-DD)'),
  dateTo: yyyyMmDdSchema.optional().describe('End date filter (YYYY-MM-DD)'),
  limit: z.number().int().positive().max(500).default(100).optional().describe('Max entries to return (default: 100)'),
});

export const DeleteMeasurementSchema = z.object({
  id: z.number().int().positive().describe('The measurement entry ID to delete'),
});

export const logMeasurementTool: ToolHandler<typeof LogMeasurementSchema.shape> = async (input, context) => {
  const { userId } = context;

  const today = localDateString(context.timezone);

  const previousRows = await getMeasurements(userId, { typeKey: input.type, limit: 1 });
  const previousRow = previousRows[0] ?? null;

  const row = await logMeasurement({
    userId,
    typeKey: input.type,
    date: input.date ?? today,
    value: input.value,
    notes: input.notes ?? null,
    entrySource: 'mcp',
  });

  return toolResponse({
    id: row.id,
    type: input.type,
    label: measurementTypeDefinitionsByKey[input.type].label,
    value: row.value,
    unit: measurementTypeDefinitionsByKey[input.type].unit,
    date: row.date,
    previousMeasurement: previousRow ? rowToMeasurementEntry(previousRow) : null,
  });
};

export const getMeasurementsTool: ToolHandler<typeof GetMeasurementsSchema.shape> = async (input, context) => {
  const { userId } = context;

  const rows = await getMeasurements(userId, {
    typeKey: input.type,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    limit: input.limit ?? 100,
  });

  return toolResponse({
    entries: rows.map(rowToMeasurementEntry),
    count: rows.length,
  });
};

export const deleteMeasurementTool: ToolHandler<typeof DeleteMeasurementSchema.shape> = async (input, context) => {
  const { userId } = context;
  const deleted = await deleteMeasurement(input.id, userId);
  if (!deleted) {
    throw new Error(`Measurement with id ${input.id} not found.`);
  }
  return toolResponse({ deleted: true, id: input.id });
};
