import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';

const VIP_PLANS = ['enterprise', 'vip', 'admin'];
const FAL_TTS_MODEL = "fal-ai/playai-tts";
const FAL_TTS_MODEL_V3 = "fal-ai/playai-tts-v3";

const FALLBACK_COSTS: Record<string, number> = {
  "fal-ai/playai-tts":    3,
  "fal-ai/playai-tts-v3": 5,
  "elevenlabs":           5,
};
const DEFAULT_TTS_COST_PER_100_CHARS = 2;

const FAL_VOICE_MAP: Record<string, string> = {
  "Aria":   "Aria",  "Rachel":  "Rachel", "Domi":  "Domi",   "Bella":  "Bella",
  "Antoni": "Antoni","Elli":    "Elli",   "Josh":  "Josh",   "Arnold": "Arnold",
  "Adam":   "Adam",  "Sam":     "Sam",
  "지수":   "Aria",  "민준":    "Adam",   "서연":  "Bella",  "태민":   "Josh",
};

function extractFalRequestId(res: Response): string | null {
  return res.headers.get('x-fal-request-id') ?? res.headers.get('X-Fal-Request-Id') ?? null;
}
function extractBillableUnits(res: Response): string | null {
  return res.headers.get('X-Fal-Billable-Units') ?? res.headers.get('x-fal-billable-units') ?? null;
}
function getFalRetryableHeader(res: Response): string | null {
  return res.headers.get('X-Fal-Retryable') ?? res.headers.get('x-fal-retryable') ?? null;
}
function getFalErrorType(res: Response, body: Record<string, unknown>): string | null {
  return res.headers.get('X-Fal-Error-Type') ?? res.headers.get('x-fal-error-type') ?? (body.error_type as string) ?? null;
}

/**
 * errors.md: Model Validation Error vs Request Error 분류
 * X-Fal-Retryable 헤더 우선 참조
 */
