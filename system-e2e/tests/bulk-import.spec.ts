import { test, expect } from '@playwright/test';
import { ensureHealthyOrSkip, bypassLoginIfRequired } from './utils';

test.describe('Bulk Import', () => {
  test('Imports multiple links via JSON', async ({ page, request }) => {
    await ensureHealthyOrSkip(request);
    await bypassLoginIfRequired(page);

    const payload = [
      { slug: `bulk1-${Date.now()}`, destination: 'https://example.com/1' },
      { slug: `bulk2-${Date.now()}`, destination: 'https://example.com/2' }
    ];

    // Open Modal
    await page.locator('button:has-text("Bulk Import")').click();
    await expect(page.locator('h3:has-text("Bulk Import Links")')).toBeVisible();

    // Fill JSON
    await page.fill('textarea[placeholder="Paste JSON here..."]', JSON.stringify(payload, null, 2));

    // Submit
    await page.locator('button:has-text("Import")').filter({ hasNotText: 'Importing...' }).click();

    // Verify Success
    await expect(page.locator('text=Successfully imported')).toBeVisible({ timeout: 10000 });
  });
});
