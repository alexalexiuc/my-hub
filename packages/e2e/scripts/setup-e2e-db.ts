import { TEST_USER } from '../config';
// import { seedAuditLogFixtures } from '../seeds/audit-log.seed';
import { seedSharedTripFixture } from '../seeds/travel.seed';

async function runHubE2eSeeds(): Promise<void> {
  // await seedAuditLogFixtures(TEST_USER.email);
  await seedSharedTripFixture(TEST_USER.email);
  console.error('E2E Hub seeds applied for:', TEST_USER.email);
}

void (async () => {
  await runHubE2eSeeds();
  process.exit(0);
})();
