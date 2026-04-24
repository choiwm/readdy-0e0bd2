import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';

const VIP_PLANS = ['enterprise', 'vip', 'admin'];

const FALLBACK_COSTS: Record<string, number> = {
  "fal-ai/stable-audio": 30,
  "fal-ai/musicgen":     25,
  "suno":                40,
};
const DEFAULT_MUSIC_COST = 30;

/**
 * model-arguments.md: 모델별 파라미터 이름이 다름
 * - fal-ai/stable-audio: seconds_total (최대 190초)
 * - fal-ai/musicgen: duration (초 단위 정수, 최대 30초)
 */
function buildMusicRequestBody(model: string, prompt: string, tags: string, duration: number): Record<string, unknown> {
  const combinedPrompt = tags ? `${prompt}, ${tags}` : prompt;

  if (model.includes('musicgen')) {
    return {
      prompt: combinedPrompt,
      duration: Math.min(Math.max(1, Math.round(duration)), 30),
    };
  }

  if (model.includes('stable-audio')) {
    return {
      prompt: combinedPrompt,
      seconds_total: Math.min(duration, 190),
      steps: 100,
    };
  }

  // 기타 fal 음악 모델 — 범용 파라미터 시도
  return {
    prompt: combinedPrompt,
    duration: Math.min(Math.max(1, Math.round(duration)), 30),
    seconds_total: Math.min(duration, 190),
  };
}

/**
 * model-arguments.md: 응답에서 오디오 URL 추출
 * 다양한 응답 필드 패턴 처리
 */
function extractAudioUrl(data: Record<string, unknown>): string | null {
  return (
    (data?.audio_file as Record<string, unknown>)?.url as string ??
    (data?.audio as Record<string, unknown>)?.url as string ??
    data?.audio_url as string ??
    data?.url as string ??
    (data?.output as Record<string, unknown>)?.url as string ??
    (data?.result as Record<string, unknown>)?.url as string ??
    null
  );
}

function extractFalRequestId(res: Response): string | null {
  return res.headers.get('x-fal-request-id') ?? res.headers.get('X-Fal-Request-Id') ?? null;
}

function extractBillableUnits(res: Response): string | null {
  return res.headers.get('X-Fal-Billable-Units') ?? res.headers.get('x-fal-billable-units') ?? null;
}

function getFalErrorType(res: Response, body: Record<string, unknown>): string | null {
  return res.headers.get('X-Fal-Error-Type') ?? res.headers.get('x-fal-error-type') ?? (body.error_type as string) ?? null;
}

function getFalRetryableHeader(res: Response): string | null {
  return res.headers.get('X-Fal-Retryable') ?? res.headers.get('x-fal-retryable') ?? null;
}

async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    if (encrypted.startsWith('aes_v2:')) {
      const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      const key = await crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
      return new TextDecoder().decode(decrypted);
    }
    if (encrypted.startsWith('aes_v1:')) {
      const base64Data = encrypted.slice(7);
      const combined = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      const secret = Deno.env.get('APP_JWT_SECRET') ?? '';
      const secretBytes = new TextEncoder().encode(secret);
      const keyMaterial = secretBytes.length >= 32
        ? secretBytes.slice(0, 32)
        : new Uint8Array(32).fill(0).map((_, i) => secretBytes[i] ?? 48);
      const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
      const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encryptedData);
      return new TextDecoder().decode(decryptedData);
    }
    if (encrypted.startsWith('enc_v1:')) {
      const parts = encrypted.split(':');
      if (parts.length >= 3) { try { return atob(parts[2]); } catch { return null; } }
    }
    return encrypted;
  } catch { return null; }
}

async function getApiKey(supabase: ReturnType<typeof createClient>, slug: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', slug).eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getCreditCostFromDB(supabase: ReturnType<typeof createClient>, category: string, modelId: string): Promise<number | null> {
  try {
    const { data } = await supabase.from('credit_costs').select('cost').eq('category', category).eq('model_id', modelId).eq('is_active', true).maybeSingle();
    return data?.cost ?? null;
  } catch { return null; }
}

