import { dotenvConfig } from 'dotenv-mono';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load e2e/.env.e2e if it exists (written by `pnpm e2e:setup`).
// override: false — existing process.env vars (e.g. from CI) always win.
dotenvConfig({ path: resolve(__dirname, '../.env.e2e'), override: false });
