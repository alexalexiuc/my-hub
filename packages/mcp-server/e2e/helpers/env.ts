/**
 * E2e environment configuration.
 *
 * Required env vars:
 *   E2E_MCP_CLIENT_ID      - OAuth client ID (e.g. hub_xxxxxxxx)
 *   E2E_MCP_CLIENT_SECRET  - OAuth client secret
 *
 * Optional env vars:
 *   E2E_MCP_BASE_URL       - Server base URL (default: http://localhost:3001)
 *
 * Run `pnpm e2e:setup` once to provision credentials and write e2e/.env.e2e.
 */
export interface E2eEnv {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

/** Base URL only — usable without auth credentials (defaults to localhost). */
export function getBaseUrl(): string {
  return process.env['E2E_MCP_BASE_URL'] ?? 'http://localhost:3001';
}

/** Full env with auth credentials — required for authenticated MCP requests. */
export function getE2eEnv(): E2eEnv {
  const baseUrl = getBaseUrl();
  const clientId = process.env['E2E_MCP_CLIENT_ID'];
  const clientSecret = process.env['E2E_MCP_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing required e2e env vars: E2E_MCP_CLIENT_ID, E2E_MCP_CLIENT_SECRET\n' +
        'Run `pnpm e2e:setup` to provision credentials. See packages/mcp-server/e2e/README.md.',
    );
  }

  return { baseUrl, clientId, clientSecret };
}
