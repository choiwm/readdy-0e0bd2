import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';

const MULTISHOT_CREDIT_COST_FALLBACK = 180;
const MULTISHOT_MODEL_ID = 'workflows/kling-multi-shot-creator';

// ── 공식 문서: aes_v2 SHA-256 기반 복호화 (표준 방식) ──
async function getEncryptionKeyV2(): Promise<CryptoKey> {
  const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    // aes_v2: SHA-256 해시 기반 (현재 표준 방식) — 이전에 미지원으로 폴백 실패하던 문제 수정
    if (encrypted.startsWith('aes_v2:')) {
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const key = await getEncryptionKeyV2();
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
      return new TextDecoder().decode(decrypted);
    }
    if (encrypted.startsWith('aes_v1:')) {
      try {
        const base64Data = encrypted.slice(7);
        const combined = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const encryptedData = combined.slice(12);
        const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
        const keyMaterial = new TextEncoder().encode(secret.slice(0, 32).padEnd(32, '0'));
        const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encryptedData);
        return new TextDecoder().decode(decrypted);
      } catch { return null; }
    }
    if (encrypted.startsWith('enc_v1:')) {
      const parts = encrypted.split(':');
      if (parts.length >= 3) { try { return atob(parts[2]); } catch { return null; } }
    }
    return encrypted;
  } catch (e) { console.error('[generate-multishot] decryptKey 오류:', e); return null; }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'fal').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getOpenRouterKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'openrouter').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getMultishotCreditCost(supabase: ReturnType<typeof createClient>): Promise<number> {
  try {
    const { data } = await supabase.from('credit_costs').select('cost').eq('category', 'workflow').eq('model_id', MULTISHOT_MODEL_ID).eq('is_active', true).maybeSingle();
    if (data?.cost != null) return data.cost as number;
  } catch (e) { console.warn('[generate-multishot] credit_costs 조회 실패:', e); }
  return MULTISHOT_CREDIT_COST_FALLBACK;
}

async function getUserPlan(supabase: ReturnType<typeof createClient>, userId?: string, sessionId?: string) {
  const VIP_PLANS = ['enterprise', 'vip', 'admin'];
  try {
    if (userId) {
      const { data } = await supabase.from('user_profiles').select('plan, credit_balance').eq('id', userId).maybeSingle();
      const plan = (data?.plan ?? 'free').toLowerCase();
      const isVip = VIP_PLANS.includes(plan);
      if (isVip) return { plan, credits: 999999, isVip: true };
      return { plan, credits: data?.credit_balance ?? 0, isVip: false };
    }
    if (sessionId) {
      const { data } = await supabase.from('credits').select('balance').eq('session_id', sessionId).maybeSingle();
      return { plan: 'free', credits: data?.balance ?? 0, isVip: false };
    }
  } catch (e) { console.error('[generate-multishot] getUserPlan error:', e); }
  return { plan: 'free', credits: 0, isVip: false };
}

async function deductCredits(supabase: ReturnType<typeof createClient>, amount: number, userId?: string, sessionId?: string): Promise<boolean> {
  try {
    if (userId) {
      const { data } = await supabase.from('user_profiles').select('credit_balance').eq('id', userId).maybeSingle();
      if (!data) return false;
      const newBalance = data.credit_balance - amount;
      if (newBalance < 0 && amount > 0) return false;
      await supabase.from('user_profiles').update({ credit_balance: Math.max(0, newBalance), updated_at: new Date().toISOString() }).eq('id', userId);
      return true;
    }
    if (sessionId) {
      const { data } = await supabase.from('credits').select('id, balance').eq('session_id', sessionId).maybeSingle();
      if (!data) return false;
      const newBalance = data.balance - amount;
      if (newBalance < 0 && amount > 0) return false;
      await supabase.from('credits').update({ balance: Math.max(0, newBalance), updated_at: new Date().toISOString() }).eq('session_id', sessionId);
      return true;
    }
  } catch (e) { console.error('[generate-multishot] deductCredits error:', e); }
  return false;
}

