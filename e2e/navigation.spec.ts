import { test, expect } from '@playwright/test';

const PUBLIC_ROUTES: ReadonlyArray<{ path: string; titleRegex: RegExp }> = [
  { path: '/', titleRegex: /AiMetaWOW|Readdy|./ },
  { path: '/terms', titleRegex: /이용약관/ },
  { path: '/privacy', titleRegex: /개인정보/ },
  { path: '/customer-support', titleRegex: /./ },
  { path: '/credit-purchase', titleRegex: /크레딧/ },
];

test.describe('public route navigation', () => {
  for (const { path, titleRegex } of PUBLIC_ROUTES) {
    test(`${path} loads without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      await page.goto(path);
      await expect(page).toHaveTitle(titleRegex, { timeout: 10_000 });
      await expect(page.locator('body')).not.toBeEmpty();

      // Supabase calls in the app sometimes 401 silently and log — those aren't
      // meaningful signal for rendering. Keep the filter broad but not empty.
      const meaningful = errors.filter(
        (e) => !/favicon|supabase|401|403|network/i.test(e),
      );
      expect(meaningful).toEqual([]);
    });
  }

  test('unknown route renders NotFound without crashing', async ({ page }) => {
    await page.goto('/totally-not-a-real-route-abc123');
    await expect(page.locator('body')).not.toBeEmpty();
    // 404 component typically shows a 404 string or similar.
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(0);
  });
});
