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
    admin = await requireAdmin(req, ['super_admin']);
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
      const {
        email, display_name, role, permissions,
        invite_mode = 'manual_url',
      } = body as {
        email?: string; display_name?: string; role?: string;
        permissions?: unknown[]; invite_mode?: 'manual_url' | 'auto_email' | 'none';
      };
      if (!email || !role) return err('email and role required');
      if (!['super_admin', 'ops', 'cs', 'billing'].includes(role)) {
        return err('role must be super_admin / ops / cs / billing');
      }
      if (!['manual_url', 'auto_email', 'none'].includes(invite_mode)) {
        return err('invite_mode must be manual_url / auto_email / none');
      }

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
        detail: `역할: ${role}, invite_mode: ${invite_mode}`,
      });

      // invite_mode 처리. manual_url 이 기본 — Supabase 메일 인프라 의존
      // 없이 generateLink() 만으로 1회용 URL 받아서 운영자가 Slack 등으로
      // 직접 전달. auto_email 은 inviteUserByEmail() (Supabase 메일러
      // 시간당 3통 한도 또는 커스텀 SMTP 설정 시 무제한). none 은 row 만.
      const adminRedirectBase = Deno.env.get('ADMIN_INVITE_REDIRECT_URL')
        ?? 'http://localhost:5173/admin';
      let invite_status:
        'sent' | 'manual_url_generated' | 'already_registered' | 'failed' | 'skipped' = 'skipped';
      let invite_url: string | undefined;
      let invite_error: string | undefined;

      if (invite_mode === 'manual_url') {
        try {
          const linkRes = await supabase.auth.admin.generateLink({
            type: 'invite',
            email,
            options: { redirectTo: adminRedirectBase },
          });
          if (linkRes.error) {
            const msg = linkRes.error.message ?? '';
            if (/already.*registered|already.*exist|user.*exist/i.test(msg)) {
              // 이미 가입된 사용자면 invite 대신 magiclink 로 재로그인 URL 생성.
              const magicRes = await supabase.auth.admin.generateLink({
                type: 'magiclink',
                email,
                options: { redirectTo: adminRedirectBase },
              });
              if (magicRes.error) {
                invite_status = 'failed';
                invite_error = magicRes.error.message ?? msg;
              } else {
                invite_status = 'already_registered';
                invite_url = magicRes.data?.properties?.action_link;
              }
            } else {
              invite_status = 'failed';
              invite_error = msg;
            }
          } else {
            invite_status = 'manual_url_generated';
            invite_url = linkRes.data?.properties?.action_link;
          }
        } catch (e) {
          invite_status = 'failed';
          invite_error = e instanceof Error ? e.message : String(e);
        }
      } else if (invite_mode === 'auto_email') {
        try {
          const inviteRes = await supabase.auth.admin.inviteUserByEmail(email, {
            redirectTo: adminRedirectBase,
          });
          if (inviteRes.error) {
            const msg = inviteRes.error.message ?? '';
            if (/already.*registered|already.*exist|user.*exist/i.test(msg)) {
              invite_status = 'already_registered';
            } else {
              invite_status = 'failed';
              invite_error = msg;
            }
          } else {
            invite_status = 'sent';
          }
        } catch (e) {
          invite_status = 'failed';
          invite_error = e instanceof Error ? e.message : String(e);
        }
      }

      return json({ admin: data, invite_status, invite_url, invite_error }, 201);
    }

    // 관리자 계정 수정
    if (req.method === 'PUT' && action === 'update_admin') {
      const body = await req.json();
      const { id, display_name, role, permissions, is_active, two_factor_enabled } = body;
      if (!id) return err('id required');
      if (role !== undefined && !['super_admin', 'ops', 'cs', 'billing'].includes(role)) {
        return err('role must be super_admin / ops / cs / billing');
      }

      // 자기 자신 다운그레이드/비활성화 차단 — 자기-lockout 방지.
      if (id === admin.adminId) {
        if (is_active === false) return err('cannot deactivate yourself', 403);
        if (role !== undefined && role !== 'super_admin') return err('cannot downgrade yourself', 403);
      }

      // 마지막 super_admin 보호. role downgrade 또는 deactivate 시 카운트
      // 후 0 이 되면 admin 패널 자체가 잠겨요 (admin 관리 = super_admin only).
      if ((role !== undefined && role !== 'super_admin') || is_active === false) {
        const { data: targetRow } = await supabase
          .from('admin_accounts')
          .select('role')
          .eq('id', id)
          .maybeSingle();
        if (targetRow?.role === 'super_admin') {
          const { count } = await supabase
            .from('admin_accounts')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'super_admin')
            .eq('is_active', true);
          if ((count ?? 0) <= 1) return err('cannot remove the last active super_admin', 403);
        }
      }

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

    // Magic-link 재발송 / URL 재생성. invite_mode 'manual_url' (기본) 이면
    // 메일 발송 없이 URL 만 다시 받아서 응답에 포함 (운영자가 직접 전달).
    // 'auto_email' 이면 Supabase 메일러로 발송.
    if (req.method === 'POST' && action === 'resend_invite') {
      const body = await req.json();
      const { email, invite_mode = 'manual_url' } = body as {
        email?: string; invite_mode?: 'manual_url' | 'auto_email';
      };
      if (!email) return err('email required');
      if (!['manual_url', 'auto_email'].includes(invite_mode)) {
        return err('invite_mode must be manual_url or auto_email');
      }

      const adminRedirectBase = Deno.env.get('ADMIN_INVITE_REDIRECT_URL')
        ?? 'http://localhost:5173/admin';

      try {
        if (invite_mode === 'manual_url') {
          // 가입 여부 모를 때는 일단 invite 시도 후, already_registered 면
          // magiclink 로 fallback. 두 케이스 모두 사용 가능한 URL 반환.
          let res = await supabase.auth.admin.generateLink({
            type: 'invite',
            email,
            options: { redirectTo: adminRedirectBase },
          });
          let status: 'manual_url_generated' | 'already_registered' = 'manual_url_generated';
          if (res.error && /already.*registered|already.*exist|user.*exist/i.test(res.error.message ?? '')) {
            res = await supabase.auth.admin.generateLink({
              type: 'magiclink',
              email,
              options: { redirectTo: adminRedirectBase },
            });
            status = 'already_registered';
          }
          if (res.error) return err(res.error.message ?? 'generate link failed');

          await writeAuditLog(supabase, admin, '관리자 invite 재발송', {
            target_type: 'security',
            target_label: email,
            detail: `mode: manual_url, status: ${status}`,
          });
          return json({ ok: true, status, invite_url: res.data?.properties?.action_link });
        }

        // auto_email
        const inviteRes = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: adminRedirectBase,
        });
        if (inviteRes.error) {
          const msg = inviteRes.error.message ?? '';
          if (/already.*registered|already.*exist|user.*exist/i.test(msg)) {
            return json({ ok: true, status: 'already_registered',
              hint: '이미 가입된 사용자에요. /admin-login 에서 직접 로그인하세요.' });
          }
          return err(msg);
        }
        await writeAuditLog(supabase, admin, '관리자 invite 재발송', {
          target_type: 'security',
          target_label: email,
          detail: 'mode: auto_email',
        });
        return json({ ok: true, status: 'sent' });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    }

    // 관리자 계정 삭제
    if (req.method === 'DELETE' && action === 'delete_admin') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');
      if (id === admin.adminId) return err('cannot delete yourself', 403);

      const { data: targetRow } = await supabase
        .from('admin_accounts')
        .select('role, email')
        .eq('id', id)
        .maybeSingle();
      if (targetRow?.role === 'super_admin') {
        const { count } = await supabase
          .from('admin_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'super_admin')
          .eq('is_active', true);
        if ((count ?? 0) <= 1) return err('cannot delete the last active super_admin', 403);
      }

      const { error } = await supabase.from('admin_accounts').delete().eq('id', id);
      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '관리자 계정 삭제', {
        target_type: 'security',
        target_id: id,
        target_label: targetRow?.email ?? id,
      });

      return json({ success: true });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-security error:', e);
    return err('Internal server error', 500);
  }
});
