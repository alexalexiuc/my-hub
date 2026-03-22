import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
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
export const POST = withAuth(async ({ user }) => {
  const [meals, measurements, mcpClients, calorieProfile] = await Promise.all([
    deleteAllUserMeals(user.id),
    deleteAllUserMeasurements(user.id),
    deleteAllUserOAuthClients(user.id),
    deleteCalorieProfile(user.id),
  ]);

  return NextResponse.json({
    results: { meals, measurements, mcp_clients: mcpClients, calorie_profile: calorieProfile },
  });
});
