import { ResourceHandler } from '../../shared/types';
import { TripBookingTypes } from '@my-hub/shared/constants';
import { getNextTrip, getTrips, getUpcomingTripBookings } from '@my-hub/shared/services';
import { resourceResponse } from '../../shared/resourcesUtils';
import { travelFilesConfig } from '../files-config';

export const getTravelTripsResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;
  const trips = await getTrips(userId);

  return resourceResponse(uri, {
    trips,
    count: trips.length,
  });
};

export const getTravelUpcomingResource: ResourceHandler = async (uri, context) => {
  const { userId } = context;
  const nextTrip = await getNextTrip(userId);

  const upcomingFlights = await getUpcomingTripBookings(userId, 48, TripBookingTypes.Flight);

  return resourceResponse(uri, {
    nextTrip,
    upcomingDepartures48h: upcomingFlights,
  });
};

export const getTravelUploadPolicyResource: ResourceHandler = async uri => {
  return resourceResponse(uri, {
    maxMb: travelFilesConfig.maxMb,
    allowedMime: travelFilesConfig.allowedMime,
  });
};
