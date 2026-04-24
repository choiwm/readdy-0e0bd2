# E2E Tests (Playwright)

## Running locally

```bash
# Install browsers once
npx playwright install chromium

# Build the app (preview server loads from out/)
npm run build

# Run the suite
npm run e2e          # headless
npm run e2e:ui       # Playwright UI for debugging
npm run e2e:report   # open the last HTML report
```

The `webServer` block in `playwright.config.ts` launches `vite preview`
automatically, so you don't need a running dev server.

## Environment

These tests run against the **built** app with the `.env` in place, so:

- `VITE_PUBLIC_SUPABASE_URL` / `VITE_PUBLIC_SUPABASE_ANON_KEY` must be
  set (the suite below does not exercise Supabase, but the app boots
  fail without them — see `src/lib/env.ts`).
- Tests that need a logged-in session should either stub the Supabase
  session in `localStorage` via `page.addInitScript(...)` or use a
  dedicated test account with seeded credentials.

## Current coverage

- `smoke.spec.ts` — app boot, 404, lazy-route loading, toast region
- `admin.spec.ts` — AdminGuard redirect, admin-login form rendering and validation
- `credits.spec.ts` — credit-purchase page packages, title, balance header
- `navigation.spec.ts` — public route console-error gate across /, /terms, /privacy,
  /customer-support, /credit-purchase + NotFound
- `customer-support.spec.ts` — FAQ section and inquiry-form rendering

Still to add as flows stabilize:

- **generate.spec.ts**: end-to-end image generation happy path
  (requires stubbing the Edge Function response)
- **ai-board.spec.ts**: new project, shot add/delete, cut-count dialog
  (requires a logged-in session stub)

## CI

Not wired into CI yet. When you enable it, add a dedicated job that:
1. installs deps (`npm ci`)
2. installs browsers (`npx playwright install --with-deps chromium`)
3. builds (`npm run build`)
4. runs E2E (`npm run e2e`)

Keep it separate from the main `check` job so the main job stays fast.
