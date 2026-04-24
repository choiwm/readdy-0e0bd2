// Self-service account deletion endpoint (PIPA 제36조 — right to erasure).
//
// Flow:
//   POST  /functions/v1/account-delete   { confirm_text: "삭제합니다" }
//
// Actions:
//   1. Verify JWT → get user.
//   2. Require `confirm_text === "삭제합니다"` to prevent accidental delete.
//   3. Write audit log (action = "계정 탈퇴") before the user row disappears.
//   4. supabase.auth.admin.deleteUser(user.id)
//      — triggers ON DELETE CASCADE for user_profiles and any other tables
//        that reference auth.users(id).
//   5. Return { ok: true }. Client signs out.
//
// Note: this is HARD delete. PIPA allows immediate deletion (no grace period
// required). Service provider's 3-month billing retention is handled at DB
// level via `payments` + `audit_logs` — those rows survive because their
// user_id FK is `on delete set null`.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AuthFailure, requireUser } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

const REQUIRED_CONFIRM_TEXT = '삭제합니다';

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

  // Require authenticated user.
  let userId: string;
  let userEmail: string;
  try {
    const user = await requireUser(req);
    userId = user.id;
    userEmail = user.email;
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const confirmText = String(body.confirm_text ?? '').trim();
  if (confirmText !== REQUIRED_CONFIRM_TEXT) {
    return err('confirm_text_mismatch', 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Audit FIRST — if the delete succeeds the user row is gone but the log
  // survives with admin_email='system' so we can prove compliance.
  try {
    await supabase.from('audit_logs').insert({
      admin_email: 'system',
      action: '계정 탈퇴 (사용자 자가 요청)',
      target_type: 'user',
      target_id: userId,
      target_label: userEmail,
      detail: 'PIPA 제36조에 따른 자가 삭제',
      result: 'success',
    });
  } catch (e) {
    console.warn('[account-delete] audit log failed:', e);
  }

  // Delete the auth user. This cascades to user_profiles and any table with
  // `user_id uuid references auth.users on delete cascade`.
  const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error('[account-delete] auth.admin.deleteUser failed:', delErr);
    // Audit the failure so ops can investigate.
    try {
      await supabase.from('audit_logs').insert({
        admin_email: 'system',
        action: '계정 탈퇴 실패',
        target_type: 'user',
        target_id: userId,
        target_label: userEmail,
        detail: delErr.message,
        result: 'failure',
      });
    } catch { /* ignore */ }
    return err('delete_failed', 500);
  }

  return json({ ok: true });
});