async function getMusicSettings(supabase: ReturnType<typeof createClient>): Promise<{ active_provider: string; active_model: string; suno_enabled: boolean }> {
  try {
    const { data } = await supabase.from('ai_model_settings').select('setting_key, setting_value').eq('category', 'music');
    const settings: Record<string, string> = {};
    (data ?? []).forEach((row: { setting_key: string; setting_value: string }) => { settings[row.setting_key] = row.setting_value; });
    return {
      active_provider: settings.active_provider ?? 'fal',
      active_model: settings.active_model ?? 'fal-ai/stable-audio',
      suno_enabled: settings.suno_enabled !== 'false',
    };
  } catch {
    return { active_provider: 'fal', active_model: 'fal-ai/stable-audio', suno_enabled: true };
  }
}

async function getUserInfo(supabase: ReturnType<typeof createClient>, userId?: string, sessionId?: string) {
  try {
    if (userId) {
      const { data: profile } = await supabase.from('user_profiles').select('plan').eq('id', userId).maybeSingle();
      const plan = (profile?.plan ?? 'free').toLowerCase();
      const isVip = VIP_PLANS.includes(plan);
      if (!isVip) {
        const { data: credit } = await supabase.from('credits').select('balance').eq('user_id', userId).maybeSingle();
        return { plan, credits: credit?.balance ?? 0, isVip: false };
      }
      return { plan, credits: 999999, isVip: true };
    }
    if (sessionId) {
      const { data } = await supabase.from('credits').select('balance').eq('session_id', sessionId).maybeSingle();
      return { plan: 'free', credits: data?.balance ?? 0, isVip: false };
    }
  } catch { /* 폴백 */ }
  return { plan: 'free', credits: 0, isVip: false };
}

async function deductCredits(supabase: ReturnType<typeof createClient>, amount: number, userId?: string, sessionId?: string): Promise<boolean> {
  try {
    if (userId) {
      const { data } = await supabase.from('credits').select('id, balance').eq('user_id', userId).maybeSingle();
      if (!data || data.balance < amount) return false;
      await supabase.from('credits').update({ balance: data.balance - amount, updated_at: new Date().toISOString() }).eq('user_id', userId);
      return true;
    }
    if (sessionId) {
      const { data } = await supabase.from('credits').select('id, balance').eq('session_id', sessionId).maybeSingle();
      if (!data || data.balance < amount) return false;
      await supabase.from('credits').update({ balance: data.balance - amount, updated_at: new Date().toISOString() }).eq('session_id', sessionId);
      return true;
    }
  } catch { /* 폴백 */ }
  return false;
}

async function logUsage(supabase: ReturnType<typeof createClient>, opts: {
  userId?: string; sessionId?: string; serviceSlug: string; action: string;
  creditsDeducted: number; userPlan: string; status: 'success' | 'failed' | 'insufficient_credits';
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('usage_logs').insert({
      user_id: opts.userId ?? null, session_id: opts.sessionId ?? null,
      service_slug: opts.serviceSlug, action: opts.action,
      credits_deducted: opts.creditsDeducted, user_plan: opts.userPlan,
      status: opts.status, metadata: opts.metadata ?? {},
    });
  } catch { /* 무시 */ }
}

async function sendGenerationNotification(opts: {
  userId: string; generationType: string; modelName: string;
  creditsUsed: number; actionUrl: string; supabaseUrl: string; anonKey: string;
}) {
  try {
    await fetch(
      `${opts.supabaseUrl}/functions/v1/credit-alert-notify?action=generation_complete`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${opts.anonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: opts.userId, generation_type: opts.generationType,
          model_name: opts.modelName, credits_used: opts.creditsUsed, action_url: opts.actionUrl,
        }),
      }
    );
  } catch { /* 알림 실패는 무시 */ }
}

/**
 * fal.run 직접 호출 (동기 방식)
 * 실패 시 → Queue 폴백 자동 전환
 */
