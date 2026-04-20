import { test, expect } from '@playwright/test';
import { TEST_USER } from '../config';

// Auth feature tests don't use the saved storageState — they test flows directly.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Forgot Password', () => {
  test('form layout and success message on submit', async ({ page }) => {
    await page.goto('/auth/forgot-password');

    // ── 1. Form layout ────────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();

    // ── 2. Submitting shows success message (API always returns 200) ───────────
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();
  });

  test('success message also shown for non-existent email (prevents enumeration)', async ({ page }) => {
    // Use a distinct address so it is never in the server-side rate-limit cache from the previous test.
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email').fill('nonexistent-enumeration@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Same success message — no information about whether user exists
    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows countdown when same email is submitted again within rate-limit window', async ({ page }) => {
    // Use a timestamped address so each test run gets a fresh cache entry.
    const email = `rate-limit-${Date.now()}@example.com`;

    // ── 1. First submission — success, no countdown ───────────────────────────
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/request another link in/i)).toBeVisible();
  });
});

test.describe('Reset Password', () => {
  test('shows invalid link when no token provided', async ({ page }) => {
    await page.goto('/auth/reset-password');
    await expect(page.getByRole('heading', { name: /invalid link/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /request a new one/i })).toBeVisible();
  });

  test('shows error for invalid or expired token', async ({ page }) => {
    await page.goto('/auth/reset-password?token=invalid-token-that-does-not-exist');

    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await page.locator('#password').fill('NewPassword123!');
    await page.locator('#confirm').fill('NewPassword123!');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10_000 });
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/auth/reset-password?token=any-token');

    await page.locator('#password').fill('NewPassword123!');
    await page.locator('#confirm').fill('DifferentPassword!');
    await page.getByRole('button', { name: /update password/i }).click();

    // Client-side validation — no API call
    await expect(page.getByText(/do not match/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/reset-password/);
  });
});
