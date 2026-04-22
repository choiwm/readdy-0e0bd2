import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
  const action = url.searchParams.get('action') ?? 'list';

  try {
    // ── 콘텐츠 목록 (gallery + audio + automation + board 통합) ──────
    if (req.method === 'GET' && action === 'list') {
      const limit  = parseInt(url.searchParams.get('limit') ?? '50');
      const status = url.searchParams.get('status') ?? '';   // approved|pending|blocked
      const type   = url.searchParams.get('type') ?? '';     // gallery|audio|automation|board

      const results: unknown[] = [];

      // gallery_items
      if (!type || type === 'gallery') {
        let q = supabase
          .from('gallery_items')
          .select('id, type, url, prompt, model, created_at, user_id, liked')
          .order('created_at', { ascending: false })
          .limit(limit);
        const { data } = await q;
        (data ?? []).forEach((item) => {
          results.push({
            id:        item.id,
            title:     item.prompt ? item.prompt.slice(0, 40) + (item.prompt.length > 40 ? '...' : '') : 'AI 이미지',
            user:      item.user_id ?? '알 수 없음',
            type:      'AI 이미지',
            source:    'gallery',
            status:    'approved',
            date:      item.created_at,
            thumbnail: item.url ?? '',
            model:     item.model ?? '-',
          });
        });
      }

      // audio_history
      if (!type || type === 'audio') {
        let q = supabase
          .from('audio_history')
          .select('id, title, type, status, created_at, user_session, voice_name')
          .order('created_at', { ascending: false })
          .limit(limit);
        const { data } = await q;
        (data ?? []).forEach((item) => {
          results.push({
            id:        item.id,
            title:     item.title ?? 'AI 사운드',
            user:      item.user_session ?? '알 수 없음',
            type:      item.type === 'music' ? 'AI 음악' : item.type === 'tts' ? 'AI 음성' : 'AI 사운드',
            source:    'audio',
            status:    item.status === 'completed' ? 'approved' : item.status === 'failed' ? 'blocked' : 'pending',
            date:      item.created_at,
            thumbnail: '',
            model:     item.voice_name ?? '-',
          });
        });
      }

      // automation_projects
      if (!type || type === 'automation') {
        let q = supabase
          .from('automation_projects')
          .select('id, title, status, thumbnail, created_at, model, style')
          .order('created_at', { ascending: false })
          .limit(limit);
        const { data } = await q;
        (data ?? []).forEach((item) => {
          results.push({
            id:        item.id,
            title:     item.title ?? '유튜브 자동화',
            user:      '-',
            type:      '유튜브 자동화',
            source:    'automation',
            status:    item.status === 'completed' ? 'approved' : item.status === 'failed' ? 'blocked' : 'pending',
            date:      item.created_at,
            thumbnail: item.thumbnail ?? '',
            model:     item.model ?? '-',
          });
        });
      }

      // board_projects
      if (!type || type === 'board') {
        let q = supabase
          .from('board_projects')
          .select('id, title, model, created_at')
          .order('created_at', { ascending: false })
          .limit(limit);
        const { data } = await q;
        (data ?? []).forEach((item) => {
          results.push({
            id:        item.id,
            title:     item.title ?? 'AI 보드',
            user:      '-',
            type:      'AI 보드',
            source:    'board',
            status:    'approved',
            date:      item.created_at,
            thumbnail: '',
            model:     item.model ?? '-',
          });
        });
      }

      // 날짜 내림차순 정렬 후 limit 적용
      results.sort((a: unknown, b: unknown) => {
        const aDate = (a as { date: string }).date ?? '';
        const bDate = (b as { date: string }).date ?? '';
        return bDate.localeCompare(aDate);
      });

      // status 필터 (approved/pending/blocked)
      const filtered = status
        ? results.filter((r) => (r as { status: string }).status === status)
        : results;

      return json({ items: filtered.slice(0, limit * 4) });
    }

    // ── 콘텐츠 통계 ────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'stats') {
      const [
        { count: galleryTotal },
        { count: audioTotal },
        { count: automationTotal },
        { count: boardTotal },
        { count: audioPending },
        { count: automationPending },
        { count: audioBlocked },
        { count: automationBlocked },
      ] = await Promise.all([
        supabase.from('gallery_items').select('*', { count: 'exact', head: true }),
        supabase.from('audio_history').select('*', { count: 'exact', head: true }),
        supabase.from('automation_projects').select('*', { count: 'exact', head: true }),
        supabase.from('board_projects').select('*', { count: 'exact', head: true }),
        supabase.from('audio_history').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('automation_projects').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('audio_history').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('automation_projects').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      ]);

      const total   = (galleryTotal ?? 0) + (audioTotal ?? 0) + (automationTotal ?? 0) + (boardTotal ?? 0);
      const pending = (audioPending ?? 0) + (automationPending ?? 0);
      const blocked = (audioBlocked ?? 0) + (automationBlocked ?? 0);

      return json({
        stats: {
          total,
          gallery:    galleryTotal ?? 0,
          audio:      audioTotal ?? 0,
          automation: automationTotal ?? 0,
          board:      boardTotal ?? 0,
          pending,
          blocked,
        },
      });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-content error:', e);
    return err('Internal server error', 500);
  }
});
