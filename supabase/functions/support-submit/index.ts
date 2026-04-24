// Public-facing support endpoint. Accepts form submissions from:
//   - /customer-support         → kind='inquiry'
//   - AI Shortcuts Pro upgrade  → kind='plan_upgrade'
//   - /my/payments refund       → kind='refund'  (authenticated only)
//   - Footer newsletter         → kind='newsletter'
//
// All entries land in `cs_tickets` (except newsletter → `newsletter_subscribers`)
// so the existing admin CS tab surfaces everything without new tooling.
//
// Security: rate-limited by IP+email to stop spam. `refund` additionally
// requires a valid JWT; the other kinds accept unauthenticated submissions so
// logged-out visitors can still reach support.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight, isOriginAllowed } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse } from '../_shared/rateLimit.ts';

type Kind = 'inquiry' | 'plan_upgrade' | 'refund' | 'newsletter';

const ALLOWED_KINDS: readonly Kind[] = ['inquiry', 'plan_upgrade', 'refund', 'newsletter'];

function getAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  const err = (msg: string, status = 400) => json({ error: msg }, status);

  if (req.method !== 'POST') return err('method_not_allowed', 405);

  // Public endpoints must still respect the CORS allowlist in prod. This
  // guards against cross-origin bot submissions.
  if (!isOriginAllowed(req)) return err('forbidden_origin', 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err('invalid_json', 400);
  }

  const kind = String(body.kind ?? '') as Kind;
  if (!ALLOWED_KINDS.includes(kind)) return err('invalid_kind', 400);

  const supabase = getAdminClient();

  // ── Rate-limit by email (or IP for newsletter) ─────────────────────────────
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !isEmail(email)) return err('invalid_email', 400);
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('cf-connecting-ip')
    ?? 'unknown';
  const rl = await checkRateLimit(supabase, {
    bucket: `support-submit:${kind}:${email}:${clientIp}`,
    max: 5,
    windowSeconds: 600, // 10 min
  });
  if (!rl.ok) return rateLimitedResponse(rl.resetAt, corsHeaders);

  // ── Newsletter branch — different table ────────────────────────────────────
  if (kind === 'newsletter') {
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .upsert({ email, subscribed_at: new Date().toISOString() }, { onConflict: 'email' });
      if (error) {
        console.error('[support-submit] newsletter insert failed:', error);
        return err('db_error', 500);
      }
      return json({ ok: true });
    } catch (e) {
      console.error('[support-submit] newsletter exception:', e);
      return err('db_error', 500);
    }
  }

  // ── Refund requires authenticated user ─────────────────────────────────────
  let userId: string | null = null;
  if (kind === 'refund') {
    try {
      const user = await requireUser(req);
      userId = user.id;
    } catch (e) {
      if (e instanceof AuthFailure) return e.response;
      throw e;
    }
  }

  // ── Ticket fields ──────────────────────────────────────────────────────────
  const name = String(body.name ?? '').trim().slice(0, 100);
  const subject = String(body.subject ?? '').trim().slice(0, 200) || (
    kind === 'plan_upgrade' ? 'Pro 플랜 문의' :
    kind === 'refund'       ? '환불 요청' :
    '일반 문의'
  );
  const message = String(body.message ?? '').trim().slice(0, 5000);
  if (!message) return err('message_required', 400);

  const priority = kind === 'refund' ? 'high' : kind === 'plan_upgrade' ? 'normal' : 'normal';

  try {
    const { data, error } = await supabase
      .from('cs_tickets')
      .insert({
        user_id: userId,
        user_email: email,
        user_name: name || null,
        subject,
        category: kind,           // 'inquiry' | 'plan_upgrade' | 'refund'
        priority,
        status: 'open',
        body: message,
        meta: { ...(body.order_id ? { order_id: body.order_id } : {}) },
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[support-submit] ticket insert failed:', error);
      return err('db_error', 500);
    }
    return json({ ok: true, ticket_id: data?.id ?? null });
  } catch (e) {
    console.error('[support-submit] exception:', e);
    return err('db_error', 500);
  }
});
