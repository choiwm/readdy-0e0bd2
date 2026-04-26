// deno-lint-ignore-file no-explicit-any
//
// TossPayments integration — single function with action-based routing.
//
// Actions:
//   POST  ?action=create_order   { package_id }
//                                → { order_id, amount, credits, customer_name, customer_email }
//   POST  ?action=confirm        { paymentKey, orderId, amount }
//                                → { ok: true, credits_granted, new_balance }
//   POST  ?action=webhook         (Toss webhook payload)
//                                → 200 OK
//
// Security model:
//   - create_order/confirm: require authenticated user (JWT).
//   - confirm: re-validates amount against the DB row (server-truth amount must
//     match Toss's amount, which must match what we created). Three-way check
//     stops a tampered client from buying Studio at Starter price.
//   - confirm: idempotent — second call on a 'done' row returns the same result.
//   - webhook: require shared secret in X-Toss-Webhook-Secret header (set
//     TOSS_WEBHOOK_SECRET env var and configure Toss console to send it).
//   - The Toss SECRET key never leaves Edge Function env (TOSS_SECRET_KEY).
//
// Setup:
//   1. supabase secrets set TOSS_SECRET_KEY=test_sk_xxx (use live_sk_ for prod)
//   2. supabase secrets set TOSS_WEBHOOK_SECRET=<random-32-bytes>
//   3. (Optional) configure webhook URL in Toss console:
//      https://<project>.supabase.co/functions/v1/payments-toss?action=webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  AuthFailure,
  requireUser,
  withAuth,
  type AuthedUser,
} from '../_shared/auth.ts';
import { getPackageById } from '../_shared/credit_packages.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';

// File-scope helper: all handler functions below are defined at module level
// (not inside the Deno.serve closure) so they cannot capture a per-request
// `buildCorsHeaders(req)` via closure. Instead every call site passes `req`
// explicitly as the third arg.
function jsonResponse(data: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function getAdminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
  }
  return createClient(url, serviceKey);
}

function getTossSecretKey(): string {
  const key = Deno.env.get('TOSS_SECRET_KEY');
  if (!key) throw new Error('TOSS_SECRET_KEY not configured');
  return key;
}

// Toss confirm API requires Basic auth: base64("<secret>:")
function tossAuthHeader(): string {
  const secret = getTossSecretKey();
  // Deno-compatible base64 encoding
  const b64 = btoa(`${secret}:`);
  return `Basic ${b64}`;
}

// Constant-time string compare for the webhook secret.
function secureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleCreateOrder(req: Request, user: AuthedUser): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const packageId = String(body.package_id ?? '').trim();
  if (!packageId) return jsonResponse({ error: 'package_id required' }, 400, req);

  const pkg = getPackageById(packageId);
  if (!pkg) return jsonResponse({ error: 'unknown package' }, 400, req);

  const supabase = getAdminClient();

  // Rate-limit order creation to stop a tampered client from spamming pending
  // rows and cluttering the `payments` table / Toss merchant dashboard.
  const rl = await checkRateLimit(supabase, {
    bucket: `payments-create-order:${user.id}`,
    ...POLICIES.paymentsCreateOrder,
  });
  if (!rl.ok) return rateLimitedResponse(rl.resetAt, buildCorsHeaders(req));

  // Generate a unique order_id. Toss requires alphanumeric + '-_' only,
  // length 6–64. We use ts + random for uniqueness + grep-ability.
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const orderId = `cr_${ts}_${rand}`;

  const { error: insertErr } = await supabase.from('payments').insert({
    order_id: orderId,
    user_id: user.id,
    package_id: pkg.id,
    amount: pkg.amount,
    credits: pkg.credits,
    status: 'pending',
  });
  if (insertErr) {
    console.error('[payments-toss] insert pending payment failed:', insertErr);
    return jsonResponse({ error: 'db_error' }, 500, req);
  }

  // Lookup the user's display name for Toss order naming.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  return jsonResponse({
    order_id: orderId,
    amount: pkg.amount,
    credits: pkg.credits,
    order_name: `${pkg.name} — ${pkg.credits.toLocaleString()} CR`,
    customer_email: user.email,
    customer_name: profile?.display_name ?? user.email.split('@')[0],
  }, 200, req);
}