const RETRYABLE_MODEL_TYPES = new Set(['internal_server_error', 'generation_timeout', 'downstream_service_error', 'downstream_service_unavailable']);
const PERMANENT_MODEL_TYPES = new Set([
  'content_policy_violation', 'no_media_generated', 'sequence_too_long', 'sequence_too_short',
  'audio_duration_too_long', 'audio_duration_too_short', 'unsupported_audio_format', 'feature_not_supported',
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
      const msg = buildTtsErrorMsg(first);
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

function buildTtsErrorMsg(err: { type: string; msg: string; ctx?: Record<string, unknown> }): string {
  const ctx = err.ctx ?? {};
  switch (err.type) {
    case 'content_policy_violation': return '텍스트 내용이 콘텐츠 정책에 위반됐어요. 내용을 수정해주세요.';
    case 'sequence_too_long': {
      const maxLen = ctx.max_length as number | undefined;
      if (maxLen) return `텍스트가 너무 길어요. 최대 ${maxLen}자 이하여야 해요.`;
      return '텍스트가 너무 길어요. 더 짧게 나눠서 시도해주세요.';
    }
    case 'sequence_too_short': return '텍스트가 너무 짧아요. 더 긴 내용을 입력해주세요.';
    case 'feature_not_supported': return '선택한 보이스 또는 모델이 현재 지원하지 않는 기능이에요.';
    case 'internal_server_error': return 'fal.ai 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'generation_timeout': return 'TTS 생성 시간이 초과됐어요. 잠시 후 다시 시도해주세요.';
    case 'downstream_service_error':
    case 'downstream_service_unavailable': return 'fal.ai 외부 서비스 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    default: return err.msg || 'TTS 생성 오류가 발생했어요.';
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
  } catch (e) { console.error('[generate-tts] decryptFalKey 오류:', e); return null; }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'fal').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptFalKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getElevenLabsKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'elevenlabs').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptFalKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getCreditCostFromDB(supabase: ReturnType<typeof createClient>, category: string, modelId: string): Promise<number | null> {
  try {
    const { data } = await supabase.from('credit_costs').select('cost, unit').eq('category', category).eq('model_id', modelId).eq('is_active', true).maybeSingle();
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
    bucket: `generate-tts:${authedUserId}`,
    ...POLICIES.generateTts,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const body = await req.json();
    const { text, voiceName = "Aria", model = "flash", stability = 0.5, similarity_boost = 0.75, style = 0.0, speed = 1.0, user_id, session_id } = body;

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "text가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const charCount = text.trim().length;
    const ttsModelId = model === "v3" ? "fal-ai/playai-tts-v3" : "fal-ai/playai-tts";
    const dbCost = await getCreditCostFromDB(supabase, 'tts', ttsModelId);
    const costPer100Chars = dbCost ?? FALLBACK_COSTS[ttsModelId] ?? DEFAULT_TTS_COST_PER_100_CHARS;
    const creditCost = Math.max(costPer100Chars, Math.ceil(charCount / 100) * costPer100Chars);

    const { plan, credits, isVip } = await getUserInfo(supabase, user_id, session_id);
    if (!isVip) {
      if (credits < creditCost) {
        await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'TTS 생성', creditsDeducted: 0, userPlan: plan, status: 'insufficient_credits', metadata: { charCount, required: creditCost, available: credits } });
        return new Response(JSON.stringify({ error: `크레딧이 부족합니다. 필요: ${creditCost} CR, 보유: ${credits} CR`, insufficient_credits: true, required: creditCost, available: credits }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await deductCredits(supabase, creditCost, user_id, session_id);
    }

    let FAL_KEY = await getFalKey(supabase);
    if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;

    if (FAL_KEY) {
      const falVoice = FAL_VOICE_MAP[voiceName] ?? "Aria";
      const ttsModel = model === "v3" ? FAL_TTS_MODEL_V3 : FAL_TTS_MODEL;

      const falRes = await fetch(`https://fal.run/${ttsModel}`, {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ input: text.trim(), voice: falVoice, speed }),
        signal: AbortSignal.timeout(55000),
      });

      const falReqId = extractFalRequestId(falRes);
      const billableUnits = extractBillableUnits(falRes);
      const retryableHeader = getFalRetryableHeader(falRes);
      if (falReqId) console.log(`[generate-tts] x-fal-request-id: ${falReqId}`);

      if (falRes.status === 401) {
        if (!isVip) await deductCredits(supabase, -creditCost, user_id, session_id);
        return new Response(JSON.stringify({ error: `fal.ai 인증 실패 (HTTP 401). API 키가 올바른지 확인하세요. fal.ai/dashboard/keys에서 키를 확인해주세요.` }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (falRes.status === 403) {
        if (!isVip) await deductCredits(supabase, -creditCost, user_id, session_id);
        return new Response(JSON.stringify({ error: `fal.ai 권한 없음 (HTTP 403). API 키의 scope를 확인하세요. fal.ai/dashboard/keys에서 API scope 키를 생성해주세요.` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // errors.md: 422 Model Validation Error — 영구 에러 시 폴백 없이 사용자에게 전달
      if (falRes.status === 422) {
        const errText = await falRes.text();
        let errBody: Record<string, unknown> = {};
        try { errBody = JSON.parse(errText); } catch { /* ignore */ }
        const errorTypeHeader = getFalErrorType(falRes, errBody);
        const errInfo = parseFalErrorBody(errBody, retryableHeader, errorTypeHeader);
        if (errInfo.isPermanent) {
          if (!isVip) await deductCredits(supabase, -creditCost, user_id, session_id);
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'TTS 생성 실패 (422)', creditsDeducted: 0, userPlan: plan, status: 'failed', metadata: { error_type: errInfo.errorType, fal_request_id: falReqId } });
          return new Response(JSON.stringify({ error: errInfo.message, fal_error_type: errInfo.errorType }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // 재시도 가능 422 → ElevenLabs 폴백
        console.warn(`[generate-tts] 422 retryable (${errInfo.errorType}), ElevenLabs 폴백`);
      }

      if (falRes.ok) {
        const falData = await falRes.json();
        const audioUrl = falData?.audio?.url ?? falData?.audio_url ?? falData?.url;
        if (audioUrl) {
          const dur = Math.ceil(charCount / 15);
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'TTS 생성', creditsDeducted: isVip ? 0 : creditCost, userPlan: plan, status: 'success', metadata: { charCount, voiceName, model: ttsModel, fal_request_id: falReqId, billable_units: billableUnits } });
          if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'tts', modelName: `${voiceName} (${model === 'v3' ? 'PlayAI v3' : 'PlayAI'})`, creditsUsed: isVip ? 0 : creditCost, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
          return new Response(JSON.stringify({ success: true, audioUrl, duration: dur, charCount, credits_used: isVip ? 0 : creditCost }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const errText = await falRes.text();
        let errBody: Record<string, unknown> = {};
        try { errBody = JSON.parse(errText); } catch { /* ignore */ }
        const errorType = getFalErrorType(falRes, errBody);
        const errInfo = parseFalErrorBody(errBody, retryableHeader, errorType);
        console.warn(`[generate-tts] fal.ai TTS 실패 HTTP ${falRes.status} error_type=${errorType} retryable=${retryableHeader} isRetryable=${errInfo.isRetryable}, ElevenLabs 폴백`);
      }
    }

    // ElevenLabs 폴백
    const ELEVEN_KEY = await getElevenLabsKey(supabase) ?? Deno.env.get("GOAPI_KEY") ?? null;
    if (!ELEVEN_KEY) {
      if (!isVip) await deductCredits(supabase, -creditCost, user_id, session_id);
      return new Response(JSON.stringify({ error: "API 키가 설정되지 않았습니다. 관리자 페이지에서 fal.ai 또는 ElevenLabs API 키를 등록해주세요." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const VOICE_MAP: Record<string, string> = {
      "Aria": "21m00Tcm4TlvDq8ikWAM", "Rachel": "21m00Tcm4TlvDq8ikWAM",
      "Domi": "AZnzlk1XvdvUeBnXmlld", "Bella": "EXAVITQu4vr4xnSDxMaL",
      "Antoni": "ErXwobaYiN019PkySvjV", "Elli": "MF3mGyEYCl7XYWbV9V6O",
      "Josh": "TxGEqnHWrfWFTfGW9XjX", "Arnold": "VR6AewLTigWG4xSOukaG",
      "Adam": "pNInz6obpgDQGcFmaJgB", "Sam": "yoZ06aMxZJJ28mfd3POQ",
      "지수": "21m00Tcm4TlvDq8ikWAM", "민준": "pNInz6obpgDQGcFmaJgB",
      "서연": "EXAVITQu4vr4xnSDxMaL", "태민": "TxGEqnHWrfWFTfGW9XjX",
    };
    const MODEL_MAP: Record<string, string> = { "flash": "eleven_turbo_v2_5", "v3": "eleven_multilingual_v2" };
    const voiceId = VOICE_MAP[voiceName] ?? "21m00Tcm4TlvDq8ikWAM";
    const modelId = MODEL_MAP[model] ?? "eleven_turbo_v2_5";

    const ttsRes = await fetch(`https://api.goapi.ai/api/v1/elevenlabs/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "x-api-key": ELEVEN_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), model_id: modelId, voice_settings: { stability, similarity_boost, style, use_speaker_boost: true, speed }, output_format: "mp3_44100_128" }),
      signal: AbortSignal.timeout(55000),
    });

    if (!ttsRes.ok) {
      if (!isVip) await deductCredits(supabase, -creditCost, user_id, session_id);
      const errText = await ttsRes.text();
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'elevenlabs', action: 'TTS 생성', creditsDeducted: 0, userPlan: plan, status: 'failed', metadata: { error: errText.slice(0, 200) } });
      return new Response(JSON.stringify({ error: `TTS 요청 실패 (${ttsRes.status})`, detail: errText, fallback: true }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contentType = ttsRes.headers.get("content-type") ?? "";
    const dur = Math.ceil(charCount / 15);
    if (contentType.includes("audio")) {
      const audioBuffer = await ttsRes.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'elevenlabs', action: 'TTS 생성', creditsDeducted: isVip ? 0 : creditCost, userPlan: plan, status: 'success', metadata: { charCount, voiceName } });
      if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'tts', modelName: `${voiceName} (ElevenLabs)`, creditsUsed: isVip ? 0 : creditCost, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
      return new Response(JSON.stringify({ success: true, audioBase64: base64Audio, mimeType: "audio/mpeg", duration: dur, charCount, credits_used: isVip ? 0 : creditCost }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await ttsRes.json();
    const audioUrl = data?.audio_url ?? data?.data?.audio_url ?? data?.url;
    if (audioUrl) {
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'elevenlabs', action: 'TTS 생성', creditsDeducted: isVip ? 0 : creditCost, userPlan: plan, status: 'success', metadata: { charCount, voiceName } });
      if (user_id) { await sendGenerationNotification({ userId: user_id, generationType: 'tts', modelName: `${voiceName} (ElevenLabs)`, creditsUsed: isVip ? 0 : creditCost, actionUrl: '/ai-sound', supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY }); }
      return new Response(JSON.stringify({ success: true, audioUrl, duration: dur, charCount, credits_used: isVip ? 0 : creditCost }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!isVip) await deductCredits(supabase, -creditCost, user_id, session_id);
    return new Response(JSON.stringify({ error: "TTS 생성 실패. 응답 형식을 확인해주세요.", raw: data }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    return new Response(JSON.stringify({ error: isTimeout ? 'fal.ai 응답 시간 초과 (55초). 잠시 후 다시 시도해주세요.' : String(err) }), { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
