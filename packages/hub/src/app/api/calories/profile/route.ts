import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getCalorieProfile, upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [profile, measurements] = await Promise.all([
    getCalorieProfile(user.id),
    getLatestMeasurementsPerType(user.id),
  ]);

  return NextResponse.json({ profile: profile ?? null, measurements });
}

export async function PUT(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed = ['name', 'age', 'sex', 'activityLevel', 'goalCaloriesOverride', 'notes'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const profile = await upsertCalorieProfile(user.id, updates);
  return NextResponse.json({ profile });
}
