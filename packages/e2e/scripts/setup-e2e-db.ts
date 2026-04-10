// Bridge E2E_DATABASE_URL → DATABASE_URL so the shared db client picks it up.
// This must happen before any function calls that touch the db.
if (process.env['E2E_DATABASE_URL'] && !process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] = process.env['E2E_DATABASE_URL'];
}

import { findUserByEmail, createUserWithPassword } from '@my-hub/shared/services';
import { TEST_USER } from '../config';
import { seedAuditLogFixtures } from '../seeds/audit-log.seed';
import { seedSharedTripFixture } from '../seeds/travel.seed';

// note: Use console.error for logging in this script so that logs are visible even if stdout is being captured by the test runner.
async function runHubE2eSeeds(): Promise<void> {
  const existing = await findUserByEmail(TEST_USER.email);
  if (!existing) {
    await createUserWithPassword(TEST_USER.email, TEST_USER.password, TEST_USER.name);
    console.error('E2E Hub user created:', TEST_USER.email);
  } else {
    console.error('E2E Hub user already exists, skipping creation:', TEST_USER.email);
  }
  await seedAuditLogFixtures(TEST_USER.email);
  await seedSharedTripFixture(TEST_USER.email);
  console.error('E2E Hub seeds applied for:', TEST_USER.email);
}

void (async () => {
  await runHubE2eSeeds();
  process.exit(0);
})();