async function logUsage(supabase: ReturnType<typeof createClient>, opts: { userId?: string; sessionId?: string; serviceSlug: string; action: string; creditsDeducted: number; userPlan: string; status: 'success' | 'failed' | 'insufficient_credits'; metadata?: Record<string, unknown>; }) {
  try { await supabase.from('usage_logs').insert({ user_id: opts.userId ?? null, session_id: opts.sessionId ?? null, service_slug: opts.serviceSlug, action: opts.action, credits_deducted: opts.creditsDeducted, user_plan: opts.userPlan, status: opts.status, metadata: opts.metadata ?? {} }); } catch { /* 무시 */ }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') throw new Error(`요청 타임아웃 (${timeoutMs / 1000}초 초과)`);
    throw err;
  }
}

/** 공식 문서: x-fal-request-id 수집 */
function extractFalRequestId(res: Response): string | null {
  return res.headers.get('x-fal-request-id') ?? res.headers.get('X-Fal-Request-Id') ?? null;
}

/** 공식 문서: has_nsfw_concepts 배열로 NSFW 감지 */
function checkNsfw(data: Record<string, unknown>): boolean {
  const nsfwConcepts = (data?.has_nsfw_concepts as boolean[] | undefined) ?? [];
  return nsfwConcepts.some(Boolean);
}

/**
 * fal.ai queue status 폴링
 * 공식 문서 적용:
 *   - POST 응답의 status_url 우선 사용
 *   - 없으면 /status suffix 방식 조립
 *   - 401/403 → 인증 오류 명시적 처리
 *   - X-Fal-Error-Type 헤더 수집
 */
