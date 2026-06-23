import { test, expect } from '@playwright/test';
import { ensureHealthyOrSkip, bypassLoginIfRequired, ADMIN_URL, ENGINE_URL } from './utils';

test.describe('Analytics Dashboard', () => {
  test('Renders analytics data after redirects', async ({ page, request }) => {
    await ensureHealthyOrSkip(request);
    await bypassLoginIfRequired(page);

    const slug = `analytics-${Date.now()}`;
    const destination = 'https://example.com/analytics';

    // Click "New Link" if visible
    const createBtn = page.getByRole('button', { name: 'New Link' });
    if (await createBtn.isVisible()) {
      await createBtn.click();
    }

    // Create a link
    await page.fill('input[placeholder="Leave empty to auto-generate"]', slug);
    await page.locator('input[placeholder="https://..."]').first().fill(destination);
    await page.locator('button:has-text("Create")').click();

    // Verify creation
    await expect(page.locator('text=Link created successfully!')).toBeVisible({ timeout: 5000 });

    // Wait for Engine sync
    await page.waitForTimeout(2000);

    // Hit the Engine to generate analytics
    await request.get(`${ENGINE_URL}/${slug}`, { maxRedirects: 0 });

    // Wait for analytics ingestion
    await page.waitForTimeout(2000);

    // Navigate to Analytics
    await page.goto(`${ADMIN_URL}/analytics`);

    // Verify Dashboard rendering
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();
    await expect(page.locator('h3:has-text("Total Clicks")')).toBeVisible();

    // Verify Recent Events section
    await expect(page.locator('span:has-text("Recent Events:")')).toBeVisible();

    // Check if the table headers rendered
    await expect(page.locator('th:has-text("Path")')).toBeVisible();

    // Verify that the specific event we generated appears in the table
    // It should be visible as text in a table cell corresponding to the path/slug
    await expect(page.locator(`td:has-text("/${slug}")`)).toBeVisible();
  });
});
