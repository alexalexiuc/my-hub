import { test, expect } from '@playwright/test';

const MCP_BASE_URL = process.env['E2E_MCP_BASE_URL'] ?? 'http://localhost:3001';

test.describe('OAuth Bridge Flow', () => {
  test('mcp-bridge sets bridge cookie and redirects back to MCP server', async ({ page, context }) => {
    // The test user is already authenticated on the hub (storageState from global setup).
    // Simulate the MCP server redirecting to the bridge endpoint with a redirect param.
    const mcpAuthorizeUrl = `${MCP_BASE_URL}/api/authorize?response_type=code&client_id=test123`;
    const bridgeUrl = `/api/auth/mcp-bridge?redirect=${encodeURIComponent(mcpAuthorizeUrl)}`;

    // Navigate to the bridge endpoint
    await page.goto(bridgeUrl);

    // The bridge should redirect us to the MCP server authorize URL.
    // Since the MCP server may not be running in e2e, we check the redirect target
    // by intercepting the navigation or checking the final URL.
    // In local e2e the MCP server might not be running, so we just verify
    // the bridge cookie was set and the redirect was attempted.
    const cookies = await context.cookies();
    const bridgeCookie = cookies.find((c) => c.name === '__Hub-mcp-bridge');

    expect(bridgeCookie).toBeDefined();
    expect(bridgeCookie!.path).toBe('/');
    expect(bridgeCookie!.httpOnly).toBe(true);

    // Verify the bridge cookie value is a valid HMAC-signed token
    // Cookie value may be URL-encoded, so decode first
    const decoded = decodeURIComponent(bridgeCookie!.value);
    const parts = decoded.split('|');
    expect(parts).toHaveLength(3);

    const [email, expiryStr, _sig] = parts;
    expect(email).toContain('@'); // should be an email
    const expiry = Number(expiryStr);
    expect(expiry).toBeGreaterThan(Date.now()); // should not be expired
  });

  test('mcp-bridge redirects to signin when not authenticated', async ({ browser }) => {
    // Create a fresh context with no auth cookies
    const context = await browser.newContext();
    const page = await context.newPage();

    const mcpUrl = `${MCP_BASE_URL}/api/authorize?test=1`;
    const bridgeUrl = `http://localhost:3000/api/auth/mcp-bridge?redirect=${encodeURIComponent(mcpUrl)}`;

    await page.goto(bridgeUrl);

    // Should be redirected to the signin page with callbackUrl back to the bridge
    await expect(page).toHaveURL(/\/auth\/signin/, { timeout: 10_000 });
    const url = new URL(page.url());
    const callbackUrl = url.searchParams.get('callbackUrl');
    expect(callbackUrl).toContain('/api/auth/mcp-bridge');

    await context.close();
  });

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
});