async function pollFalStatus(
  falKey: string,
  modelPath: string,
  requestId: string,
  statusUrlFromPost?: string | null,
): Promise<{ httpStatus: number; body: string; isError: boolean }> {
  const candidates = statusUrlFromPost
    ? [statusUrlFromPost]
    : [
        `https://queue.fal.run/${modelPath}/requests/${requestId}/status`,
        `https://queue.fal.run/${modelPath}/requests/${requestId}/status?logs=1`,
        `https://fal.run/${modelPath}/requests/${requestId}/status`,
      ];

  let lastStatus = 0;
  let lastBody = '';

  for (const url of candidates) {
    try {
      console.log(`[generate-multishot] 폴링: GET ${url}`);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Key ${falKey}` },
        signal: AbortSignal.timeout(12000),
      });
      const body = await res.text();
      console.log(`[generate-multishot] 폴링 응답 HTTP ${res.status}: ${body.slice(0, 300)}`);

      // 공식 문서: 401/403 → API 키 인증 실패
      if (res.status === 401 || res.status === 403) {
        return { httpStatus: res.status, body: `fal.ai 인증 실패 (HTTP ${res.status}). fal.ai 대시보드(fal.ai/dashboard/keys)에서 키를 확인해주세요.`, isError: true };
      }

      if (res.status === 404 || res.status === 405) {
        lastStatus = res.status;
        lastBody = body;
        console.warn(`[generate-multishot] HTTP ${res.status} — 다음 URL 시도`);
        continue;
      }

      return { httpStatus: res.status, body, isError: false };
    } catch (e) {
      console.warn(`[generate-multishot] 폴링 URL 예외 (${url}):`, e);
      lastBody = String(e);
    }
  }

  return { httpStatus: lastStatus, body: lastBody, isError: true };
}

/**
 * fal.ai response 가져오기
 * 공식 문서: response_url 우선 사용
 */
async function fetchFalResponse(
  falKey: string,
  modelPath: string,
  requestId: string,
  responseUrlFromPost?: string | null,
): Promise<{ ok: boolean; httpStatus: number; body: string }> {
  const candidates = responseUrlFromPost
    ? [responseUrlFromPost]
    : [
        `https://queue.fal.run/${modelPath}/requests/${requestId}/response`,
        `https://fal.run/${modelPath}/requests/${requestId}/response`,
        `https://queue.fal.run/${modelPath}/requests/${requestId}`,
      ];

  for (const url of candidates) {
    try {
      console.log(`[generate-multishot] response 시도: GET ${url}`);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Key ${falKey}` },
        signal: AbortSignal.timeout(12000),
      });
      const body = await res.text();
      console.log(`[generate-multishot] response HTTP ${res.status}: ${body.slice(0, 300)}`);
      if (res.status === 404 || res.status === 405) continue;
      return { ok: res.ok, httpStatus: res.status, body };
    } catch (e) {
      console.warn(`[generate-multishot] response URL 예외:`, e);
    }
  }

  return { ok: false, httpStatus: 0, body: 'all response URLs failed' };
}

function parsePollResult(pollResult: { httpStatus: number; body: string; isError: boolean }): {
  falStatus: string; queuePos: number | undefined; statusData: Record<string, unknown>; isNetworkError: boolean;
} {
  if (pollResult.isError) return { falStatus: 'IN_PROGRESS', queuePos: undefined, statusData: {}, isNetworkError: true };

  let statusData: Record<string, unknown> = {};
  try { statusData = JSON.parse(pollResult.body); } catch {
    return { falStatus: 'IN_PROGRESS', queuePos: undefined, statusData: {}, isNetworkError: false };
  }

  const falStatus = (statusData?.status as string) ?? 'IN_PROGRESS';
  const queuePos = statusData?.queue_position as number | undefined;
  return { falStatus, queuePos, statusData, isNetworkError: false };
}

async function actionInit(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { prompt, user_id, session_id } = body as { prompt: string; user_id?: string; session_id?: string };
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return new Response(JSON.stringify({ error: "prompt가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let OPENROUTER_KEY = await getOpenRouterKey(supabase);
  if (!OPENROUTER_KEY) OPENROUTER_KEY = Deno.env.get("OPENROUTER_KEY") ?? null;
  if (!OPENROUTER_KEY) {
    return new Response(JSON.stringify({ error: "OpenRouter API 키가 설정되지 않았습니다." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const CREDIT_COST = await getMultishotCreditCost(supabase);
  const { plan, credits, isVip } = await getUserPlan(supabase, user_id, session_id);
  if (!isVip && credits < CREDIT_COST) {
    return new Response(JSON.stringify({ error: `크레딧이 부족합니다. 필요: ${CREDIT_COST} CR, 보유: ${credits} CR`, insufficient_credits: true, required: CREDIT_COST, available: credits }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!isVip) await deductCredits(supabase, CREDIT_COST, user_id, session_id);

  const jobId = `multishot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await supabase.from('ad_works').insert({
    id: jobId, user_id: user_id ?? null, session_id: session_id ?? null,
    title: `멀티샷 영상 - ${prompt.slice(0, 30)}`, template_id: 'multishot',
    template_title: 'Kling Multi-Shot', result_type: 'video', result_url: 'pending',
    ratio: '16:9', resolution: '1K', format: 'MP4',
    step_status: { step: 'init', credit_cost: CREDIT_COST, is_vip: isVip, user_id: user_id ?? null, session_id: session_id ?? null }
  });

  console.log('[multishot:init] Claude 샷 플랜 생성 중...');
  const shotPlan = await generateShotPlan(prompt.trim(), OPENROUTER_KEY);
  console.log('[multishot:init] 샷 플랜 완료:', JSON.stringify(shotPlan).slice(0, 200));

  await supabase.from('ad_works').update({
    step_status: { step: 'shot_plan_done', credit_cost: CREDIT_COST, is_vip: isVip, user_id: user_id ?? null, session_id: session_id ?? null, shot_plan: shotPlan }
  }).eq('id', jobId);

  return new Response(JSON.stringify({ job_id: jobId, shot_plan: shotPlan, credits_used: isVip ? 0 : CREDIT_COST }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function actionGenImage(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { job_id, base_image_prompt } = body as { job_id: string; base_image_prompt: string };
  let FAL_KEY = await getFalKey(supabase);
  if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
  if (!FAL_KEY) return new Response(JSON.stringify({ error: "fal.ai API 키가 설정되지 않았습니다." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // 공식 문서:
  //   image_size: 'landscape_16_9' preset string (권장)
  //   enable_safety_checker: true
  //   output_format: 'jpeg'
  //   fal_max_queue_length: 15 (큐 혼잡 시 빠른 실패)
  //   X-Fal-Object-Lifecycle-Preference: 1시간 보관
  const res = await fetch('https://queue.fal.run/fal-ai/flux/schnell?fal_max_queue_length=15', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
      'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({
      prompt: base_image_prompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    // 공식 문서: 401/403 → 인증 실패
    if (res.status === 401 || res.status === 403) {
      throw new Error(`fal.ai 인증 실패 (HTTP ${res.status}). 대시보드(fal.ai/dashboard/keys)에서 키를 확인해주세요.`);
    }
    // 공식 문서: 429 → 큐 혼잡 (fal_max_queue_length 초과)
    if (res.status === 429) {
      throw new Error('fal.ai 대기열이 혼잡해요. 잠시 후 다시 시도해주세요.');
    }
    const errText = await res.text();
    throw new Error(`이미지 생성 요청 실패: ${res.status} - ${errText.slice(0, 100)}`);
  }

  const queueData = await res.json();
  const requestId = queueData?.request_id;
  // 공식 문서: status_url, response_url 수집
  const statusUrl = queueData?.status_url ?? null;
  const responseUrl = queueData?.response_url ?? null;
  const falReqId = extractFalRequestId(res);

  if (!requestId) throw new Error('이미지 생성 request_id 없음');

  await supabase.from('ad_works').update({
    step_status: { step: 'image_queued', image_request_id: requestId, status_url: statusUrl, response_url: responseUrl }
  }).eq('id', job_id);

  console.log(`[multishot:gen_image] request_id=${requestId}, status_url=${statusUrl ?? '(없음)'}, x-fal-request-id=${falReqId}`);

  return new Response(JSON.stringify({ request_id: requestId, status_url: statusUrl, response_url: responseUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function actionPollImage(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { job_id, request_id } = body as { job_id: string; request_id: string };
  const statusUrlFromPost = body.status_url as string | null | undefined;
  const responseUrlFromPost = body.response_url as string | null | undefined;

  let FAL_KEY = await getFalKey(supabase);
  if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
  if (!FAL_KEY) throw new Error("fal.ai API 키 없음");

  const MODEL_PATH = 'fal-ai/flux/schnell';
  const pollResult = await pollFalStatus(FAL_KEY, MODEL_PATH, request_id, statusUrlFromPost);
  const { falStatus, queuePos, isNetworkError } = parsePollResult(pollResult);

  console.log(`[multishot:poll_image] falStatus=${falStatus}, queue_pos=${queuePos}`);

  if (isNetworkError) {
    return new Response(JSON.stringify({ status: 'IN_PROGRESS' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (falStatus === 'COMPLETED') {
    const { ok, body: resultText } = await fetchFalResponse(FAL_KEY, MODEL_PATH, request_id, responseUrlFromPost);
    if (ok) {
      try {
        const resultData = JSON.parse(resultText);

        // 공식 문서: has_nsfw_concepts 체크
        const hasNsfw = checkNsfw(resultData);
        if (hasNsfw) {
          console.warn('[multishot:poll_image] NSFW 콘텐츠 감지됨');
          return new Response(JSON.stringify({ status: 'FAILED', error: '이미지가 콘텐츠 정책에 위반됐어요. 프롬프트를 수정해주세요.' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const imageUrl = resultData?.images?.[0]?.url;
        if (imageUrl) {
          await supabase.from('ad_works').update({ step_status: { step: 'image_done', base_image_url: imageUrl } }).eq('id', job_id);
          return new Response(JSON.stringify({ status: 'COMPLETED', image_url: imageUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch { /* JSON 파싱 실패 → IN_PROGRESS */ }
    }
  }

  if (falStatus === 'FAILED') {
    return new Response(JSON.stringify({ status: 'FAILED', error: '이미지 생성 실패' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ status: falStatus || 'IN_PROGRESS', queue_position: queuePos }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function actionGenVideo(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { shot_prompt, image_url, duration, shot_index } = body as { job_id: string; shot_prompt: string; image_url: string; duration: string; shot_index: number };
  let FAL_KEY = await getFalKey(supabase);
  if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
  if (!FAL_KEY) throw new Error("fal.ai API 키 없음");

  const klingDuration = parseInt(duration, 10) <= 5 ? '5' : '10';

  // 공식 문서: fal_max_queue_length + X-Fal-Object-Lifecycle-Preference
  const res = await fetch('https://queue.fal.run/fal-ai/kling-video/v1.6/pro/image-to-video?fal_max_queue_length=10', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
      'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({ prompt: shot_prompt, image_url, duration: klingDuration, aspect_ratio: '16:9' }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error(`fal.ai 인증 실패 (HTTP ${res.status})`);
    if (res.status === 429) throw new Error('fal.ai 대기열이 혼잡해요. 잠시 후 다시 시도해주세요.');
    throw new Error(`Kling 영상 생성 요청 실패: ${res.status}`);
  }

  const data = await res.json();
  const requestId = data?.request_id;
  // 공식 문서: status_url, response_url 수집
  const statusUrl = data?.status_url ?? null;
  const responseUrl = data?.response_url ?? null;
  const falReqId = extractFalRequestId(res);

  if (!requestId) throw new Error('Kling request_id 없음');

  console.log(`[multishot:gen_video] shot=${shot_index}, request_id=${requestId}, x-fal-request-id=${falReqId}`);

  return new Response(JSON.stringify({ request_id: requestId, shot_index, status_url: statusUrl, response_url: responseUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function actionPollVideo(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { request_id, shot_index } = body as { job_id: string; request_id: string; shot_index: number };
  const statusUrlFromPost = body.status_url as string | null | undefined;
  const responseUrlFromPost = body.response_url as string | null | undefined;

  let FAL_KEY = await getFalKey(supabase);
  if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
  if (!FAL_KEY) throw new Error("fal.ai API 키 없음");

  const MODEL_PATH = 'fal-ai/kling-video/v1.6/pro/image-to-video';
  const pollResult = await pollFalStatus(FAL_KEY, MODEL_PATH, request_id, statusUrlFromPost);
  const { falStatus, queuePos, isNetworkError } = parsePollResult(pollResult);

  console.log(`[multishot:poll_video] shot=${shot_index}, falStatus=${falStatus}, queue_pos=${queuePos}`);

  if (isNetworkError) {
    return new Response(JSON.stringify({ status: 'IN_PROGRESS', shot_index }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (falStatus === 'COMPLETED') {
    const { ok, body: resultText } = await fetchFalResponse(FAL_KEY, MODEL_PATH, request_id, responseUrlFromPost);
    if (ok) {
      try {
        const resultData = JSON.parse(resultText);
        const videoUrl = resultData?.video?.url ?? resultData?.video_url;
        if (videoUrl) {
          return new Response(JSON.stringify({ status: 'COMPLETED', video_url: videoUrl, shot_index }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch { /* JSON 파싱 실패 → IN_PROGRESS */ }
    }
  }

  if (falStatus === 'FAILED') {
    return new Response(JSON.stringify({ status: 'FAILED', error: `샷 ${shot_index + 1} 생성 실패`, shot_index }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ status: falStatus || 'IN_PROGRESS', queue_position: queuePos, shot_index }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function actionUploadToFal(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { webm_base64, content_type } = body as { webm_base64: string; content_type?: string };
  let FAL_KEY = await getFalKey(supabase);
  if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
  if (!FAL_KEY) return new Response(JSON.stringify({ error: "fal.ai API 키가 설정되지 않았습니다." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!webm_base64) return new Response(JSON.stringify({ error: "webm_base64가 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const binaryStr = atob(webm_base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }
  const mimeType = content_type ?? 'video/webm';
  const filename = `multishot_${Date.now()}.webm`;

  const uploadRes = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: filename, content_type: mimeType }),
    signal: AbortSignal.timeout(15000),
  });

  if (!uploadRes.ok) { return await directUploadToFal(bytes, mimeType, filename, FAL_KEY, corsHeaders); }
  const uploadData = await uploadRes.json();
  const uploadUrl = uploadData?.upload_url ?? uploadData?.url;
  const fileUrl = uploadData?.file_url ?? uploadData?.storage_url;

  if (uploadUrl) {
    const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: bytes, signal: AbortSignal.timeout(30000) });
    if (!putRes.ok) { return await directUploadToFal(bytes, mimeType, filename, FAL_KEY, corsHeaders); }
    const finalUrl = fileUrl ?? uploadData?.file_url;
    if (finalUrl) { return new Response(JSON.stringify({ url: finalUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
  }
  return await directUploadToFal(bytes, mimeType, filename, FAL_KEY, corsHeaders);
}

async function directUploadToFal(bytes: Uint8Array, mimeType: string, filename: string, falKey: string, headers: Record<string, string>): Promise<Response> {
  const formData = new FormData();
  const blob = new Blob([bytes], { type: mimeType });
  formData.append('file', blob, filename);
  const res = await fetch('https://rest.alpha.fal.ai/storage/upload', { method: 'POST', headers: { 'Authorization': `Key ${falKey}` }, body: formData, signal: AbortSignal.timeout(30000) });
  if (!res.ok) { const errText = await res.text(); return new Response(JSON.stringify({ error: `fal.ai 업로드 실패: ${res.status} - ${errText.slice(0, 100)}` }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } }); }
  const data = await res.json();
  const url = data?.url ?? data?.file_url ?? data?.storage_url;
  if (!url) return new Response(JSON.stringify({ error: 'fal.ai 업로드 응답에 URL 없음' }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ url }), { headers: { ...headers, "Content-Type": "application/json" } });
}

async function actionConvertToMp4(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { video_url } = body as { video_url: string };
  let FAL_KEY = await getFalKey(supabase);
  if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
  if (!FAL_KEY) return new Response(JSON.stringify({ error: "fal.ai API 키가 설정되지 않았습니다." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!video_url) return new Response(JSON.stringify({ error: "video_url이 필요합니다." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // 공식 문서: fal_max_queue_length + X-Fal-Object-Lifecycle-Preference
  const res = await fetch('https://queue.fal.run/fal-ai/ffmpeg-api/compose?fal_max_queue_length=10', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
      'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
    },
    body: JSON.stringify({ tracks: [{ id: 'main_video', type: 'video', keyframes: [{ url: video_url, timestamp: 0 }] }] }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) return new Response(JSON.stringify({ error: `fal.ai 인증 실패 (HTTP ${res.status})` }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ error: `MP4 변환 요청 실패: ${res.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const queueData = await res.json();
  const requestId = queueData?.request_id;
  // 공식 문서: status_url, response_url 수집
  const statusUrl = queueData?.status_url ?? null;
  const responseUrl = queueData?.response_url ?? null;

  if (!requestId) return new Response(JSON.stringify({ error: 'MP4 변환 request_id 없음' }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ request_id: requestId, status_url: statusUrl, response_url: responseUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function actionPollConvert(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { request_id } = body as { request_id: string };
  const statusUrlFromPost = body.status_url as string | null | undefined;
  const responseUrlFromPost = body.response_url as string | null | undefined;

  let FAL_KEY = await getFalKey(supabase);
  if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
  if (!FAL_KEY) throw new Error("fal.ai API 키 없음");

  const MODEL_PATH = 'fal-ai/ffmpeg-api/compose';
  const pollResult = await pollFalStatus(FAL_KEY, MODEL_PATH, request_id, statusUrlFromPost);
  const { falStatus, queuePos, isNetworkError } = parsePollResult(pollResult);

  console.log(`[multishot:poll_convert] falStatus=${falStatus}, queue_pos=${queuePos}`);

  if (isNetworkError) return new Response(JSON.stringify({ status: 'IN_PROGRESS' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (falStatus === 'COMPLETED') {
    const { ok, body: resultText } = await fetchFalResponse(FAL_KEY, MODEL_PATH, request_id, responseUrlFromPost);
    if (ok) {
      try {
        const resultData = JSON.parse(resultText);
        const mp4Url = resultData?.video?.url ?? resultData?.video_url ?? resultData?.url ?? resultData?.output?.url ?? resultData?.output_url;
        if (mp4Url) return new Response(JSON.stringify({ status: 'COMPLETED', mp4_url: mp4Url }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch { /* JSON 파싱 실패 → FAILED */ }
    }
    return new Response(JSON.stringify({ status: 'FAILED', error: 'MP4 URL을 찾을 수 없습니다' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (falStatus === 'FAILED') return new Response(JSON.stringify({ status: 'FAILED', error: 'MP4 변환 실패' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  return new Response(JSON.stringify({ status: falStatus || 'IN_PROGRESS', queue_position: queuePos }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function finalizeJob(supabase: ReturnType<typeof createClient>, jobId: string, videoUrl: string, userId?: string, sessionId?: string) {
  await supabase.from('ad_works').update({ result_url: videoUrl, step_status: { step: 'done' }, updated_at: new Date().toISOString() }).eq('id', jobId);
  await logUsage(supabase, { userId, sessionId, serviceSlug: 'fal', action: '멀티샷 영상 생성', creditsDeducted: 0, userPlan: 'unknown', status: 'success', metadata: { jobId, videoUrl } });
}

async function generateShotPlan(prompt: string, openRouterKey: string): Promise<{ shots: Array<{ shot_number: number; prompt: string; duration: string }>; total_duration: string; base_image_prompt: string; }> {
  const systemPrompt = `You are an elite cinematic director and AI video prompt engineer specializing in multi-shot video production.

## What is Multi-Shot Video?
Multi-shot video is a filmmaking technique where a single video is composed of multiple consecutive "shots". Each shot transitions naturally into the next.

## Your Task
1. Design exactly 3 shots that form a cohesive cinematic sequence.
2. For each shot, write a rich, detailed video generation prompt.
3. Assign a duration (in seconds) to each shot. Minimum 3 seconds, maximum 5 seconds per shot.
4. Write a base_image_prompt that describes the very first frame of the video as a still photograph.

**CRITICAL: Each shot prompt MUST be under 512 characters.**

## Output Format
Respond with ONLY this exact JSON structure. No markdown code fences, no explanation:
{"shots":[{"shot_number":1,"prompt":"...","duration":"5"},{"shot_number":2,"prompt":"...","duration":"5"},{"shot_number":3,"prompt":"...","duration":"5"}],"total_duration":"15","base_image_prompt":"..."}

## Strict Rules
- Output MUST be valid, parseable JSON. Nothing else.
- "duration" and "total_duration" MUST be string values.
- Always produce exactly 3 shots.
- Each duration must be minimum "3" and maximum "5".
- "total_duration" MUST NOT exceed "15".
- All prompts must be in English.`;

  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://readdy.ai', 'X-Title': 'Readdy AI Multi-Shot Creator' },
      body: JSON.stringify({ model: 'anthropic/claude-3-5-haiku', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 800 }),
    },
    60000
  );

  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      console.warn('[multishot] claude-3-5-haiku 실패, claude-3-5-sonnet으로 폴백');
      return await generateShotPlanFallback(prompt, openRouterKey, systemPrompt);
    }
    const errText = await res.text();
    throw new Error(`Claude 샷 플랜 생성 실패: ${res.status} - ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error(`Claude 응답 JSON 파싱 실패: ${cleaned.slice(0, 200)}`);
  }
}

async function generateShotPlanFallback(prompt: string, openRouterKey: string, systemPrompt: string): Promise<{ shots: Array<{ shot_number: number; prompt: string; duration: string }>; total_duration: string; base_image_prompt: string; }> {
  const res = await fetchWithTimeout(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openRouterKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://readdy.ai', 'X-Title': 'Readdy AI Multi-Shot Creator' },
      body: JSON.stringify({ model: 'anthropic/claude-3-5-sonnet', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 800 }),
    },
    90000
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude 폴백 실패: ${res.status} - ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error(`폴백 응답 JSON 파싱 실패: ${cleaned.slice(0, 200)}`);
  }
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
    bucket: `generate-multishot:${authedUserId}`,
    ...POLICIES.generateMultishot,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = body.action as string | undefined;
    if (body._get_cost) { const cost = await getMultishotCreditCost(supabase); return new Response(JSON.stringify({ cost }), { headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    switch (action) {
      case 'init':            return await actionInit(body, supabase);
      case 'gen_image':       return await actionGenImage(body, supabase);
      case 'poll_image':      return await actionPollImage(body, supabase);
      case 'gen_video':       return await actionGenVideo(body, supabase);
      case 'poll_video':      return await actionPollVideo(body, supabase);
      case 'upload_to_fal':   return await actionUploadToFal(body, supabase);
      case 'convert_to_mp4':  return await actionConvertToMp4(body, supabase);
      case 'poll_convert':    return await actionPollConvert(body, supabase);
      case 'merge':
      case 'poll_merge': {
        const videoUrls = (body.video_urls as string[]) ?? [];
        const fallback = videoUrls[0] ?? '';
        if (body.job_id) await finalizeJob(supabase, body.job_id as string, fallback, body.user_id as string | undefined, body.session_id as string | undefined);
        return new Response(JSON.stringify({ status: 'COMPLETED', video_url: fallback }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      default:
        return new Response(JSON.stringify({ error: `알 수 없는 action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("generate-multishot Edge Function 오류:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
