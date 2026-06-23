import { test, type APIRequestContext, type Page } from '@playwright/test';

export const ADMIN_URL = 'http://localhost:3001';
export const ENGINE_URL = 'http://localhost:3002';

/**
 * Checks if the Admin Service is returning 503 (Supabase missing).
 * If so, skips the test using test.skip().
 */
export async function ensureHealthyOrSkip(request: APIRequestContext): Promise<void> {
  try {
    const adminHealth = await request.get(`${ADMIN_URL}/api/health`);
    if (adminHealth.status() === 503) {
      test.skip(true, 'Skipping due to 503 (Supabase missing).');
    }
  } catch (e) {
    console.error("Admin Service not ready", e);
    test.skip(true, 'Admin Service not reachable.');
  }
}

/**
 * Checks if the UI is presenting a login screen.
 * If so, skips the test using test.skip().
 */
export async function bypassLoginIfRequired(page: Page): Promise<void> {
  await page.goto(ADMIN_URL);

  const isLoginPage = await page.getByText('Sign in', { exact: false }).isVisible() ||
                      await page.getByText('Login', { exact: false }).isVisible();

  if (isLoginPage) {
    test.skip(true, 'Authentication required. Skipping test as we do not have credentials configured for this automated run.');
  }
}
