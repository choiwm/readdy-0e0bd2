import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';
import { persistFalAsset } from '../_shared/fal_storage.ts';

const FAL_SFX_MODEL = "fal-ai/elevenlabs/sound-effects";
const VIP_PLANS = ['enterprise', 'vip', 'admin'];
const FALLBACK_SFX_COST = 5;

function extractFalRequestId(res: Response): string | null {
  return res.headers.get('x-fal-request-id') ?? res.headers.get('X-Fal-Request-Id') ?? null;
}
function extractBillableUnits(res: Response): string | null {
  return res.headers.get('X-Fal-Billable-Units') ?? res.headers.get('x-fal-billable-units') ?? null;
}
/** errors.md: X-Fal-Retryable 응답 헤더로 재시도 여부 판단 */
function getFalRetryableHeader(res: Response): string | null {
  return res.headers.get('X-Fal-Retryable') ?? res.headers.get('x-fal-retryable') ?? null;
}
/** errors.md: X-Fal-Error-Type 응답 헤더 */
function getFalErrorType(res: Response, body: Record<string, unknown>): string | null {
  return res.headers.get('X-Fal-Error-Type') ?? res.headers.get('x-fal-error-type') ?? (body.error_type as string) ?? null;
}

/**
 * errors.md: Model Validation Error (detail 배열) vs Request Error (flat) 분류
 */
const RETRYABLE_MODEL_TYPES = new Set(['internal_server_error', 'generation_timeout', 'downstream_service_error', 'downstream_service_unavailable']);
const PERMANENT_MODEL_TYPES = new Set([
  'content_policy_violation', 'no_media_generated', 'audio_duration_too_long', 'audio_duration_too_short',
  'unsupported_audio_format', 'file_download_error', 'file_too_large', 'feature_not_supported',
]);
const RETRYABLE_REQUEST_TYPES = new Set(['request_timeout', 'startup_timeout', 'runner_scheduling_failure', 'runner_connection_timeout', 'runner_disconnected', 'runner_connection_refused', 'runner_connection_error', 'runner_incomplete_response', 'runner_server_error', 'internal_error']);

interface FalErrorInfo { message: string; isRetryable: boolean; errorType: string | null; isPermanent: boolean; }

function parseFalErrorBody(body: Record<string, unknown>, retryableHeader: string | null, errorTypeHeader: string | null): FalErrorInfo {
  if (Array.isArray(body.detail)) {
    const first = (body.detail as Array<{ type: string; msg: string; ctx?: Record<string, unknown> }>)[0];
    if (first) {
      const errType = first.type;
      let isRetryable: boolean;
      if (retryableHeader !== null) {
        isRetryable = retryableHeader === 'true';
      } else {
        isRetryable = RETRYABLE_MODEL_TYPES.has(errType) && !PERMANENT_MODEL_TYPES.has(errType);
      }
      const isPermanent = PERMANENT_MODEL_TYPES.has(errType);
      const msg = buildSfxErrorMsg(first);
      return { message: msg, isRetryable, errorType: errType, isPermanent };
    }
  }
  if (typeof body.detail === 'string' && body.error_type) {
    const errType = (errorTypeHeader ?? body.error_type) as string;
    const isRetryable = retryableHeader !== null ? retryableHeader === 'true' : RETRYABLE_REQUEST_TYPES.has(errType);
    return { message: body.detail, isRetryable, errorType: errType, isPermanent: false };
  }
  if (typeof body.error === 'string') {
    return { message: body.error, isRetryable: true, errorType: errorTypeHeader, isPermanent: false };
  }
  return { message: '알 수 없는 fal.ai 오류', isRetryable: true, errorType: errorTypeHeader, isPermanent: false };
}

