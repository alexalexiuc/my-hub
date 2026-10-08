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
    .map(item => item.trim())
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
  get CORS_ORIGIN() {
    return getEnvVar('CORS_ORIGIN', '*');
  },
  /**
   * Host-header allowlist for the MCP endpoints (DNS-rebinding protection). Hostnames only, no ports.
   * Must include the public MCP domain in deployed environments.
   */
  get MCP_ALLOWED_HOSTS() {
    return parseCsv(getEnvVar('MCP_ALLOWED_HOSTS', ''), ['localhost', '127.0.0.1', '[::1]']);
  },
  /** Origin-header allowlist (hostnames) for browser clients of the MCP endpoints. Requests without Origin pass. */
  get MCP_ALLOWED_ORIGINS() {
    return parseCsv(getEnvVar('MCP_ALLOWED_ORIGINS', ''), [
      'localhost',
      '127.0.0.1',
      '[::1]',
      'claude.ai',
      'claude.com',
    ]);
  },
  get ALLOWED_REDIRECT_URIS() {
    return parseCsv(getEnvVar('ALLOWED_REDIRECT_URIS', ''), []);
  },
  /** Falls back to NEXTAUTH_URL (set by the hub) when HUB_URL is not explicitly provided. */
  get HUB_URL() {
    return getEnvVar('HUB_URL', '') || getEnvVar('NEXTAUTH_URL', 'http://localhost:3000');
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
  get NEXTAUTH_SECRET() {
    return getEnvVar('NEXTAUTH_SECRET');
  },
};
