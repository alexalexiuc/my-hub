import { findUserByEmail, createUserWithPassword } from '@my-hub/shared/services';
import { TEST_USER } from '../config';
import { seedAuditLogFixtures } from '../seeds/audit-log.seed';
import { seedSharedTripFixture } from '../seeds/travel.seed';

async function runHubE2eSeeds(): Promise<void> {
  const existing = await findUserByEmail(TEST_USER.email);
  if (!existing) {
    await createUserWithPassword(TEST_USER.email, TEST_USER.password, TEST_USER.name);
    console.error('E2E Hub user created:', TEST_USER.email);
  }
  await seedAuditLogFixtures(TEST_USER.email);
  await seedSharedTripFixture(TEST_USER.email);
  console.error('E2E Hub seeds applied for:', TEST_USER.email);
}

void (async () => {
  await runHubE2eSeeds();
  process.exit(0);
})();