function buildSfxErrorMsg(err: { type: string; msg: string; ctx?: Record<string, unknown> }): string {
  const ctx = err.ctx ?? {};
  switch (err.type) {
    case 'content_policy_violation': return '프롬프트가 콘텐츠 정책에 위반됐어요. 내용을 수정해주세요.';
    case 'audio_duration_too_long': {
      const maxD = ctx.max_duration as number | undefined;
      const provD = ctx.provided_duration as number | undefined;
      if (maxD && provD) return `요청 길이가 너무 길어요. 최대 ${maxD}초인데 ${provD}초를 요청했어요.`;
      return '요청한 오디오 길이가 너무 길어요.';
    }
    case 'audio_duration_too_short': return '요청한 오디오 길이가 너무 짧아요.';
    case 'unsupported_audio_format': {
      const formats = ctx.supported_formats as string[] | undefined;
      if (formats) return `지원하지 않는 오디오 형식이에요. 지원 형식: ${formats.join(', ')}`;
      return '지원하지 않는 오디오 형식이에요.';
    }
    case 'file_download_error': return '파일 URL에 접근할 수 없어요. 공개 URL인지 확인해주세요.';
    case 'file_too_large': {
      const maxSize = ctx.max_size as number | undefined;
      if (maxSize) return `파일 크기가 너무 커요. 최대 ${Math.round(maxSize / 1024 / 1024)}MB 이하여야 해요.`;
      return '파일 크기가 너무 커요.';
    }
    case 'feature_not_supported': return '현재 설정에서 지원하지 않는 기능이에요.';
    case 'internal_server_error': return 'fal.ai 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'generation_timeout': return 'SFX 생성 시간이 초과됐어요. 잠시 후 다시 시도해주세요.';
    case 'downstream_service_error':
    case 'downstream_service_unavailable': return 'fal.ai 외부 서비스 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    default: return err.msg || 'SFX 생성 오류가 발생했어요.';
  }
}

