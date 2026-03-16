import { test, expect } from '@playwright/test';

test.describe('MCP Services Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first to establish session context, then clean up OAuth clients
    await page.goto('/mcp-control');
    await page.waitForLoadState('networkidle');
    const res = await page.request.get('/api/mcp/clients');
    if (res.ok()) {
      const clients = (await res.json()) as Array<{ id: number }>;
      for (const c of clients) {
        await page.request.delete(`/api/mcp/clients/${c.id}`);
      }
      if (clients.length > 0) {
        await page.reload();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('page shows Connections and MCP Servers headings', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'MCP Servers' })).toBeVisible();
  });

  test('shows three MCP server toggle cards', async ({ page }) => {
    // Use exact:true so that 'Calories' doesn't partial-match the MCP URL code element
    await expect(page.getByText('Calories', { exact: true })).toBeVisible();
    await expect(page.getByText('Hive Manager', { exact: true })).toBeVisible();
    await expect(page.getByText('Products', { exact: true })).toBeVisible();
  });

  test('toggle a MCP server on/off and back', async ({ page }) => {
    // All three toggles (role=switch) are for the MCP server section cards
    // After beforeEach, page is on /mcp-control with no OAuth clients
    const toggles = page.getByRole('switch');
    const firstToggle = toggles.first();

    const initialState = await firstToggle.getAttribute('aria-checked');
    const expectedFlipped = initialState === 'true' ? 'false' : 'true';

    await firstToggle.click();
    // Wait for async PATCH to complete and state to update
    await expect(firstToggle).toHaveAttribute('aria-checked', expectedFlipped, { timeout: 5_000 });

    // Restore
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-checked', initialState!, { timeout: 5_000 });
  });

  test('create a new connection shows one-time secret', async ({ page }) => {
    await page.getByRole('button', { name: /new connection/i }).click();

    await page.getByPlaceholder(/claude desktop/i).fill('My Test Client');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Secret reveal card with amber warning
    await expect(page.getByText(/save these credentials now/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Client ID', { exact: true })).toBeVisible();
    await expect(page.getByText('Client secret', { exact: true })).toBeVisible();
    await expect(page.getByText('MCP URL', { exact: true })).toBeVisible();

    // Dismiss
    await page.getByRole('button', { name: /done/i }).click();
    await expect(page.getByText(/save these credentials now/i)).not.toBeVisible();

    // Client card appears with the correct name
    await expect(page.getByText('My Test Client')).toBeVisible();
  });

  test('client card shows client ID prefix and MCP URL', async ({ page }) => {
    await page.request.post('/api/mcp/clients', { data: { name: 'API Client' } });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('API Client')).toBeVisible();
    await expect(page.locator('code', { hasText: 'hub_' }).first()).toBeVisible();
  });

  test('revoke a connection with two-step confirmation', async ({ page }) => {
    await page.request.post('/api/mcp/clients', { data: { name: 'To Be Revoked' } });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('To Be Revoked')).toBeVisible();

    await page.getByRole('button', { name: /^revoke$/i }).click();
    await expect(page.getByRole('button', { name: /confirm revoke/i })).toBeVisible();
    await page.getByRole('button', { name: /confirm revoke/i }).click();

    await expect(page.getByText('To Be Revoked')).not.toBeVisible({ timeout: 5_000 });
  });

  test('toggle client enabled/disabled', async ({ page }) => {
    await page.request.post('/api/mcp/clients', { data: { name: 'Toggle Me' } });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // The client card toggle is the last switch on the page (server toggles come after)
    const clientCard = page.locator('[class*="rounded-xl"]', { hasText: 'Toggle Me' });
    const toggle = clientCard.getByRole('switch');

    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
