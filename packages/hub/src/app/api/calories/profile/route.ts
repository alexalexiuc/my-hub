import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getCalorieProfile, upsertCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { calculateMacroKcal } from '@my-hub/shared/utils';

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
    'goalProtein',
    'goalCarbs',
    'goalFat',
    'notes',
  ] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Coerce calorie goal fields to integers (DB columns are integer type)
  for (const key of ['goalMinCalories', 'goalMaxCalories'] as const) {
    if (typeof updates[key] === 'number') updates[key] = Math.round(updates[key]);
  }

  // Validate: if calorie limits and any macros are set, macro kcal must not exceed the calorie ceiling
  const protein = typeof updates['goalProtein'] === 'number' ? updates['goalProtein'] : 0;
  const carbs = typeof updates['goalCarbs'] === 'number' ? updates['goalCarbs'] : 0;
  const fat = typeof updates['goalFat'] === 'number' ? updates['goalFat'] : 0;
  const hasMacros = 'goalProtein' in updates || 'goalCarbs' in updates || 'goalFat' in updates;
  const maxCal = typeof updates['goalMaxCalories'] === 'number' ? updates['goalMaxCalories'] : null;
  if (hasMacros && maxCal !== null) {
    const macroKcal = calculateMacroKcal(protein, carbs, fat);
    if (macroKcal > maxCal) {
      return NextResponse.json(
        { error: `Macro totals (${macroKcal} kcal) exceed the max calorie limit (${maxCal} kcal).` },
        { status: 422 },
      );
    }
  }

  const profile = await upsertCalorieProfile(user.id, updates);
  return NextResponse.json({ profile });
});