async function decryptFalKey(encrypted: string): Promise<string | null> {
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
      const combined = Uint8Array.from(atob(encrypted.slice(7)), (c) => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      const secret = Deno.env.get('APP_JWT_SECRET') ?? '';
      const secretBytes = new TextEncoder().encode(secret);
      const keyMaterial = secretBytes.length >= 32 ? secretBytes.slice(0, 32) : new Uint8Array(32).fill(0).map((_, i) => secretBytes[i] ?? 48);
      const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
      const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encryptedData);
      return new TextDecoder().decode(decryptedData);
    }
    if (encrypted.startsWith('enc_v1:')) {
      try { return atob(encrypted.split(':')[2]); } catch { return null; }
    }
    return encrypted;
  } catch (e) { console.error('[generate-sfx] decryptFalKey 오류:', e); return null; }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'fal').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptFalKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getGoApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'goapi').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptFalKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getCreditCostFromDB(supabase: ReturnType<typeof createClient>, category: string, modelId: string): Promise<number | null> {
  try {
    const { data } = await supabase.from('credit_costs').select('cost').eq('category', category).eq('model_id', modelId).eq('is_active', true).maybeSingle();
    return data?.cost ?? null;
  } catch { return null; }
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

async function sendGenerationNotification(opts: { userId: string; generationType: string; modelName: string; creditsUsed: number; actionUrl: string; supabaseUrl: string; anonKey: string; }) {
  try {
    await fetch(`${opts.supabaseUrl}/functions/v1/credit-alert-notify?action=generation_complete`, { method: 'POST', headers: { 'Authorization': `Bearer ${opts.anonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: opts.userId, generation_type: opts.generationType, model_name: opts.modelName, credits_used: opts.creditsUsed, action_url: opts.actionUrl }) });
  } catch { /* 무시 */ }
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
    bucket: `generate-sfx:${authedUserId}`,
    ...POLICIES.generateSfx,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json();
    const { text, duration_seconds, prompt_influence = 0.3, user_id, session_id } = body;

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "text(프롬프트)가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dbCost = await getCreditCostFromDB(supabase, 'sfx', FAL_SFX_MODEL);
    const SFX_CREDIT_COST = dbCost ?? FALLBACK_SFX_COST;

    const { plan, credits, isVip } = await getUserInfo(supabase, user_id, session_id);
    if (!isVip) {
      if (credits < SFX_CREDIT_COST) {
        await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'SFX 생성', creditsDeducted: 0, userPlan: plan, status: 'insufficient_credits', metadata: { required: SFX_CREDIT_COST, available: credits } });
        return new Response(JSON.stringify({ error: `크레딧이 부족합니다. 필요: ${SFX_CREDIT_COST} CR, 보유: ${credits} CR`, insufficient_credits: true, required: SFX_CREDIT_COST, available: credits }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await deductCredits(supabase, SFX_CREDIT_COST, user_id, session_id);
    }

    let FAL_KEY = await getFalKey(supabase);
    if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;

    if (FAL_KEY) {
      const falBody: Record<string, unknown> = { text: text.trim(), prompt_influence };
      if (duration_seconds && duration_seconds > 0) falBody.duration_seconds = duration_seconds;

      const falRes = await fetch(`https://fal.run/${FAL_SFX_MODEL}`, {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(falBody),
        signal: AbortSignal.timeout(55000),
      });

      const falReqId = extractFalRequestId(falRes);
      const billableUnits = extractBillableUnits(falRes);
      const retryableHeader = getFalRetryableHeader(falRes);
      if (falReqId) console.log(`[generate-sfx] x-fal-request-id: ${falReqId}`);

      if (falRes.status === 401) {
        if (!isVip) await deductCredits(supabase, -SFX_CREDIT_COST, user_id, session_id);
        return new Response(JSON.stringify({ error: `fal.ai 인증 실패 (HTTP 401). API 키가 올바른지 확인하세요. fal.ai/dashboard/keys에서 키를 재발급해주세요.` }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (falRes.status === 403) {
        if (!isVip) await deductCredits(supabase, -SFX_CREDIT_COST, user_id, session_id);
        return new Response(JSON.stringify({ error: `fal.ai 권한 없음 (HTTP 403). API 키의 scope를 확인하세요. fal.ai/dashboard/keys에서 API scope 키를 생성해주세요.` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // errors.md: 422 Model Validation Error — 폴백 없이 사용자에게 명확히 전달
      if (falRes.status === 422) {
        const errText = await falRes.text();
        let errBody: Record<string, unknown> = {};
        try { errBody = JSON.parse(errText); } catch { /* ignore */ }
        const errorTypeHeader = getFalErrorType(falRes, errBody);
        const errInfo = parseFalErrorBody(errBody, retryableHeader, errorTypeHeader);
        if (errInfo.isPermanent) {
          if (!isVip) await deductCredits(supabase, -SFX_CREDIT_COST, user_id, session_id);
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'SFX 생성 실패 (422)', creditsDeducted: 0, userPlan: plan, status: 'failed', metadata: { error_type: errInfo.errorType, fal_request_id: falReqId } });
          return new Response(JSON.stringify({ error: errInfo.message, fal_error_type: errInfo.errorType }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      if (falRes.ok) {
        const contentType = falRes.headers.get("content-type") ?? "";
        if (contentType.includes("audio") || contentType.includes("octet-stream")) {
          const audioBuffer = await falRes.arrayBuffer();
          const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'SFX 생성', creditsDeducted: isVip ? 0 : SFX_CREDIT_COST, userPlan: plan, status: 'success', metadata: { fal_request_id: falReqId, billable_units: billableUnits } });
          if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'sfx', modelName: 'ElevenLabs SFX', creditsUsed: isVip ? 0 : SFX_CREDIT_COST, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
          return new Response(JSON.stringify({ success: true, audioBase64: base64Audio, mimeType: "audio/mpeg", duration: duration_seconds ?? null, credits_used: isVip ? 0 : SFX_CREDIT_COST }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const falData = await falRes.json();
        const rawAudioUrl = falData?.audio?.url ?? falData?.audio_url ?? falData?.url;
        const audioBase64 = falData?.audio?.base64 ?? falData?.audio_base64;
        const audioUrl = rawAudioUrl
          ? await persistFalAsset(supabase, rawAudioUrl, 'audio', user_id ?? session_id ?? 'anon')
          : rawAudioUrl;
        if (audioUrl) {
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'SFX 생성', creditsDeducted: isVip ? 0 : SFX_CREDIT_COST, userPlan: plan, status: 'success', metadata: { fal_request_id: falReqId, billable_units: billableUnits } });
          if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'sfx', modelName: 'ElevenLabs SFX', creditsUsed: isVip ? 0 : SFX_CREDIT_COST, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
          return new Response(JSON.stringify({ success: true, audioUrl, duration: duration_seconds ?? null, credits_used: isVip ? 0 : SFX_CREDIT_COST }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (audioBase64) {
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'SFX 생성', creditsDeducted: isVip ? 0 : SFX_CREDIT_COST, userPlan: plan, status: 'success', metadata: { fal_request_id: falReqId, billable_units: billableUnits } });
          if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'sfx', modelName: 'ElevenLabs SFX', creditsUsed: isVip ? 0 : SFX_CREDIT_COST, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
          return new Response(JSON.stringify({ success: true, audioBase64, mimeType: "audio/mpeg", duration: duration_seconds ?? null, credits_used: isVip ? 0 : SFX_CREDIT_COST }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const errText = await falRes.text();
        let errBody: Record<string, unknown> = {};
        try { errBody = JSON.parse(errText); } catch { /* ignore */ }
        const errorType = getFalErrorType(falRes, errBody);
        // errors.md: X-Fal-Retryable로 재시도 여부 판단
        const errInfo = parseFalErrorBody(errBody, retryableHeader, errorType);
        console.warn(`[generate-sfx] fal.ai SFX 실패 HTTP ${falRes.status} error_type=${errorType} retryable=${retryableHeader}, isRetryable=${errInfo.isRetryable}`);
        if (!isVip) await deductCredits(supabase, -SFX_CREDIT_COST, user_id, session_id);
      }
    }

    // GoAPI ElevenLabs 폴백
    const GOAPI_KEY = await getGoApiKey(supabase) ?? Deno.env.get("GOAPI_KEY") ?? null;
    if (!GOAPI_KEY) {
      if (!isVip) await deductCredits(supabase, -SFX_CREDIT_COST, user_id, session_id);
      return new Response(JSON.stringify({ error: "API 키가 설정되지 않았습니다. 관리자 페이지에서 fal.ai API 키를 등록해주세요." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const requestBody: Record<string, unknown> = { text: text.trim(), prompt_influence };
    if (duration_seconds && duration_seconds > 0) requestBody.duration_seconds = duration_seconds;

    let sfxRes = await fetch("https://api.goapi.ai/api/v1/elevenlabs/sound-generation", {
      method: "POST",
      headers: { "x-api-key": GOAPI_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(55000),
    });

    if (!sfxRes.ok) {
      sfxRes = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
        method: "POST",
        headers: { "xi-api-key": GOAPI_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(55000),
      });
    }

    if (!sfxRes.ok) {
      const errText = await sfxRes.text();
      if (!isVip) await deductCredits(supabase, -SFX_CREDIT_COST, user_id, session_id);
      return new Response(JSON.stringify({ error: `SFX 생성 실패 (${sfxRes.status})`, detail: errText }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contentType = sfxRes.headers.get("content-type") ?? "";
    if (contentType.includes("audio") || contentType.includes("octet-stream")) {
      const audioBuffer = await sfxRes.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'SFX 생성 (GoAPI)', creditsDeducted: isVip ? 0 : SFX_CREDIT_COST, userPlan: plan, status: 'success', metadata: {} });
      if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'sfx', modelName: 'ElevenLabs SFX', creditsUsed: isVip ? 0 : SFX_CREDIT_COST, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
      return new Response(JSON.stringify({ success: true, audioBase64: base64Audio, mimeType: contentType.includes("mpeg") ? "audio/mpeg" : "audio/wav", duration: duration_seconds ?? null, credits_used: isVip ? 0 : SFX_CREDIT_COST }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await sfxRes.json();
    const audioUrl = data?.audio_url ?? data?.data?.audio_url ?? data?.url ?? data?.data?.url;
    if (audioUrl) {
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'SFX 생성 (GoAPI)', creditsDeducted: isVip ? 0 : SFX_CREDIT_COST, userPlan: plan, status: 'success', metadata: {} });
      if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'sfx', modelName: 'ElevenLabs SFX', creditsUsed: isVip ? 0 : SFX_CREDIT_COST, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
      return new Response(JSON.stringify({ success: true, audioUrl, duration: duration_seconds ?? null, credits_used: isVip ? 0 : SFX_CREDIT_COST }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!isVip) await deductCredits(supabase, -SFX_CREDIT_COST, user_id, session_id);
    return new Response(JSON.stringify({ error: "SFX 생성 실패. 응답에서 오디오를 찾을 수 없습니다.", raw: data }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    return new Response(JSON.stringify({ error: isTimeout ? 'fal.ai 응답 시간 초과 (55초). 잠시 후 다시 시도해주세요.' : String(err) }), { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
