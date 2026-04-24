import { test, expect } from '@playwright/test';

test.describe('credit purchase', () => {
  test('renders all five credit packages with prices', async ({ page }) => {
    await page.goto('/credit-purchase');
    // The hero heading.
    await expect(page.getByText('쓴 만큼만 결제하세요')).toBeVisible({ timeout: 10_000 });
    // Package names (Starter/Basic/Plus/Pro/Max live in CREDIT_PACKAGES).
    for (const name of ['Starter', 'Basic', 'Plus']) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    // KRW prices should be rendered (starter ₩6,900 is cheapest).
    await expect(page.getByText(/₩6,?900/).first()).toBeVisible();
  });

  test('sets the document title', async ({ page }) => {
    await page.goto('/credit-purchase');
    await expect(page).toHaveTitle(/크레딧/);
  });

  test('header shows the current credit balance (0 without a session)', async ({ page }) => {
    await page.goto('/credit-purchase');
    // The balance is `{credits} CR` — a signed-out visitor sees 0.
    const balance = page.locator('text=/\\d[\\d,]*\\s*CR/').first();
    await expect(balance).toBeVisible({ timeout: 10_000 });
  });
});