async function generateWithFal(
  falKey: string,
  model: string,
  prompt: string,
  tags: string,
  duration: number,
): Promise<{ url: string | null; falRequestId: string | null; billableUnits: string | null }> {
  const requestBody = buildMusicRequestBody(model, prompt, tags, duration);
  console.log(`[generate-music] fal.run 요청: model=${model}, body=${JSON.stringify(requestBody).slice(0, 150)}`);

  const falRes = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000),
  });

  const falReqId = extractFalRequestId(falRes);
  const billableUnits = extractBillableUnits(falRes);
  if (falReqId) console.log(`[generate-music] x-fal-request-id: ${falReqId}`);
  if (billableUnits) console.log(`[generate-music] billable-units: ${billableUnits}`);

  if (falRes.status === 401) {
    throw new Error(`fal.ai 인증 실패 (HTTP 401). API 키가 올바른지 확인하세요. fal.ai/dashboard/keys에서 키를 확인해주세요.`);
  }
  if (falRes.status === 403) {
    throw new Error(`fal.ai 권한 없음 (HTTP 403). API 키의 scope를 확인하세요. fal.ai/dashboard/keys에서 API scope 키를 사용해주세요.`);
  }

  if (!falRes.ok) {
    const errText = await falRes.text();
    let errBody: Record<string, unknown> = {};
    try { errBody = JSON.parse(errText); } catch { /* ignore */ }
    const errorType = getFalErrorType(falRes, errBody);
    const retryableHeader = getFalRetryableHeader(falRes);

    // 422 영구 에러 — Queue 폴백 불필요
    if (falRes.status === 422) {
      const isPermanent = retryableHeader === 'false' || (
        retryableHeader === null && (
          errBody.error_type === 'content_policy_violation' ||
          errBody.error_type === 'sequence_too_long' ||
          (Array.isArray(errBody.detail) && errBody.detail.length > 0)
        )
      );
      if (isPermanent) {
        const errMsg = Array.isArray(errBody.detail)
          ? ((errBody.detail[0] as Record<string, unknown>)?.msg as string) ?? '음악 생성 유효성 오류'
          : (errBody.detail as string) ?? '음악 생성 유효성 오류';
        throw new Error(errMsg);
      }
    }

    console.warn(`[generate-music] fal.ai 음악 생성 실패 (${model}) HTTP ${falRes.status} error_type=${errorType}, Queue 폴백`);
    return await generateWithFalQueue(falKey, model, prompt, tags, duration);
  }

  const falData = await falRes.json();
  const url = extractAudioUrl(falData);
  console.log(`[generate-music] fal.run 성공, url=${url ? url.slice(0, 80) : 'null'}`);
  return { url, falRequestId: falReqId, billableUnits };
}

/**
 * Queue 방식 음악 생성
 * 폴링 50회(100초) — musicgen 최대 90초 소요 대응
 * common-parameters.md: X-Fal-Object-Lifecycle-Preference 헤더 적용
 */
