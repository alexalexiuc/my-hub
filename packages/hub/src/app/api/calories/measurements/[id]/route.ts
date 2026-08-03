import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { deleteMeasurement, updateMeasurement } from '@my-hub/shared/services';
import { measurementTypeKeys } from '@my-hub/shared/constants';
import { isoDateSchema, nonEmptyPatch } from '@/lib/schemas/common';

// Coerced by the schema rather than parsed by hand in each handler — an id that isn't a number
// is a validation failure, not something for the handler to discover.
const MeasurementIdParamSchema = z.object({ id: z.coerce.number().int().positive() });

const MeasurementUpdateSchema = nonEmptyPatch(
  z.object({
    typeKey: z.enum(measurementTypeKeys).optional(),
    value: z.number().nonnegative().optional(),
    date: isoDateSchema.optional(),
    /** Nullable so a note can be removed; omitted leaves it as it is. */
    notes: z.string().nullish(),
  }),
);

export const PATCH = route({ body: MeasurementUpdateSchema, params: MeasurementIdParamSchema })(async ({
  user,
  params,
  body,
}) => {
  const updated = await updateMeasurement(params.id, user.id, body);
  if (!updated) routeHttpError(404, { error: 'Not found' });
  return { measurement: updated };
});

export const DELETE = route({ params: MeasurementIdParamSchema })(async ({ user, params }) => {
  const deleted = await deleteMeasurement(params.id, user.id);
  if (!deleted) routeHttpError(404, { error: 'Not found' });
  return { deleted: true };
});
