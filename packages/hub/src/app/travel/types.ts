import type {
  FlightData,
  TripBooking,
  TripChecklistItem,
  TripCompanion,
  TripDay,
  TripDocument,
  TripPlace,
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
  owner_user_id: string;
  owner_name: string | null;
  owner_email: string;
  access_role: 'owner' | 'viewer';
  can_edit: boolean;
  permission: 'view';
}

export interface TripShareView {
  id: number;
  user_id: string;
  permission: 'view';
  name: string | null;
  email: string;
}

export interface TripShareSuggestion {
  user_id: string;
  name: string | null;
  email: string;
}

export interface BookingRange {
  tripId: number;
  fromAt: string | null;
  toAt: string | null;
}

export interface UploadConfig {
  max_mb: number;
  allowed_mime: string[];
}
