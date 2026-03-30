import type {
  FlightData,
  Trip,
  TripBooking,
  TripChecklistItem,
  TripCompanion,
  TripDocument,
  TripPlace,
} from '@my-hub/shared/types';

export type TripBookingExtended = TripBooking & { flightData: FlightData | null };

export interface TripOverviewResponse {
  trip: Trip;
  bookings: TripBookingExtended[];
  places: TripPlace[];
  checklist: TripChecklistItem[];
  companions: TripCompanion[];
  documents: TripDocument[];
}

export interface ApiTrip extends Trip {
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
