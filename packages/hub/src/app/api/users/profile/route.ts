import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { findUserById, updateUserProfile } from '@my-hub/shared/services';
import { COUNTRIES, TIMEZONES } from '@my-hub/shared/constants';

const VALID_COUNTRIES = new Set(COUNTRIES.map((c) => c.value));
const VALID_TIMEZONES = new Set(TIMEZONES.map((t) => t.value));

export const GET = withAuth(async ({ user }) => {
  const record = await findUserById(user.id);
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { passwordHash: _ph, googleId: _gi, ...publicFields } = record;
  return NextResponse.json({ user: publicFields });
});

export const PUT = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, country, timezone } = body as {
    name?: string;
    country?: string;
    timezone?: string;
  };

  if (country != null && country !== '' && !VALID_COUNTRIES.has(country)) {
    return NextResponse.json({ error: 'Invalid country code' }, { status: 400 });
  }

  if (timezone != null && timezone !== '' && !VALID_TIMEZONES.has(timezone)) {
    return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
  }

  const data: { name?: string | null; country?: string | null; timezone?: string | null } = {};
  if ('name' in body) data.name = (name as string | undefined) ?? null;
  if ('country' in body) data.country = (country as string | undefined) ?? null;
  if ('timezone' in body) data.timezone = (timezone as string | undefined) ?? null;

  const updated = await updateUserProfile(user.id, data);
  const { passwordHash: _ph, googleId: _gi, ...publicFields } = updated;
  return NextResponse.json({ user: publicFields });
});
