// Bridge E2E_DATABASE_URL → DATABASE_URL so the shared db client picks it up.
// This must happen before any function calls that touch the db.
if (process.env.E2E_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
}

import { seedSandboxFixtures } from '../seeds/sandbox.seed';
import { SANDBOX_USER } from '../constants';

// note: Use console.error for logging in this script so that logs stay visible when stdout is captured.
void (async () => {
  const months = Number(process.env.SANDBOX_MONTHS ?? 21);
  const { budgetId } = await seedSandboxFixtures(months);
  console.error(`Sandbox seeded: ${SANDBOX_USER.email} / budget #${budgetId} / ${months} months of history`);
  process.exit(0);
})();
