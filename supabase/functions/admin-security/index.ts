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
    // IP BLOCKS
    // ─────────────────────────────────────────────

    // IP 차단 목록 조회
    if (req.method === 'GET' && action === 'list_ip_blocks') {
      const is_active = url.searchParams.get('is_active');
      const search    = url.searchParams.get('search');
      const page      = parseInt(url.searchParams.get('page') ?? '1');
      const limit     = parseInt(url.searchParams.get('limit') ?? '50');
      const offset    = (page - 1) * limit;

      let query = supabase
        .from('ip_blocks')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (is_active !== null && is_active !== undefined && is_active !== '') {
        query = query.eq('is_active', is_active === 'true');
      }
      if (search) query = query.or(`ip_address.ilike.%${search}%,reason.ilike.%${search}%`);

      const { data, error, count } = await query;
      if (error) return err(error.message);
      return json({ ip_blocks: data, total: count, page, limit });
    }

    // IP 차단 등록 - reason 기본값 처리
    if (req.method === 'POST' && action === 'block_ip') {
      const body = await req.json();
      const { ip_address, reason, expires_at } = body;
      if (!ip_address) return err('ip_address required');

      // reason이 없으면 기본값 사용
      const blockReason = reason?.trim() || '수동 차단';

      const { data, error } = await supabase
        .from('ip_blocks')
        .insert({
          ip_address,
          reason: blockReason,
          blocked_by_email: admin.email,
          is_active: true,
          expires_at: expires_at ?? null,
        })
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, 'IP 차단 등록', {
        target_type: 'security',
        target_id: data.id,
        target_label: ip_address,
        detail: blockReason,
      });

      return json({ ip_block: data }, 201);
    }

    // IP 차단 해제
    if (req.method === 'PATCH' && action === 'unblock_ip') {
      const body = await req.json();
      const { id } = body;
      if (!id) return err('id required');

      const { data, error } = await supabase
        .from('ip_blocks')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, 'IP 차단 해제', {
        target_type: 'security',
        target_id: id,
        target_label: data.ip_address,
      });

      return json({ ip_block: data });
    }

    // IP 차단 삭제
    if (req.method === 'DELETE' && action === 'delete_ip_block') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { error } = await supabase.from('ip_blocks').delete().eq('id', id);
      if (error) return err(error.message);
      return json({ success: true });
    }

    // ─────────────────────────────────────────────
    // ADMIN ACCOUNTS
    // ─────────────────────────────────────────────

    // 관리자 계정 목록 조회
    if (req.method === 'GET' && action === 'list_admins') {
      const { data, error } = await supabase
        .from('admin_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return err(error.message);
      return json({ admins: data });
    }

    // 관리자 계정 생성
    if (req.method === 'POST' && action === 'create_admin') {
      const body = await req.json();
      const { email, display_name, role, permissions } = body;
      if (!email || !role) return err('email and role required');

      const { data, error } = await supabase
        .from('admin_accounts')
        .insert({
          email,
          display_name: display_name ?? email.split('@')[0],
          role,
          permissions: permissions ?? [],
          is_active: true,
          two_factor_enabled: false,
        })
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '관리자 계정 생성', {
        target_type: 'security',
        target_id: data.id,
        target_label: email,
        detail: `역할: ${role}`,
      });

      return json({ admin: data }, 201);
    }

    // 관리자 계정 수정
    if (req.method === 'PUT' && action === 'update_admin') {
      const body = await req.json();
      const { id, display_name, role, permissions, is_active, two_factor_enabled } = body;
      if (!id) return err('id required');

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (display_name !== undefined)       updateData.display_name       = display_name;
      if (role !== undefined)               updateData.role               = role;
      if (permissions !== undefined)        updateData.permissions        = permissions;
      if (is_active !== undefined)          updateData.is_active          = is_active;
      if (two_factor_enabled !== undefined) updateData.two_factor_enabled = two_factor_enabled;

      const { data, error } = await supabase
        .from('admin_accounts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '관리자 계정 수정', {
        target_type: 'security',
        target_id: id,
        target_label: data.email,
      });

      return json({ admin: data });
    }

    // 관리자 계정 삭제
    if (req.method === 'DELETE' && action === 'delete_admin') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { error } = await supabase.from('admin_accounts').delete().eq('id', id);
      if (error) return err(error.message);
      return json({ success: true });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-security error:', e);
    return err('Internal server error', 500);
  }
});
