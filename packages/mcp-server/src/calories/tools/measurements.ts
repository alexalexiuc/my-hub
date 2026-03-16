import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getMeasurementTypes,
  getMeasurementTypeByKey,
  logMeasurement,
  getMeasurements,
  deleteMeasurement,
} from '@my-hub/shared/services';
import type { MeasurementTypeKey } from '@my-hub/shared/types';
import type { MeasurementEntry } from '../types';
import type { MeasurementWithType } from '@my-hub/shared/services';

const yyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

const LogMeasurementSchema = z.object({
  type: z
    .string()
    .describe(
      'Measurement type key, e.g. "weight", "height", "waist". Use calories_get_measurement_types to list available types.',
    ),
  value: z.number().positive().describe("Measurement value in the type's unit (e.g. kg for weight, cm for height)"),
  date: yyyyMmDdSchema.optional().describe('Date of measurement (YYYY-MM-DD). Defaults to today.'),
  notes: z.string().optional().describe('Optional notes about this measurement'),
});

const GetMeasurementsSchema = z.object({
  type: z.string().optional().describe('Filter by measurement type key (e.g. "weight")'),
  date_from: yyyyMmDdSchema.optional().describe('Start date filter (YYYY-MM-DD)'),
  date_to: yyyyMmDdSchema.optional().describe('End date filter (YYYY-MM-DD)'),
  limit: z.number().int().positive().max(500).default(100).optional().describe('Max entries to return (default: 100)'),
});

const DeleteMeasurementSchema = z.object({
  id: z.number().int().positive().describe('The measurement entry ID to delete'),
});

type LogMeasurementInput = z.infer<typeof LogMeasurementSchema>;
type GetMeasurementsInput = z.infer<typeof GetMeasurementsSchema>;
type DeleteMeasurementInput = z.infer<typeof DeleteMeasurementSchema>;

function rowToEntry(row: MeasurementWithType): MeasurementEntry {
  return {
    id: row.id,
    type: row.typeKey,
    label: row.typeLabel,
    value: row.value,
    unit: row.typeUnit,
    date: row.date,
    notes: row.notes ?? null,
  };
}

export function registerMeasurementTools(server: McpServer) {
  server.registerTool(
    'calories_log_measurement',
    {
      description:
        'Log a body measurement (weight, height, waist, etc.). Each entry is timestamped so you can track progress over time. Use calories_get_measurement_types to see available types.',
      inputSchema: LogMeasurementSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: false },
    },
    async (input: LogMeasurementInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');

      const measurementType = await getMeasurementTypeByKey(input.type as MeasurementTypeKey);
      if (!measurementType) {
        const types = await getMeasurementTypes();
        throw new Error(
          `Unknown measurement type "${input.type}". Available types: ${types.map((t) => t.key).join(', ')}`,
        );
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
    },
  );

  server.registerTool(
    'calories_get_measurements',
    {
      description:
        'Retrieve logged body measurements. Filter by type, date range, or get all. Useful for tracking progress.',
      inputSchema: GetMeasurementsSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (input: GetMeasurementsInput, extra) => {
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
        entries: rows.map(rowToEntry),
        count: rows.length,
      });
    },
  );

  server.registerTool(
    'calories_get_measurement_types',
    {
      description: 'List all available measurement types with their units (weight in kg, height in cm, etc.)',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const types = await getMeasurementTypes();
      return toolResponse(types.map((t) => ({ key: t.key, label: t.label, unit: t.unit })));
    },
  );

  server.registerTool(
    'calories_delete_measurement',
    {
      description: 'Delete a measurement entry by its ID.',
      inputSchema: DeleteMeasurementSchema.shape,
      annotations: { idempotentHint: false, destructiveHint: true },
    },
    async (input: DeleteMeasurementInput, extra) => {
      const userId = extra.authInfo?.extra?.['userId'] as string | undefined;
      if (!userId) throw new Error('Authentication required');
      const deleted = await deleteMeasurement(input.id, userId);
      if (!deleted) {
        throw new Error(`Measurement with id ${input.id} not found.`);
      }
      return toolResponse({ deleted: true, id: input.id });
    },
  );
}

function toolResponse(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}
