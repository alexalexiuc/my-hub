import {
  TRAVEL_FILES_ALLOWED_MIME_DEFAULT,
  TRAVEL_FILES_MAX_MB_DEFAULT,
  TRAVEL_FILES_ROOT_DEFAULT,
} from '@my-hub/shared/constants';
import { getEnvVar } from '@my-hub/shared/utils';

function parseNum(val: string, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseCsv(val: string, fallback: string[]): string[] {
  if (!val) return fallback;
  const items = val
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export const envConfig = {
  get NODE_ENV() {
    return getEnvVar('NODE_ENV', 'development');
  },
  /** Falls back to PORT (the generic container port variable) when MCP_SERVER_PORT is not set. */
  get MCP_SERVER_PORT() {
    return parseNum(getEnvVar('MCP_SERVER_PORT', '') || getEnvVar('PORT', ''), 3001);
  },
  get MCP_HOST() {
    return getEnvVar('MCP_HOST', '127.0.0.1');
  },
  get LOG_LEVEL() {
    return getEnvVar('LOG_LEVEL', 'info');
  },
  get SESSION_CLEANUP_INTERVAL_MS() {
    return parseNum(getEnvVar('SESSION_CLEANUP_INTERVAL_MS', ''), 300_000);
  },
  get SESSION_MAX_IDLE_MS() {
    return parseNum(getEnvVar('SESSION_MAX_IDLE_MS', ''), 1_800_000);
  },
  get CORS_ORIGIN() {
    return getEnvVar('CORS_ORIGIN', '*');
  },
  get ALLOWED_REDIRECT_URIS() {
    return parseCsv(getEnvVar('ALLOWED_REDIRECT_URIS', ''), []);
  },
  /** Falls back to NEXTAUTH_URL (set by the hub) when HUB_URL is not explicitly provided. */
  get HUB_URL() {
    return getEnvVar('NEXTAUTH_URL', '') || getEnvVar('HUB_URL', 'http://localhost:3000');
  },
  get LOG_PAYLOADS() {
    return getEnvVar('LOG_PAYLOADS', '') === 'true';
  },
  get PRINT_PAYLOADS() {
    return getEnvVar('PRINT_PAYLOADS', '') === 'true';
  },
  get IS_LOCAL() {
    return getEnvVar('IS_LOCAL', '') === 'true';
  },
  get TRAVEL_FILES_ROOT() {
    return getEnvVar('TRAVEL_FILES_ROOT', TRAVEL_FILES_ROOT_DEFAULT);
  },
  get TRAVEL_FILES_MAX_MB() {
    return parseNum(getEnvVar('TRAVEL_FILES_MAX_MB', ''), TRAVEL_FILES_MAX_MB_DEFAULT);
  },
  get TRAVEL_FILES_ALLOWED_MIME() {
    return parseCsv(getEnvVar('TRAVEL_FILES_ALLOWED_MIME', ''), [...TRAVEL_FILES_ALLOWED_MIME_DEFAULT]);
  },
  /** Shared secret for verifying the cross-subdomain bridge cookie set by the Hub. */
  get NEXTAUTH_SECRET() {
    return getEnvVar('NEXTAUTH_SECRET', '');
  },
};

console.log('Loaded environment configuration:', JSON.stringify(envConfig, null, 2));
