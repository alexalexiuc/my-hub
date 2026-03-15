/**
 * E2e environment configuration.
 *
 * Required env vars:
 *   E2E_CLIENT_ID            - Pre-registered OAuth client ID (e.g. hub_xxxxxxxx)
 *   E2E_TOKEN_SIGNING_SECRET - Raw (unencrypted) token signing secret for that client
 *   E2E_USER_ID              - UUID of the user this client is authorized for
 *
 * Optional env vars:
 *   E2E_BASE_URL             - Server base URL (default: http://localhost:3001)
 */
export interface E2eEnv {
  baseUrl: string;
  clientId: string;
  tokenSigningSecret: string;
  userId: string;
}

/** Base URL only — usable without auth credentials (defaults to localhost). */
export function getBaseUrl(): string {
  return process.env['E2E_BASE_URL'] ?? 'http://localhost:3001';
}

/** Full env with auth credentials — required for authenticated MCP requests. */
export function getE2eEnv(): E2eEnv {
  const baseUrl = getBaseUrl();
  const clientId = process.env['E2E_CLIENT_ID'];
  const tokenSigningSecret = process.env['E2E_TOKEN_SIGNING_SECRET'];
  const userId = process.env['E2E_USER_ID'];

  if (!clientId || !tokenSigningSecret || !userId) {
    throw new Error(
      'Missing required e2e env vars: E2E_CLIENT_ID, E2E_TOKEN_SIGNING_SECRET, E2E_USER_ID\n' +
        'See packages/mcp-server/e2e/README.md for setup instructions.',
    );
  }

  return { baseUrl, clientId, tokenSigningSecret, userId };
}
