import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { findUserById, updateUserProfile } from '@my-hub/shared/services';
import { COUNTRIES, TIMEZONES } from '@my-hub/shared/constants';
import { UpdateUserProfileSchema } from '@my-hub/shared/schemas';
import { withErrorLogging, formatZodError } from '@/lib/api/with-error-logging';

const VALID_COUNTRIES = new Set(COUNTRIES.map(c => c.value));
const VALID_TIMEZONES = new Set(TIMEZONES.map(t => t.value));

export const GET = withAuth(async ({ user }) => {
  const record = await findUserById(user.id);
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { passwordHash: _ph, googleId: _gi, ...publicFields } = record;
  return NextResponse.json({ user: publicFields });
});

const putHandler = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = UpdateUserProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { name, country, timezone } = parsed.data;

  if (country != null && country !== '' && !VALID_COUNTRIES.has(country)) {
    return NextResponse.json({ error: 'Invalid country code' }, { status: 400 });
  }
  if (timezone != null && timezone !== '' && !VALID_TIMEZONES.has(timezone)) {
    return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
  }

  const patch: { name?: string | null; country?: string | null; timezone?: string | null } = {};
  if (name !== undefined) patch.name = name ?? null;
  if (country !== undefined) patch.country = country || null;
  if (timezone !== undefined) patch.timezone = timezone || null;

  const updated = await updateUserProfile(user.id, patch);
  const { passwordHash: _ph, googleId: _gi, ...publicFields } = updated;
  return NextResponse.json({ user: publicFields });
});

export const PUT = withErrorLogging(putHandler);
