import { z } from 'zod';
import { route, routeHttpError } from '@/lib/api/route';
import { findUserById, updateUserProfile } from '@my-hub/shared/services';
import { COUNTRIES, TIMEZONES } from '@my-hub/shared/constants';

const UpdateUserProfileSchema = z.object({
  name: z.string().trim().max(100).nullish(),
  country: z.string().nullish(),
  timezone: z.string().nullish(),
});

const VALID_COUNTRIES = new Set(COUNTRIES.map(c => c.value));
const VALID_TIMEZONES = new Set(TIMEZONES.map(t => t.value));

export const GET = route(async ({ user }) => {
  const record = await findUserById(user.id);
  if (!record) routeHttpError(404, { error: 'Not found' });
  const { passwordHash: _ph, googleId: _gi, ...publicFields } = record;
  return { user: publicFields };
});

export const PUT = route({ body: UpdateUserProfileSchema })(async ({ user, body }) => {
  const { name, country, timezone } = body;

  if (country != null && country !== '' && !VALID_COUNTRIES.has(country)) {
    routeHttpError(400, { error: 'Invalid country code' });
  }
  if (timezone != null && timezone !== '' && !VALID_TIMEZONES.has(timezone)) {
    routeHttpError(400, { error: 'Invalid timezone' });
  }

  const patch: { name?: string | null; country?: string | null; timezone?: string | null } = {};
  if (name !== undefined) patch.name = name ?? null;
  if (country !== undefined) patch.country = country || null;
  if (timezone !== undefined) patch.timezone = timezone || null;

  const updated = await updateUserProfile(user.id, patch);
  const { passwordHash: _ph, googleId: _gi, ...publicFields } = updated;
  return { user: publicFields };
});
