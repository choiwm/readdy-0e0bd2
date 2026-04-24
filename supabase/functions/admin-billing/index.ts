import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure, writeAuditLog, type AuthedAdmin } from '../_shared/auth.ts';
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
  let admin: AuthedAdmin;
  try {
    admin = await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? '';

  try {
    // ─────────────────────────────────────────────
    // PAYMENTS
    // ─────────────────────────────────────────────

    // 결제 목록 조회 (페이지네이션 지원)
    if (req.method === 'GET' && action === 'list_payments') {
      const status = url.searchParams.get('status');
      const plan   = url.searchParams.get('plan');
      const page   = parseInt(url.searchParams.get('page') ?? '1');
      const limit  = parseInt(url.searchParams.get('limit') ?? '20');
      const offset = (page - 1) * limit;

      let query = supabase
        .from('payments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (plan)   query = query.eq('plan', plan);

      const { data: payments, error, count } = await query;
      if (error) return err(error.message);

      // user_id 목록 추출 후 user_profiles 별도 조회
      const userIds = [...new Set((payments ?? []).map((p) => p.user_id).filter(Boolean))];
      let userMap: Record<string, { email: string; display_name: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email, display_name')
          .in('id', userIds);

        if (profiles) {
          userMap = Object.fromEntries(
            profiles.map((p) => [p.id, { email: p.email, display_name: p.display_name }])
          );
        }
      }

      const enriched = (payments ?? []).map((p) => ({
        ...p,
        user_profiles: userMap[p.user_id] ?? null,
      }));

      return json({ payments: enriched, total: count ?? 0, page, limit, total_pages: Math.ceil((count ?? 0) / limit) });
    }

    // 환불 처리 - updated_at 컬럼 없으므로 제거
    if (req.method === 'POST' && action === 'refund_payment') {
      const body = await req.json();
      const { id, refund_reason } = body;
      if (!id) return err('id required');

      // payments 테이블에 updated_at 컬럼이 없으므로 제외
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'refunded',
          refunded_at: new Date().toISOString(),
          refund_reason: refund_reason ?? '관리자 환불 처리',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '환불 처리', {
        target_type: 'payment',
        target_id: id,
        target_label: `결제 ${id.slice(0, 8)}`,
        detail: refund_reason ?? '관리자 환불',
      });

      return json({ payment: data });
    }

    // 결제 통계
    if (req.method === 'GET' && action === 'payment_stats') {
      const { data, error } = await supabase
        .from('payments')
        .select('status, amount_usd, plan, created_at');

      if (error) return err(error.message);

      const now = new Date();
      const thisMonth = (data ?? []).filter((p) => {
        const d = new Date(p.created_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });

      const stats = {
        total_payments: (data ?? []).length,
        completed: (data ?? []).filter((p) => p.status === 'completed').length,
        refunded: (data ?? []).filter((p) => p.status === 'refunded').length,
        pending: (data ?? []).filter((p) => p.status === 'pending').length,
        monthly_revenue: thisMonth
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + (p.amount_usd ?? 0), 0),
        total_revenue: (data ?? [])
          .filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + (p.amount_usd ?? 0), 0),
      };

      return json({ stats });
    }

    // ─────────────────────────────────────────────
    // SUBSCRIPTIONS
    // ─────────────────────────────────────────────

    if (req.method === 'GET' && action === 'list_subscriptions') {
      const status = url.searchParams.get('status');
      const plan   = url.searchParams.get('plan');
      const page   = parseInt(url.searchParams.get('page') ?? '1');
      const limit  = parseInt(url.searchParams.get('limit') ?? '20');
      const offset = (page - 1) * limit;

      let query = supabase
        .from('subscriptions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);
      if (plan)   query = query.eq('plan', plan);

      const { data: subs, error, count } = await query;
      if (error) return err(error.message);

      const userIds = [...new Set((subs ?? []).map((s) => s.user_id).filter(Boolean))];
      let userMap: Record<string, { email: string; display_name: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, email, display_name')
          .in('id', userIds);

        if (profiles) {
          userMap = Object.fromEntries(
            profiles.map((p) => [p.id, { email: p.email, display_name: p.display_name }])
          );
        }
      }

      const enriched = (subs ?? []).map((s) => ({
        ...s,
        user_profiles: userMap[s.user_id] ?? null,
      }));

      return json({ subscriptions: enriched, total: count, page, limit });
    }

    if (req.method === 'PATCH' && action === 'cancel_subscription') {
      const body = await req.json();
      const { id } = body;
      if (!id) return err('id required');

      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '구독 강제 취소', {
        target_type: 'subscription',
        target_id: id,
        target_label: `${data.plan} 구독`,
      });

      return json({ subscription: data });
    }

    // ─────────────────────────────────────────────
    // COUPONS
    // ─────────────────────────────────────────────

    if (req.method === 'GET' && action === 'list_coupons') {
      const { data, error, count } = await supabase
        .from('coupons')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) return err(error.message);
      return json({ coupons: data, total: count });
    }

    if (req.method === 'POST' && action === 'create_coupon') {
      const body = await req.json();
      const { code, description, discount_type, discount_value, max_uses, applicable_plans, expires_at } = body;

      if (!code || !discount_type || discount_value === undefined) {
        return err('code, discount_type, discount_value required');
      }

      const { data, error } = await supabase
        .from('coupons')
        .insert({
          code: code.toUpperCase(),
          description: description ?? '',
          discount_type,
          discount_value,
          max_uses: max_uses ?? null,
          applicable_plans: applicable_plans ?? ['free', 'pro', 'enterprise'],
          is_active: true,
          expires_at: expires_at ?? null,
        })
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '쿠폰 생성', {
        target_type: 'coupon',
        target_id: data.id,
        target_label: code.toUpperCase(),
        detail: `${discount_type === 'percent' ? discount_value + '%' : discount_value + ' CR'} 할인`,
      });

      return json({ coupon: data }, 201);
    }

    // 쿠폰 상태 토글 - code 또는 id로 조회 지원
    if (req.method === 'PATCH' && action === 'toggle_coupon') {
      const body = await req.json();
      const { id, code, is_active } = body;
      if (!id && !code) return err('id or code required');

      let targetId = id;

      if (!targetId && code) {
        const { data: found, error: findErr } = await supabase
          .from('coupons')
          .select('id')
          .eq('code', code.toUpperCase())
          .maybeSingle();

        if (findErr || !found) return err('Coupon not found');
        targetId = found.id;
      }

      const { data, error } = await supabase
        .from('coupons')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', targetId)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, is_active ? '쿠폰 활성화' : '쿠폰 비활성화', {
        target_type: 'coupon',
        target_id: targetId,
        target_label: data.code,
      });

      return json({ coupon: data });
    }

    if (req.method === 'DELETE' && action === 'delete_coupon') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) return err(error.message);
      return json({ success: true });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-billing error:', e);
    return err('Internal server error', 500);
  }
});
