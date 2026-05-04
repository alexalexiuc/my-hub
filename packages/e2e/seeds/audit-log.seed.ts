import { and, eq, like } from 'drizzle-orm';
import { db } from '@my-hub/shared/db';
import { findUserByEmail } from '@my-hub/shared/services';
import { apiRequestLogs } from '@my-hub/shared/schema';

const SEED_PATH_PREFIX = '/e2e/audit-log/';

// Ignored for now
export async function seedAuditLogFixtures(userEmail: string): Promise<void> {
  const user = await findUserByEmail(userEmail);
  if (!user) {
    throw new Error(`Unable to find test user by email: ${userEmail}`);
  }

  // Idempotent seed: delete only previously seeded audit-log rows for this specific test user.
  await db
    .delete(apiRequestLogs)
    .where(and(eq(apiRequestLogs.userId, user.id), like(apiRequestLogs.path, `${SEED_PATH_PREFIX}%`)));

  // Shift 'now' 1 hour into the future so seeded rows always appear at the top of
  // the audit-log table (ordered desc by createdAt) regardless of how many real hub
  // entries accumulate during the test session.
  const now = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(apiRequestLogs).values([
    {
      service: 'mcp-service',
      server: 'calories',
      method: 'POST',
      path: `${SEED_PATH_PREFIX}calories-entry`,
      statusCode: 201,
      durationMs: 48,
      userId: user.id,
      createdAt: new Date(now.getTime() - 30_000),
      requestBody: { body: { description: 'E2E seeded meal', kcal: 510 } },
      responseBody: { id: 1001, ok: true },
    },
    {
      service: 'mcp-service',
      server: 'todo',
      method: 'GET',
      path: `${SEED_PATH_PREFIX}todo-list`,
      statusCode: 200,
      durationMs: 15,
      userId: user.id,
      createdAt: new Date(now.getTime() - 20_000),
      requestBody: { query: { limit: 10 } },
      responseBody: { count: 2 },
    },
    {
      service: 'mcp-service',
      server: 'apiary',
      method: 'PATCH',
      path: `${SEED_PATH_PREFIX}apiary-sync`,
      statusCode: 500,
      durationMs: 121,
      userId: user.id,
      createdAt: new Date(now.getTime() - 10_000),
      error: 'Seeded e2e error payload',
    },
  ]);
}
