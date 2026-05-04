import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { getMeasurements, logMeasurement } from '@my-hub/shared/services';
import type { MeasurementTypeKey } from '@my-hub/shared/types';
import type { MeasurementEntrySource } from '@my-hub/shared/types';
import { MeasurementEntrySources, measurementTypeKeys } from '@my-hub/shared/constants';

const GetQuerySchema = z.object({
  type: z.enum(measurementTypeKeys).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().positive().default(100),
  entrySource: z.enum(MeasurementEntrySources).optional(),
});

const PostBodySchema = z.object({
  typeKey: z.enum(measurementTypeKeys),
  value: z.number(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = route({ query: GetQuerySchema })(async ({ user, query }) => {
  const measurements = await getMeasurements(user.id, {
    typeKey: query.type as MeasurementTypeKey | undefined,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: query.limit,
    entrySource: query.entrySource as MeasurementEntrySource | undefined,
  });
  return { measurements };
});

export const POST = route({ body: PostBodySchema })(async ({ user, body }) => {
  const today = new Date().toISOString().split('T')[0]!;
  const measurement = await logMeasurement({
    userId: user.id,
    typeKey: body.typeKey,
    date: body.date ?? today,
    value: body.value,
    notes: body.notes ?? null,
    entrySource: 'hub',
  });

  return created({ measurement });
});
