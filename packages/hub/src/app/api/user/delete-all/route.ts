import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import {
  deleteAllUserMeals,
  deleteAllUserMeasurements,
  deleteCalorieProfile,
  deleteAllUserOAuthClients,
} from '@my-hub/shared/services';

/**
 * DELETE all data for the authenticated user across every feature.
 * Useful for e2e test cleanup and for the "nuke everything" UI action.
 */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [meals, measurements, mcpClients, calorieProfile] = await Promise.all([
    deleteAllUserMeals(user.id),
    deleteAllUserMeasurements(user.id),
    deleteAllUserOAuthClients(user.id),
    deleteCalorieProfile(user.id),
  ]);

  return NextResponse.json({
    results: { meals, measurements, mcp_clients: mcpClients, calorie_profile: calorieProfile },
  });
}