async function generateWithFalQueue(
  falKey: string,
  model: string,
  prompt: string,
  tags: string,
  duration: number,
): Promise<{ url: string | null; falRequestId: string | null; billableUnits: string | null }> {
  const requestBody = buildMusicRequestBody(model, prompt, tags, duration);
  console.log(`[generate-music] queue 제출: model=${model}, body=${JSON.stringify(requestBody).slice(0, 150)}`);

  const submitRes = await fetch(`https://queue.fal.run/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falKey}`,
      'Content-Type': 'application/json',
      'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(15000),
  });

  if (submitRes.status === 401) {
    throw new Error(`fal.ai 인증 실패 (HTTP 401). API 키를 확인해주세요.`);
  }
  if (submitRes.status === 403) {
    throw new Error(`fal.ai 권한 없음 (HTTP 403). API 키의 scope를 확인해주세요.`);
  }

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    console.warn(`[generate-music] queue 제출 실패 HTTP ${submitRes.status}: ${errText.slice(0, 100)}`);
    return { url: null, falRequestId: null, billableUnits: null };
  }

  const submitData = await submitRes.json();
  console.log(`[generate-music] queue 제출 성공: ${JSON.stringify(submitData).slice(0, 150)}`);

  // 즉시 완료 확인
  const immediateUrl = extractAudioUrl(submitData);
  if (immediateUrl) {
    console.log(`[generate-music] queue 즉시 완료: ${immediateUrl.slice(0, 80)}`);
    return {
      url: immediateUrl,
      falRequestId: extractFalRequestId(submitRes),
      billableUnits: extractBillableUnits(submitRes),
    };
  }

  const requestId = submitData?.request_id;
  const statusUrl = (submitData?.status_url as string) ?? null;
  const responseUrl = (submitData?.response_url as string) ?? null;

  if (!requestId) {
    console.warn('[generate-music] queue: request_id 없음');
    return { url: null, falRequestId: null, billableUnits: null };
  }

  console.log(`[generate-music] queue: request_id=${requestId}, status_url=${statusUrl ?? '(없음)'}`);

  // 폴링 50회(100초) — musicgen 최대 90초 소요 대응
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const resolvedStatusUrl = statusUrl ?? `https://queue.fal.run/${model}/requests/${requestId}`;
      const statusRes = await fetch(resolvedStatusUrl, {
        headers: { 'Authorization': `Key ${falKey}` },
        signal: AbortSignal.timeout(8000),
      });

      if (statusRes.status === 401 || statusRes.status === 403) {
        throw new Error(`fal.ai 인증 실패 (HTTP ${statusRes.status})`);
      }

      if (!statusRes.ok) {
        console.warn(`[generate-music] queue 폴링 ${i + 1} HTTP ${statusRes.status}`);
        continue;
      }

      const statusData = await statusRes.json();
      const status = statusData?.status ?? 'IN_PROGRESS';
      console.log(`[generate-music] queue 폴링 ${i + 1}/50: status=${status}, queue_pos=${statusData?.queue_position ?? '-'}`);

      if (status === 'COMPLETED') {
        const resolvedResponseUrl = responseUrl ?? `https://queue.fal.run/${model}/requests/${requestId}/response`;
        const resultRes = await fetch(resolvedResponseUrl, {
          headers: { 'Authorization': `Key ${falKey}` },
          signal: AbortSignal.timeout(10000),
        });

        const falReqId = extractFalRequestId(resultRes);
        const billableUnits = extractBillableUnits(resultRes);

        if (resultRes.ok) {
          const resultData = await resultRes.json();
          const url = extractAudioUrl(resultData);
          console.log(`[generate-music] queue 완료: url=${url ? url.slice(0, 80) : 'null'}`);
          if (url) return { url, falRequestId: falReqId, billableUnits };
        }

        // COMPLETED이지만 URL 없음 → 추가 대기
        console.warn('[generate-music] COMPLETED이지만 오디오 URL 없음');
        return { url: null, falRequestId: falReqId, billableUnits };
      }

      if (status === 'FAILED') {
        console.warn('[generate-music] queue FAILED');
        // errors.md: FAILED 에러 정보 로깅
        const errType = getFalErrorType(statusRes, statusData);
        console.warn(`[generate-music] FAILED error_type=${errType}, detail=${JSON.stringify(statusData).slice(0, 200)}`);
        return { url: null, falRequestId: null, billableUnits: null };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('인증 실패') || msg.includes('권한 없음')) throw e;
      console.warn(`[generate-music] 폴링 ${i + 1} 예외:`, msg);
    }
  }

  console.warn('[generate-music] queue 폴링 시간 초과 (100초)');
  return { url: null, falRequestId: null, billableUnits: null };
}

