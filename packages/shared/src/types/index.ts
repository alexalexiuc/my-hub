import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { MeasurementTypeKey } from '../constants/measurements';
import type {
  users,
  oauthClients,
  oauthRefreshTokens,
  mcpServers,
  calorieProfiles,
  mealLogs,
  measurementTypes,
  bodyMeasurements,
  apiRequestLogs,
  todos,
  inviteTokens,
  apiaryYards,
  apiaryHives,
  apiaryLogs,
  apiaryTasks,
  trips,
  tripBookings,
  tripPlaces,
  tripChecklistItems,
  tripCompanions,
  tripDocuments,
  tripShares,
  tripDays,
  flightData,
} from '../db/schema/';
import type {
  TripStatus,
  TripBookingType,
  TripPlacePriority,
  TripDocumentType,
  TripSharePermission,
} from '../constants/travel';
export { deriveTripStatus } from '../utils';

// Identity & Auth
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type OAuthClient = InferSelectModel<typeof oauthClients>;
export type NewOAuthClient = InferInsertModel<typeof oauthClients>;
export type OAuthRefreshToken = InferSelectModel<typeof oauthRefreshTokens>;
export type NewOAuthRefreshToken = InferInsertModel<typeof oauthRefreshTokens>;
export type McpServer = InferSelectModel<typeof mcpServers>;
export type NewMcpServer = InferInsertModel<typeof mcpServers>;

// Calories
export type CalorieProfile = InferSelectModel<typeof calorieProfiles>;
export type NewCalorieProfile = InferInsertModel<typeof calorieProfiles>;
export type MealLog = InferSelectModel<typeof mealLogs>;
export type NewMealLog = InferInsertModel<typeof mealLogs>;

// Body Measurements
export type MeasurementType = InferSelectModel<typeof measurementTypes>;
export type NewMeasurementType = InferInsertModel<typeof measurementTypes>;
export type BodyMeasurement = InferSelectModel<typeof bodyMeasurements>;
export type NewBodyMeasurement = InferInsertModel<typeof bodyMeasurements>;
export type { MeasurementTypeKey };

// API Request Logs
export type ApiRequestLog = InferSelectModel<typeof apiRequestLogs>;
export type NewApiRequestLog = InferInsertModel<typeof apiRequestLogs>;

// Todos
export type Todo = InferSelectModel<typeof todos>;
export type NewTodo = InferInsertModel<typeof todos>;

// Invites
export type InviteToken = InferSelectModel<typeof inviteTokens>;
export type InviteTokenWithUsedByEmail = InviteToken & { usedByEmail: string | null };

// Apiary
export type ApiaryYard = InferSelectModel<typeof apiaryYards>;
export type NewApiaryYard = InferInsertModel<typeof apiaryYards>;
export type ApiaryHive = InferSelectModel<typeof apiaryHives>;
export type NewApiaryHive = InferInsertModel<typeof apiaryHives>;
export type ApiaryLog = InferSelectModel<typeof apiaryLogs>;
export type NewApiaryLog = InferInsertModel<typeof apiaryLogs>;
export type ApiaryTask = InferSelectModel<typeof apiaryTasks>;
export type NewApiaryTask = InferInsertModel<typeof apiaryTasks>;

// Travel — booking details discriminated union
export type {
  BookingDetails,
  FlightDetails,
  TransportLocation,
  TransportDetails,
  BaseBookingDetails,
} from './booking-details';

// Finances — transaction details discriminated union
export type {
  TransactionDetails,
  ManualTransactionDetails,
  ReceiptTransactionDetails,
  ReceiptLineItem,
  BaseTransactionDetails,
} from './transaction-details';

// Travel
export type FlightData = InferSelectModel<typeof flightData>;
export type NewFlightData = InferInsertModel<typeof flightData>;
export type Trip = InferSelectModel<typeof trips>;
export type NewTrip = InferInsertModel<typeof trips>;
export type TripWithStatus = Trip & { status: TripStatus };
export type TripBooking = InferSelectModel<typeof tripBookings>;
export type NewTripBooking = InferInsertModel<typeof tripBookings>;
export type TripPlace = InferSelectModel<typeof tripPlaces>;
export type NewTripPlace = InferInsertModel<typeof tripPlaces>;
export type TripChecklistItem = InferSelectModel<typeof tripChecklistItems>;
export type NewTripChecklistItem = InferInsertModel<typeof tripChecklistItems>;
export type TripCompanion = InferSelectModel<typeof tripCompanions>;
export type NewTripCompanion = InferInsertModel<typeof tripCompanions>;
export type TripDocument = InferSelectModel<typeof tripDocuments>;
export type NewTripDocument = InferInsertModel<typeof tripDocuments>;
export type TripShare = InferSelectModel<typeof tripShares>;
export type NewTripShare = InferInsertModel<typeof tripShares>;
export type TripDay = InferSelectModel<typeof tripDays>;
export type NewTripDay = InferInsertModel<typeof tripDays>;
export type { TripStatus, TripBookingType, TripPlacePriority, TripDocumentType, TripSharePermission };
