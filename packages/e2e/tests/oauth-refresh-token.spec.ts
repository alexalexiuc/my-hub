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
    // Clean up the OAuth client created during the test
    if (createdClientId !== null) {
      await page.request.delete(`/api/mcp/clients/${createdClientId}`);
      createdClientId = null;
    }
  });

  test('client_credentials grant returns a refresh_token alongside access_token', async ({
    page,
    request,
  }) => {
    // Create a client pre-bound to the e2e test user via the Hub API
    const createRes = await page.request.post('/api/mcp/clients', {
      data: { name: 'E2E Refresh Token Test' },
    });
    expect(createRes.status()).toBe(201);
    const client = (await createRes.json()) as CreatedClient;
    createdClientId = client.id;

    // Exchange client credentials for tokens at the MCP server
    const tokenRes = await request.post(`${MCP_BASE_URL}/api/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.clientId,
        client_secret: client.plainClientSecret,
      }).toString(),
    });

    expect(tokenRes.status()).toBe(200);
    const tokens = (await tokenRes.json()) as TokenResponse;
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.token_type).toBe('bearer');
    expect(tokens.expires_in).toBe(86400);
  });

  test('refresh_token grant returns a new access_token and rotated refresh_token', async ({
    page,
    request,
  }) => {
    // Create a client pre-bound to the e2e test user
    const createRes = await page.request.post('/api/mcp/clients', {
      data: { name: 'E2E Token Rotation Test' },
    });
    expect(createRes.status()).toBe(201);
    const client = (await createRes.json()) as CreatedClient;
    createdClientId = client.id;

    // First: get an initial access + refresh token pair via client_credentials
    const initialTokenRes = await request.post(`${MCP_BASE_URL}/api/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.clientId,
        client_secret: client.plainClientSecret,
      }).toString(),
    });
    expect(initialTokenRes.status()).toBe(200);
    const initialTokens = (await initialTokenRes.json()) as TokenResponse;
    const initialRefreshToken = initialTokens.refresh_token;
    const initialAccessToken = initialTokens.access_token;
    expect(initialRefreshToken).toBeTruthy();

    // Second: use the refresh token to get a new token pair
    const refreshRes = await request.post(`${MCP_BASE_URL}/api/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: client.clientId,
        client_secret: client.plainClientSecret,
        refresh_token: initialRefreshToken,
      }).toString(),
    });

    expect(refreshRes.status()).toBe(200);
    const refreshedTokens = (await refreshRes.json()) as TokenResponse;
    expect(refreshedTokens.access_token).toBeTruthy();
    expect(refreshedTokens.refresh_token).toBeTruthy();
    expect(refreshedTokens.token_type).toBe('bearer');
    expect(refreshedTokens.expires_in).toBe(86400);

    // The new tokens must be different from the originals (rotation)
    expect(refreshedTokens.access_token).not.toBe(initialAccessToken);
    expect(refreshedTokens.refresh_token).not.toBe(initialRefreshToken);
  });

  test('refresh_token grant rejects an already-rotated (old) refresh_token', async ({
    page,
    request,
  }) => {
    // Create a client
    const createRes = await page.request.post('/api/mcp/clients', {
      data: { name: 'E2E Rotation Rejection Test' },
    });
    expect(createRes.status()).toBe(201);
    const client = (await createRes.json()) as CreatedClient;
    createdClientId = client.id;

    // Get initial tokens
    const initialTokenRes = await request.post(`${MCP_BASE_URL}/api/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.clientId,
        client_secret: client.plainClientSecret,
      }).toString(),
    });
    const { refresh_token: firstRefreshToken } = (await initialTokenRes.json()) as TokenResponse;

    // Rotate: consume the first refresh token
    const firstRotationRes = await request.post(`${MCP_BASE_URL}/api/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: client.clientId,
        client_secret: client.plainClientSecret,
        refresh_token: firstRefreshToken,
      }).toString(),
    });
    expect(firstRotationRes.status()).toBe(200);

    // Attempting to reuse the now-invalidated first refresh token must fail
    const replayRes = await request.post(`${MCP_BASE_URL}/api/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: client.clientId,
        client_secret: client.plainClientSecret,
        refresh_token: firstRefreshToken,
      }).toString(),
    });

    expect(replayRes.status()).toBe(400);
    const body = (await replayRes.json()) as { error: string };
    expect(body.error).toBe('invalid_grant');
  });

  test('refresh_token grant rejects an invalid refresh_token', async ({ page, request }) => {
    // Create a client
    const createRes = await page.request.post('/api/mcp/clients', {
      data: { name: 'E2E Invalid Refresh Token Test' },
    });
    expect(createRes.status()).toBe(201);
    const client = (await createRes.json()) as CreatedClient;
    createdClientId = client.id;

    const res = await request.post(`${MCP_BASE_URL}/api/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: client.clientId,
        client_secret: client.plainClientSecret,
        refresh_token: 'completely-invalid-token',
      }).toString(),
    });

    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_grant');
  });
});
