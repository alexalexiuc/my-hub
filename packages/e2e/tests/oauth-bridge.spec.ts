import { test, expect } from '@playwright/test';

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
});
