import {
  findUserByEmail,
  findOrCreateUser,
  getTrips,
  deleteTrip,
  createTrip,
  addTripBooking,
  createTripShare,
} from '@my-hub/shared/services';
import { SHARED_TRIP_FIXTURE, SHARED_OWNER_EMAIL } from '../constants';

export interface SharedTripFixture {
  tripName: string;
  ownerName: string;
  bookingTitle: string;
}

export async function seedSharedTripFixture(viewerEmail: string): Promise<SharedTripFixture> {
  const ownerName = SHARED_TRIP_FIXTURE.ownerName;
  const tripName = SHARED_TRIP_FIXTURE.tripName;
  const bookingTitle = SHARED_TRIP_FIXTURE.bookingTitle;

  const viewer = await findUserByEmail(viewerEmail);
  if (!viewer) {
    throw new Error(`Unable to find viewer user by email: ${viewerEmail}`);
  }

  const owner = await findOrCreateUser(SHARED_OWNER_EMAIL, ownerName);

  // Idempotent: delete any previously seeded trips with the same name
  const existingTrips = await getTrips(owner.id);
  for (const trip of existingTrips.filter((t) => t.name === tripName)) {
    await deleteTrip(owner.id, trip.id);
  }

  const sharedTrip = await createTrip(owner.id, {
    name: tripName,
    destination: 'Barcelona',
    notes: 'Seeded shared trip for e2e',
  });

  await addTripBooking(owner.id, sharedTrip.id, {
    bookingType: 'accommodation',
    title: bookingTitle,
    provider: 'Seeded Hotel',
    startAt: new Date('2026-06-10T14:00:00.000Z'),
    endAt: new Date('2026-06-12T10:00:00.000Z'),
    notes: 'Seeded booking for read-only checks',
  });

  await createTripShare(owner.id, sharedTrip.id, viewer.id);

  return { tripName, ownerName, bookingTitle };
}
