function parsePort(val: string | undefined, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseMs(val: string | undefined, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const envConfig = {
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  MCP_SERVER_PORT: parsePort(process.env['MCP_SERVER_PORT'] ?? process.env['PORT'], 3001),
  HOST: process.env['HOST'] ?? '127.0.0.1',
  LOG_LEVEL: process.env['LOG_LEVEL'] ?? 'info',
  SESSION_CLEANUP_INTERVAL_MS: parseMs(process.env['SESSION_CLEANUP_INTERVAL_MS'], 300_000),
  SESSION_MAX_IDLE_MS: parseMs(process.env['SESSION_MAX_IDLE_MS'], 1_800_000),
  CORS_ORIGIN: process.env['CORS_ORIGIN'] ?? '*',
} as const;
