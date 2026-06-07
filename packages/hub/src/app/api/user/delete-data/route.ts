import { z } from 'zod';
import { route } from '@/lib/api/route';
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
  deleteAllUserAvailableOverrides,
  deleteAllUserWeeklyMenus,
} from '@my-hub/shared/services';

const SUPPORTED_FEATURES = [
  'meals',
  'measurements',
  'calories_profile',
  'todos',
  'my_travels',
  'finances',
  'weekly_menus',
] as const;

type Feature = (typeof SUPPORTED_FEATURES)[number];

const PostBodySchema = z.object({
  features: z.array(z.enum(SUPPORTED_FEATURES)).min(1),
});

export const POST = route({ body: PostBodySchema })(async ({ user, body }) => {
  const { features } = body;
  const results: Record<string, unknown> = {};

  for (const feature of features as Feature[]) {
    switch (feature) {
      case 'meals': {
        const deleted = await deleteAllUserMeals(user.id);
        results.meals = { deleted };
        break;
      }
      case 'measurements': {
        const deleted = await deleteAllUserMeasurements(user.id);
        results.measurements = { deleted };
        break;
      }
      case 'calories_profile': {
        const deleted = await deleteAllUserCalorieProfiles(user.id);
        results.calories_profile = { deleted };
        break;
      }
      case 'todos': {
        const deleted = await deleteAllUserTodos(user.id);
        results.todos = { deleted };
        break;
      }
      case 'finances': {
        const [budgets, overrides] = await Promise.all([
          deleteAllUserFinanceBudgets(user.id),
          deleteAllUserAvailableOverrides(user.id),
        ]);
        results.finances = { deleted: budgets + overrides };
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
      case 'weekly_menus': {
        const deleted = await deleteAllUserWeeklyMenus(user.id);
        results.weekly_menus = { deleted };
        break;
      }
    }
  }

  return { results };
});
