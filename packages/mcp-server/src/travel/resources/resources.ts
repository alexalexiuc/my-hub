import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getTrips, getUpcomingTripBookings } from '@my-hub/shared/services';
import { resourceResponse } from '../../shared/resourcesUtils';
import { travelFilesConfig } from '../files-config';

export const getTravelTripsResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const trips = await getTrips(userId);

  return resourceResponse(uri, {
    trips,
    count: trips.length,
  });
};

export const getTravelUpcomingResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;
  const trips = await getTrips(userId);

  const nextTrip =
    trips
      .filter((trip) => (trip.startAt ? trip.startAt.getTime() >= Date.now() : true))
      .sort((a, b) => {
        const aTime = a.startAt ? a.startAt.getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.startAt ? b.startAt.getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })[0] ?? null;

  const upcomingFlights = await getUpcomingTripBookings(userId, 48);

  return resourceResponse(uri, {
    next_trip: nextTrip,
    upcoming_departures_48h: upcomingFlights,
  });
};

export const getTravelUploadPolicyResource: ReadResourceCallback = async (uri) => {
  return resourceResponse(uri, {
    max_mb: travelFilesConfig.maxMb,
    allowed_mime: travelFilesConfig.allowedMime,
  });
};