async function generateWithSuno(sunoKey: string, prompt: string, tags: string, title: string, makeInstrumental: boolean) {
  const createRes = await fetch('https://api.goapi.ai/api/suno/v1/music', {
    method: 'POST',
    headers: { 'x-api-key': sunoKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      custom_mode: false, prompt, tags: tags || prompt.slice(0, 120),
      title: title || prompt.slice(0, 40), make_instrumental: makeInstrumental,
      mv: 'chirp-v3-5', wait_audio: false,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!createRes.ok) { console.warn('Suno 생성 요청 실패:', createRes.status); return null; }

  const createData = await createRes.json();
  const taskId = (createData?.data as Record<string, unknown>)?.task_id as string ?? createData?.task_id as string;
  if (!taskId) return null;

  // Suno 폴링 90회(7.5분) — Suno 생성 최대 5~6분 소요 대응
  for (let attempt = 0; attempt < 90; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const pollRes = await fetch(`https://api.goapi.ai/api/suno/v1/music/${taskId}`, {
        headers: { 'x-api-key': sunoKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      const status = (pollData?.data as Record<string, unknown>)?.status as string ?? pollData?.status as string;

      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        const inner = (pollData?.data ?? pollData) as Record<string, unknown>;
        const output = (inner?.output ?? inner?.clips ?? inner?.audio_clips) as unknown;
        const rawClips: Record<string, unknown>[] = Array.isArray(output) ? output as Record<string, unknown>[] : [];
        const clips = rawClips.map((clip) => ({
          id: String(clip?.id ?? Date.now()),
          title: String(clip?.title ?? 'AI Music'),
          audioUrl: String(clip?.audio_url ?? clip?.url ?? ''),
          imageUrl: String(clip?.image_url ?? ''),
          duration: Number(clip?.duration ?? 90),
          tags: String(clip?.tags ?? ''),
        })).filter((c) => c.audioUrl);
        if (clips.length > 0) return clips;
      }
      if (status === 'failed' || status === 'error') return null;
    } catch (e) {
      console.warn(`[generate-music] Suno 폴링 ${attempt + 1} 예외:`, e);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  const err = (msg: string, status = 400) => json({ error: msg }, status);
  let authedUserId: string;
  try {
    const authed = await requireUser(req);
    authedUserId = authed.id;
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const _rl = await checkRateLimit(supabase, {
    bucket: `generate-music:${authedUserId}`,
    ...POLICIES.generateMusic,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json();
    const {
      prompt = '', tags = '', title = '', make_instrumental = false,
      duration = 30, user_id, session_id,
    } = body;

    if (!prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'prompt가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const musicSettings = await getMusicSettings(supabase);
    const activeModelId = musicSettings.active_provider === 'suno' ? 'suno' : musicSettings.active_model;
    const dbCost = await getCreditCostFromDB(supabase, 'music', activeModelId);
    const MUSIC_CREDIT_COST = dbCost ?? FALLBACK_COSTS[activeModelId] ?? DEFAULT_MUSIC_COST;

    console.log(`[generate-music] provider=${musicSettings.active_provider}, model=${musicSettings.active_model}, creditCost=${MUSIC_CREDIT_COST}`);

    const { plan, credits, isVip } = await getUserInfo(supabase, user_id, session_id);

    if (!isVip) {
      if (credits < MUSIC_CREDIT_COST) {
        await logUsage(supabase, {
          userId: user_id, sessionId: session_id, serviceSlug: 'fal',
          action: '음악 생성', creditsDeducted: 0, userPlan: plan,
          status: 'insufficient_credits',
          metadata: { required: MUSIC_CREDIT_COST, available: credits },
        });
        return new Response(
          JSON.stringify({
            error: `크레딧이 부족합니다. 필요: ${MUSIC_CREDIT_COST} CR, 보유: ${credits} CR`,
            insufficient_credits: true, required: MUSIC_CREDIT_COST, available: credits,
            code: 'INSUFFICIENT_CREDITS',
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await deductCredits(supabase, MUSIC_CREDIT_COST, user_id, session_id);
    }

    // ── Suno 우선 모드 ──────────────────────────────────────────────────────
    if (musicSettings.active_provider === 'suno') {
      const sunoKey = await getApiKey(supabase, 'suno') ?? Deno.env.get('SUNO_KEY') ?? null;
      if (sunoKey) {
        console.log('[generate-music] Suno 우선 모드 시도');
        const sunoResult = await generateWithSuno(sunoKey, prompt, tags, title, make_instrumental);
        if (sunoResult && Array.isArray(sunoResult) && sunoResult.length > 0) {
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'suno', action: '음악 생성 (Suno)', creditsDeducted: isVip ? 0 : MUSIC_CREDIT_COST, userPlan: plan, status: 'success', metadata: { provider: 'suno' } });
          if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'music', modelName: 'Suno', creditsUsed: isVip ? 0 : MUSIC_CREDIT_COST, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
          return new Response(
            JSON.stringify({ success: true, clips: sunoResult, credits_used: isVip ? 0 : MUSIC_CREDIT_COST, provider: 'suno' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.warn('[generate-music] Suno 실패, fal.ai 폴백 시도');
      }
    }

    // ── fal.ai 음악 생성 ────────────────────────────────────────────────────
    const FAL_KEY = await getApiKey(supabase, 'fal') ?? Deno.env.get('FAL_KEY') ?? null;
    if (FAL_KEY) {
      const falModel = musicSettings.active_model ?? 'fal-ai/stable-audio';
      console.log(`[generate-music] fal.ai 시도: model=${falModel}, duration=${duration}`);
      try {
        const { url: audioUrl, falRequestId, billableUnits } = await generateWithFal(FAL_KEY, falModel, prompt, tags, duration);
        if (audioUrl) {
          const clip = {
            id: String(Date.now()), title: title || prompt.slice(0, 40),
            audioUrl, imageUrl: '', duration: Math.min(duration, 190),
            tags: tags || prompt.slice(0, 80),
          };
          await logUsage(supabase, {
            userId: user_id, sessionId: session_id, serviceSlug: 'fal',
            action: '음악 생성', creditsDeducted: isVip ? 0 : MUSIC_CREDIT_COST,
            userPlan: plan, status: 'success',
            metadata: { model: falModel, provider: 'fal', fal_request_id: falRequestId, billable_units: billableUnits },
          });
          if (user_id) {
            await sendGenerationNotification({
              userId: user_id, generationType: 'music',
              modelName: falModel.split('/').pop() ?? 'AI Music',
              creditsUsed: isVip ? 0 : MUSIC_CREDIT_COST,
              actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY,
            });
          }
          return new Response(
            JSON.stringify({ success: true, clips: [clip], credits_used: isVip ? 0 : MUSIC_CREDIT_COST, provider: 'fal', model: falModel }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (falErr) {
        const msg = falErr instanceof Error ? falErr.message : String(falErr);
        if (msg.includes('인증 실패') || msg.includes('권한 없음')) {
          if (!isVip) await deductCredits(supabase, -MUSIC_CREDIT_COST, user_id, session_id);
          const httpStatus = msg.includes('403') ? 403 : 401;
          return new Response(JSON.stringify({ error: msg }), { status: httpStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        console.warn('[generate-music] fal.ai 생성 오류, Suno 폴백 시도:', msg);
      }
    }

    // ── Suno 폴백 (fal.ai 실패 시) ─────────────────────────────────────────
    if (musicSettings.suno_enabled && musicSettings.active_provider !== 'suno') {
      const sunoKey = await getApiKey(supabase, 'suno') ?? Deno.env.get('SUNO_KEY') ?? null;
      const goApiKey = await getApiKey(supabase, 'goapi') ?? Deno.env.get('GOAPI_KEY') ?? null;
      const fallbackKey = sunoKey ?? goApiKey;

      if (fallbackKey) {
        console.log('[generate-music] Suno 폴백 시도');
        const sunoResult = await generateWithSuno(fallbackKey, prompt, tags, title, make_instrumental);
        if (sunoResult && Array.isArray(sunoResult) && sunoResult.length > 0) {
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'suno', action: '음악 생성 (Suno 폴백)', creditsDeducted: isVip ? 0 : MUSIC_CREDIT_COST, userPlan: plan, status: 'success', metadata: { provider: 'suno_fallback' } });
          if (user_id) {
            await sendGenerationNotification({
              userId: user_id, generationType: 'music', modelName: 'Suno',
              creditsUsed: isVip ? 0 : MUSIC_CREDIT_COST, actionUrl: '/ai-sound',
              supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY,
            });
          }
          return new Response(
            JSON.stringify({ success: true, clips: sunoResult, credits_used: isVip ? 0 : MUSIC_CREDIT_COST, provider: 'suno' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 모든 시도 실패 — 크레딧 환불
    if (!isVip) await deductCredits(supabase, -MUSIC_CREDIT_COST, user_id, session_id);
    return new Response(
      JSON.stringify({
        error: 'API 키가 설정되지 않았습니다. 관리자 페이지에서 fal.ai 또는 Suno API 키를 등록해주세요.',
        code: 'NO_API_KEY',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    console.error('Music Edge Function 오류:', isTimeout ? '타임아웃' : err);
    return new Response(
      JSON.stringify({
        error: isTimeout ? 'fal.ai 응답 시간 초과. 잠시 후 다시 시도해주세요.' : String(err),
        code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
      }),
      { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
