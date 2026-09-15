export const SHARED_OWNER_EMAIL = 'e2e-shared-owner@test.local';

export const SHARED_TRIP_FIXTURE = {
  tripName: 'E2E Shared View Trip',
  ownerName: 'E2E Shared Owner',
  bookingTitle: 'E2E Shared Booking',
} as const;

/**
 * Local UI sandbox (`pnpm ui:sandbox`) — a throwaway account with demo data for eyeballing the UI.
 * Separate from TEST_USER so a sandbox run never disturbs E2E fixtures.
 */
export const SANDBOX_USER = {
  email: 'sandbox@test.local',
  password: 'SandboxPass123!',
  name: 'Sandbox User',
} as const;

export const SANDBOX_BUDGET_NAME = 'Sandbox Demo';

export const SHARED_FINANCE_MEMBER_EMAIL = 'e2e-finance-member@test.local';

export const SHARED_FINANCE_FIXTURE = {
  budgetName: 'E2E Shared Finance Budget',
  ownerEmail: SHARED_FINANCE_MEMBER_EMAIL,
} as const;
