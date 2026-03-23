import 'dotenv-mono/load';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  findOrCreateUser,
  findUserByEmail,
  listUserOAuthClients,
  deleteUserOAuthClient,
  createUserOAuthClient,
  ensureAllMcpServers,
  putLog,
} from '@my-hub/shared/services';

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_MCP_CLIENT_NAME = process.env['E2E_MCP_CLIENT_NAME'] || 'e2e-test';
const E2E_MCP_USER_EMAIL = process.env['E2E_MCP_USER_EMAIL'] || 'e2e@test.local';
const E2E_HUB_USER_EMAIL = process.env['E2E_HUB_USER_EMAIL'] || 'e2e-hub@test.local';
const SEED_PATH_PREFIX = '/e2e/audit-log/';

console.error('Provisioning e2e test user...');
const user = await findOrCreateUser(E2E_MCP_USER_EMAIL, 'E2E Test User');

// Always delete existing e2e client to get a fresh plainClientSecret
const existing = await listUserOAuthClients(user.id);
for (const c of existing.filter((c) => c.clientName === E2E_MCP_CLIENT_NAME)) {
  await deleteUserOAuthClient(c.id, user.id);
  console.error('Deleted old e2e client:', c.clientId);
}

// Use credentials from env (CI passes them in via docker compose exec -e) or generate locally
const created = await createUserOAuthClient(
  user.id,
  E2E_MCP_CLIENT_NAME,
  process.env['E2E_MCP_CLIENT_ID'],
  process.env['E2E_MCP_CLIENT_SECRET'],
);
await ensureAllMcpServers(user.id);
console.error('Created e2e client:', created.clientId);

// Seed deterministic audit-log fixtures for Hub E2E tests using server-side DB access.
const hubUser = await findUserByEmail(E2E_HUB_USER_EMAIL);
if (!hubUser) {
  throw new Error(`Unable to find hub e2e user by email: ${E2E_HUB_USER_EMAIL}`);
}

await putLog({
  service: 'mcp-service',
  server: 'calories',
  method: 'POST',
  path: `${SEED_PATH_PREFIX}calories-entry`,
  statusCode: 201,
  durationMs: 48,
  userId: hubUser.id,
  requestBody: { body: { description: 'E2E seeded meal', kcal: 510 } },
  responseBody: { id: 1001, ok: true },
});

await putLog({
  service: 'mcp-service',
  server: 'todo',
  method: 'GET',
  path: `${SEED_PATH_PREFIX}todo-list`,
  statusCode: 200,
  durationMs: 15,
  userId: hubUser.id,
  requestBody: { query: { limit: 10 } },
  responseBody: { count: 2 },
});

await putLog({
  service: 'mcp-service',
  server: 'apiary',
  method: 'PATCH',
  path: `${SEED_PATH_PREFIX}apiary-sync`,
  statusCode: 500,
  durationMs: 121,
  userId: hubUser.id,
  error: 'Seeded e2e error payload',
});
console.error('Seeded audit-log fixtures for:', E2E_HUB_USER_EMAIL);

const lines =
  [
    `E2E_MCP_CLIENT_ID=${created.clientId}`,
    `E2E_MCP_CLIENT_SECRET=${created.plainClientSecret}`,
    `E2E_MCP_USER_ID=${user.id}`,
  ].join('\n') + '\n';

// Write .env.e2e only on local machines (IS_LOCAL=true in .env)
if (process.env['IS_LOCAL'] === 'true') {
  const envPath = resolve(__dirname, '../.env.e2e');
  writeFileSync(envPath, lines);
  console.error('Written to', envPath);
}

// Always print to stdout — captured by CI via ssh docker exec
process.stdout.write(lines);

process.exit(0);
