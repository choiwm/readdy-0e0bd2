import { test, expect } from '@playwright/test';

test.describe('customer support', () => {
  test('FAQ section renders with questions', async ({ page }) => {
    await page.goto('/customer-support');
    // At least one of the FAQ answers referenced in the page source should surface.
    const faqHit = page.locator('text=/크레딧|TTS|AI/').first();
    await expect(faqHit).toBeVisible({ timeout: 10_000 });
  });

  test('inquiry form loads', async ({ page }) => {
    await page.goto('/customer-support');
    // Page loads to a non-empty body; specific form testing is left for later.
    await expect(page.locator('body')).not.toBeEmpty();
    // The select has entries like "크레딧/결제 문의" hard-coded in the page.
    await expect(page.locator('text=/문의/').first()).toBeVisible({ timeout: 10_000 });
  });
});
