// Admin-only end-to-end fal.ai health check.
//
// The existing /admin → AI 엔진 → API 키 관리 → 테스트 button only proves
// that the stored fal.ai key authenticates. It does not prove that
//
//   - generate-image queue submit works
//   - generate-image queue polling works
//   - the wired model paths in fal_image_models.ts / fal_video_models.ts
//     resolve to a 200 response on the live fal.ai catalog
//
// This function calls fal.ai directly (skipping our generate-* layer so we
// don't double-charge credits) using a tiny payload and returns a per-task
// matrix the admin UI renders as a diagnostic table.
//
// Auth: requireAdmin — never expose to end users.
// Cost: each call charges fal.ai for one tiny generation per task. Default
// task list is image-only to keep cost low; video probes are opt-in via
// the request body.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { parseFalError, toClientPayload, getFalRequestId } from '../_shared/fal_errors.ts';
import { VERIFIED_FAL_IMAGE_MODELS } from '../_shared/fal_image_models.ts';
import { VERIFIED_FAL_VIDEO_MODELS } from '../_shared/fal_video_models.ts';

interface ProbeResult {
  task: string;
  model: string;
  ok: boolean;
  http_status: number | null;
  duration_ms: number;
  /** Populated only on failure — toClientPayload(parseFalError(...)) shape. */
  error?: ReturnType<typeof toClientPayload>;
  fal_request_id?: string | null;
  /** Notes — e.g. "skipped (preview model)" */
  note?: string;
}

interface DiagnosticReport {
  timestamp: string;
  fal_key_found: boolean;
  fal_key_source: 'db' | 'env' | null;
  app_jwt_secret_set: boolean;
  allowed_origins: string | null;
  probes: ProbeResult[];
  summary: {
    total: number;
    ok: number;
    failed: number;
    skipped: number;
  };
}

// ── Decryption helpers (mirror the version in admin-api-keys / generate-image) ─
async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    if (encrypted.startsWith('aes_v2:')) {
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      const key = await crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12),
      );
      return new TextDecoder().decode(decrypted);
    }
    return encrypted; // legacy fallthrough — admin-api-keys handles older formats
  } catch {
    return null;
  }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<{ key: string | null; source: 'db' | 'env' | null }> {
  try {
    const { data } = await supabase
      .from('api_keys')
      .select('encrypted_key, status')
      .eq('service_slug', 'fal')
      .eq('status', 'active')
      .maybeSingle();
    if (data?.encrypted_key) {
      const k = await decryptKey(data.encrypted_key as string);
      if (k) return { key: k, source: 'db' };
    }
  } catch { /* fall through */ }
  const envKey = Deno.env.get('FAL_KEY');
  if (envKey) return { key: envKey, source: 'env' };
  return { key: null, source: null };
}

// ── Probe runner ──────────────────────────────────────────────────────────
// validateOnly mode: send an intentionally-empty body and treat 422 as
// "OK — path verified". Useful for confirming a model path exists on
// fal.ai's catalog without burning credits on a real generation.
//   - 200/202    → path exists AND request was accepted
//   - 422        → path exists but body was rejected (validateOnly: success)
//   - 404        → path does NOT exist (the kling-v1.6 bug we fixed in PR #13)
//   - 401/403    → auth issue
async function runProbe(
  task: string,
  modelPath: string,
  url: string,
  body: unknown,
  falKey: string,
  timeoutMs = 30_000,
  validateOnly = false,
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let parsedBody: Record<string, unknown> = {};
    try { parsedBody = JSON.parse(text); } catch { /* empty */ }
    const duration_ms = Date.now() - start;

    if (res.ok) {
      return {
        task, model: modelPath, ok: true,
        http_status: res.status, duration_ms,
        fal_request_id: getFalRequestId(res),
      };
    }

    if (validateOnly && res.status === 422) {
      return {
        task, model: modelPath, ok: true,
        http_status: res.status, duration_ms,
        fal_request_id: getFalRequestId(res),
        note: 'path verified (422 expected — empty body)',
      };
    }

    const parsed = parseFalError(res.status, parsedBody, res);
    return {
      task, model: modelPath, ok: false,
      http_status: res.status, duration_ms,
      fal_request_id: getFalRequestId(res),
      error: toClientPayload(parsed, getFalRequestId(res)),
    };
  } catch (e) {
    const duration_ms = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      task, model: modelPath, ok: false,
      http_status: null, duration_ms,
      error: {
        error: msg, message: msg, action: '네트워크 또는 타임아웃 — Edge Function 콜드 스타트 또는 fal.ai 응답 지연일 수 있어요.',
        kind: msg.toLowerCase().includes('timeout') ? 'timeout' : 'unknown',
        fal_error_type: null, http_status: 0, is_retryable: true,
      },
    };
  }
}

// ── Probe definitions ─────────────────────────────────────────────────────
// Tiny payloads — minimal credit burn while still exercising fal.ai.
const IMAGE_PROBES = [
  {
    task: 'image:flux-schnell (sync)',
    modelKey: 'fal-ai/flux/schnell',
    url: () => `https://fal.run/fal-ai/flux/schnell`,
    body: { prompt: 'white square', image_size: { width: 64, height: 64 }, num_images: 1, num_inference_steps: 1 },
  },
  {
    task: 'image:flux-pro (queue submit)',
    modelKey: 'fal-ai/flux-pro',
    url: () => `https://queue.fal.run/fal-ai/flux-pro`,
    body: { prompt: 'white square', image_size: { width: 256, height: 256 }, num_images: 1 },
  },
];

const VIDEO_PROBES = [
  // Video models are expensive ($1+ per call); only probe queue submission
  // (which validates path + auth) — actual video generation isn't needed.
  {
    task: 'video:kling-v1 (queue submit)',
    modelKey: 'kling-v1',
    url: () => `https://queue.fal.run/fal-ai/kling-video/v1/standard/text-to-video`,
    body: { prompt: 'a white square', duration: '5' },
  },
];

