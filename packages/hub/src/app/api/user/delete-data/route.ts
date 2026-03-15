import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { deleteAllUserMeals, deleteAllUserMeasurements, deleteCalorieProfile } from '@my-hub/shared/services';

type Feature = 'meals' | 'measurements' | 'calories_profile';

const SUPPORTED_FEATURES: Feature[] = ['meals', 'measurements', 'calories_profile'];

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const features = body['features'];
  if (!Array.isArray(features) || features.length === 0) {
    return NextResponse.json({ error: 'features array is required' }, { status: 400 });
  }

  const invalid = features.filter((f) => !SUPPORTED_FEATURES.includes(f as Feature));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unsupported features: ${invalid.join(', ')}. Supported: ${SUPPORTED_FEATURES.join(', ')}` },
      { status: 400 },
    );
  }

  const results: Record<string, unknown> = {};

  for (const feature of features as Feature[]) {
    switch (feature) {
      case 'meals': {
        const count = await deleteAllUserMeals(user.id);
        results.meals = { deleted: count };
        break;
      }
      case 'measurements': {
        const count = await deleteAllUserMeasurements(user.id);
        results.measurements = { deleted: count };
        break;
      }
      case 'calories_profile': {
        const deleted = await deleteCalorieProfile(user.id);
        results.calories_profile = { deleted };
        break;
      }
    }
  }

  return NextResponse.json({ results });
}
