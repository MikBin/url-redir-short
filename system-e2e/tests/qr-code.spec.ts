import { test, expect } from '@playwright/test';
import { ensureHealthyOrSkip, bypassLoginIfRequired } from './utils';

test.describe('QR Code Generation', () => {
  test('Creates a link and views its QR code', async ({ page, request }) => {
    await ensureHealthyOrSkip(request);
    await bypassLoginIfRequired(page);

    const slug = `qr-${Date.now()}`;
    const destination = 'https://example.com/qr';

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

    // Find the QR button for the new link in the table (it should be the first row based on descending sort)
    const qrButton = page.locator('button:has-text("QR")').first();
    await qrButton.click();

    // Wait for the modal and verify image
    await expect(page.locator('h3:has-text("QR Code")')).toBeVisible();
    const qrImage = page.locator('img[alt="QR Code"]');
    await expect(qrImage).toBeVisible();

    // Assert src is present
    const src = await qrImage.getAttribute('src');
    expect(src).toBeTruthy();

    // Close the modal
    await page.locator('button:has-text("Close")').click();
    await expect(page.locator('h3:has-text("QR Code")')).toBeHidden();
  });
});
