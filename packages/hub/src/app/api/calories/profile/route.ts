import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getCalorieProfile, upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const [profile, measurements] = await Promise.all([
    getCalorieProfile(user.id),
    getLatestMeasurementsPerType(user.id),
  ]);

  return NextResponse.json({ profile: profile ?? null, measurements });
});

export const PUT = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed = [
    'name',
    'age',
    'sex',
    'heightCm',
    'activityLevel',
    'goalType',
    'goalWeeklyRateKg',
    'goalMinCalories',
    'goalMaxCalories',
    'notes',
    'country',
    'timezone',
  ] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Coerce calorie goal fields to integers (DB columns are integer type)
  for (const key of ['goalMinCalories', 'goalMaxCalories'] as const) {
    if (typeof updates[key] === 'number') updates[key] = Math.round(updates[key]);
  }

  const profile = await upsertCalorieProfile(user.id, updates);
  return NextResponse.json({ profile });
});
