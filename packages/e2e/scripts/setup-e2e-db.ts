import { pathToFileURL } from 'url';
import { seedAuditLogFixtures } from '../seeds/audit-log.seed';
import { seedSharedTripFixture } from '../seeds/travel.seed';

const DEFAULT_EMAIL = 'e2e-hub@test.local';

export async function runHubE2eSeeds(hubUserEmail: string): Promise<void> {
  await seedAuditLogFixtures(hubUserEmail);
  await seedSharedTripFixture(hubUserEmail);
  console.error('E2E Hub seeds applied for:', hubUserEmail);
}

// Run when executed directly (server-side via docker compose exec, or local CLI)
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void (async () => {
    const email = process.env['E2E_HUB_USER_EMAIL'] ?? DEFAULT_EMAIL;
    await runHubE2eSeeds(email);
    process.exit(0);
  })();
}
