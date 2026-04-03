import { dotenvConfig } from 'dotenv-mono';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(__dirname, '../../../../.env');
const envPath = resolve(__dirname, '../.env.e2e');

// Load root .env first so shared services (e.g. getLogs) can access DATABASE_URL.
// override: false — existing process.env vars (e.g. from CI/secrets) always win.
dotenvConfig({ path: rootEnvPath, override: false });

// Load e2e/.env.e2e if it exists (written by `pnpm e2e:setup`).
// override: false — existing process.env vars (e.g. from CI) always win.
dotenvConfig({ path: envPath, override: false });
