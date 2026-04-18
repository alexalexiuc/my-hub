import type {
  FlightData,
  TripBooking,
  TripChecklistItem,
  TripCompanion,
  TripDay,
  TripDocument,
  TripPlace,
  TripSharePermission,
  TripWithStatus,
} from '@my-hub/shared/types';
import type { TripMapData } from '@my-hub/shared/services';

export type TripBookingExtended = TripBooking & {
  flightData: FlightData | null;
  startTimezone: string | null;
  endTimezone: string | null;
};

export interface TripOverviewResponse {
  trip: TripWithStatus;
  bookings: TripBookingExtended[];
  places: TripPlace[];
  checklist: TripChecklistItem[];
  companions: TripCompanion[];
  documents: TripDocument[];
  dayNotes: TripDay[];
  mapData: TripMapData;
}

export type { TripDay };

export interface ApiTrip extends TripWithStatus {
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string;
  accessRole: 'owner' | 'viewer';
  canEdit: boolean;
  permission: TripSharePermission;
}

export interface TripShareView {
  id: number;
  userId: string;
  permission: TripSharePermission;
  name: string | null;
  email: string;
}

export interface TripShareSuggestion {
  userId: string;
  name: string | null;
  email: string;
}

export interface BookingRange {
  tripId: number;
  fromAt: string | null;
  toAt: string | null;
}

export interface UploadConfig {
  maxMb: number;
  allowedMime: string[];
}
