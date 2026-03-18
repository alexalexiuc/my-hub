export const TEST_USER = {
  email: process.env['E2E_HUB_USER_EMAIL'] ?? 'e2e-hub@test.local',
  password: process.env['E2E_HUB_USER_PASSWORD'] ?? 'E2eTestPass123!',
  name: 'E2E Test',
};
