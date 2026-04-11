import { test, expect } from '@playwright/test';

/**
 * E2E tests for the OAuth 2.1 refresh token flow.
 *
 * These tests call the MCP server's /api/token endpoint directly using
 * client credentials obtained from the Hub's /api/mcp/clients API.
 *
 * Requires:
 *   - Hub running at E2E_HUB_BASE_URL (default: http://localhost:3000)
 *   - MCP server running at NEXT_PUBLIC_MCP_URL (default: http://localhost:3001)
 *   - The e2e test user authenticated (handled by global.setup.ts)
 */

const MCP_BASE_URL = process.env['NEXT_PUBLIC_MCP_URL'] ?? 'http://localhost:3001';

interface CreatedClient {
  id: number;
  clientId: string;
  plainClientSecret: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

test.describe('OAuth Refresh Token Flow', () => {
  let createdClientId: number | null = null;

  test.afterEach(async ({ page }) => {
    if (createdClientId !== null) {
      await page.request.delete(`/api/mcp/clients/${createdClientId}`);
      createdClientId = null;
    }
  });

  /**
   * Full refresh token lifecycle on a single client:
   * issue tokens → rotate → reject replayed token → reject invalid token.
   */
  test('full refresh token lifecycle: issue, rotate, reject replay, reject invalid', async ({ page, request }) => {
    // ── Setup: create one OAuth client for all steps ──────────────────────────
    const createRes = await page.request.post('/api/mcp/clients', {
      data: { name: 'E2E Refresh Token Test' },
    });
    expect(createRes.status()).toBe(201);
    const client = (await createRes.json()) as CreatedClient;
    createdClientId = client.id;

    const tokenRequest = (params: Record<string, string>) =>
      request.post(`${MCP_BASE_URL}/api/token`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: new URLSearchParams({
          client_id: client.clientId,
          client_secret: client.plainClientSecret,
          ...params,
        }).toString(),
      });

    // ── 1. client_credentials grant issues access_token + refresh_token ───────
    const initialRes = await tokenRequest({ grant_type: 'client_credentials' });
    expect(initialRes.status()).toBe(200);
    const initialTokens = (await initialRes.json()) as TokenResponse;
    expect(initialTokens.access_token).toBeTruthy();
    expect(initialTokens.refresh_token).toBeTruthy();
    expect(initialTokens.token_type).toBe('bearer');
    expect(initialTokens.expires_in).toBe(86400);

    // ── 2. refresh_token grant rotates both tokens ─────────────────────────────
    const rotateRes = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: initialTokens.refresh_token,
    });
    expect(rotateRes.status()).toBe(200);
    const rotatedTokens = (await rotateRes.json()) as TokenResponse;
    expect(rotatedTokens.access_token).toBeTruthy();
    expect(rotatedTokens.refresh_token).toBeTruthy();
    expect(rotatedTokens.token_type).toBe('bearer');
    expect(rotatedTokens.expires_in).toBe(86400);
    // Both tokens must differ from the originals
    expect(rotatedTokens.access_token).not.toBe(initialTokens.access_token);
    expect(rotatedTokens.refresh_token).not.toBe(initialTokens.refresh_token);

    // ── 3. Replaying the already-rotated refresh_token is rejected ─────────────
    const replayRes = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: initialTokens.refresh_token,
    });
    expect(replayRes.status()).toBe(400);
    expect(((await replayRes.json()) as { error: string }).error).toBe('invalid_grant');

    // ── 4. A completely invalid refresh_token is rejected ─────────────────────
    const invalidRes = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: 'completely-invalid-token',
    });
    expect(invalidRes.status()).toBe(400);
    expect(((await invalidRes.json()) as { error: string }).error).toBe('invalid_grant');
  });
});
