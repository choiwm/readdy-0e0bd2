import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// 이메일 HTML 템플릿 생성
function buildEmailHtml(params: {
  userName: string;
  currentBalance: number;
  thresholdPct: number;
  thresholdAmount: number;
  alertType: 'pct' | 'amount';
  purchaseUrl: string;
}) {
  const { userName, currentBalance, thresholdPct, thresholdAmount, alertType, purchaseUrl } = params;
  const alertDesc = alertType === 'pct'
    ? `크레딧 잔액이 ${thresholdPct}% 이하로 떨어졌습니다.`
    : `크레딧 잔액이 ${thresholdAmount} CR 이하로 떨어졌습니다.`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>크레딧 부족 알림</title>
</head>
<body style="margin:0;padding:0;background:#09090c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090c;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0f0f13;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
              <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:24px;">⚡</span>
              </div>
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">크레딧 부족 알림</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px;">AiMetaWOW</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px;color:#a1a1aa;font-size:14px;">안녕하세요, <strong style="color:#fff;">${userName}</strong>님</p>
              <p style="margin:0 0 24px;color:#71717a;font-size:14px;line-height:1.6;">${alertDesc}</p>

              <!-- Credit Balance Card -->
              <div style="background:#18181b;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
                <p style="margin:0 0 4px;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1px;">현재 잔액</p>
                <p style="margin:0;color:#f4f4f5;font-size:36px;font-weight:900;letter-spacing:-1px;">${currentBalance.toLocaleString()} <span style="font-size:18px;color:#71717a;">CR</span></p>
              </div>

              <!-- Warning Message -->
              <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;margin-bottom:24px;">
                <p style="margin:0;color:#fbbf24;font-size:13px;line-height:1.6;">
                  ⚠️ 크레딧이 부족하면 AI 이미지 생성, 음악 제작, 영상 자동화 등의 기능을 사용할 수 없습니다. 지금 바로 충전하여 서비스를 계속 이용하세요.
                </p>
              </div>

              <!-- Packages -->
              <p style="margin:0 0 12px;color:#a1a1aa;font-size:13px;font-weight:700;">추천 충전 패키지</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:0 4px 0 0;">
                    <div style="background:#18181b;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;text-align:center;">
                      <p style="margin:0 0 2px;color:#6366f1;font-size:11px;font-weight:700;">STARTER</p>
                      <p style="margin:0 0 2px;color:#f4f4f5;font-size:18px;font-weight:900;">1,000 CR</p>
                      <p style="margin:0;color:#71717a;font-size:11px;">₩9,900</p>
                    </div>
                  </td>
                  <td style="padding:0 4px;">
                    <div style="background:#18181b;border:1px solid rgba(99,102,241,0.4);border-radius:10px;padding:14px;text-align:center;">
                      <p style="margin:0 0 2px;color:#6366f1;font-size:11px;font-weight:700;">BASIC ⭐</p>
                      <p style="margin:0 0 2px;color:#f4f4f5;font-size:18px;font-weight:900;">3,000 CR</p>
                      <p style="margin:0;color:#71717a;font-size:11px;">₩24,900</p>
                    </div>
                  </td>
                  <td style="padding:0 0 0 4px;">
                    <div style="background:#18181b;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:14px;text-align:center;">
                      <p style="margin:0 0 2px;color:#f59e0b;font-size:11px;font-weight:700;">PRO</p>
                      <p style="margin:0 0 2px;color:#f4f4f5;font-size:18px;font-weight:900;">10,000 CR</p>
                      <p style="margin:0;color:#71717a;font-size:11px;">₩69,900</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${purchaseUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.3px;">
                      지금 크레딧 충전하기 →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
              <p style="margin:0 0 4px;color:#52525b;font-size:11px;">이 이메일은 AiMetaWOW 크레딧 알림 설정에 의해 발송됐습니다.</p>
              <p style="margin:0;color:#52525b;font-size:11px;">알림을 받고 싶지 않으시면 <a href="${purchaseUrl.replace('/credit-purchase', '/settings')}" style="color:#6366f1;text-decoration:none;">설정에서 해제</a>하세요.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let authedUserId: string;
  try {
    const authed = await requireUser(req);
    authedUserId = authed.id;
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'check_and_send';

  try {
    // ── POST: 크레딧 알림 체크 & 발송 ────────────────────────────────
    if (req.method === 'POST' && action === 'check_and_send') {
      const body = await req.json();
      const { user_id, current_balance, max_balance } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);

      if (!user_id || current_balance === undefined) {
        return err('user_id and current_balance required');
      }

      // 사용자 알림 설정 조회
      const { data: settings } = await supabase
        .from('credit_alert_settings')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle();

      // 설정이 없거나 이메일 알림 비활성화면 스킵
      if (!settings || !settings.email_enabled) {
        return json({ sent: false, reason: 'email_disabled_or_no_settings' });
      }

      // 쿨다운 체크 (마지막 알림 후 N시간 이내면 스킵)
      if (settings.last_alerted_at) {
        const lastAlerted = new Date(settings.last_alerted_at);
        const cooldownMs = (settings.alert_cooldown_hours ?? 24) * 60 * 60 * 1000;
        if (Date.now() - lastAlerted.getTime() < cooldownMs) {
          return json({ sent: false, reason: 'cooldown_active', next_alert_at: new Date(lastAlerted.getTime() + cooldownMs).toISOString() });
        }
      }

      // 임계값 체크
      const pct = max_balance > 0 ? (current_balance / max_balance) * 100 : 0;
      let shouldAlert = false;
      let alertType: 'pct' | 'amount' = 'pct';

      if (settings.alert_on_pct && pct <= settings.threshold_pct) {
        shouldAlert = true;
        alertType = 'pct';
      } else if (settings.alert_on_amount && current_balance <= settings.threshold_amount) {
        shouldAlert = true;
        alertType = 'amount';
      }

      if (!shouldAlert) {
        return json({ sent: false, reason: 'threshold_not_reached', current_pct: Math.round(pct) });
      }

      // 사용자 이메일 조회
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, display_name')
        .eq('id', user_id)
        .maybeSingle();

      if (!profile?.email) {
        return json({ sent: false, reason: 'no_email' });
      }

      const userName = profile.display_name ?? profile.email.split('@')[0];
      const siteUrl = Deno.env.get('SITE_URL') ?? 'https://aimetawow.com';
      const purchaseUrl = `${siteUrl}/credit-purchase`;

      // 이메일 발송 (Resend API 사용)
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        // Resend 키 없으면 로그만 남기고 성공 처리 (개발 환경)
        console.log(`[Credit Alert] Would send email to ${profile.email}: balance=${current_balance}`);
        
        // last_alerted_at 업데이트
        await supabase
          .from('credit_alert_settings')
          .update({ last_alerted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('user_id', user_id);

        return json({ sent: true, simulated: true, email: profile.email });
      }

      const emailHtml = buildEmailHtml({
        userName,
        currentBalance: current_balance,
        thresholdPct: settings.threshold_pct,
        thresholdAmount: settings.threshold_amount,
        alertType,
        purchaseUrl,
      });

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AiMetaWOW <noreply@aimetawow.com>',
          to: [profile.email],
          subject: `⚡ 크레딧이 부족합니다 — 현재 ${current_balance.toLocaleString()} CR`,
          html: emailHtml,
        }),
      });

      const emailResult = await emailRes.json();

      if (!emailRes.ok) {
        console.error('Resend error:', emailResult);
        return json({ sent: false, reason: 'email_send_failed', detail: emailResult });
      }

      // last_alerted_at 업데이트
      await supabase
        .from('credit_alert_settings')
        .update({ last_alerted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', user_id);

      return json({ sent: true, email: profile.email, resend_id: emailResult.id });
    }

    // ── GET: 사용자 알림 설정 조회 ────────────────────────────────────
    if (req.method === 'GET' && action === 'get_settings') {
      const userId = url.searchParams.get('user_id');
      if (!userId) return err('user_id required');

      const { data, error } = await supabase
        .from('credit_alert_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) return err(error.message);
      return json({ settings: data });
    }

    // ── POST: 사용자 알림 설정 저장/업데이트 ─────────────────────────
    if (req.method === 'POST' && action === 'save_settings') {
      const body = await req.json();
      const { user_id, threshold_pct, threshold_amount, alert_on_pct, alert_on_amount, email_enabled, alert_cooldown_hours } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);

      if (!user_id) return err('user_id required');

      const upsertData = {
        user_id,
        threshold_pct: threshold_pct ?? 20,
        threshold_amount: threshold_amount ?? 100,
        alert_on_pct: alert_on_pct ?? true,
        alert_on_amount: alert_on_amount ?? false,
        email_enabled: email_enabled ?? true,
        alert_cooldown_hours: alert_cooldown_hours ?? 24,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('credit_alert_settings')
        .upsert(upsertData, { onConflict: 'user_id' })
        .select()
        .maybeSingle();

      if (error) return err(error.message);
      return json({ success: true, settings: data });
    }

    // ── GET: 관리자용 - 전체 알림 발송 현황 ──────────────────────────
    if (req.method === 'GET' && action === 'admin_stats') {
      const { data, error } = await supabase
        .from('credit_alert_settings')
        .select('email_enabled, alert_on_pct, alert_on_amount, last_alerted_at, threshold_pct, threshold_amount');

      if (error) return err(error.message);

      const stats = {
        total_configured: data?.length ?? 0,
        email_enabled: data?.filter((s) => s.email_enabled).length ?? 0,
        alerted_today: data?.filter((s) => {
          if (!s.last_alerted_at) return false;
          const today = new Date().toISOString().slice(0, 10);
          return s.last_alerted_at.startsWith(today);
        }).length ?? 0,
        alerted_this_week: data?.filter((s) => {
          if (!s.last_alerted_at) return false;
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          return s.last_alerted_at >= weekAgo;
        }).length ?? 0,
      };

      return json({ stats });
    }

    // ── POST: 관리자용 - 수동 테스트 이메일 발송 ─────────────────────
    if (req.method === 'POST' && action === 'admin_test_send') {
      const body = await req.json();
      const { user_id } = body;
      if (!user_id) return err('user_id required');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, display_name, credit_balance')
        .eq('id', user_id)
        .maybeSingle();

      if (!profile?.email) return err('User email not found');

      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        return json({ sent: false, reason: 'RESEND_API_KEY not configured', email: profile.email });
      }

      const siteUrl = Deno.env.get('SITE_URL') ?? 'https://aimetawow.com';
      const emailHtml = buildEmailHtml({
        userName: profile.display_name ?? profile.email.split('@')[0],
        currentBalance: profile.credit_balance ?? 0,
        thresholdPct: 20,
        thresholdAmount: 100,
        alertType: 'pct',
        purchaseUrl: `${siteUrl}/credit-purchase`,
      });

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'AiMetaWOW <noreply@aimetawow.com>',
          to: [profile.email],
          subject: `[테스트] ⚡ 크레딧 부족 알림 테스트`,
          html: emailHtml,
        }),
      });

      const result = await emailRes.json();
      return json({ sent: emailRes.ok, email: profile.email, result });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('credit-alert-email error:', e);
    return err('Internal server error', 500);
  }
});
