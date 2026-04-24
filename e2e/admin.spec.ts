import { test, expect } from '@playwright/test';

test.describe('admin guard', () => {
  test('visiting /admin without a session redirects to /admin-login', async ({ page }) => {
    // Belt-and-braces: make sure no stale Supabase session lingers.
    await page.addInitScript(() => {
      try {
        for (const k of Object.keys(localStorage)) {
          if (k.startsWith('sb-')) localStorage.removeItem(k);
        }
      } catch { /* storage may be unavailable in some sandboxes */ }
    });

    await page.goto('/admin');
    // AdminGuard revalidates against admin-stats?action=check_admin.
    // In the E2E env that call 401s (or rejects because no session), and the
    // guard redirects to /admin-login. Give it a few seconds to settle.
    await page.waitForURL('**/admin-login', { timeout: 10_000 });
    expect(new URL(page.url()).pathname).toBe('/admin-login');
  });

  test('/admin-login page renders email + password inputs', async ({ page }) => {
    await page.goto('/admin-login');
    await expect(page.getByText('관리자 로그인')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder('admin@aimetawow.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
  });

  test('/admin-login shows an error when submitted with empty fields', async ({ page }) => {
    await page.goto('/admin-login');
    await page.getByText('관리자 로그인').waitFor({ timeout: 5_000 });
    // Find the submit button — only button whose text contains "로그인" inside the form.
    const submit = page.getByRole('button', { name: /로그인/ }).last();
    await submit.click();
    await expect(page.getByText('이메일과 비밀번호를 입력해주세요.')).toBeVisible({ timeout: 5_000 });
  });
});