async function handleConfirm(req: Request, user: AuthedUser): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const paymentKey = String(body.paymentKey ?? '').trim();
  const orderId = String(body.orderId ?? '').trim();
  const amount = Number(body.amount);

  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return jsonResponse({ error: 'paymentKey, orderId, amount required' }, 400, req);
  }

  const supabase = getAdminClient();

  // 1) Look up our pending row — server-truth amount.
  const { data: payment, error: selectErr } = await supabase
    .from('payments')
    .select('id, user_id, package_id, amount, credits, status')
    .eq('order_id', orderId)
    .maybeSingle();

  if (selectErr || !payment) {
    return jsonResponse({ error: 'order_not_found' }, 404, req);
  }
  if (payment.user_id !== user.id) {
    return jsonResponse({ error: 'forbidden' }, 403, req);
  }

  // Idempotency: if already confirmed, just return.
  if (payment.status === 'done') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('credit_balance')
      .eq('id', user.id)
      .maybeSingle();
    return jsonResponse({
      ok: true,
      already_confirmed: true,
      credits_granted: payment.credits,
      new_balance: profile?.credit_balance ?? null,
    }, 200, req);
  }
  if (payment.status !== 'pending') {
    return jsonResponse({ error: `payment_status_${payment.status}` }, 409, req);
  }

  // 2) The amount the client claimed AND the amount in our DB must match.
  if (payment.amount !== amount) {
    console.warn('[payments-toss] amount mismatch', { orderId, db: payment.amount, client: amount });
    return jsonResponse({ error: 'amount_mismatch' }, 400, req);
  }

  // 3) Call Toss confirm API — Toss is the final source of truth.
  let tossData: any;
  try {
    // Toss confirm 은 결제 흐름의 마지막 진실의 원천이라 hang 하면 사용자가
    // 무한 로딩 후 새로고침 → 같은 paymentKey 로 재시도 → idempotency 처리는
    // toss 가 알아서 한다 해도 UX 가 깨져요. 25 초 타임아웃 (Toss SLA 평균
    // < 5s, p99 < 15s).
    const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': tossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(25_000),
    });
    tossData = await res.json();
    if (!res.ok) {
      console.error('[payments-toss] Toss confirm failed', tossData);
      await supabase.from('payments').update({
        status: 'failed',
        toss_response: tossData,
      }).eq('id', payment.id);
      return jsonResponse({
        error: 'toss_confirm_failed',
        toss_code: tossData?.code,
        toss_message: tossData?.message,
      }, 400, req);
    }
  } catch (e) {
    console.error('[payments-toss] Toss confirm network error', e);
    return jsonResponse({ error: 'toss_network_error' }, 502, req);
  }

  // 4) Toss accepted — credit the user atomically via RPC and mark done.
  //    NOTE: requires a Postgres function `grant_credits(p_user_id uuid, p_amount int)`
  //    that does `update user_profiles set credit_balance = credit_balance + p_amount`
  //    and returns the new balance. Falls back to read-modify-write if RPC missing.
  let newBalance: number | null = null;
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('grant_credits', {
    p_user_id: user.id,
    p_amount: payment.credits,
  });
  if (rpcErr) {
    console.warn('[payments-toss] grant_credits RPC missing, falling back to read-modify-write:', rpcErr.message);
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('credit_balance')
      .eq('id', user.id)
      .maybeSingle();
    const current = profile?.credit_balance ?? 0;
    newBalance = current + payment.credits;
    await supabase
      .from('user_profiles')
      .update({ credit_balance: newBalance })
      .eq('id', user.id);
  } else {
    newBalance = typeof rpcResult === 'number' ? rpcResult : null;
  }

  await supabase.from('payments').update({
    status: 'done',
    payment_key: paymentKey,
    payment_method: tossData?.method ?? null,
    toss_response: tossData,
    approved_at: new Date().toISOString(),
  }).eq('id', payment.id);

  // Audit log (system-attributed since this is a user-driven payment, not an
  // admin action — admin_email = 'system' marks the source).
  try {
    await supabase.from('audit_logs').insert({
      admin_email: 'system',
      action: '결제 완료 — 크레딧 지급',
      target_type: 'payment',
      target_id: orderId,
      target_label: `${user.email} · ${payment.package_id} (${payment.credits} CR)`,
      detail: `paymentKey=${paymentKey} amount=${amount} method=${tossData?.method ?? '-'}`,
      result: 'success',
    });
  } catch (e) {
    console.warn('[payments-toss] audit log failed:', e);
  }

  return jsonResponse({
    ok: true,
    credits_granted: payment.credits,
    new_balance: newBalance,
  }, 200, req);
}

