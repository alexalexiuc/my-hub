import { test, expect } from '@playwright/test';
import { TEST_USER, BASE_URL } from '../config';

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
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Same success message — no information about whether user exists
    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 10_000 });
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

  test('full reset flow: request token, reset password, sign in with new password', async ({ page, request }) => {
    // ── 1. Get a real reset token via the test helper endpoint ────────────────
    const tokenRes = await request.get(`${BASE_URL}/api/auth/test/reset-token?email=${TEST_USER.email}`);
    expect(tokenRes.status()).toBe(200);
    const { token } = (await tokenRes.json()) as { token: string };
    expect(token).toBeTruthy();

    // ── 2. Navigate to the reset-password page with the token ─────────────────
    const newPassword = 'ResetPass456!';
    await page.goto(`/auth/reset-password?token=${token}`);

    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    await page.locator('#password').fill(newPassword);
    await page.locator('#confirm').fill(newPassword);
    await page.getByRole('button', { name: /update password/i }).click();

    // ── 3. Verify success state ───────────────────────────────────────────────
    await expect(page.getByText(/password has been updated/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();

    // ── 4. Verify token cannot be reused ─────────────────────────────────────
    await page.goto(`/auth/reset-password?token=${token}`);
    await page.locator('#password').fill('AnotherPass789!');
    await page.locator('#confirm').fill('AnotherPass789!');
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible({ timeout: 10_000 });

    // ── 5. Sign in with the new password ─────────────────────────────────────
    await page.goto('/auth/signin');
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.locator('#password').fill(newPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });

    // ── 6. Restore the original password (teardown) ───────────────────────────
    const restoreRes = await request.get(`${BASE_URL}/api/auth/test/reset-token?email=${TEST_USER.email}`);
    const { token: restoreToken } = (await restoreRes.json()) as { token: string };
    await request.post(`${BASE_URL}/api/auth/reset-password`, {
      data: { token: restoreToken, password: TEST_USER.password },
    });
  });
});
