import { test, expect } from '@playwright/test';
import { ensureHealthyOrSkip, bypassLoginIfRequired, ENGINE_URL } from './utils';

test.describe('Advanced Routing (Targeting)', () => {
  test('Creates a link with country targeting and verifies redirect', async ({ page, request }) => {
    await ensureHealthyOrSkip(request);
    await bypassLoginIfRequired(page);

    const slug = `advanced-${Date.now()}`;
    const defaultDestination = 'https://example.com/default';
    const targetDestination = 'https://example.com/target-us';

    // Click "New Link" if visible (to ensure form is ready/visible)
    const createBtn = page.getByRole('button', { name: 'New Link' });
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Fill the basic link form
    await page.fill('input[placeholder="Leave empty to auto-generate"]', slug);
    await page.locator('input[placeholder="https://..."]').first().fill(defaultDestination);

    // Navigate to Targeting tab
    await page.locator('button:has-text("Targeting")').click();

    // Enable targeting
    await page.check('input#targeting-enabled');

    // Add a rule
    await page.locator('button:has-text("+ Add Rule")').click();

    // Fill the rule (Target, Value, Destination)
    // Target is 'country' by default in the <select>
    await page.fill('input[placeholder="e.g. US, mobile, en"]', 'US');

    // The second input[placeholder="https://..."] should be the rule destination
    await page.locator('input[placeholder="https://..."]').nth(1).fill(targetDestination);

    // Submit form
    await page.locator('button:has-text("Create")').click();

    // Verify success message
    await expect(page.locator('text=Link created successfully!')).toBeVisible({ timeout: 5000 });

    // Wait for Engine sync
    await page.waitForTimeout(2000);

    // Verify redirect logic
    // 1. Visit with NO special headers -> should hit default
    const resDefault = await request.get(`${ENGINE_URL}/${slug}`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(resDefault.status());
    expect(resDefault.headers()['location']).toBe(defaultDestination);

    // 2. Visit WITH US country header -> should hit target URL
    const resTarget = await request.get(`${ENGINE_URL}/${slug}`, {
      maxRedirects: 0,
      headers: {
        'cf-ipcountry': 'US'
      }
    });
    expect([301, 302, 307, 308]).toContain(resTarget.status());
    expect(resTarget.headers()['location']).toBe(targetDestination);
  });
});
