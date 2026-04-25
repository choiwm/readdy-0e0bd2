import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  const err = (msg: string, status = 400) => json({ error: msg }, status);
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
  const action = url.searchParams.get('action') ?? 'check_and_notify';

  try {

    // ── POST: 크레딧 알림 체크 & 인앱 알림 저장 ─────────────────────
    if (req.method === 'POST' && action === 'check_and_notify') {
      const body = await req.json();
      const { user_id, current_balance, max_balance } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id || current_balance === undefined) return err('user_id and current_balance required');

      const { data: settings } = await supabase
        .from('credit_alert_settings')
        .select('*')
        .eq('user_id', user_id)
        .maybeSingle();

      if (!settings || !settings.email_enabled) {
        return json({ sent: false, reason: 'notification_disabled_or_no_settings' });
      }

      if (settings.last_alerted_at) {
        const lastAlerted = new Date(settings.last_alerted_at);
        const cooldownMs = (settings.alert_cooldown_hours ?? 24) * 60 * 60 * 1000;
        if (Date.now() - lastAlerted.getTime() < cooldownMs) {
          return json({ sent: false, reason: 'cooldown_active' });
        }
      }

      const pct = max_balance > 0 ? (current_balance / max_balance) * 100 : 0;
      let shouldAlert = false;
      let alertType: 'pct' | 'amount' = 'pct';

      if (settings.alert_on_pct && pct <= settings.threshold_pct) { shouldAlert = true; alertType = 'pct'; }
      else if (settings.alert_on_amount && current_balance <= settings.threshold_amount) { shouldAlert = true; alertType = 'amount'; }

      if (!shouldAlert) return json({ sent: false, reason: 'threshold_not_reached', current_pct: Math.round(pct) });

      const alertDesc = alertType === 'pct'
        ? `크레딧 잔액이 ${settings.threshold_pct}% 이하로 떨어졌습니다.`
        : `크레딧 잔액이 ${settings.threshold_amount} CR 이하로 떨어졌습니다.`;

      const { error: insertError } = await supabase.from('notifications').insert({
        user_id,
        type: 'credit_alert',
        title: '크레딧이 부족합니다',
        message: `현재 잔액: ${current_balance.toLocaleString()} CR — ${alertDesc} 지금 충전하여 서비스를 계속 이용하세요.`,
        data: { current_balance, alert_type: alertType, threshold_pct: settings.threshold_pct, threshold_amount: settings.threshold_amount, action_url: '/credit-purchase' },
      });

      if (insertError) return json({ sent: false, reason: 'db_insert_failed', detail: insertError.message });

      await supabase.from('credit_alert_settings')
        .update({ last_alerted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', user_id);

      return json({ sent: true, type: 'in_app', user_id });
    }

    // ── POST: 생성 시작 알림 저장 (진행 중) ──────────────────────────
    if (req.method === 'POST' && action === 'generation_in_progress') {
      const body = await req.json();
      const { user_id, generation_type, model_name, client_job_id } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id || !generation_type) return err('user_id and generation_type required');

      const typeLabels: Record<string, string> = {
        image: '이미지',
        video: '영상',
        music: '음악',
        tts: 'TTS 음성',
        sfx: '효과음',
        transcribe: '음성 전사',
        clean: '오디오 클린',
      };
      const label = typeLabels[generation_type] ?? generation_type;

      const { data, error } = await supabase.from('notifications').insert({
        user_id,
        type: 'generation_in_progress',
        title: `${label} 생성 중...`,
        message: `${model_name ? `[${model_name}] ` : ''}${label}을(를) 생성하고 있습니다. 완료되면 알림이 업데이트됩니다.`,
        data: {
          generation_type,
          model_name,
          client_job_id: client_job_id ?? null,
          status: 'in_progress',
          action_url: generation_type === 'image' ? '/ai-create' : '/ai-sound',
        },
        is_read: false,
      }).select('id').maybeSingle();

      if (error) return err(error.message);
      return json({ sent: true, notification_id: data?.id });
    }

    // ── POST: 생성 완료 알림 업데이트 (진행 중 → 완료) ───────────────
    if (req.method === 'POST' && action === 'generation_complete') {
      const body = await req.json();
      const { user_id, generation_type, model_name, credits_used, result_url, action_url, notification_id } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id || !generation_type) return err('user_id and generation_type required');

      const typeLabels: Record<string, string> = {
        image: '이미지',
        video: '영상',
        music: '음악',
        tts: 'TTS 음성',
        sfx: '효과음',
        transcribe: '음성 전사',
        clean: '오디오 클린',
      };
      const label = typeLabels[generation_type] ?? generation_type;

      // 기존 진행 중 알림이 있으면 업데이트, 없으면 새로 삽입
      if (notification_id) {
        const { error } = await supabase.from('notifications').update({
          type: 'generation_complete',
          title: `${label} 생성 완료`,
          message: `${model_name ? `[${model_name}] ` : ''}${label} 생성이 완료됐습니다.${credits_used ? ` ${credits_used} CR 사용됨.` : ''}`,
          data: {
            generation_type,
            model_name,
            credits_used,
            result_url,
            status: 'complete',
            action_url: action_url ?? (generation_type === 'image' ? '/ai-create' : '/ai-sound'),
          },
          is_read: false,
        }).eq('id', notification_id).eq('user_id', user_id);

        if (error) return err(error.message);
        return json({ sent: true, type: 'generation_complete', updated: true, notification_id });
      }

      // 진행 중 알림 ID 없으면 새로 삽입
      const { error } = await supabase.from('notifications').insert({
        user_id,
        type: 'generation_complete',
        title: `${label} 생성 완료`,
        message: `${model_name ? `[${model_name}] ` : ''}${label} 생성이 완료됐습니다.${credits_used ? ` ${credits_used} CR 사용됨.` : ''}`,
        data: {
          generation_type,
          model_name,
          credits_used,
          result_url,
          status: 'complete',
          action_url: action_url ?? (generation_type === 'image' ? '/ai-create' : '/ai-sound'),
        },
      });

      if (error) return err(error.message);
      return json({ sent: true, type: 'generation_complete', updated: false });
    }

    // ── POST: 생성 실패 알림 업데이트 ────────────────────────────────
    if (req.method === 'POST' && action === 'generation_failed') {
      const body = await req.json();
      const { user_id, generation_type, model_name, error_message, notification_id } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id || !generation_type) return err('user_id and generation_type required');

      const typeLabels: Record<string, string> = {
        image: '이미지', video: '영상', music: '음악', tts: 'TTS 음성', sfx: '효과음', transcribe: '음성 전사', clean: '오디오 클린',
      };
      const label = typeLabels[generation_type] ?? generation_type;

      if (notification_id) {
        const { error } = await supabase.from('notifications').update({
          type: 'generation_failed',
          title: `${label} 생성 실패`,
          message: `${model_name ? `[${model_name}] ` : ''}${label} 생성 중 오류가 발생했습니다.${error_message ? ` (${error_message})` : ''}`,
          data: {
            generation_type,
            model_name,
            status: 'failed',
            error_message,
            action_url: generation_type === 'image' ? '/ai-create' : '/ai-sound',
          },
          is_read: false,
        }).eq('id', notification_id).eq('user_id', user_id);

        if (error) return err(error.message);
        return json({ sent: true, type: 'generation_failed', notification_id });
      }

      return json({ sent: false, reason: 'no_notification_id' });
    }

    // ── POST: 시스템 공지사항 브로드캐스트 (관리자 전용) ─────────────
    if (req.method === 'POST' && action === 'broadcast_notice') {
      const body = await req.json();
      const { title, message, notice_type, action_url, target_user_ids } = body;
      if (!title || !message) return err('title and message required');

      let userIds: string[] = [];

      if (target_user_ids && Array.isArray(target_user_ids) && target_user_ids.length > 0) {
        userIds = target_user_ids;
      } else {
        const { data: users } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1000);
        userIds = (users ?? []).map((u: { id: string }) => u.id);
      }

      if (userIds.length === 0) return json({ sent: false, reason: 'no_users' });

      const rows = userIds.map((uid) => ({
        user_id: uid,
        type: notice_type ?? 'system_notice',
        title,
        message,
        data: { action_url: action_url ?? null, broadcast: true },
      }));

      let totalInserted = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from('notifications').insert(batch);
        if (!error) totalInserted += batch.length;
      }

      return json({ sent: true, total_sent: totalInserted, user_count: userIds.length });
    }

    // ── POST: 환영 알림 (신규 가입자) ────────────────────────────────
    if (req.method === 'POST' && action === 'send_welcome') {
      const body = await req.json();
      const { user_id, display_name } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id) return err('user_id required');

      const name = display_name ?? '사용자';
      const { error } = await supabase.from('notifications').insert({
        user_id,
        type: 'welcome',
        title: `환영합니다, ${name}님! 🎉`,
        message: 'AiMetaWOW에 오신 것을 환영합니다! AI 이미지, 영상, 음악, 음성 생성을 자유롭게 즐겨보세요. 신규 가입 보너스 크레딧이 지급됐습니다.',
        data: { action_url: '/ai-create', is_welcome: true },
      });

      if (error) return err(error.message);
      return json({ sent: true, type: 'welcome' });
    }

    // ── GET: 사용자 알림 목록 조회 ────────────────────────────────────
    if (req.method === 'GET' && action === 'get_notifications') {
      const userId = url.searchParams.get('user_id');
      if (!userId) return err('user_id required');

      const limit = parseInt(url.searchParams.get('limit') ?? '30', 10);
      const typeFilter = url.searchParams.get('type');
      const onlyUnread = url.searchParams.get('unread_only') === 'true';

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (onlyUnread) query = query.eq('is_read', false);
      if (typeFilter) query = query.eq('type', typeFilter);

      const { data, error } = await query;
      if (error) return err(error.message);

      const unreadCount = data?.filter((n) => !n.is_read).length ?? 0;
      return json({ notifications: data ?? [], unread_count: unreadCount });
    }

    // ── POST: 알림 읽음 처리 ──────────────────────────────────────────
    if (req.method === 'POST' && action === 'mark_read') {
      const body = await req.json();
      const { user_id, notification_id, mark_all, type_filter } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id) return err('user_id required');

      if (mark_all) {
        let query = supabase.from('notifications').update({ is_read: true }).eq('user_id', user_id).eq('is_read', false);
        if (type_filter) query = query.eq('type', type_filter);
        const { error } = await query;
        if (error) return err(error.message);
        return json({ success: true, marked: 'all' });
      }

      if (!notification_id) return err('notification_id required');
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notification_id).eq('user_id', user_id);
      if (error) return err(error.message);
      return json({ success: true, marked: notification_id });
    }

    // ── POST: 알림 삭제 ───────────────────────────────────────────────
    if (req.method === 'POST' && action === 'delete') {
      const body = await req.json();
      const { user_id, notification_id, delete_all, type_filter } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id) return err('user_id required');

      if (delete_all) {
        let query = supabase.from('notifications').delete().eq('user_id', user_id);
        if (type_filter) query = query.eq('type', type_filter);
        const { error } = await query;
        if (error) return err(error.message);
        return json({ success: true, deleted: 'all' });
      }

      if (!notification_id) return err('notification_id required');
      const { error } = await supabase.from('notifications').delete().eq('id', notification_id).eq('user_id', user_id);
      if (error) return err(error.message);
      return json({ success: true, deleted: notification_id });
    }

    // ── GET: 사용자 알림 설정 조회 ────────────────────────────────────
    if (req.method === 'GET' && action === 'get_settings') {
      const userId = url.searchParams.get('user_id');
      if (!userId) return err('user_id required');
      const { data, error } = await supabase.from('credit_alert_settings').select('*').eq('user_id', userId).maybeSingle();
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

      const { data, error } = await supabase.from('notifications_settings' in supabase ? 'notifications_settings' : 'credit_alert_settings').upsert(upsertData, { onConflict: 'user_id' }).select().maybeSingle();
      if (error) {
        // fallback
        const { data: d2, error: e2 } = await supabase.from('credit_alert_settings').upsert(upsertData, { onConflict: 'user_id' }).select().maybeSingle();
        if (e2) return err(e2.message);
        return json({ success: true, settings: d2 });
      }
      return json({ success: true, settings: data });
    }

    // ── GET: 관리자용 - 전체 알림 현황 ───────────────────────────────
    if (req.method === 'GET' && action === 'admin_stats') {
      const { data: settingsData } = await supabase.from('credit_alert_settings').select('email_enabled, alert_on_pct, alert_on_amount, last_alerted_at');
      const { data: notifData } = await supabase.from('notifications').select('created_at, is_read, type');

      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const byType: Record<string, number> = {};
      (notifData ?? []).forEach((n) => { byType[n.type] = (byType[n.type] ?? 0) + 1; });

      const stats = {
        total_configured: settingsData?.length ?? 0,
        notification_enabled: settingsData?.filter((s) => s.email_enabled).length ?? 0,
        alerted_today: notifData?.filter((n) => n.created_at.startsWith(today)).length ?? 0,
        alerted_this_week: notifData?.filter((n) => n.created_at >= weekAgo).length ?? 0,
        total_notifications: notifData?.length ?? 0,
        unread_notifications: notifData?.filter((n) => !n.is_read).length ?? 0,
        by_type: byType,
      };

      return json({ stats });
    }

    // ── POST: 관리자용 - 수동 테스트 알림 발송 ───────────────────────
    if (req.method === 'POST' && action === 'admin_test_send') {
      const body = await req.json();
      const { user_id, test_type } = body;
      if (user_id && user_id !== authedUserId) return err('forbidden', 403);
      if (!user_id) return err('user_id required');

      const { data: profile } = await supabase.from('user_profiles').select('email, display_name, credit_balance').eq('id', user_id).maybeSingle();
      if (!profile) return err('User not found');

      const typeMap: Record<string, { type: string; title: string; message: string; data: Record<string, unknown> }> = {
        credit_alert: {
          type: 'credit_alert',
          title: '[테스트] 크레딧 부족 알림',
          message: `현재 잔액: ${(profile.credit_balance ?? 0).toLocaleString()} CR — 이것은 관리자가 발송한 테스트 알림입니다.`,
          data: { current_balance: profile.credit_balance ?? 0, alert_type: 'test', action_url: '/credit-purchase', is_test: true },
        },
        system_notice: {
          type: 'system_notice',
          title: '[테스트] 시스템 공지사항',
          message: '이것은 테스트 공지사항입니다. 실제 공지사항은 관리자 패널에서 발송할 수 있습니다.',
          data: { action_url: null, is_test: true },
        },
        generation_complete: {
          type: 'generation_complete',
          title: '[테스트] 이미지 생성 완료',
          message: '[Flux Pro] 이미지 생성이 완료됐습니다. 10 CR 사용됨.',
          data: { generation_type: 'image', model_name: 'Flux Pro', credits_used: 10, action_url: '/ai-create', is_test: true },
        },
        generation_in_progress: {
          type: 'generation_in_progress',
          title: '[테스트] 영상 생성 중...',
          message: '[Kling v1] 영상을 생성하고 있습니다. 완료되면 알림이 업데이트됩니다.',
          data: { generation_type: 'video', model_name: 'Kling v1', status: 'in_progress', action_url: '/ai-sound', is_test: true },
        },
        feature_update: {
          type: 'feature_update',
          title: '[테스트] 새 기능 업데이트',
          message: '새로운 AI 모델이 추가됐습니다! 지금 바로 사용해보세요.',
          data: { action_url: '/ai-create', is_test: true },
        },
      };

      const notifData = typeMap[test_type ?? 'credit_alert'] ?? typeMap['credit_alert'];
      const { error } = await supabase.from('notifications').insert({ user_id, ...notifData });
      if (error) return err(error.message);
      return json({ sent: true, user_id, display_name: profile.display_name, test_type: test_type ?? 'credit_alert' });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('credit-alert-notify error:', e);
    return err('Internal server error', 500);
  }
});
