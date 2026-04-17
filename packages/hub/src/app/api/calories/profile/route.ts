import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getCalorieProfile, upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { ProfileUpdateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ user }) => {
  const [profile, measurements] = await Promise.all([
    getCalorieProfile(user.id),
    getLatestMeasurementsPerType(user.id),
  ]);

  return NextResponse.json({ profile: profile ?? null, measurements });
});

export const PUT = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data } = parsed;
  const updates: Record<string, unknown> = { ...data };

  for (const key of ['goalMinCalories', 'goalMaxCalories'] as const) {
    if (typeof updates[key] === 'number') updates[key] = Math.round(updates[key] as number);
  }

  const profile = await upsertCalorieProfile(user.id, updates);
  return NextResponse.json({ profile });
});
