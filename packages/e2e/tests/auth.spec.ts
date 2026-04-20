import { test, expect } from '@playwright/test';
import { TEST_USER } from '../config';

// Auth tests don't use the saved storageState — they test the login flow itself.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  /**
   * Sign-in flow: unauthenticated redirect, form layout, invalid credentials error,
   * and successful sign-in navigation — all on the same page context.
   */
  test('sign-in: redirect, form layout, invalid creds, valid creds', async ({ page }) => {
    // ── 1. Unauthenticated user redirected to sign-in ─────────────────────────
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/signin/);

    // ── 2. Form layout ────────────────────────────────────────────────────────
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create one/i })).toBeVisible();

    // ── 3. Invalid credentials shows error ────────────────────────────────────
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    // ── 4. Valid credentials redirect to dashboard ────────────────────────────
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  /**
   * Register flow: form layout, client-side password mismatch error (no API call),
   * and server-side duplicate email error.
   */
  test('register: form layout, password mismatch, duplicate email', async ({ page }) => {
    await page.goto('/auth/register');

    // ── 1. Form layout ────────────────────────────────────────────────────────
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();

    // ── 2. Password mismatch is caught client-side (no navigation) ─────────────
    await page.getByLabel('Email').fill('new@example.com');
    await page.locator('#password').fill('Password123!');
    await page.locator('#confirm').fill('DifferentPassword!');
    await page.getByRole('button', { name: /create account/i }).click();
    // Target the form error <p> specifically — PasswordStrength renders the same phrase
    // without a trailing period in a <span>, so this exact string matches only the <p>.
    await expect(page.getByText('Passwords do not match.')).toBeVisible();
    await expect(page).toHaveURL('/auth/register');

    // ── 3. Duplicate email returns server error ───────────────────────────────
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await page.locator('#confirm').fill(TEST_USER.password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/already registered/i)).toBeVisible();
  });

  /**
   * Verify email page: shows correct UI for missing token, invalid token, and success states.
   */
  test('verify-email: missing token, invalid token, success state', async ({ page }) => {
    // ── 1. No token in URL — "Invalid link" state ─────────────────────────────
    await page.goto('/auth/verify-email');
    await expect(page.getByRole('heading', { name: /invalid link/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible();

    // ── 2. Invalid token — "Verification failed" state ───────────────────────
    await page.goto('/auth/verify-email?token=invalid-token-that-does-not-exist');
    await expect(page.getByRole('heading', { name: /verification failed/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});
