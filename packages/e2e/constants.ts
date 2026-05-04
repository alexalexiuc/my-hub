export const SHARED_OWNER_EMAIL = 'e2e-shared-owner@test.local';

export const SHARED_TRIP_FIXTURE = {
  tripName: 'E2E Shared View Trip',
  ownerName: 'E2E Shared Owner',
  bookingTitle: 'E2E Shared Booking',
} as const;

export const SHARED_FINANCE_MEMBER_EMAIL = 'e2e-finance-member@test.local';

export const SHARED_FINANCE_FIXTURE = {
  budgetName: 'E2E Shared Finance Budget',
  ownerEmail: SHARED_FINANCE_MEMBER_EMAIL,
} as const;
