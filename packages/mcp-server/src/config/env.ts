import {
  TRAVEL_FILES_ALLOWED_MIME_DEFAULT,
  TRAVEL_FILES_MAX_MB_DEFAULT,
  TRAVEL_FILES_ROOT_DEFAULT,
} from '@my-hub/shared/constants';

function parseNum(val: string | undefined, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseCsv(val: string | undefined, fallback: string[]): string[] {
  if (!val) return fallback;
  const items = val
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export const envConfig = {
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  MCP_SERVER_PORT: parseNum(process.env['MCP_SERVER_PORT'] ?? process.env['PORT'], 3001),
  MCP_HOST: process.env['MCP_HOST'] ?? '127.0.0.1',
  LOG_LEVEL: process.env['LOG_LEVEL'] ?? 'info',
  SESSION_CLEANUP_INTERVAL_MS: parseNum(process.env['SESSION_CLEANUP_INTERVAL_MS'], 300_000),
  SESSION_MAX_IDLE_MS: parseNum(process.env['SESSION_MAX_IDLE_MS'], 1_800_000),
  CORS_ORIGIN: process.env['CORS_ORIGIN'] ?? '*',
  ALLOWED_REDIRECT_URIS: (process.env['ALLOWED_REDIRECT_URIS'] ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean),
  HUB_URL: process.env['NEXTAUTH_URL'] ?? process.env['HUB_URL'] ?? 'http://localhost:3000',
  LOG_PAYLOADS: process.env['LOG_PAYLOADS'] === 'true',
  PRINT_PAYLOADS: process.env['PRINT_PAYLOADS'] === 'true',
  IS_LOCAL: process.env['IS_LOCAL'] === 'true',
  TRAVEL_FILES_ROOT: process.env['TRAVEL_FILES_ROOT'] ?? TRAVEL_FILES_ROOT_DEFAULT,
  TRAVEL_FILES_MAX_MB: parseNum(process.env['TRAVEL_FILES_MAX_MB'], TRAVEL_FILES_MAX_MB_DEFAULT),
  TRAVEL_FILES_ALLOWED_MIME: parseCsv(process.env['TRAVEL_FILES_ALLOWED_MIME'], [...TRAVEL_FILES_ALLOWED_MIME_DEFAULT]),
} as const;

console.log('Loaded environment configuration:', JSON.stringify(envConfig, null, 2));
