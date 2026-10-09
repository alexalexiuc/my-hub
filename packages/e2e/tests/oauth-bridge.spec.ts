import { test, expect } from '@playwright/test';
import { BASE_URL } from '../config';

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL ?? 'http://localhost:3001';

test.describe('OAuth Bridge Flow', () => {
  test('mcp-bridge rejects missing redirect parameter', async ({ page }) => {
    const response = await page.goto('/api/auth/mcp-bridge');
    expect(response?.status()).toBe(400);
  });

  test('mcp-bridge rejects non-HTTPS redirect in production-like check', async ({ page }) => {
    // http:// non-localhost redirect should be rejected
    const response = await page.goto(
      '/api/auth/mcp-bridge?redirect=' + encodeURIComponent('http://evil.example.com/callback'),
    );
    // Should get 403 (HTTPS required) or redirect to error
    // In localhost dev, http is allowed for localhost only
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });

  test('mcp-bridge sends a signed-out user to sign-in on the public hub origin', async ({ playwright }) => {
    // Fresh context without the saved auth state, as when a session has expired.
    // An explicit empty storageState is required: otherwise the context inherits
    // the project's saved auth state.
    const request = await playwright.request.newContext({
      baseURL: BASE_URL,
      storageState: { cookies: [], origins: [] },
    });
    const redirect = `${MCP_URL}/api/authorize?response_type=code&client_id=test`;
    const response = await request.get('/api/auth/mcp-bridge?redirect=' + encodeURIComponent(redirect), {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(307);

    // Inside Docker the request URL carries the bind address (0.0.0.0:3000);
    // the sign-in redirect and its callbackUrl must use the public hub origin.
    const hubOrigin = new URL(BASE_URL).origin;
    const location = new URL(response.headers().location ?? '');
    expect(location.origin).toBe(hubOrigin);
    expect(location.pathname).toBe('/auth/signin');

    const callbackUrl = new URL(location.searchParams.get('callbackUrl') ?? '');
    expect(callbackUrl.origin).toBe(hubOrigin);
    expect(callbackUrl.pathname).toBe('/api/auth/mcp-bridge');
    expect(callbackUrl.searchParams.get('redirect')).toBe(redirect);

    await request.dispose();
  });
});
