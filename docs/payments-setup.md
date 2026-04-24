# TossPayments Setup

Production cutover checklist for the credit-purchase flow.

## 1. Toss merchant onboarding

1. Sign up at https://docs.tosspayments.com and complete merchant verification.
2. Generate two key pairs in **상점관리 → 결제연동**:
   - **Test**: `test_ck_xxx` (client) + `test_sk_xxx` (secret)
   - **Live**: `live_ck_xxx` (client) + `live_sk_xxx` (secret)
3. (Recommended) Generate a webhook secret: `openssl rand -hex 16`.

## 2. Frontend env (browser)

Edit `.env`:

```
VITE_PUBLIC_TOSS_CLIENT_KEY="live_ck_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Use `test_ck_xxx` for staging. The fallback in `src/lib/toss.ts` is Toss's
public test key — useful for local dev with no env at all, but never charges.

## 3. Edge Function secrets (server-only)

Set these via the Supabase CLI (NOT in `.env`):

```
supabase secrets set TOSS_SECRET_KEY=live_sk_xxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TOSS_WEBHOOK_SECRET=$(openssl rand -hex 16)
```

These are read by `supabase/functions/payments-toss/index.ts`. They must
NEVER appear in any committed file or in the bundled JS.

## 4. Database migrations

```
supabase db push
```

Applies:
- `0002_payments.sql` — `payments` table + RLS (user reads own rows; writes
  go through Edge Function with service-role).
- `0003_grant_credits_rpc.sql` — atomic `grant_credits(user_id, amount)` RPC
  used during confirmation. The Edge Function falls back to read-modify-write
  if the RPC is missing, but the RPC prevents races on concurrent webhooks.

The Edge Function expects `user_profiles.credit_balance` to exist. If your
schema uses a different column, update `grant_credits` and the fallback
read-modify-write block in `payments-toss/index.ts`.

## 5. Deploy the Edge Function

```
supabase functions deploy payments-toss
```

Endpoint: `https://<project>.supabase.co/functions/v1/payments-toss`

## 6. Configure the Toss webhook (optional but recommended)

In Toss console **상점관리 → 웹훅**:

- URL: `https://<project>.supabase.co/functions/v1/payments-toss?action=webhook`
- Custom header: `X-Toss-Webhook-Secret: <the value you set in step 3>`
- Events: `Payment.DONE`, `Payment.CANCELED`, `Payment.PARTIAL_CANCELED`,
  `Payment.EXPIRED`, `Payment.ABORTED`

Without webhook the happy path still works (success page calls the confirm
action synchronously), but late-arriving cancellations / refunds won't update
the `payments` table automatically.

## 7. Keeping packages in sync

Two files hold the package list:

- `src/pages/credit-purchase/packages.ts` — display data (icons, badges)
- `supabase/functions/_shared/credit_packages.ts` — server-truth `amount` /
  `credits` (what the Edge Function will charge / grant)

Whenever you change pricing, update **both**. The Edge Function rejects any
order whose `package_id` is missing from its own list, so the server is the
final guardrail.

## 8. Testing the flow

1. Sign in as a real user (Toss requires `customerEmail`).
2. Go to `/credit-purchase`, pick a package, click 결제하기.
3. Toss test card: card number `4242 4242 4242 4242`, any future expiry,
   any CVC, any password.
4. After approval Toss redirects to `/payment/success?paymentKey=...&orderId=...&amount=...`,
   which calls `?action=confirm` and grants credits.
5. To test cancellation: close Toss's popup → redirected to `/payment/fail?code=PAY_PROCESS_CANCELED`.

## 9. Monitoring in production

- `audit_logs` table records every successful payment (`action='결제 완료 — 크레딧 지급'`)
  and every webhook event (`action='Toss 웹훅 수신 — ...'`).
- Cross-check Toss console totals with `select sum(amount) from payments where status='done' and created_at > now() - interval '1 day';`
- Failed confirmations leave the row at `status='failed'` with the Toss error
  in `toss_response`. Investigate before manually granting credit.
