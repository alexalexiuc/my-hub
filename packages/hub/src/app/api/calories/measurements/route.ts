import { z } from 'zod';
import { route, routeHttpError, created } from '@/lib/api/route';
import { getMeasurements, logMeasurement, getMeasurementTypeByKey } from '@my-hub/shared/services';
import type { MeasurementTypeKey } from '@my-hub/shared/types';

const GetQuerySchema = z.object({
  type: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().positive().default(100),
});

const PostBodySchema = z.object({
  typeKey: z.string(),
  value: z.number(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export const GET = route({ query: GetQuerySchema })(async ({ user, query }) => {
  if (query.type) {
    const mt = await getMeasurementTypeByKey(query.type as MeasurementTypeKey);
    if (!mt) routeHttpError(400, { error: `Unknown type: ${query.type}` });
  }

  const measurements = await getMeasurements(user.id, {
    typeKey: query.type as MeasurementTypeKey | undefined,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: query.limit,
  });
  return { measurements };
});

export const POST = route({ body: PostBodySchema })(async ({ user, body }) => {
  const measurementType = await getMeasurementTypeByKey(body.typeKey as MeasurementTypeKey);
  if (!measurementType) {
    routeHttpError(400, { error: `Unknown measurement type: ${body.typeKey}` });
  }

  const today = new Date().toISOString().split('T')[0]!;
  const measurement = await logMeasurement({
    userId: user.id,
    typeKey: measurementType.key,
    date: body.date ?? today,
    value: body.value,
    notes: body.notes ?? null,
  });

  return created({ measurement });
});
