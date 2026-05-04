import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { created, route, routeHttpError } from '@/lib/api/route';
import { getCalorieProfile } from '@my-hub/shared/services';
import { logMeasurementsBatch } from '@my-hub/shared/services';
import { measurementTypeKeys } from '@my-hub/shared/constants';

const itemSchema = z.object({
  typeKey: z.enum(measurementTypeKeys),
  value: z.number(),
  date: z
    .string()
    .optional()
    .default(() => new Date().toISOString().split('T')[0]!),
  notes: z.string().optional(),
});

const paramsSchema = z.object({
  userId: z.string(),
});

const bodySchema = z.union([
  itemSchema,
  z.array(itemSchema).length(1, { message: 'At least one measurement is required' }),
]);

export const POST = route({ public: true, params: paramsSchema, body: bodySchema })(async ({ req, params, body }) => {
  const { userId } = params;

  // Extract Bearer token
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    routeHttpError(401, { error: 'Missing Authorization header' });
  }

  // Look up the calorie profile to retrieve the stored automation key
  const profile = await getCalorieProfile(userId);
  if (!profile || !profile.automationApiKey) {
    routeHttpError(401, { error: 'Unauthorized' });
  }

  // Constant-time comparison to prevent timing attacks
  const storedBuf = Buffer.from(profile.automationApiKey, 'utf8');
  const providedBuf = Buffer.from(token, 'utf8');
  const keysMatch = storedBuf.length === providedBuf.length && timingSafeEqual(storedBuf, providedBuf);
  if (!keysMatch) {
    routeHttpError(401, { error: 'Unauthorized' });
  }

  const items = Array.isArray(body) ? body : [body];

  const measurements = await logMeasurementsBatch(userId, items, 'automation');

  return created({ measurements });
});
