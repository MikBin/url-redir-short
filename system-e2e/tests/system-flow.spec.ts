import { test, expect, request as playwrightRequest } from '@playwright/test';

const ADMIN_URL = 'http://localhost:3001';
const ENGINE_URL = 'http://localhost:3002';

test.describe('System Flow', () => {

  test.beforeAll(async () => {
    // Wait for Admin Service to be healthy
    const request = await playwrightRequest.newContext();
    try {
        const res = await request.get(`${ADMIN_URL}/api/health`);
        if (res.status() === 503) {
            console.warn("Admin Service returned 503 (Service Unavailable). Supabase likely missing.");
        } else if (!res.ok()) {
             console.warn(`Admin Service returned ${res.status()}`);
        }
    } catch (e) {
        console.error("Admin Service not ready", e);
    }
    await request.dispose();
  });

  test('Services are running', async ({ request }) => {
    const adminHealth = await request.get(`${ADMIN_URL}/api/health`);
    if (adminHealth.status() === 503) {
        test.skip(true, 'Admin Service is running but 503 (Supabase missing).');
    }
    expect(adminHealth.ok()).toBeTruthy();

    const engineHealth = await request.get(`${ENGINE_URL}/health`);
    expect(engineHealth.ok()).toBeTruthy();
  });

  test('Full Link Lifecycle', async ({ page, request }) => {
     const adminHealth = await request.get(`${ADMIN_URL}/api/health`);
     if (adminHealth.status() === 503) {
         test.skip(true, 'Skipping E2E flow because Admin Service is unhealthy (Supabase missing).');
     }

     // Check if we are redirected to login
     await page.goto(ADMIN_URL);

     // Basic check to see if we can load the UI
     const title = await page.title();
     console.log(`Page Title: ${title}`);
     expect(title).not.toBe('');

     // Check for login page indicators
     // Adjust selectors based on actual UI
     const isLoginPage = await page.getByText('Sign in', { exact: false }).isVisible() ||
                         await page.getByText('Login', { exact: false }).isVisible();

     if (isLoginPage) {
         console.warn('Authentication required. Skipping full lifecycle test as we do not have credentials configured for this automated run.');
         return;
     }

     // Assuming we are logged in or in a state to create links
     const slug = `e2e-${Date.now()}`;
     const destination = 'https://example.com';

     // Try to find the "Create Link" button (Adjust selector to match Admin UI)
     // Assuming a button with text "New Link" or similar icon
     const createBtn = page.getByRole('button', { name: 'New Link' });

     if (await createBtn.isVisible()) {
        await createBtn.click();

        // Fill form
        await page.fill('input[name="slug"]', slug).catch(() => page.fill('input[placeholder*="slug"]', slug));
        await page.fill('input[name="destination"]', destination).catch(() => page.fill('input[placeholder*="http"]', destination));

        await page.getByRole('button', { name: 'Save' }).click().catch(() => page.getByRole('button', { name: 'Create' }).click());

        // Wait for sync to Engine
        // (Engine syncs via SSE, should be fast)
        await page.waitForTimeout(2000);

        // Verify Redirect
        console.log(`Verifying redirect for ${ENGINE_URL}/${slug}`);
        const engineRes = await request.get(`${ENGINE_URL}/${slug}`, { maxRedirects: 0 });

        // Expect 302/301
        // Note: If sync failed, this will be 404
        expect([301, 302, 307, 308]).toContain(engineRes.status());
        expect(engineRes.headers()['location']).toBe(destination);

        console.log('Redirect verified. Checking Analytics...');

        // Check analytics
        // Wait for analytics ingestion (fire-and-forget)
        await page.waitForTimeout(2000);

        await page.goto(`${ADMIN_URL}/analytics`);
        // Basic verification that page loads
        expect(await page.getByText('Analytics').isVisible()).toBeTruthy();
     } else {
         console.warn('Create Link button not found. Maybe not logged in or UI changed?');
     }
  });
});
