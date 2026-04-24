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
    // CS TICKETS
    // ─────────────────────────────────────────────

    // GET /tickets - 티켓 목록 조회
    if (req.method === 'GET' && action === 'list_tickets') {
      const status   = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const category = url.searchParams.get('category');
      const search   = url.searchParams.get('search');
      const page     = parseInt(url.searchParams.get('page') ?? '1');
      const limit    = parseInt(url.searchParams.get('limit') ?? '20');
      const offset   = (page - 1) * limit;

      let query = supabase
        .from('cs_tickets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status)   query = query.eq('status', status);
      if (priority) query = query.eq('priority', priority);
      if (category) query = query.eq('category', category);
      if (search)   query = query.or(`title.ilike.%${search}%,user_email.ilike.%${search}%,user_name.ilike.%${search}%`);

      const { data, error, count } = await query;
      if (error) return err(error.message);
      return json({ tickets: data, total: count, page, limit });
    }

    // GET /ticket - 단일 티켓 조회
    if (req.method === 'GET' && action === 'get_ticket') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { data, error } = await supabase
        .from('cs_tickets')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return err(error.message);
      if (!data) return err('Ticket not found', 404);
      return json({ ticket: data });
    }

    // POST /ticket - 티켓 생성
    if (req.method === 'POST' && action === 'create_ticket') {
      const body = await req.json();
      const { user_id, user_email, user_name, title, content, category, priority } = body;

      if (!title || !content) return err('title and content required');

      const { data, error } = await supabase
        .from('cs_tickets')
        .insert({
          user_id:   user_id   ?? null,
          user_email: user_email ?? null,
          user_name:  user_name  ?? null,
          title,
          content,
          category:  category  ?? 'general',
          priority:  priority  ?? 'medium',
          status:    'open',
        })
        .select()
        .single();

      if (error) return err(error.message);
      return json({ ticket: data }, 201);
    }

    // PATCH /ticket/status - 티켓 상태 변경
    if (req.method === 'PATCH' && action === 'update_ticket_status') {
      const body = await req.json();
      const { id, status, assigned_to } = body;
      if (!id || !status) return err('id and status required');

      const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'resolved') updateData.resolved_at = new Date().toISOString();
      if (assigned_to !== undefined) updateData.assigned_to = assigned_to;

      const { data, error } = await supabase
        .from('cs_tickets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);
      return json({ ticket: data });
    }

    // POST /ticket/reply - 티켓 답변 등록 + 상태 변경
    if (req.method === 'POST' && action === 'reply_ticket') {
      const body = await req.json();
      const { id, reply_content, new_status } = body;
      if (!id || !reply_content) return err('id and reply_content required');

      const { data, error } = await supabase
        .from('cs_tickets')
        .update({
          reply_content,
          replied_at:  new Date().toISOString(),
          replied_by:  admin.email,
          status:      new_status ?? 'resolved',
          resolved_at: new_status === 'resolved' || !new_status ? new Date().toISOString() : null,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '티켓 답변 등록', {
        target_type:  'ticket',
        target_id:    id,
        target_label: data.title,
        detail:       `상태: ${new_status ?? 'resolved'}`,
      });

      return json({ ticket: data });
    }

    // DELETE /ticket - 티켓 삭제
    if (req.method === 'DELETE' && action === 'delete_ticket') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { error } = await supabase.from('cs_tickets').delete().eq('id', id);
      if (error) return err(error.message);
      return json({ success: true });
    }

    // GET /tickets/stats - 티켓 통계
    if (req.method === 'GET' && action === 'ticket_stats') {
      const { data, error } = await supabase
        .from('cs_tickets')
        .select('status, priority');

      if (error) return err(error.message);

      const stats = {
        total:       data.length,
        open:        data.filter((t) => t.status === 'open').length,
        in_progress: data.filter((t) => t.status === 'in_progress').length,
        resolved:    data.filter((t) => t.status === 'resolved').length,
        closed:      data.filter((t) => t.status === 'closed').length,
        urgent:      data.filter((t) => t.priority === 'urgent').length,
        high:        data.filter((t) => t.priority === 'high').length,
      };

      return json({ stats });
    }

    // ─────────────────────────────────────────────
    // NOTICES
    // ─────────────────────────────────────────────

    // GET /notices - 공지사항 목록
    if (req.method === 'GET' && action === 'list_notices') {
      const status   = url.searchParams.get('status');
      const category = url.searchParams.get('category');
      const page     = parseInt(url.searchParams.get('page') ?? '1');
      const limit    = parseInt(url.searchParams.get('limit') ?? '20');
      const offset   = (page - 1) * limit;

      let query = supabase
        .from('notices')
        .select('*', { count: 'exact' })
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status)   query = query.eq('status', status);
      if (category) query = query.eq('category', category);

      const { data, error, count } = await query;
      if (error) return err(error.message);
      return json({ notices: data, total: count, page, limit });
    }

    // GET /notice - 단일 공지사항 조회
    if (req.method === 'GET' && action === 'get_notice') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return err(error.message);
      if (!data) return err('Notice not found', 404);

      // 조회수 증가
      await supabase
        .from('notices')
        .update({ view_count: (data.view_count ?? 0) + 1 })
        .eq('id', id);

      return json({ notice: data });
    }

    // POST /notice - 공지사항 생성
    if (req.method === 'POST' && action === 'create_notice') {
      const body = await req.json();
      const { title, content, category, status, is_pinned, target_plans, expires_at } = body;

      if (!title || !content) return err('title and content required');

      const insertData: Record<string, unknown> = {
        title,
        content,
        category:     category     ?? 'general',
        status:       status       ?? 'draft',
        is_pinned:    is_pinned    ?? false,
        target_plans: target_plans ?? ['free', 'starter', 'pro', 'enterprise'],
        created_by:   admin.email,
      };

      if (status === 'published') insertData.published_at = new Date().toISOString();
      if (expires_at) insertData.expires_at = expires_at;

      const { data, error } = await supabase
        .from('notices')
        .insert(insertData)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, status === 'published' ? '공지사항 게시' : '공지사항 초안 저장', {
        target_type:  'notice',
        target_id:    data.id,
        target_label: title,
      });

      return json({ notice: data }, 201);
    }

    // PUT /notice - 공지사항 수정
    if (req.method === 'PUT' && action === 'update_notice') {
      const body = await req.json();
      const { id, title, content, category, status, is_pinned, target_plans, expires_at } = body;
      if (!id) return err('id required');

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (title         !== undefined) updateData.title         = title;
      if (content       !== undefined) updateData.content       = content;
      if (category      !== undefined) updateData.category      = category;
      if (is_pinned     !== undefined) updateData.is_pinned     = is_pinned;
      if (target_plans  !== undefined) updateData.target_plans  = target_plans;
      if (expires_at    !== undefined) updateData.expires_at    = expires_at;

      if (status !== undefined) {
        updateData.status = status;
        if (status === 'published') updateData.published_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('notices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '공지사항 수정', {
        target_type:  'notice',
        target_id:    id,
        target_label: data.title,
      });

      return json({ notice: data });
    }

    // PATCH /notice/status - 공지사항 상태만 변경 (게시/비게시/보관)
    if (req.method === 'PATCH' && action === 'update_notice_status') {
      const body = await req.json();
      const { id, status } = body;
      if (!id || !status) return err('id and status required');

      const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === 'published') updateData.published_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('notices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) return err(error.message);
      return json({ notice: data });
    }

    // DELETE /notice - 공지사항 삭제
    if (req.method === 'DELETE' && action === 'delete_notice') {
      const id = url.searchParams.get('id');
      if (!id) return err('id required');

      const { error } = await supabase.from('notices').delete().eq('id', id);
      if (error) return err(error.message);

      await writeAuditLog(supabase, admin, '공지사항 삭제', {
        target_type: 'notice',
        target_id:   id,
      });

      return json({ success: true });
    }

    // ─────────────────────────────────────────────
    // PUSH / EMAIL 발송 (시뮬레이션 - 실제 발송 서비스 연동 가능)
    // ─────────────────────────────────────────────

    // POST /send_push - 푸시 알림 발송
    if (req.method === 'POST' && action === 'send_push') {
      const body = await req.json();
      const { title, message, target_plan } = body;
      if (!message) return err('message required');

      await writeAuditLog(supabase, admin, '브라우저 푸시 발송', {
        target_type:  'system',
        target_label: `대상: ${target_plan ?? '전체'}`,
        detail:       message.slice(0, 100),
      });

      return json({
        success: true,
        sent_to: target_plan ?? '전체',
        message: `푸시 알림이 ${target_plan ?? '전체'} 대상으로 발송됐습니다`,
      });
    }

    // POST /send_email - 이메일 발송
    if (req.method === 'POST' && action === 'send_email') {
      const body = await req.json();
      const { subject, message, target_plan } = body;
      if (!subject || !message) return err('subject and message required');

      await writeAuditLog(supabase, admin, '이메일 발송', {
        target_type:  'system',
        target_label: `대상: ${target_plan ?? '전체'}`,
        detail:       `제목: ${subject}`,
      });

      return json({
        success: true,
        sent_to: target_plan ?? '전체',
        message: `이메일이 ${target_plan ?? '전체'} 대상으로 발송됐습니다`,
      });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-cs error:', e);
    return err('Internal server error', 500);
  }
});