// validateOnly probes — verify the path exists on fal.ai's catalog without
// spending credits. We send an empty body and accept 422 as "OK".
// Added after PR #13 found that multishot was hitting nonexistent kling-v1.6
// for the entire product lifetime — these probes catch that class of bug
// the next time it happens.
const PATH_VALIDATION_PROBES = [
  // ── Video models ──────────────────────────────────────────────────────
  {
    task: 'path:kling-v2.1-pro/i2v (multishot)',
    modelKey: 'kling-v2.1-pro',
    url: () => `https://queue.fal.run/fal-ai/kling-video/v2.1/pro/image-to-video`,
    body: {},
  },
  {
    task: 'path:kling-v2.5-turbo/i2v',
    modelKey: 'kling-v2.5-turbo',
    url: () => `https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/standard/image-to-video`,
    body: {},
  },
  {
    task: 'path:kling-v3-pro/t2v',
    modelKey: 'kling-v3-pro',
    url: () => `https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video`,
    body: {},
  },
  {
    task: 'path:veo3 (t2v)',
    modelKey: 'veo3',
    url: () => `https://queue.fal.run/fal-ai/veo3`,
    body: {},
  },
  {
    task: 'path:vton workflow',
    modelKey: 'workflows/fal-vton',
    url: () => `https://queue.fal.run/workflows/fal-vton`,
    body: {},
  },
  // ── Pipeline auxiliaries ──────────────────────────────────────────────
  {
    task: 'path:ffmpeg-api/compose (multishot mp4 convert)',
    modelKey: 'ffmpeg-api/compose',
    url: () => `https://queue.fal.run/fal-ai/ffmpeg-api/compose`,
    body: {},
  },
  // ── Audio models ──────────────────────────────────────────────────────
  {
    task: 'path:playai-tts',
    modelKey: 'playai-tts',
    url: () => `https://queue.fal.run/fal-ai/playai-tts`,
    body: {},
  },
  {
    task: 'path:elevenlabs/sound-effects',
    modelKey: 'elevenlabs/sound-effects',
    url: () => `https://queue.fal.run/fal-ai/elevenlabs/sound-effects`,
    body: {},
  },
  {
    task: 'path:stable-audio (music)',
    modelKey: 'stable-audio',
    url: () => `https://queue.fal.run/fal-ai/stable-audio`,
    body: {},
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    await requireAdmin(req, ['super_admin', 'ops']);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const includeVideo = Boolean(body.include_video);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { key: falKey, source } = await getFalKey(supabase);
  const probes: ProbeResult[] = [];

  if (!falKey) {
    return json({
      timestamp: new Date().toISOString(),
      fal_key_found: false,
      fal_key_source: null,
      app_jwt_secret_set: Boolean(Deno.env.get('APP_JWT_SECRET')),
      allowed_origins: Deno.env.get('ALLOWED_ORIGINS') ?? null,
      probes: [],
      summary: { total: 0, ok: 0, failed: 0, skipped: 0 },
      error: 'fal.ai API 키가 등록되지 않았어요.',
      action: '관리자 패널 → AI 엔진 → API 키 관리에서 fal.ai 키를 등록하세요.',
    } satisfies DiagnosticReport & { error: string; action: string });
  }

  const tasksToRun = [...IMAGE_PROBES, ...(includeVideo ? VIDEO_PROBES : [])];

  for (const probe of tasksToRun) {
    // Skip preview/unverified models entirely — would 99% guarantee a 404
    // and waste a call.
    const videoEntry = VERIFIED_FAL_VIDEO_MODELS[probe.modelKey];
    const imageEntry = VERIFIED_FAL_IMAGE_MODELS[probe.modelKey];
    if ((videoEntry && !videoEntry.verified) || (imageEntry && !imageEntry)) {
      probes.push({
        task: probe.task, model: probe.modelKey, ok: false,
        http_status: null, duration_ms: 0,
        note: 'skipped — preview/unverified model',
      });
      continue;
    }
    probes.push(await runProbe(probe.task, probe.modelKey, probe.url(), probe.body, falKey));
  }

  // Path-only validation probes — always run, regardless of include_video.
  // Empty body intentionally — 422 is the success signal (path exists).
  for (const probe of PATH_VALIDATION_PROBES) {
    probes.push(await runProbe(probe.task, probe.modelKey, probe.url(), probe.body, falKey, 30_000, true));
  }

  const summary = {
    total: probes.length,
    ok: probes.filter((p) => p.ok).length,
    failed: probes.filter((p) => !p.ok && !p.note).length,
    skipped: probes.filter((p) => p.note).length,
  };

  // Audit trail — admin-triggered diagnostic always logged.
  try {
    await supabase.from('audit_logs').insert({
      admin_email: 'system',
      action: 'fal.ai 진단 헬스체크 실행',
      target_type: 'system',
      target_id: 'fal',
      target_label: `${summary.ok}/${summary.total} OK`,
      detail: probes.map((p) => `${p.task}: ${p.ok ? 'OK' : (p.note ?? p.error?.kind ?? 'fail')}`).join(' | '),
      result: summary.failed === 0 ? 'success' : 'failure',
    });
  } catch { /* ignore audit failure */ }

  return json({
    timestamp: new Date().toISOString(),
    fal_key_found: true,
    fal_key_source: source,
    app_jwt_secret_set: Boolean(Deno.env.get('APP_JWT_SECRET')),
    allowed_origins: Deno.env.get('ALLOWED_ORIGINS') ?? null,
    probes,
    summary,
  } satisfies DiagnosticReport);
});