async function handleWebhook(req: Request): Promise<Response> {
  // Validate shared secret header.
  const expected = Deno.env.get('TOSS_WEBHOOK_SECRET');
  if (!expected) {
    console.error('[payments-toss] TOSS_WEBHOOK_SECRET not set — webhook disabled');
    return jsonResponse({ error: 'webhook_not_configured' }, 503, req);
  }
  const received = req.headers.get('x-toss-webhook-secret') ?? '';
  if (!secureEquals(received, expected)) {
    return jsonResponse({ error: 'unauthorized' }, 401, req);
  }

  const payload = await req.json().catch(() => ({}));
  const eventType: string | undefined = payload?.eventType;
  const data = payload?.data ?? payload;
  const orderId: string | undefined = data?.orderId;
  const status: string | undefined = data?.status;

  if (!orderId) return jsonResponse({ error: 'orderId required' }, 400, req);

  const supabase = getAdminClient();

  // Map Toss status → our payments.status. We care most about cancellation
  // (CANCELED, PARTIAL_CANCELED) and failures arriving asynchronously.
  // For now we just record the event; full cancel/refund flow is admin-side.
  const update: Record<string, unknown> = {
    toss_response: payload,
  };
  if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
    update.status = 'cancelled';
  } else if (status === 'EXPIRED' || status === 'ABORTED') {
    update.status = 'failed';
  }

  if (Object.keys(update).length > 0) {
    await supabase.from('payments').update(update).eq('order_id', orderId);
  }

  // Audit trail for visibility.
  try {
    await supabase.from('audit_logs').insert({
      admin_email: 'system',
      action: `Toss 웹훅 수신 — ${eventType ?? 'unknown'}`,
      target_type: 'payment',
      target_id: orderId,
      target_label: `status=${status ?? '-'}`,
      detail: JSON.stringify(payload).slice(0, 1000),
      result: 'success',
    });
  } catch (e) {
    console.warn('[payments-toss] webhook audit failed:', e);
  }

  return jsonResponse({ ok: true }, 200, req);
}

// ── Entry point ──────────────────────────────────────────────────────────────

Deno.serve((req) => withAuth(async () => {
  if (req.method === 'OPTIONS') return handlePreflight(req);
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, req);

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? '';

  // Webhook does NOT require user auth — it's authenticated by the shared secret.
  if (action === 'webhook') {
    return await handleWebhook(req);
  }

  // Other actions require an authenticated user.
  let user: AuthedUser;
  try {
    user = await requireUser(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  if (action === 'create_order') return await handleCreateOrder(req, user);
  if (action === 'confirm')      return await handleConfirm(req, user);

  return jsonResponse({ error: 'unknown action' }, 400, req);
}));
