import { test, expect } from '@playwright/test';
import { TEST_USER } from '../config';

// Auth tests don't use the saved storageState — they test the login flow itself.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('sign-in page shows email+password form and Google button', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create one/i })).toBeVisible();
  });

  test('register page shows registration form', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('sign in with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });
  });

  test('duplicate registration returns error', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await page.locator('#confirm').fill(TEST_USER.password);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/already registered/i)).toBeVisible();
  });

  test('password mismatch shows error without API call', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByLabel('Email').fill('new@example.com');
    await page.locator('#password').fill('Password123!');
    await page.locator('#confirm').fill('DifferentPassword!');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/do not match/i)).toBeVisible();
    await expect(page).toHaveURL('/auth/register');
  });

  test('unauthenticated user is redirected to sign-in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
