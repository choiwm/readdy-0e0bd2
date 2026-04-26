// Cron-driven probe of fal.ai model paths with Slack alerting.
//
// WHY THIS EXISTS
// ────────────────
// PR #13 found that multishot was hitting nonexistent kling-v1.6 from launch
// onward — every run silently 404'd. PR #15/#34 added admin healthcheck path
// probes you can run manually, but a manual button doesn't catch fal.ai
// renaming/removing a model six weeks after launch when nobody's looking.
//
// This function is the always-on guard. Schedule it via pg_cron (e.g. every
// 30 min) and it sends one Slack message when a previously-working path
// starts returning 404, plus another when the path comes back.
//
// AUTH
// ────
// requireSchedulerSecret — same pattern as healthcheck-scheduler. Posting
// the SCHEDULER_SECRET env var as `Authorization: Bearer <secret>` is the
// only way in. No admin token needed (so cron jobs can call without a real
// human signed-in).
//
// CONFIG
// ──────
//   SCHEDULER_SECRET                random hex, also used by other crons
//   HEALTHCHECK_SLACK_WEBHOOK_URL   Slack incoming-webhook URL
//   FAL_KEY                         fal.ai key (also read from api_keys DB
//                                    if not in env)
//
// pg_cron example (run every 30 minutes):
//
//   select cron.schedule(
//     'fal-paths-slack',
//     '*/30 * * * *',
//     $$
//       select net.http_post(
//         url     := 'https://<project>.supabase.co/functions/v1/cron-fal-paths-slack',
//         headers := jsonb_build_object('Authorization', 'Bearer ' || vault.read_secret('SCHEDULER_SECRET'))
--       ) $$
--   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireSchedulerSecret, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

interface ProbeResult {
  task: string;
  path: string;
  ok: boolean;
  http_status: number | null;
  duration_ms: number;
  note?: string;
}

// Same list as diagnostic-healthcheck PATH_VALIDATION_PROBES (PR #15/#34).
// Send empty body, treat 422 as "path verified" success, 404 as failure.
const PROBES = [
  { task: 'kling-v2.1-pro/i2v (multishot)', url: 'https://queue.fal.run/fal-ai/kling-video/v2.1/pro/image-to-video' },
  { task: 'kling-v2.5-turbo/i2v',           url: 'https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/standard/image-to-video' },
  { task: 'kling-v3-pro/t2v',               url: 'https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video' },
  { task: 'veo3 (t2v)',                     url: 'https://queue.fal.run/fal-ai/veo3' },
  { task: 'vton workflow',                  url: 'https://queue.fal.run/workflows/fal-vton' },
  { task: 'ffmpeg-api/compose',             url: 'https://queue.fal.run/fal-ai/ffmpeg-api/compose' },
  { task: 'playai-tts',                     url: 'https://queue.fal.run/fal-ai/playai-tts' },
  { task: 'elevenlabs/sound-effects',       url: 'https://queue.fal.run/fal-ai/elevenlabs/sound-effects' },
  { task: 'stable-audio (music)',           url: 'https://queue.fal.run/fal-ai/stable-audio' },
];

// Decryption helper — mirrors diagnostic-healthcheck. fal.ai key may be in
// env or admin-managed in api_keys table.
async function decryptAesV2(encrypted: string): Promise<string | null> {
  try {
    if (!encrypted.startsWith('aes_v2:')) return encrypted;
    const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
    const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
    const key = await crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
    return new TextDecoder().decode(decrypted);
  } catch { return null; }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const envKey = Deno.env.get('FAL_KEY');
  if (envKey) return envKey;
  try {
    const { data } = await supabase
      .from('api_keys')
      .select('encrypted_key')
      .eq('service_slug', 'fal')
      .eq('status', 'active')
      .maybeSingle();
    return data?.encrypted_key ? await decryptAesV2(data.encrypted_key as string) : null;
  } catch { return null; }
}

async function runProbe(falKey: string, task: string, url: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    });
    const duration_ms = Date.now() - start;
    if (res.status === 422) {
      return { task, path: url, ok: true, http_status: 422, duration_ms, note: 'path verified (422)' };
    }
    if (res.ok) {
      return { task, path: url, ok: true, http_status: res.status, duration_ms };
    }
    return { task, path: url, ok: false, http_status: res.status, duration_ms };
  } catch (e) {
    return {
      task, path: url, ok: false, http_status: null,
      duration_ms: Date.now() - start,
      note: e instanceof Error ? e.message : String(e),
    };
  }
}

async function postSlack(webhookUrl: string, failures: ProbeResult[]): Promise<boolean> {
  const lines = failures.map((f) =>
    `• *${f.task}* — HTTP ${f.http_status ?? 'network'}  \`${f.path}\``,
  ).join('\n');

  const payload = {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🚨 fal.ai 모델 경로 실패 감지', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text:
        `${failures.length}개 모델 경로가 fal.ai 카탈로그에서 사라졌거나 404 응답을 돌려주고 있어요. ` +
        `사용자가 해당 모델을 호출하면 즉시 실패합니다.` } },
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: lines } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `🕐 ${new Date().toLocaleString('ko-KR')} | cron-fal-paths-slack` }] },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);
  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try { requireSchedulerSecret(req); } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const falKey = await getFalKey(supabase);
  if (!falKey) {
    return json({ ok: false, error: 'FAL_KEY not configured (env or api_keys)' }, 500);
  }

  const results = await Promise.all(PROBES.map((p) => runProbe(falKey, p.task, p.url)));
  const failures = results.filter((r) => !r.ok);

  // Audit trail — every cron run logs a summary, even when nothing failed.
  // Useful for "did this even run last week?" debugging.
  try {
    await supabase.from('audit_logs').insert({
      admin_email: 'system:cron-fal-paths',
      action: 'fal.ai 경로 검증 실행',
      target_type: 'cron',
      target_id: 'fal-paths',
      target_label: failures.length === 0 ? '모두 OK' : `${failures.length}개 실패`,
      detail: results.map((r) => `${r.task}: ${r.ok ? 'OK' : `${r.http_status ?? 'network'}`}`).join(' | '),
      result: failures.length === 0 ? 'success' : 'failure',
    });
  } catch { /* audit failures non-fatal */ }

  if (failures.length === 0) {
    return json({ ok: true, total: results.length, failed: 0 });
  }

  const webhookUrl = Deno.env.get('HEALTHCHECK_SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    return json({ ok: false, error: 'failures detected but HEALTHCHECK_SLACK_WEBHOOK_URL not set', failures });
  }

  const slackOk = await postSlack(webhookUrl, failures);
  return json({ ok: slackOk, total: results.length, failed: failures.length, slack_sent: slackOk, failures });
});
