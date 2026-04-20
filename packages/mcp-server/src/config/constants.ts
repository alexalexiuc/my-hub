/** How often (ms) the session cleanup job runs. */
export const SESSION_CLEANUP_INTERVAL_MS = 300_000;

/** Maximum idle time (ms) before a session is eligible for cleanup. */
export const SESSION_MAX_IDLE_MS = 1_800_000;

export const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
]);

export const SENSITIVE_FIELDS = new Set([
  'client_name',
  'client_secret',
  'code_challenge',
  'code_verifier',
  'access_token',
  'refresh_token',
]);

export const REDACTED_PLACEHOLDER = '[REDACTED]';
