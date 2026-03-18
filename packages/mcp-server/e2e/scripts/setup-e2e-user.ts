import 'dotenv-mono/load';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  findOrCreateUser,
  listUserOAuthClients,
  deleteUserOAuthClient,
  createUserOAuthClient,
  ensureAllMcpServers,
} from '@my-hub/shared/services';

const __dirname = dirname(fileURLToPath(import.meta.url));
const E2E_CLIENT_NAME = 'e2e-test';
const E2E_USER_EMAIL = 'e2e@test.local';

console.error('Provisioning e2e test user...');
const user = await findOrCreateUser(E2E_USER_EMAIL, 'E2E Test User');

// Always delete existing e2e client to get a fresh plainClientSecret
const existing = await listUserOAuthClients(user.id);
for (const c of existing.filter((c) => c.clientName === E2E_CLIENT_NAME)) {
  await deleteUserOAuthClient(c.id, user.id);
  console.error('Deleted old e2e client:', c.clientId);
}

// Use credentials from env (CI passes them in via docker compose exec -e) or generate locally
const created = await createUserOAuthClient(
  user.id,
  E2E_CLIENT_NAME,
  process.env['E2E_CLIENT_ID'],
  process.env['E2E_CLIENT_SECRET'],
);
await ensureAllMcpServers(user.id);
console.error('Created e2e client:', created.clientId);

const lines =
  [
    `E2E_CLIENT_ID=${created.clientId}`,
    `E2E_CLIENT_SECRET=${created.plainClientSecret}`,
    `E2E_USER_ID=${user.id}`,
  ].join('\n') + '\n';

// Write .env.e2e when running locally via tsx (not inside the Docker container)
if (process.env['NODE_ENV'] !== 'production') {
  const envPath = resolve(__dirname, '../.env.e2e');
  writeFileSync(envPath, lines);
  console.error('Written to', envPath);
}

// Always print to stdout — captured by CI via ssh docker exec
process.stdout.write(lines);

process.exit(0);
