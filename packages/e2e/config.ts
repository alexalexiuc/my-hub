export const TEST_USER = {
  email: process.env['E2E_USER_EMAIL'] ?? 'e2e@test.local',
  password: process.env['E2E_USER_PASSWORD'] ?? 'E2eTestPass123!',
  name: 'E2E Test',
};
