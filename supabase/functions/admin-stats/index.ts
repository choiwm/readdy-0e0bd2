import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'overview';

  // ── 관리자 권한 확인 ─────────────────────────────────────────────────
  if (action === 'check_admin') {
    try {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ is_admin: false, reason: 'no_auth_header' });

      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return json({ is_admin: false, reason: 'invalid_token' });

      const { data: adminData, error: adminError } = await supabase
        .from('admin_accounts')
        .select('id, role, is_active')
        .eq('email', user.email ?? '')
        .eq('is_active', true)
        .maybeSingle();

      if (adminError) return json({ is_admin: false, reason: 'db_error', detail: adminError.message });
      if (!adminData) return json({ is_admin: false, reason: 'not_admin' });

      return json({ is_admin: true, role: adminData.role, id: adminData.id });
    } catch (e) {
      return json({ is_admin: false, reason: 'exception', detail: String(e) });
    }
  }

  // 그 외 모든 액션은 관리자만 호출 가능
  try {
    await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  try {
    // ── 전체 Overview 통계 ──────────────────────────────────────────────
    if (req.method === 'GET' && action === 'overview') {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const { data: users } = await supabase
        .from('user_profiles')
        .select('plan, status, created_at');

      const totalUsers    = users?.length ?? 0;
      const activeUsers   = users?.filter((u) => u.status === 'active').length ?? 0;
      const newUsersToday = users?.filter((u) => u.created_at >= todayStart).length ?? 0;
      const newUsersMonth = users?.filter((u) => u.created_at >= thisMonthStart).length ?? 0;

      const planDist = {
        free:       users?.filter((u) => (u.plan ?? 'free').toLowerCase() === 'free').length ?? 0,
        pro:        users?.filter((u) => (u.plan ?? '').toLowerCase() === 'pro').length ?? 0,
        enterprise: users?.filter((u) => (u.plan ?? '').toLowerCase() === 'enterprise').length ?? 0,
      };

      const { data: payments } = await supabase
        .from('payments')
        .select('amount_usd, status, created_at');

      const monthlyRevenue = (payments ?? [])
        .filter((p) => p.status === 'completed' && p.created_at >= thisMonthStart)
        .reduce((sum, p) => sum + (p.amount_usd ?? 0), 0);

      const lastMonthRevenue = (payments ?? [])
        .filter((p) => p.status === 'completed' && p.created_at >= lastMonthStart && p.created_at <= lastMonthEnd)
        .reduce((sum, p) => sum + (p.amount_usd ?? 0), 0);

      const totalRevenue = (payments ?? [])
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + (p.amount_usd ?? 0), 0);

      const { count: galleryCount } = await supabase
        .from('gallery_items')
        .select('*', { count: 'exact', head: true });

      const { count: audioCount } = await supabase
        .from('audio_history')
        .select('*', { count: 'exact', head: true });

      const { count: automationCount } = await supabase
        .from('automation_projects')
        .select('*', { count: 'exact', head: true });

      const { count: boardCount } = await supabase
        .from('board_projects')
        .select('*', { count: 'exact', head: true });

      const totalContent = (galleryCount ?? 0) + (audioCount ?? 0) + (automationCount ?? 0) + (boardCount ?? 0);

      const { data: tickets } = await supabase
        .from('cs_tickets')
        .select('status');

      const openTickets = tickets?.filter((t) => t.status === 'open').length ?? 0;
      const inProgressTickets = tickets?.filter((t) => t.status === 'in_progress').length ?? 0;

      return json({
        users: {
          total: totalUsers,
          active: activeUsers,
          new_today: newUsersToday,
          new_month: newUsersMonth,
          plan_dist: planDist,
        },
        revenue: {
          monthly: monthlyRevenue,
          last_month: lastMonthRevenue,
          total: totalRevenue,
          growth_pct: lastMonthRevenue > 0
            ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
            : 0,
        },
        content: {
          total: totalContent,
          gallery: galleryCount ?? 0,
          audio: audioCount ?? 0,
          automation: automationCount ?? 0,
          board: boardCount ?? 0,
        },
        cs: {
          open: openTickets,
          in_progress: inProgressTickets,
          total: tickets?.length ?? 0,
        },
      });
    }

    // ── API 상태 체크 (usage_logs 기반으로 개선) ──────────────────────
    if (req.method === 'GET' && action === 'api_health') {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last1h  = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // usage_logs에서 서비스별 통계 조회
      const { data: usageLogs } = await supabase
        .from('usage_logs')
        .select('service_slug, action, status, credits_deducted, created_at')
        .gte('created_at', last24h);

      const logs = usageLogs ?? [];

      // 이미지 생성 로그 (generate-image → service_slug: 'fal', action contains '이미지')
      const imageLogs = logs.filter((l) =>
        l.service_slug === 'fal' && (l.action?.includes('이미지') || l.action?.includes('image'))
      );
      const imageSuccess = imageLogs.filter((l) => l.status === 'success').length;
      const imageFailed  = imageLogs.filter((l) => l.status === 'failed').length;
      const imageTotal   = imageLogs.length;
      const imageErrorRate = imageTotal > 0 ? Math.round((imageFailed / imageTotal) * 100 * 10) / 10 : 0;
      const imageLast1h  = imageLogs.filter((l) => l.created_at >= last1h).length;
      const imageToday   = imageLogs.filter((l) => l.created_at >= todayStart).length;

      // 오디오 생성 로그 (TTS, 음악, SFX, 클린 등)
      const audioLogs = logs.filter((l) =>
        l.service_slug === 'fal' && (
          l.action?.includes('TTS') ||
          l.action?.includes('음악') ||
          l.action?.includes('SFX') ||
          l.action?.includes('음성') ||
          l.action?.includes('music') ||
          l.action?.includes('tts')
        )
      );
      const audioFailed = audioLogs.filter((l) => l.status === 'failed').length;
      const audioTotal  = audioLogs.length;
      const audioErrorRate = audioTotal > 0 ? Math.round((audioFailed / audioTotal) * 100 * 10) / 10 : 0;
      const audioLast1h = audioLogs.filter((l) => l.created_at >= last1h).length;
      const audioToday  = audioLogs.filter((l) => l.created_at >= todayStart).length;

      // 영상 생성 로그
      const videoLogs = logs.filter((l) =>
        l.service_slug === 'fal' && (l.action?.includes('영상') || l.action?.includes('video'))
      );
      const videoFailed = videoLogs.filter((l) => l.status === 'failed').length;
      const videoTotal  = videoLogs.length;
      const videoErrorRate = videoTotal > 0 ? Math.round((videoFailed / videoTotal) * 100 * 10) / 10 : 0;
      const videoLast1h = videoLogs.filter((l) => l.created_at >= last1h).length;
      const videoToday  = videoLogs.filter((l) => l.created_at >= todayStart).length;

      // 전체 통계
      const totalToday = logs.filter((l) => l.created_at >= todayStart).length;
      const totalLast1h = logs.filter((l) => l.created_at >= last1h).length;
      const totalSuccess = logs.filter((l) => l.status === 'success').length;
      const totalFailed  = logs.filter((l) => l.status === 'failed').length;
      const totalInsufficient = logs.filter((l) => l.status === 'insufficient_credits').length;
      const totalCreditsUsed = logs
        .filter((l) => l.status === 'success')
        .reduce((sum, l) => sum + (l.credits_deducted ?? 0), 0);

      // 갤러리/오디오 기반 폴백 (usage_logs 데이터 없을 때)
      let fallbackImageData = null;
      let fallbackAudioData = null;
      if (imageTotal === 0 && audioTotal === 0) {
        const [galleryRes, audioRes, autoRes] = await Promise.all([
          supabase.from('gallery_items').select('created_at').gte('created_at', last24h),
          supabase.from('audio_history').select('status, created_at').gte('created_at', last24h),
          supabase.from('automation_projects').select('status, created_at').gte('created_at', last24h),
        ]);
        fallbackImageData = galleryRes.data ?? [];
        fallbackAudioData = audioRes.data ?? [];
      }

      return json({
        api_stats: {
          image: {
            requests_24h: imageTotal > 0 ? imageTotal : (fallbackImageData?.length ?? 0),
            requests_today: imageTotal > 0 ? imageToday : (fallbackImageData?.filter((g: {created_at: string}) => g.created_at >= todayStart).length ?? 0),
            requests_1h: imageTotal > 0 ? imageLast1h : (fallbackImageData?.filter((g: {created_at: string}) => g.created_at >= last1h).length ?? 0),
            success: imageSuccess,
            failed: imageFailed,
            error_rate: imageErrorRate,
            status: imageErrorRate > 5 ? 'warning' : 'normal',
          },
          audio: {
            requests_24h: audioTotal > 0 ? audioTotal : (fallbackAudioData?.length ?? 0),
            requests_today: audioTotal > 0 ? audioToday : (fallbackAudioData?.filter((a: {created_at: string}) => a.created_at >= todayStart).length ?? 0),
            requests_1h: audioTotal > 0 ? audioLast1h : (fallbackAudioData?.filter((a: {created_at: string}) => a.created_at >= last1h).length ?? 0),
            error_rate: audioErrorRate,
            status: audioErrorRate > 10 ? 'error' : audioErrorRate > 5 ? 'warning' : 'normal',
          },
          video: {
            requests_24h: videoTotal,
            requests_today: videoToday,
            requests_1h: videoLast1h,
            error_rate: videoErrorRate,
            status: videoErrorRate > 10 ? 'error' : videoErrorRate > 5 ? 'warning' : 'normal',
          },
          total_requests_today: totalToday,
          total_requests_1h: totalLast1h,
          // usage_logs 기반 추가 통계
          usage_summary: {
            total_24h: logs.length,
            success: totalSuccess,
            failed: totalFailed,
            insufficient_credits: totalInsufficient,
            credits_used_24h: totalCreditsUsed,
          },
        },
      });
    }

    // ── usage_logs 기반 상세 통계 (신규 액션) ─────────────────────────
    if (req.method === 'GET' && action === 'usage_stats') {
      const days = parseInt(url.searchParams.get('days') ?? '7');
      const from = new Date();
      from.setDate(from.getDate() - days + 1);
      from.setHours(0, 0, 0, 0);

      const { data: logs, error } = await supabase
        .from('usage_logs')
        .select('service_slug, action, status, credits_deducted, user_plan, created_at')
        .gte('created_at', from.toISOString())
        .order('created_at', { ascending: false });

      if (error) return err(error.message);

      const allLogs = logs ?? [];
      const successLogs = allLogs.filter((l) => l.status === 'success');
      const failedLogs  = allLogs.filter((l) => l.status === 'failed');
      const insufficientLogs = allLogs.filter((l) => l.status === 'insufficient_credits');

      // 일별 성공 건수
      const dailyCounts: Record<string, { success: number; failed: number; credits: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        dailyCounts[d.toISOString().slice(0, 10)] = { success: 0, failed: 0, credits: 0 };
      }
      allLogs.forEach((l) => {
        const day = l.created_at.slice(0, 10);
        if (dailyCounts[day]) {
          if (l.status === 'success') {
            dailyCounts[day].success++;
            dailyCounts[day].credits += l.credits_deducted ?? 0;
          } else if (l.status === 'failed') {
            dailyCounts[day].failed++;
          }
        }
      });

      // 서비스별 통계
      const byService: Record<string, { total: number; success: number; failed: number; credits: number }> = {};
      allLogs.forEach((l) => {
        const key = l.action ?? l.service_slug ?? 'unknown';
        if (!byService[key]) byService[key] = { total: 0, success: 0, failed: 0, credits: 0 };
        byService[key].total++;
        if (l.status === 'success') {
          byService[key].success++;
          byService[key].credits += l.credits_deducted ?? 0;
        } else if (l.status === 'failed') {
          byService[key].failed++;
        }
      });

      // 플랜별 통계
      const byPlan: Record<string, number> = {};
      successLogs.forEach((l) => {
        const plan = l.user_plan ?? 'free';
        byPlan[plan] = (byPlan[plan] ?? 0) + 1;
      });

      return json({
        period_days: days,
        total: allLogs.length,
        success: successLogs.length,
        failed: failedLogs.length,
        insufficient_credits: insufficientLogs.length,
        total_credits_used: successLogs.reduce((sum, l) => sum + (l.credits_deducted ?? 0), 0),
        success_rate: allLogs.length > 0
          ? Math.round((successLogs.length / allLogs.length) * 100 * 10) / 10
          : 0,
        daily: dailyCounts,
        by_service: byService,
        by_plan: byPlan,
      });
    }

    // ── 일별 가입자 추이 ───────────────────────────────────────────────
    if (req.method === 'GET' && action === 'daily_signups') {
      const days = parseInt(url.searchParams.get('days') ?? '14');
      const from = new Date();
      from.setDate(from.getDate() - days + 1);
      from.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', from.toISOString());

      if (error) return err(error.message);

      const counts: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        counts[d.toISOString().slice(0, 10)] = 0;
      }

      (data ?? []).forEach((u) => {
        const day = u.created_at.slice(0, 10);
        if (counts[day] !== undefined) counts[day]++;
      });

      return json({ daily_signups: counts });
    }

    // ── 월별 매출 추이 ─────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'monthly_revenue') {
      const months = parseInt(url.searchParams.get('months') ?? '6');
      const from = new Date();
      from.setMonth(from.getMonth() - months + 1);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('payments')
        .select('amount_usd, created_at, status')
        .gte('created_at', from.toISOString())
        .eq('status', 'completed');

      if (error) return err(error.message);

      const monthly: Record<string, number> = {};
      for (let i = 0; i < months; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (months - 1 - i));
        monthly[d.toISOString().slice(0, 7)] = 0;
      }

      (data ?? []).forEach((p) => {
        const month = p.created_at.slice(0, 7);
        if (monthly[month] !== undefined) monthly[month] += p.amount_usd ?? 0;
      });

      return json({ monthly_revenue: monthly });
    }

    // ── 플랜 분포 ──────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'plan_dist') {
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('plan');

      if (error) return err(error.message);

      const total = users?.length ?? 0;
      const free       = users?.filter((u) => (u.plan ?? 'free').toLowerCase() === 'free').length ?? 0;
      const pro        = users?.filter((u) => (u.plan ?? '').toLowerCase() === 'pro').length ?? 0;
      const enterprise = users?.filter((u) => (u.plan ?? '').toLowerCase() === 'enterprise').length ?? 0;

      return json({
        plan_dist: [
          { label: 'Free',       count: free,       pct: total > 0 ? Math.round((free / total) * 1000) / 10 : 0,       color: 'bg-zinc-500' },
          { label: 'Pro',        count: pro,        pct: total > 0 ? Math.round((pro / total) * 1000) / 10 : 0,        color: 'bg-indigo-500' },
          { label: 'Enterprise', count: enterprise, pct: total > 0 ? Math.round((enterprise / total) * 1000) / 10 : 0, color: 'bg-amber-500' },
        ],
        total,
      });
    }

    // ── 콘텐츠 트렌드 (usage_logs + 테이블 카운트 병행) ───────────────
    if (req.method === 'GET' && action === 'content_trends') {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // 테이블 카운트 (기존 방식)
      const [
        { count: galleryCount },
        { count: audioCount },
        { count: automationCount },
        { count: boardCount },
      ] = await Promise.all([
        supabase.from('gallery_items').select('*', { count: 'exact', head: true }).gte('created_at', thisMonthStart),
        supabase.from('audio_history').select('*', { count: 'exact', head: true }).gte('created_at', thisMonthStart),
        supabase.from('automation_projects').select('*', { count: 'exact', head: true }).gte('created_at', thisMonthStart),
        supabase.from('board_projects').select('*', { count: 'exact', head: true }).gte('created_at', thisMonthStart),
      ]);

      // usage_logs에서 이번 달 성공 건수 추가 집계
      const { data: usageLogs } = await supabase
        .from('usage_logs')
        .select('action, status, credits_deducted')
        .gte('created_at', thisMonthStart)
        .eq('status', 'success');

      const usageImageCount = (usageLogs ?? []).filter((l) =>
        l.action?.includes('이미지') || l.action?.includes('image')
      ).length;
      const usageAudioCount = (usageLogs ?? []).filter((l) =>
        l.action?.includes('TTS') || l.action?.includes('음악') ||
        l.action?.includes('SFX') || l.action?.includes('음성')
      ).length;
      const usageVideoCount = (usageLogs ?? []).filter((l) =>
        l.action?.includes('영상') || l.action?.includes('video')
      ).length;
      const totalCreditsUsed = (usageLogs ?? []).reduce((sum, l) => sum + (l.credits_deducted ?? 0), 0);

      // 테이블 카운트 우선, usage_logs는 보조 지표
      const finalGallery    = Math.max(galleryCount ?? 0, usageImageCount);
      const finalAudio      = Math.max(audioCount ?? 0, usageAudioCount);
      const finalAutomation = Math.max(automationCount ?? 0, usageVideoCount);
      const finalBoard      = boardCount ?? 0;

      const counts = [finalGallery, finalAudio, finalAutomation, finalBoard];
      const maxCount = Math.max(...counts, 1);

      return json({
        content_trends: [
          { name: 'AI 이미지',    count: finalGallery,    pct: Math.round((finalGallery / maxCount) * 100),    color: 'bg-indigo-500',  icon: 'ri-image-ai-line' },
          { name: 'AI 사운드',    count: finalAudio,      pct: Math.round((finalAudio / maxCount) * 100),      color: 'bg-emerald-500', icon: 'ri-music-2-line' },
          { name: '유튜브 자동화', count: finalAutomation, pct: Math.round((finalAutomation / maxCount) * 100), color: 'bg-red-500',     icon: 'ri-youtube-line' },
          { name: 'AI 보드',      count: finalBoard,      pct: Math.round((finalBoard / maxCount) * 100),      color: 'bg-violet-500',  icon: 'ri-layout-masonry-line' },
        ],
        usage_logs_summary: {
          image_success: usageImageCount,
          audio_success: usageAudioCount,
          video_success: usageVideoCount,
          total_credits_used: totalCreditsUsed,
        },
      });
    }

    // ── 최근 감사 로그 ─────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'recent_audit') {
      const limit = parseInt(url.searchParams.get('limit') ?? '6');

      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, admin_email, action, target_label, detail, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return err(error.message);

      const logs = (data ?? []).map((l) => ({
        admin:  l.admin_email ?? 'admin',
        action: l.action,
        target: l.target_label ?? '-',
        detail: l.detail ?? '-',
        time:   l.created_at
          ? new Date(l.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
              .replace(/\. /g, '.').replace(/\.$/, '')
          : '-',
      }));

      return json({ logs });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-stats error:', e);
    return err('Internal server error', 500);
  }
});
