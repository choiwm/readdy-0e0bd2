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

// cron 표현식 → 사람이 읽기 쉬운 설명
function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, month, dow] = parts;

  if (min === '*' && hour === '*') return '매 분마다';
  if (hour === '*' && dom === '*' && month === '*' && dow === '*') {
    return `매 시간 ${min}분마다`;
  }
  if (dom === '*' && month === '*' && dow === '*') {
    if (min === '0') return `매 ${hour}시간마다`;
    return `매일 ${hour}:${min.padStart(2, '0')}`;
  }
  if (dow !== '*') {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayLabel = dow.split(',').map((d) => days[parseInt(d)] ?? d).join(', ');
    return `매주 ${dayLabel}요일 ${hour}:${min.padStart(2, '0')}`;
  }
  return expr;
}

// 인터벌(분) → cron 표현식 변환
function intervalToCron(intervalMin: number): string {
  if (intervalMin < 60) return `*/${intervalMin} * * * *`;
  const hours = Math.floor(intervalMin / 60);
  if (hours === 1) return '0 * * * *';
  if (hours < 24) return `0 */${hours} * * *`;
  const days = Math.floor(hours / 24);
  return `0 0 */${days} * *`;
}

// 헬스체크 Edge Function 호출 SQL 명령
function buildHealthcheckCommand(supabaseUrl: string, anonKey: string, slug?: string): string {
  const url = slug
    ? `${supabaseUrl}/functions/v1/healthcheck-scheduler?action=run&slug=${slug}`
    : `${supabaseUrl}/functions/v1/healthcheck-scheduler?action=run`;

  return `SELECT net.http_post(
    url := '${url}',
    headers := '{"Authorization": "Bearer ${anonKey}", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  if (!supabaseUrl || !serviceRoleKey) return err('Server configuration error', 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'list_jobs';

  try {
    // ── GET: pg_cron job 목록 조회 ────────────────────────────────
    if (req.method === 'GET' && action === 'list_jobs') {
      const { data, error } = await supabase.rpc('get_cron_jobs_safe');

      // RPC 없으면 직접 쿼리
      if (error) {
        const { data: rawData, error: rawErr } = await supabase
          .from('cron.job' as never)
          .select('*');

        if (rawErr) {
          // cron.job 직접 접근도 안 되면 빈 배열 반환 + pg_net 상태 체크
          const { data: extData } = await supabase
            .rpc('check_extensions');

          return json({
            jobs: [],
            pg_cron_enabled: false,
            pg_net_enabled: false,
            message: 'pg_cron 접근 불가. Supabase 대시보드에서 pg_cron 익스텐션을 활성화해주세요.',
            setup_required: true,
          });
        }
        return json({ jobs: rawData ?? [], pg_cron_enabled: true });
      }

      return json({ jobs: data ?? [], pg_cron_enabled: true });
    }

    // ── GET: pg_cron + pg_net 익스텐션 상태 확인 ─────────────────
    if (req.method === 'GET' && action === 'check_status') {
      // 익스텐션 확인
      const { data: extData } = await supabase
        .from('pg_extension' as never)
        .select('extname, extversion')
        .in('extname' as never, ['pg_cron', 'pg_net'] as never);

      const exts = (extData as Array<{ extname: string; extversion: string }>) ?? [];
      const pgCron = exts.find((e) => e.extname === 'pg_cron');
      const pgNet = exts.find((e) => e.extname === 'pg_net');

      // cron.job 테이블에서 헬스체크 관련 job 조회
      let jobs: Array<{
        jobid: number;
        jobname: string;
        schedule: string;
        command: string;
        active: boolean;
      }> = [];

      if (pgCron) {
        try {
          // service_role로 cron 스키마 직접 쿼리
          const cronRes = await fetch(
            `${supabaseUrl}/rest/v1/rpc/get_healthcheck_cron_jobs`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey,
              },
              body: '{}',
            }
          );

          if (cronRes.ok) {
            jobs = await cronRes.json();
          }
        } catch (_e) {
          // RPC 없으면 빈 배열
        }
      }

      // 최근 실행 이력
      let recentRuns: Array<{
        runid: number;
        jobid: number;
        status: string;
        return_message: string;
        start_time: string;
        end_time: string;
        command: string;
      }> = [];

      if (pgCron) {
        try {
          const runsRes = await fetch(
            `${supabaseUrl}/rest/v1/rpc/get_healthcheck_cron_runs`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey,
              },
              body: JSON.stringify({ p_limit: 20 }),
            }
          );
          if (runsRes.ok) {
            recentRuns = await runsRes.json();
          }
        } catch (_e) {
          // 무시
        }
      }

      return json({
        pg_cron_enabled: !!pgCron,
        pg_cron_version: pgCron?.extversion ?? null,
        pg_net_enabled: !!pgNet,
        pg_net_version: pgNet?.extversion ?? null,
        jobs,
        recent_runs: recentRuns,
        supabase_url: supabaseUrl,
      });
    }

    // ── POST: cron job 등록/업데이트 ──────────────────────────────
    if (req.method === 'POST' && action === 'upsert_job') {
      let body: {
        jobname?: string;
        interval_min?: number;
        schedule?: string;
        slug?: string;
        enabled?: boolean;
      };
      try { body = await req.json(); } catch { return err('Invalid JSON body'); }

      const { jobname, interval_min, schedule, slug, enabled = true } = body;
      if (!jobname) return err('jobname required');

      const cronExpr = schedule ?? (interval_min ? intervalToCron(interval_min) : '0 * * * *');
      const command = buildHealthcheckCommand(supabaseUrl, anonKey, slug);

      // cron.schedule() 호출 — service_role로 직접 SQL 실행
      const sqlCommand = `
        DO $$
        BEGIN
          -- 기존 job 삭제 시도
          BEGIN
            PERFORM cron.unschedule('${jobname.replace(/'/g, "''")}');
          EXCEPTION WHEN OTHERS THEN
            NULL;
          END;
          -- 새 job 등록
          PERFORM cron.schedule(
            '${jobname.replace(/'/g, "''")}',
            '${cronExpr.replace(/'/g, "''")}',
            $cmd$${command}$cmd$
          );
          -- 활성화 상태 설정
          UPDATE cron.job SET active = ${enabled} WHERE jobname = '${jobname.replace(/'/g, "''")}';
        END;
        $$;
      `;

      // Supabase Management API를 통한 SQL 실행
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (!projectRef) return err('Cannot determine project ref');

      const mgmtRes = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sqlCommand }),
        }
      );

      if (!mgmtRes.ok) {
        // Management API 실패 시 RPC 방식 시도
        const { error: rpcErr } = await supabase.rpc('upsert_cron_job', {
          p_jobname: jobname,
          p_schedule: cronExpr,
          p_command: command,
        });

        if (rpcErr) {
          return json({
            success: false,
            error: rpcErr.message,
            manual_sql: sqlCommand,
            message: '자동 등록에 실패했습니다. 아래 SQL을 Supabase SQL Editor에서 직접 실행해주세요.',
          });
        }
      }

      return json({
        success: true,
        jobname,
        schedule: cronExpr,
        description: describeCron(cronExpr),
        command,
        message: `cron job "${jobname}" 등록 완료 (${describeCron(cronExpr)})`,
      });
    }

    // ── DELETE: cron job 삭제 ─────────────────────────────────────
    if (req.method === 'DELETE' && action === 'delete_job') {
      let body: { jobname?: string };
      try { body = await req.json(); } catch { return err('Invalid JSON body'); }
      const { jobname } = body;
      if (!jobname) return err('jobname required');

      const { error: rpcErr } = await supabase.rpc('delete_cron_job', { p_jobname: jobname });

      if (rpcErr) {
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
        const sqlCommand = `SELECT cron.unschedule('${jobname.replace(/'/g, "''")}');`;
        return json({
          success: false,
          error: rpcErr.message,
          manual_sql: sqlCommand,
          message: '자동 삭제에 실패했습니다. 아래 SQL을 직접 실행해주세요.',
        });
      }

      return json({ success: true, message: `cron job "${jobname}" 삭제 완료` });
    }

    // ── PATCH: cron job 활성/비활성 토글 ─────────────────────────
    if (req.method === 'PATCH' && action === 'toggle_job') {
      let body: { jobname?: string; active?: boolean };
      try { body = await req.json(); } catch { return err('Invalid JSON body'); }
      const { jobname, active } = body;
      if (!jobname || active === undefined) return err('jobname and active required');

      const { error: rpcErr } = await supabase.rpc('toggle_cron_job', {
        p_jobname: jobname,
        p_active: active,
      });

      if (rpcErr) {
        return json({
          success: false,
          error: rpcErr.message,
          manual_sql: `UPDATE cron.job SET active = ${active} WHERE jobname = '${jobname}';`,
        });
      }

      return json({ success: true, message: `cron job "${jobname}" ${active ? '활성화' : '비활성화'} 완료` });
    }

    // ── GET: 권장 SQL 스크립트 생성 ───────────────────────────────
    if (req.method === 'GET' && action === 'get_setup_sql') {
      const intervalMin = parseInt(url.searchParams.get('interval_min') ?? '60');
      const cronExpr = intervalToCron(intervalMin);
      const command = buildHealthcheckCommand(supabaseUrl, anonKey);

      const setupSql = `-- ============================================================
-- Readdy AI 헬스체크 pg_cron 자동화 설정
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. pg_cron 익스텐션 활성화 (이미 활성화된 경우 무시됨)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. pg_net 익스텐션 활성화 (HTTP 요청용)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. 기존 헬스체크 job 삭제 (있는 경우)
DO $$
BEGIN
  PERFORM cron.unschedule('readdy-healthcheck');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

-- 4. 헬스체크 cron job 등록 (${describeCron(cronExpr)})
SELECT cron.schedule(
  'readdy-healthcheck',
  '${cronExpr}',
  $cmd$
  ${command}
  $cmd$
);

-- 5. 등록 확인
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'readdy-healthcheck';`;

      const perServiceSql = `-- ============================================================
-- 서비스별 개별 헬스체크 job 등록 (선택사항)
-- ============================================================

${['fal', 'goapi', 'elevenlabs', 'suno', 'openai', 'lalalai'].map((slug) => {
  const svcCommand = buildHealthcheckCommand(supabaseUrl, anonKey, slug);
  return `-- ${slug} 헬스체크
DO $$
BEGIN
  PERFORM cron.unschedule('readdy-healthcheck-${slug}');
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;
SELECT cron.schedule(
  'readdy-healthcheck-${slug}',
  '${cronExpr}',
  $cmd$${svcCommand}$cmd$
);`;
}).join('\n\n')}`;

      return json({
        setup_sql: setupSql,
        per_service_sql: perServiceSql,
        cron_expr: cronExpr,
        description: describeCron(cronExpr),
        interval_min: intervalMin,
      });
    }

    // ── GET: 실행 이력 조회 ───────────────────────────────────────
    if (req.method === 'GET' && action === 'get_runs') {
      const limit = parseInt(url.searchParams.get('limit') ?? '20');

      const { data, error } = await supabase.rpc('get_healthcheck_cron_runs', { p_limit: limit });

      if (error) {
        return json({ runs: [], error: error.message, message: 'cron 실행 이력을 조회할 수 없습니다.' });
      }

      return json({ runs: data ?? [] });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('cron-manager error:', e);
    return err(`Internal error: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
});
