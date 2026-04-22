import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? '';

  try {
    // ─────────────────────────────────────────────
    // 사용자 목록 조회
    // ─────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list_users') {
      const search   = url.searchParams.get('search');
      const plan     = url.searchParams.get('plan');
      const status   = url.searchParams.get('status');
      const grade    = url.searchParams.get('grade');
      const page     = parseInt(url.searchParams.get('page') ?? '1');
      const limit    = parseInt(url.searchParams.get('limit') ?? '20');
      const offset   = (page - 1) * limit;

      let query = supabase
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (plan)   query = query.eq('plan', plan.toLowerCase());
      if (status) query = query.eq('status', status);
      if (grade)  query = query.eq('member_grade', grade);
      if (search) query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);

      const { data: users, error, count } = await query;
      if (error) return err(error.message);

      const userIds = (users ?? []).map((u) => u.id).filter(Boolean);
      const projectCounts: Record<string, number> = {};

      if (userIds.length > 0) {
        const userIdStrings = userIds.map(String);
        const [{ data: galleryData }] = await Promise.all([
          supabase.from('gallery_items').select('user_id').in('user_id', userIdStrings),
        ]);
        (galleryData ?? []).forEach((g) => {
          if (g.user_id) {
            projectCounts[g.user_id] = (projectCounts[g.user_id] ?? 0) + 1;
          }
        });
      }

      const enriched = (users ?? []).map((u) => ({
        ...u,
        project_count: projectCounts[u.id] ?? 0,
      }));

      return json({ users: enriched, total: count, page, limit });
    }

    // ─────────────────────────────────────────────
    // 사용자 상세 조회
    // ─────────────────────────────────────────────
    if (req.method === 'GET' && action === 'get_user') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (profileErr) return err(profileErr.message);
      if (!profile) return err('User not found', 404);

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', id)
        .eq('status', 'active')
        .maybeSingle();

      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount_usd, currency, status, payment_method, plan, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: gradePerms } = await supabase
        .from('grade_permissions')
        .select('*')
        .eq('grade', profile.member_grade ?? 'general')
        .maybeSingle();

      const [
        { count: galleryCount },
        { count: audioCount },
      ] = await Promise.all([
        supabase.from('gallery_items').select('*', { count: 'exact', head: true }).eq('user_id', id),
        supabase.from('audio_history').select('*', { count: 'exact', head: true }).eq('user_session', id),
      ]);

      const totalProjects = (galleryCount ?? 0) + (audioCount ?? 0);

      return json({
        profile: { ...profile, project_count: totalProjects },
        subscription,
        payments: payments ?? [],
        grade_permissions: gradePerms,
        project_stats: {
          gallery: galleryCount ?? 0,
          audio: audioCount ?? 0,
          total: totalProjects,
        },
      });
    }

    // ─────────────────────────────────────────────
    // 사용자 상태 변경
    // ─────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update_user_status') {
      const body = await req.json();
      const { id, status, reason, admin_email } = body;
      if (!id || !status) return err('id and status required');

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await supabase.from('audit_logs').insert({
        admin_email: admin_email ?? 'admin',
        action: status === 'suspended' ? '계정 정지' : '계정 활성화',
        target_type: 'user',
        target_id: id,
        target_label: data.email,
        detail: reason ?? '',
        result: 'success',
      });

      return json({ user: data });
    }

    // ─────────────────────────────────────────────
    // 회원 등급 변경
    // ─────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update_member_grade') {
      const body = await req.json();
      const { id, member_grade, reason, admin_email } = body;
      if (!id || !member_grade) return err('id and member_grade required');

      const validGrades = ['general', 'staff', 'b2b', 'group', 'vip', 'suspended'];
      if (!validGrades.includes(member_grade)) return err('Invalid member_grade');

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ member_grade, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await supabase.from('audit_logs').insert({
        admin_email: admin_email ?? 'admin',
        action: '회원 등급 변경',
        target_type: 'user',
        target_id: id,
        target_label: data.email,
        detail: `등급 → ${member_grade} (사유: ${reason ?? '-'})`,
        result: 'success',
      });

      return json({ user: data });
    }

    // ─────────────────────────────────────────────
    // 등급별 권한 목록 조회
    // ─────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list_grade_permissions') {
      const { data, error } = await supabase
        .from('grade_permissions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) return err(error.message);
      return json({ grade_permissions: data ?? [] });
    }

    // ─────────────────────────────────────────────
    // 등급 권한 업데이트 (라벨/설명 포함)
    // ─────────────────────────────────────────────
    if (req.method === 'PUT' && action === 'update_grade_permissions') {
      const body = await req.json();
      const { grade, permissions, admin_email } = body;
      if (!grade || !permissions) return err('grade and permissions required');

      const allowedKeys = [
        'grade_label', 'grade_description',
        'can_generate_image', 'can_generate_video', 'can_generate_music',
        'can_generate_tts', 'can_generate_sfx', 'can_use_automation',
        'can_use_ai_board', 'can_use_ai_ad', 'can_use_youtube_studio',
        'can_download_hd', 'can_remove_watermark', 'can_api_access',
        'can_team_create', 'priority_queue',
        'monthly_credit_bonus', 'max_projects', 'max_team_members',
      ];

      const safePerms: Record<string, unknown> = {};
      for (const key of allowedKeys) {
        if (key in permissions) safePerms[key] = permissions[key];
      }
      safePerms['updated_at'] = new Date().toISOString();

      const { data, error } = await supabase
        .from('grade_permissions')
        .update(safePerms)
        .eq('grade', grade)
        .select()
        .single();

      if (error) return err(error.message);

      const changedLabel = permissions.grade_label ? ` (라벨: ${permissions.grade_label})` : '';
      await supabase.from('audit_logs').insert({
        admin_email: admin_email ?? 'admin',
        action: '등급 권한 수정',
        target_type: 'system',
        target_id: grade,
        target_label: `${grade} 등급 권한${changedLabel}`,
        detail: `권한 설정 업데이트`,
        result: 'success',
      });

      return json({ grade_permission: data });
    }

    // ─────────────────────────────────────────────
    // 등급별 사용자 통계
    // ─────────────────────────────────────────────
    if (req.method === 'GET' && action === 'grade_stats') {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('member_grade, status');

      if (error) return err(error.message);

      const stats: Record<string, number> = {
        general: 0, staff: 0, b2b: 0, group: 0, vip: 0, suspended: 0,
      };
      (data ?? []).forEach((u) => {
        const g = u.member_grade ?? 'general';
        if (g in stats) stats[g]++;
      });

      return json({ grade_stats: stats, total: data?.length ?? 0 });
    }

    // ─────────────────────────────────────────────
    // 크레딧 수동 지급/차감 (단일 유저)
    // ─────────────────────────────────────────────
    if (req.method === 'POST' && action === 'adjust_credits') {
      const body = await req.json();
      const { id, amount, reason, admin_email } = body;
      if (!id || amount === undefined) return err('id and amount required');

      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('credit_balance, email')
        .eq('id', id)
        .maybeSingle();

      if (profileErr || !profile) return err('User not found');

      const newBalance = Math.max(0, (profile.credit_balance ?? 0) + amount);

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ credit_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await supabase.from('audit_logs').insert({
        admin_email: admin_email ?? 'admin',
        action: amount > 0 ? '크레딧 수동 지급' : '크레딧 수동 차감',
        target_type: 'user',
        target_id: id,
        target_label: profile.email,
        detail: `${amount > 0 ? '+' : ''}${amount} 크레딧 (사유: ${reason ?? '-'})`,
        result: 'success',
      });

      return json({ user: data, new_balance: newBalance });
    }

    // ─────────────────────────────────────────────
    // 코인 일괄 지급 (플랜별 / 전체 / 등급별)
    // ─────────────────────────────────────────────
    if (req.method === 'POST' && action === 'grant_credits') {
      const body = await req.json();
      const { amount, reason, admin_email, target_type, target_value } = body;
      // target_type: 'all' | 'plan' | 'grade' | 'user_ids'
      // target_value: plan name | grade name | string[] of user ids
      if (!amount || amount <= 0) return err('amount must be positive');

      let userQuery = supabase
        .from('user_profiles')
        .select('id, email, credit_balance');

      if (target_type === 'plan' && target_value) {
        userQuery = userQuery.eq('plan', (target_value as string).toLowerCase());
      } else if (target_type === 'grade' && target_value) {
        userQuery = userQuery.eq('member_grade', target_value as string);
      } else if (target_type === 'user_ids' && Array.isArray(target_value)) {
        userQuery = userQuery.in('id', target_value as string[]);
      }
      // target_type === 'all': no filter

      const { data: users, error: usersErr } = await userQuery;
      if (usersErr) return err(usersErr.message);
      if (!users || users.length === 0) return err('No users found for target');

      // 배치 업데이트: 각 유저별 새 잔액 계산
      const updates = (users as { id: string; email: string; credit_balance: number | null }[]).map((u) => ({
        id: u.id,
        credit_balance: (u.credit_balance ?? 0) + amount,
        updated_at: new Date().toISOString(),
      }));

      // Supabase upsert로 배치 처리
      const { error: updateErr } = await supabase
        .from('user_profiles')
        .upsert(updates, { onConflict: 'id' });

      if (updateErr) return err(updateErr.message);

      // 감사 로그 기록
      const targetLabel = target_type === 'all' ? '전체 유저'
        : target_type === 'plan' ? `${target_value} 플랜 유저`
        : target_type === 'grade' ? `${target_value} 등급 유저`
        : `선택 유저 ${Array.isArray(target_value) ? target_value.length : 0}명`;

      await supabase.from('audit_logs').insert({
        admin_email: admin_email ?? 'admin',
        action: '크레딧 일괄 지급',
        target_type: 'user',
        target_id: 'batch',
        target_label: targetLabel,
        detail: `+${amount} 크레딧 × ${users.length}명 (사유: ${reason ?? '-'})`,
        result: 'success',
      });

      return json({
        success: true,
        granted_count: users.length,
        amount_per_user: amount,
        total_granted: amount * users.length,
        target_label: targetLabel,
      });
    }

    // ─────────────────────────────────────────────
    // 사용자 플랜 변경
    // ─────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update_user_plan') {
      const body = await req.json();
      const { id, plan, admin_email } = body;
      if (!id || !plan) return err('id and plan required');

      const planLower = plan.toLowerCase();

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ plan: planLower, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await supabase.from('audit_logs').insert({
        admin_email: admin_email ?? 'admin',
        action: '플랜 수동 변경',
        target_type: 'user',
        target_id: id,
        target_label: data.email,
        detail: `플랜 → ${planLower}`,
        result: 'success',
      });

      return json({ user: data });
    }

    // ─────────────────────────────────────────────
    // 사용자 통계
    // ─────────────────────────────────────────────
    if (req.method === 'GET' && action === 'user_stats') {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('plan, status, member_grade');

      if (error) return err(error.message);

      const stats = {
        total: data.length,
        active: data.filter((u) => u.status === 'active').length,
        inactive: data.filter((u) => u.status === 'inactive').length,
        suspended: data.filter((u) => u.status === 'suspended').length,
        free: data.filter((u) => (u.plan ?? '').toLowerCase() === 'free').length,
        pro: data.filter((u) => (u.plan ?? '').toLowerCase() === 'pro').length,
        enterprise: data.filter((u) => (u.plan ?? '').toLowerCase() === 'enterprise').length,
        grade_general: data.filter((u) => (u.member_grade ?? 'general') === 'general').length,
        grade_staff: data.filter((u) => u.member_grade === 'staff').length,
        grade_b2b: data.filter((u) => u.member_grade === 'b2b').length,
        grade_group: data.filter((u) => u.member_grade === 'group').length,
        grade_vip: data.filter((u) => u.member_grade === 'vip').length,
      };

      return json({ stats });
    }

    // ─────────────────────────────────────────────
    // 사용자 메모 업데이트
    // ─────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update_user_notes') {
      const body = await req.json();
      const { id, notes } = body;
      if (!id) return err('id required');

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);
      return json({ user: data });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-users error:', e);
    return err('Internal server error', 500);
  }
});
