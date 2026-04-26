import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  deleteAllUserMeals,
  deleteAllUserMeasurements,
  deleteAllUserCalorieProfiles,
  deleteAllUserTodos,
  deleteAllUserTripShares,
  deleteAllUserTripDocuments,
  deleteAllUserTripCompanions,
  deleteAllUserTripChecklistItems,
  deleteAllUserTripDays,
  deleteAllUserTripPlaces,
  deleteAllUserTripBookings,
  deleteAllUserTrips,
  deleteAllUserFinanceBudgets,
} from '@my-hub/shared/services';

type Feature = 'meals' | 'measurements' | 'calories_profile' | 'todos' | 'my_travels' | 'finances';

const SUPPORTED_FEATURES: Feature[] = ['meals', 'measurements', 'calories_profile', 'todos', 'my_travels', 'finances'];

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { features } = body;
  if (!Array.isArray(features) || features.length === 0) {
    return NextResponse.json({ error: 'features array is required' }, { status: 400 });
  }

  const invalid = features.filter(f => !SUPPORTED_FEATURES.includes(f as Feature));
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
        const deleted = await deleteAllUserCalorieProfiles(user.id);
        results.calories_profile = { deleted };
        break;
      }
      case 'todos': {
        const count = await deleteAllUserTodos(user.id);
        results.todos = { deleted: count };
        break;
      }
      case 'finances': {
        await deleteAllUserFinanceBudgets(user.id);
        results.finances = { deleted: true };
        break;
      }
      case 'my_travels': {
        const [shares, documents, companions, checklistItems, days, places, bookings, trips] = await Promise.all([
          deleteAllUserTripShares(user.id),
          deleteAllUserTripDocuments(user.id),
          deleteAllUserTripCompanions(user.id),
          deleteAllUserTripChecklistItems(user.id),
          deleteAllUserTripDays(user.id),
          deleteAllUserTripPlaces(user.id),
          deleteAllUserTripBookings(user.id),
          deleteAllUserTrips(user.id),
        ]);

        results.my_travels = {
          deleted: shares + documents + companions + checklistItems + days + places + bookings + trips,
          breakdown: {
            tripShares: shares,
            tripDocuments: documents,
            tripCompanions: companions,
            tripChecklistItems: checklistItems,
            tripDays: days,
            tripPlaces: places,
            tripBookings: bookings,
            trips,
          },
        };
        break;
      }
    }
  }

  return NextResponse.json({ results });
});
