import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';
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

  try {
    await requireAdmin(req);
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
    // 감사 로그 목록 조회
    if (req.method === 'GET' && action === 'list_logs') {
      const category   = url.searchParams.get('category');
      const admin      = url.searchParams.get('admin');
      const search     = url.searchParams.get('search');
      const date_from  = url.searchParams.get('date_from');
      const date_to    = url.searchParams.get('date_to');
      const page       = parseInt(url.searchParams.get('page') ?? '1');
      const limit      = parseInt(url.searchParams.get('limit') ?? '30');
      const offset     = (page - 1) * limit;

      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category)  query = query.eq('target_type', category);
      if (admin)     query = query.ilike('admin_email', `%${admin}%`);
      if (search)    query = query.or(`action.ilike.%${search}%,target_label.ilike.%${search}%,detail.ilike.%${search}%`);
      if (date_from) query = query.gte('created_at', date_from);
      if (date_to)   query = query.lte('created_at', date_to);

      const { data, error, count } = await query;
      if (error) return err(error.message);
      return json({ logs: data, total: count, page, limit });
    }

    // 감사 로그 기록 (내부 호출용)
    if (req.method === 'POST' && action === 'write_log') {
      const body = await req.json();
      const { admin_email, action: logAction, target_type, target_id, target_label, detail, ip_address, result } = body;

      if (!logAction) return err('action required');

      const { data, error } = await supabase
        .from('audit_logs')
        .insert({
          admin_email: admin_email ?? 'system',
          action: logAction,
          target_type: target_type ?? 'system',
          target_id: target_id ?? null,
          target_label: target_label ?? null,
          detail: detail ?? null,
          ip_address: ip_address ?? null,
          result: result ?? 'success',
        })
        .select()
        .single();

      if (error) return err(error.message);
      return json({ log: data }, 201);
    }

    // 감사 로그 통계
    if (req.method === 'GET' && action === 'log_stats') {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('target_type, result, created_at');

      if (error) return err(error.message);

      const now = new Date();
      const today = data.filter((l) => {
        const d = new Date(l.created_at);
        return d.toDateString() === now.toDateString();
      });

      const stats = {
        total: data.length,
        today: today.length,
        by_category: {
          user: data.filter((l) => l.target_type === 'user').length,
          content: data.filter((l) => l.target_type === 'content').length,
          billing: data.filter((l) => l.target_type === 'billing' || l.target_type === 'payment' || l.target_type === 'coupon').length,
          system: data.filter((l) => l.target_type === 'system').length,
          security: data.filter((l) => l.target_type === 'security').length,
          notice: data.filter((l) => l.target_type === 'notice').length,
          ticket: data.filter((l) => l.target_type === 'ticket').length,
        },
        success: data.filter((l) => l.result === 'success').length,
        failed: data.filter((l) => l.result === 'failed').length,
      };

      return json({ stats });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-audit error:', e);
    return err('Internal server error', 500);
  }
});
