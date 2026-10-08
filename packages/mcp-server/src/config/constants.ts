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
