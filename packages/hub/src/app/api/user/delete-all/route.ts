import { route } from '@/lib/api/route';
import {
  deleteAllUserMeals,
  deleteAllUserFavouriteMeals,
  deleteAllUserMeasurements,
  deleteAllUserCalorieProfiles,
  deleteAllUserCalorieDayTargets,
  deleteAllUserOAuthClients,
  deleteAllUserOAuthRefreshTokens,
  deleteAllUserMcpServers,
  deleteAllUserNotificationPreferences,
  deleteAllUserApiRequestLogs,
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
  deleteAllUserShoppingListItems,
  deleteAllUserThemePreferences,
  deleteAllUserVacationData,
} from '@my-hub/shared/services';
import { deleteAllUserNotes } from '@/lib/notes';

/**
 * DELETE all data for the authenticated user across every feature.
 * Useful for e2e test cleanup and for the "nuke everything" UI action.
 */
export const POST = route(async ({ user }) => {
  // First: notes live on the mcp-server, and if it cannot be reached the request fails before anything else is
  // deleted, so a retry starts from a clean state.
  const notes = await deleteAllUserNotes(user.id);

  // Before the menus themselves — running it concurrently with deleteAllUserWeeklyMenus
  // would race the FK cascade on the same rows.
  const shoppingListItems = await deleteAllUserShoppingListItems(user.id);

  const [
    meals,
    favouriteMeals,
    measurements,
    calorieProfiles,
    calorieDayTargets,
    oauthRefreshTokens,
    mcpClients,
    mcpServers,
    notificationPreferences,
    apiRequestLogs,
    tripShares,
    tripDocuments,
    tripCompanions,
    tripChecklistItems,
    tripDays,
    tripPlaces,
    tripBookings,
    trips,
    finances,
    availableOverrides,
    weeklyMenus,
    themePreferences,
    vacation,
  ] = await Promise.all([
    deleteAllUserMeals(user.id),
    deleteAllUserFavouriteMeals(user.id),
    deleteAllUserMeasurements(user.id),
    deleteAllUserCalorieProfiles(user.id),
    deleteAllUserCalorieDayTargets(user.id),
    deleteAllUserOAuthRefreshTokens(user.id),
    deleteAllUserOAuthClients(user.id),
    deleteAllUserMcpServers(user.id),
    deleteAllUserNotificationPreferences(user.id),
    deleteAllUserApiRequestLogs(user.id),
    deleteAllUserTripShares(user.id),
    deleteAllUserTripDocuments(user.id),
    deleteAllUserTripCompanions(user.id),
    deleteAllUserTripChecklistItems(user.id),
    deleteAllUserTripDays(user.id),
    deleteAllUserTripPlaces(user.id),
    deleteAllUserTripBookings(user.id),
    deleteAllUserTrips(user.id),
    deleteAllUserFinanceBudgets(user.id),
    deleteAllUserAvailableOverrides(user.id),
    deleteAllUserWeeklyMenus(user.id),
    deleteAllUserThemePreferences(user.id),
    deleteAllUserVacationData(user.id),
  ]);

  return {
    results: {
      meals,
      favouriteMeals,
      measurements,
      calorieProfiles,
      calorieDayTargets,
      oauthRefreshTokens,
      oauthClients: mcpClients,
      mcpServers,
      notificationPreferences,
      apiRequestLogs,
      tripShares,
      tripDocuments,
      tripCompanions,
      tripChecklistItems,
      tripDays,
      tripPlaces,
      tripBookings,
      trips,
      finances,
      availableOverrides,
      weeklyMenus,
      shoppingListItems,
      themePreferences,
      vacation,
      notes,
    },
  };
});
