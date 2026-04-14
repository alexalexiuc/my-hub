import { test, expect } from '@playwright/test';

test.describe('MCP Service Page', () => {
  test.beforeEach(async ({ page }) => {
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

  /**
   * Page layout and server controls: headings, server cards, Coming soon label,
   * and toggling an active server on/off and back.
   */
  test('page layout and server controls', async ({ page }) => {
    // ── 1. Headings ───────────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'MCP Service' })).toBeVisible();

    // ── 2. Server cards ───────────────────────────────────────────────────────
    // Scope to the MCP Servers section — the Audit Log filter dropdown also
    // has options with these exact names, which causes strict mode violations.
    const serversSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'MCP Servers' }),
    });
    await expect(serversSection.getByText('Calories', { exact: true })).toBeVisible();
    await expect(serversSection.getByText('Todo', { exact: true })).toBeVisible();
    await expect(serversSection.getByText('Apiary', { exact: true })).toBeVisible();
    await expect(serversSection.getByText('Products', { exact: true })).toBeVisible();

    // ── 3. Inactive server shows Coming soon ──────────────────────────────────
    const productsCard = page.locator('[class*="rounded-xl"]', { hasText: 'Products' });
    await expect(productsCard.getByText('Coming soon')).toBeVisible();

    // ── 4. Toggle active server on/off and back ───────────────────────────────
    const caloriesCard = page.locator('[class*="rounded-xl"]', { hasText: 'Meal logging' });
    const toggle = caloriesCard.getByRole('switch');
    const initialState = await toggle.getAttribute('aria-checked');
    const expectedFlipped = initialState === 'true' ? 'false' : 'true';

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', expectedFlipped, { timeout: 5_000 });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', initialState!, { timeout: 5_000 });
  });

  /**
   * Connection lifecycle: create via UI (verify one-time secret), inspect the
   * resulting card (Client ID prefix, MCP URL), toggle it disabled, then revoke it.
   */
  test('connection lifecycle: create, inspect, toggle, revoke', async ({ page }) => {
    // ── 1. Create connection via UI ───────────────────────────────────────────
    await page.getByRole('button', { name: /new connection/i }).click();
    await page.getByPlaceholder(/claude desktop/i).fill('My Test Client');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByText(/save these credentials now/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Client ID', { exact: true })).toBeVisible();
    await expect(page.getByText('Client secret', { exact: true })).toBeVisible();
    await expect(page.getByText('MCP URL', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /done/i }).click();
    await expect(page.getByText(/save these credentials now/i)).not.toBeVisible();

    // ── 2. Client card shows name, ID prefix, MCP URL ─────────────────────────
    await expect(page.getByText('My Test Client')).toBeVisible();
    await expect(page.locator('code', { hasText: 'hub_' }).first()).toBeVisible();

    // ── 3. Toggle client disabled ─────────────────────────────────────────────
    const clientCard = page.locator('[class*="rounded-xl"]', { hasText: 'My Test Client' });
    const clientToggle = clientCard.getByRole('switch');
    await expect(clientToggle).toHaveAttribute('aria-checked', 'true');
    await clientToggle.click();
    await expect(clientToggle).toHaveAttribute('aria-checked', 'false');

    // ── 4. Revoke with two-step confirmation ──────────────────────────────────
    await page.getByRole('button', { name: /^revoke$/i }).click();
    await expect(page.getByRole('button', { name: /confirm revoke/i })).toBeVisible();
    await page.getByRole('button', { name: /confirm revoke/i }).click();
    await expect(page.getByText('My Test Client')).not.toBeVisible({ timeout: 5_000 });
  });

  /**
   * Kept separate: audit log uses seeded rows from e2e setup and is independent
   * of connection lifecycle state.
   */
  test('audit log loads seeded rows and shows table columns', async ({ page }) => {
    const auditSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Audit Log' }),
    });

    await auditSection.getByRole('button', { name: /load logs/i }).click();

    await expect(auditSection.getByText('Server', { exact: true })).toBeVisible();
    await expect(auditSection.getByText('Method', { exact: true })).toBeVisible();
    await expect(auditSection.getByText('Path', { exact: true })).toBeVisible();
    await expect(auditSection.getByText('Status', { exact: true })).toBeVisible();
    await expect(auditSection.getByText('Duration', { exact: true })).toBeVisible();
    await expect(auditSection.getByText('Time', { exact: true })).toBeVisible();

    await expect(auditSection.getByText('/e2e/audit-log/', { exact: false }).first()).toBeVisible({ timeout: 5_000 });
    await expect(auditSection.getByText('No logs found for the selected filters.')).not.toBeVisible();
  });
});
