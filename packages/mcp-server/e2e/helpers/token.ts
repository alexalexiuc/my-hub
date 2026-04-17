import { getE2eEnv } from './env.js';

/**
 * Obtains a fresh access token by calling POST /token with the client_credentials grant.
 * Requires the server to be running at E2E_MCP_BASE_URL.
 */
export async function generateToken(): Promise<string> {
  const { clientId, clientSecret, baseUrl } = getE2eEnv();
  const res = await fetch(`${baseUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`POST /token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
