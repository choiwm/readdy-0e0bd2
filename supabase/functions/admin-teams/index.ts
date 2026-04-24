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
  const action = url.searchParams.get('action');

  try {
    // ── LIST TEAMS ──────────────────────────────────────────────────────────
    if (action === 'list_teams') {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const teamIds = (teams ?? []).map((t: Record<string, unknown>) => t.id as string);
      const memberCounts: Record<string, number> = {};

      if (teamIds.length > 0) {
        const { data: memberData } = await supabase
          .from('team_members')
          .select('team_id')
          .in('team_id', teamIds);

        (memberData ?? []).forEach((m: Record<string, unknown>) => {
          const tid = m.team_id as string;
          memberCounts[tid] = (memberCounts[tid] ?? 0) + 1;
        });
      }

      const enriched = (teams ?? []).map((t: Record<string, unknown>) => ({
        ...t,
        member_count: memberCounts[t.id as string] ?? 0,
      }));

      return new Response(JSON.stringify({ teams: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── TEAM STATS ──────────────────────────────────────────────────────────
    if (action === 'team_stats') {
      const { data: teams } = await supabase.from('teams').select('id, status');
      const { data: members } = await supabase.from('team_members').select('id');

      const total = (teams ?? []).length;
      const active = (teams ?? []).filter((t: Record<string, unknown>) => t.status === 'active').length;
      const totalMembers = (members ?? []).length;

      return new Response(JSON.stringify({
        stats: { total, active, inactive: total - active, total_members: totalMembers },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── TEAM CONTENT STATS (팀별 콘텐츠 통계 대시보드용) ────────────────────
    if (action === 'team_content_stats') {
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (teamsError) throw teamsError;

      const teamIds = (teams ?? []).map((t: Record<string, unknown>) => t.id as string);

      if (teamIds.length === 0) {
        return new Response(JSON.stringify({ teams: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 멤버 수 집계
      const { data: memberData } = await supabase
        .from('team_members')
        .select('team_id, user_id')
        .in('team_id', teamIds);

      const memberCounts: Record<string, number> = {};
      (memberData ?? []).forEach((m: Record<string, unknown>) => {
        const tid = m.team_id as string;
        memberCounts[tid] = (memberCounts[tid] ?? 0) + 1;
      });

      // 콘텐츠 통계 집계 (gallery_items, audio_history, automation_projects, board_projects)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [galleryRes, audioRes, autoRes, boardRes] = await Promise.allSettled([
        supabase.from('gallery_items').select('team_id, created_at').in('team_id', teamIds),
        supabase.from('audio_history').select('team_id, created_at').in('team_id', teamIds),
        supabase.from('automation_projects').select('team_id, created_at').in('team_id', teamIds),
        supabase.from('board_projects').select('team_id, created_at').in('team_id', teamIds),
      ]);

      const gallery = galleryRes.status === 'fulfilled' ? (galleryRes.value.data ?? []) : [];
      const audio = audioRes.status === 'fulfilled' ? (audioRes.value.data ?? []) : [];
      const automation = autoRes.status === 'fulfilled' ? (autoRes.value.data ?? []) : [];
      const boards = boardRes.status === 'fulfilled' ? (boardRes.value.data ?? []) : [];

      // 팀별 집계
      const statsMap: Record<string, {
        gallery_count: number;
        audio_count: number;
        automation_count: number;
        board_count: number;
        content_7d: number;
        content_30d: number;
      }> = {};

      teamIds.forEach((id) => {
        statsMap[id] = {
          gallery_count: 0, audio_count: 0, automation_count: 0, board_count: 0,
          content_7d: 0, content_30d: 0,
        };
      });

      const allItems = [
        ...gallery.map((i: Record<string, unknown>) => ({ ...i, _type: 'gallery' })),
        ...audio.map((i: Record<string, unknown>) => ({ ...i, _type: 'audio' })),
        ...automation.map((i: Record<string, unknown>) => ({ ...i, _type: 'automation' })),
        ...boards.map((i: Record<string, unknown>) => ({ ...i, _type: 'board' })),
      ];

      allItems.forEach((item: Record<string, unknown>) => {
        const tid = item.team_id as string;
        if (!tid || !statsMap[tid]) return;
        const createdAt = item.created_at as string;

        if (item._type === 'gallery') statsMap[tid].gallery_count++;
        else if (item._type === 'audio') statsMap[tid].audio_count++;
        else if (item._type === 'automation') statsMap[tid].automation_count++;
        else if (item._type === 'board') statsMap[tid].board_count++;

        if (createdAt >= sevenDaysAgo) statsMap[tid].content_7d++;
        if (createdAt >= thirtyDaysAgo) statsMap[tid].content_30d++;
      });

      const enriched = (teams ?? []).map((team: Record<string, unknown>) => {
        const tid = team.id as string;
        const s = statsMap[tid] ?? { gallery_count: 0, audio_count: 0, automation_count: 0, board_count: 0, content_7d: 0, content_30d: 0 };
        const total_content = s.gallery_count + s.audio_count + s.automation_count + s.board_count;

        // 성장률: 7일 vs 이전 7일 비교
        const growth_pct = s.content_30d > 0
          ? Math.round(((s.content_7d / Math.max(s.content_30d - s.content_7d, 1)) - 1) * 100)
          : 0;

        return {
          ...team,
          member_count: memberCounts[tid] ?? 0,
          total_content,
          gallery_count: s.gallery_count,
          audio_count: s.audio_count,
          automation_count: s.automation_count,
          board_count: s.board_count,
          content_7d: s.content_7d,
          content_30d: s.content_30d,
          active_members_7d: memberCounts[tid] ?? 0, // 실제 활성 멤버 추적은 usage_logs 필요
          growth_pct: Math.max(-99, Math.min(999, growth_pct)),
        };
      });

      return new Response(JSON.stringify({ teams: enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── GET TEAM MEMBERS ────────────────────────────────────────────────────
    if (action === 'get_members') {
      const teamId = url.searchParams.get('team_id');
      if (!teamId) throw new Error('team_id required');

      const { data: members, error } = await supabase
        .from('team_members')
        .select('*, user_profiles(id, email, display_name, plan, status, credit_balance)')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ members: members ?? [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── GET TEAM CONTENT ────────────────────────────────────────────────────
    if (action === 'get_team_content') {
      const teamId = url.searchParams.get('team_id');
      if (!teamId) throw new Error('team_id required');

      const [galleryRes, audioRes, autoRes] = await Promise.allSettled([
        supabase.from('gallery_items').select('id, type, url, prompt, model, created_at, user_id').eq('team_id', teamId).order('created_at', { ascending: false }).limit(20),
        supabase.from('audio_history').select('id, type, prompt, status, created_at, user_id').eq('team_id', teamId).order('created_at', { ascending: false }).limit(20),
        supabase.from('automation_projects').select('id, title, status, created_at, user_id').eq('team_id', teamId).order('created_at', { ascending: false }).limit(20),
      ]);

      const gallery = galleryRes.status === 'fulfilled' ? (galleryRes.value.data ?? []) : [];
      const audio = audioRes.status === 'fulfilled' ? (audioRes.value.data ?? []) : [];
      const automation = autoRes.status === 'fulfilled' ? (autoRes.value.data ?? []) : [];

      return new Response(JSON.stringify({ gallery, audio, automation }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── CREATE TEAM ─────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'create_team') {
      const body = await req.json();
      const { name, description, owner_id, content_access, max_members } = body;

      if (!name?.trim()) throw new Error('name required');

      const { data: team, error } = await supabase
        .from('teams')
        .insert({
          name: name.trim(),
          description: description?.trim() ?? null,
          owner_id: owner_id ?? null,
          content_access: content_access ?? 'shared',
          max_members: max_members ?? 10,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      if (owner_id && team) {
        await supabase.from('team_members').insert({
          team_id: team.id,
          user_id: owner_id,
          role: 'owner',
        });
      }

      await writeAuditLog(supabase, admin, '팀 생성', {
        target_type: 'team',
        target_id: team?.id ?? '',
        target_label: name,
      });

      return new Response(JSON.stringify({ team }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── UPDATE TEAM ─────────────────────────────────────────────────────────
    if (req.method === 'PUT' && action === 'update_team') {
      const body = await req.json();
      const { id, name, description, status, content_access, max_members } = body;

      if (!id) throw new Error('id required');

      const { data: team, error } = await supabase
        .from('teams')
        .update({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(status !== undefined && { status }),
          ...(content_access !== undefined && { content_access }),
          ...(max_members !== undefined && { max_members }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ team }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ADD MEMBER ──────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'add_member') {
      const body = await req.json();
      const { team_id, user_id, role } = body;

      if (!team_id || !user_id) throw new Error('team_id and user_id required');

      const { data: team } = await supabase.from('teams').select('max_members').eq('id', team_id).single();
      const { count } = await supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', team_id);

      if (team && count !== null && count >= (team as Record<string, number>).max_members) {
        return new Response(JSON.stringify({ error: '팀 최대 인원을 초과했습니다' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: member, error } = await supabase
        .from('team_members')
        .insert({ team_id, user_id, role: role ?? 'member' })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return new Response(JSON.stringify({ error: '이미 팀 멤버입니다' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify({ member }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── REMOVE MEMBER ───────────────────────────────────────────────────────
    if (req.method === 'DELETE' && action === 'remove_member') {
      const teamId = url.searchParams.get('team_id');
      const userId = url.searchParams.get('user_id');

      if (!teamId || !userId) throw new Error('team_id and user_id required');

      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── UPDATE MEMBER ROLE ──────────────────────────────────────────────────
    if (req.method === 'PATCH' && action === 'update_member_role') {
      const body = await req.json();
      const { team_id, user_id, role } = body;

      const { error } = await supabase
        .from('team_members')
        .update({ role })
        .eq('team_id', team_id)
        .eq('user_id', user_id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── SEARCH USERS ────────────────────────────────────────────────────────
    if (action === 'search_users') {
      const q = url.searchParams.get('q') ?? '';
      const teamId = url.searchParams.get('team_id');

      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, plan, status')
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
        .eq('status', 'active')
        .limit(10);

      if (error) throw error;

      let filtered = users ?? [];
      if (teamId && filtered.length > 0) {
        const { data: existing } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamId);
        const existingIds = new Set((existing ?? []).map((m: Record<string, string>) => m.user_id));
        filtered = filtered.filter((u: Record<string, string>) => !existingIds.has(u.id));
      }

      return new Response(JSON.stringify({ users: filtered }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
