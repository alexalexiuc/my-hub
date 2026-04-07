/**
 * Travel domain constants and string-union types.
 */
export const TripStatuses = {
  Planned: 'planned',
  Active: 'active',
  Completed: 'completed',
  Cancelled: 'cancelled',
} as const;

export type TripStatus = (typeof TripStatuses)[keyof typeof TripStatuses];
export const tripStatusValues: TripStatus[] = Object.values(TripStatuses);

export const TripBookingTypes = {
  Flight: 'flight',
  Accommodation: 'accommodation',
  RentalCar: 'rental_car',
  Train: 'train',
  Bus: 'bus',
  Ferry: 'ferry',
  Taxi: 'taxi',
  Restaurant: 'restaurant',
  Tour: 'tour',
  Activity: 'activity',
  Other: 'other',
} as const;

export type TripBookingType = (typeof TripBookingTypes)[keyof typeof TripBookingTypes];
export const tripBookingTypeValues: TripBookingType[] = Object.values(TripBookingTypes);

export const TripPlacePriorities = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;

export type TripPlacePriority = (typeof TripPlacePriorities)[keyof typeof TripPlacePriorities];
export const tripPlacePriorityValues: TripPlacePriority[] = Object.values(TripPlacePriorities);

export const TripDocumentTypes = {
  Passport: 'passport',
  Visa: 'visa',
  BoardingPass: 'boarding_pass',
  Voucher: 'voucher',
  Ticket: 'ticket',
  Other: 'other',
} as const;

export type TripDocumentType = (typeof TripDocumentTypes)[keyof typeof TripDocumentTypes];
export const tripDocumentTypeValues: TripDocumentType[] = Object.values(TripDocumentTypes);

export const TripSharePermissions = {
  View: 'view',
} as const;

export type TripSharePermission = (typeof TripSharePermissions)[keyof typeof TripSharePermissions];
export const tripSharePermissionValues: TripSharePermission[] = Object.values(TripSharePermissions);
