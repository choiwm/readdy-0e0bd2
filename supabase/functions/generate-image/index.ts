import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';
import {
  resolveImageModel,
  DEFAULT_IMAGE_MODEL,
  VERIFIED_FAL_IMAGE_MODELS,
} from '../_shared/fal_image_models.ts';
import { parseFalError, toClientPayload } from '../_shared/fal_errors.ts';
import { persistFalAsset } from '../_shared/fal_storage.ts';

const CINEMATIC_SUFFIXES: Record<string, string> = {
  "Wide Shot":     "wide establishing shot, cinematic composition, dramatic lighting",
  "Medium Shot":   "medium shot, natural lighting, shallow depth of field",
  "Close Up":      "extreme close up, bokeh background, cinematic portrait",
  "Over Shoulder": "over the shoulder shot, cinematic framing",
  "Two Shot":      "two shot composition, cinematic lighting",
  "POV":           "point of view shot, first person perspective",
  "Aerial":        "aerial drone shot, bird eye view, cinematic landscape",
  "Tracking":      "tracking shot, motion blur, cinematic action",
};

function getImageSize(ratio: string): string | { width: number; height: number } {
  switch (ratio) {
    case '16:9':  return 'landscape_16_9';
    case '1:1':   return 'square_hd';
    case '9:16':  return 'portrait_16_9';
    case '4:3':   return 'landscape_4_3';
    case '3:4':   return 'portrait_4_3';
    case '21:9':  return { width: 1280, height: 548 };
    default:      return 'landscape_16_9';
  }
}

function parseDimensions(ratio: string): { width: number; height: number } {
  if (ratio === '9:16')  return { width: 576,  height: 1024 };
  if (ratio === '1:1')   return { width: 1024, height: 1024 };
  if (ratio === '4:3')   return { width: 1024, height: 768  };
  if (ratio === '3:4')   return { width: 768,  height: 1024 };
  if (ratio === '21:9')  return { width: 1280, height: 548  };
  return { width: 1024, height: 576 };
}

async function getEncryptionKeyV2(): Promise<CryptoKey> {
  const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    if (encrypted.startsWith('aes_v2:')) {
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const key = await getEncryptionKeyV2();
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
      const result = new TextDecoder().decode(decrypted);
      console.log(`[generate-image] 복호화 성공, 키 길이: ${result.length}`);
      return result;
    }
    if (encrypted.startsWith('aes_v1:')) {
      const base64Data = encrypted.slice(7);
      const combined = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
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
      const parts = encrypted.split(':');
      if (parts.length >= 3) { try { return atob(parts[2]); } catch { return null; } }
    }
    return encrypted;
  } catch (e) {
    console.error('[generate-image] decryptKey 오류:', e);
    return null;
  }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('encrypted_key, status')
      .eq('service_slug', 'fal')
      .eq('status', 'active')
      .maybeSingle();
    if (error || !data?.encrypted_key) {
      console.warn('[generate-image] fal 키 조회 실패:', error?.message ?? 'no data');
      return null;
    }
    return await decryptKey(data.encrypted_key as string);
  } catch (e) {
    console.error('[generate-image] getFalKey 예외:', e);
    return null;
  }
}

async function logUsage(supabase: ReturnType<typeof createClient>, opts: {
  userId?: string; sessionId?: string; serviceSlug: string; action: string;
  creditsDeducted: number; userPlan: string; status: 'success' | 'failed' | 'insufficient_credits';
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('usage_logs').insert({
      user_id: opts.userId ?? null,
      session_id: opts.sessionId ?? null,
      service_slug: opts.serviceSlug,
      action: opts.action,
      credits_deducted: opts.creditsDeducted,
      user_plan: opts.userPlan,
      status: opts.status,
      metadata: opts.metadata ?? {}
    });
  } catch (e) {
    console.error('[generate-image] logUsage 예외:', e);
  }
}

async function saveGalleryItem(supabase: ReturnType<typeof createClient>, opts: {
  type: 'image' | 'video'; url: string; prompt: string; model: string;
  ratio: string; userId?: string; sessionId?: string; source?: string;
}): Promise<void> {
  try {
    const effectiveUserId = opts.userId ?? opts.sessionId ?? 'anonymous';
    await supabase.from('gallery_items').insert({
      type: opts.type, url: opts.url, prompt: opts.prompt, model: opts.model,
      ratio: opts.ratio, liked: false,
      user_id: effectiveUserId,
      session_id: opts.userId ? null : (opts.sessionId ?? null),
      source: opts.source ?? 'ai-create',
    });
    console.log('[generate-image] gallery_items 저장 성공');
  } catch (e) {
    console.warn('[generate-image] gallery_items INSERT 실패:', e);
  }
}

async function saveAdWork(supabase: ReturnType<typeof createClient>, opts: {
  userId?: string; sessionId?: string; templateId?: string; templateTitle?: string;
  resultType: 'image' | 'video'; resultUrl: string; ratio: string;
  resolution: string; format: string; productName?: string; productDesc?: string;
}): Promise<string | null> {
  try {
    const workId = `adwork_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const { error } = await supabase.from('ad_works').insert({
      id: workId, user_id: opts.userId ?? null, session_id: opts.sessionId ?? null,
      title: opts.templateTitle ?? 'AI 광고 이미지', template_id: opts.templateId ?? null,
      template_title: opts.templateTitle ?? null, result_type: opts.resultType,
      result_url: opts.resultUrl, ratio: opts.ratio ?? '16:9',
      resolution: opts.resolution ?? '1K', format: opts.format ?? 'PNG',
      product_name: opts.productName ?? null, product_desc: opts.productDesc ?? null,
    });
    if (error) { console.error('[generate-image] ad_works INSERT 실패:', error.message); return null; }
    console.log('[generate-image] ad_works 저장 성공:', workId);
    return workId;
  } catch (e) {
    console.error('[generate-image] ad_works INSERT 예외:', e);
    return null;
  }
}

function extractImgResult(data: Record<string, unknown>): {
  url: string | null; hasNsfw: boolean; nsfwConcepts: boolean[];
} {
  const nsfwConcepts = (data?.has_nsfw_concepts as boolean[] | undefined) ?? [];
  const hasNsfw = nsfwConcepts.some(Boolean);
  const url =
    (data?.images as Array<{ url: string }>)?.[0]?.url ??
    (data?.image as { url: string })?.url ??
    (data?.image_url as string) ??
    (data?.url as string) ??
    null;
  return { url, hasNsfw, nsfwConcepts };
}

function getFalRequestId(res: Response): string | null {
  return res.headers.get('x-fal-request-id') ?? res.headers.get('X-Fal-Request-Id') ?? null;
}

function getBillableUnits(res: Response): string | null {
  return res.headers.get('X-Fal-Billable-Units') ?? res.headers.get('x-fal-billable-units') ?? null;
}

function getFalRetryableHeader(res: Response): string | null {
  return res.headers.get('X-Fal-Retryable') ?? res.headers.get('x-fal-retryable') ?? null;
}

function getFalErrorTypeHeader(res: Response): string | null {
  return res.headers.get('X-Fal-Error-Type') ?? res.headers.get('x-fal-error-type') ?? null;
}

const RETRYABLE_MODEL_ERROR_TYPES = new Set([
  'internal_server_error', 'generation_timeout',
  'downstream_service_error', 'downstream_service_unavailable',
]);
const PERMANENT_MODEL_ERROR_TYPES = new Set([
  'content_policy_violation', 'no_media_generated', 'image_too_small', 'image_too_large',
  'image_load_error', 'file_download_error', 'face_detection_error', 'file_too_large',
  'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal', 'multiple_of',
  'sequence_too_short', 'sequence_too_long', 'one_of', 'feature_not_supported',
  'unsupported_image_format', 'unsupported_audio_format', 'unsupported_video_format',
]);
const RETRYABLE_REQUEST_ERROR_TYPES = new Set([
  'request_timeout', 'startup_timeout', 'runner_scheduling_failure',
  'runner_connection_timeout', 'runner_disconnected', 'runner_connection_refused',
  'runner_connection_error', 'runner_incomplete_response', 'runner_server_error', 'internal_error',
]);

interface FalErrorInfo {
  message: string;
  errorType: string | null;
  isRetryable: boolean;
}

function parseFalErrorBody(
  body: Record<string, unknown>,
  retryableHeader: string | null,
  errorTypeHeader: string | null,
): FalErrorInfo {
  if (Array.isArray(body.detail)) {
    const errors = body.detail as Array<{ loc: string[]; msg: string; type: string; ctx?: Record<string, unknown> }>;
    const first = errors[0];
    if (first) {
      const errType = first.type;
      let isRetryable: boolean;
      if (retryableHeader !== null) {
        isRetryable = retryableHeader === 'true';
      } else {
        isRetryable = RETRYABLE_MODEL_ERROR_TYPES.has(errType) && !PERMANENT_MODEL_ERROR_TYPES.has(errType);
      }
      const msg = buildModelErrorMessage(first);
      return { message: msg, errorType: errType, isRetryable };
    }
  }

  if (typeof body.detail === 'string' && body.error_type) {
    const errType = (errorTypeHeader ?? body.error_type) as string;
    let isRetryable: boolean;
    if (retryableHeader !== null) {
      isRetryable = retryableHeader === 'true';
    } else {
      isRetryable = RETRYABLE_REQUEST_ERROR_TYPES.has(errType);
    }
    return { message: body.detail as string, errorType: errType, isRetryable };
  }

  if (typeof body.error === 'string') {
    const errType = errorTypeHeader ?? (body.error_type as string | null) ?? null;
    return { message: body.error as string, errorType: errType, isRetryable: true };
  }

  if (typeof body.detail === 'string') {
    return { message: body.detail as string, errorType: errorTypeHeader, isRetryable: true };
  }

  return { message: '알 수 없는 fal.ai 오류', errorType: errorTypeHeader, isRetryable: true };
}

function buildModelErrorMessage(err: { type: string; msg: string; ctx?: Record<string, unknown> }): string {
  const ctx = err.ctx ?? {};
  switch (err.type) {
    case 'content_policy_violation':
      return '콘텐츠 정책에 위반됐어요. 프롬프트를 수정해주세요.';
    case 'no_media_generated':
      return '이미지 생성이 완료됐지만 결과물이 없어요. 프롬프트를 바꿔 다시 시도해주세요.';
    case 'image_too_small': {
      const minW = ctx.min_width as number | undefined;
      const minH = ctx.min_height as number | undefined;
      if (minW && minH) return `이미지가 너무 작아요. 최소 ${minW}x${minH}px 이상이어야 해요.`;
      return '이미지가 너무 작아요.';
    }
    case 'image_too_large': {
      const maxW = ctx.max_width as number | undefined;
      const maxH = ctx.max_height as number | undefined;
      if (maxW && maxH) return `이미지가 너무 커요. 최대 ${maxW}x${maxH}px 이하여야 해요.`;
      return '이미지가 너무 커요.';
    }
    case 'image_load_error': return '이미지를 불러올 수 없어요. 파일이 손상됐거나 지원하지 않는 형식이에요.';
    case 'file_download_error': return '이미지 URL에 접근할 수 없어요. 공개 URL인지 확인해주세요.';
    case 'unsupported_image_format': {
      const formats = ctx.supported_formats as string[] | undefined;
      if (formats) return `지원하지 않는 이미지 형식이에요. 지원 형식: ${formats.join(', ')}`;
      return '지원하지 않는 이미지 형식이에요.';
    }
    case 'less_than_equal': {
      const le = ctx.le as number | undefined;
      if (le !== undefined) return `입력값이 최대 ${le}을(를) 초과했어요.`;
      return '입력값이 허용 범위를 초과했어요.';
    }
    case 'greater_than_equal': {
      const ge = ctx.ge as number | undefined;
      if (ge !== undefined) return `입력값이 최소 ${ge} 이상이어야 해요.`;
      return '입력값이 너무 작아요.';
    }
    case 'multiple_of': {
      const mul = ctx.multiple_of as number | undefined;
      if (mul !== undefined) return `입력값은 ${mul}의 배수여야 해요.`;
      return '입력값이 허용되지 않아요.';
    }
    case 'one_of': {
      const expected = ctx.expected as string[] | undefined;
      if (expected) return `허용되지 않는 값이에요. 가능한 값: ${expected.join(', ')}`;
      return '허용되지 않는 입력값이에요.';
    }
    case 'internal_server_error': return 'fal.ai 서버 내부 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'generation_timeout': return '이미지 생성 시간이 초과됐어요. 잠시 후 다시 시도해주세요.';
    case 'downstream_service_error': return 'fal.ai 외부 서비스 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'downstream_service_unavailable': return 'fal.ai 외부 서비스가 일시적으로 이용 불가해요. 잠시 후 다시 시도해주세요.';
    case 'feature_not_supported': return '현재 설정에서 지원하지 않는 기능이에요.';
    default:
      return err.msg || '입력값 검증 오류가 발생했어요.';
  }
}

function resolvePollingUrls(
  falModel: string,
  requestId: string,
  statusUrl?: string | null,
  responseUrl?: string | null,
): { statusUrl: string; responseUrl: string } {
  const resolvedStatusUrl = statusUrl
    ?? `https://queue.fal.run/${falModel}/requests/${requestId}`;
  const resolvedResponseUrl = responseUrl
    ?? `https://queue.fal.run/${falModel}/requests/${requestId}/response`;

  if (!statusUrl) {
    console.warn(`[generate-image:poll] ⚠️ status_url 없음 — 조립: ${resolvedStatusUrl}`);
  } else {
    console.log(`[generate-image:poll] status_url OK: ${resolvedStatusUrl}`);
  }

  return { statusUrl: resolvedStatusUrl, responseUrl: resolvedResponseUrl };
}

async function handlePollMode(
  body: Record<string, unknown>,
  FAL_KEY: string,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const requestId = body.request_id as string;
  const falModel = body.model as string;
  const statusUrlInput = body.status_url as string | undefined | null;
  const responseUrlInput = body.response_url as string | undefined | null;
  const saveOpts = body.save_opts as Record<string, unknown> | undefined;

  if (!requestId || !falModel) {
    return new Response(JSON.stringify({ error: 'request_id, model 필요' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { statusUrl: resolvedStatusUrl, responseUrl: resolvedResponseUrl } = resolvePollingUrls(
    falModel, requestId, statusUrlInput, responseUrlInput,
  );

  console.log(`[generate-image:poll] === 폴링 시작 ===`);
  console.log(`[generate-image:poll] request_id=${requestId}, model=${falModel}`);
  console.log(`[generate-image:poll] status_url=${resolvedStatusUrl}`);

  const MAX_RETRIES = 2;
  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const statusRes = await fetch(resolvedStatusUrl, {
        method: 'GET',
        headers: { 'Authorization': `Key ${FAL_KEY}` },
        signal: AbortSignal.timeout(30000),
      });

      const statusText = await statusRes.text();
      console.log(`[generate-image:poll] attempt=${attempt} HTTP ${statusRes.status}: ${statusText.slice(0, 400)}`);

      const corsH = { ...corsHeaders, 'Content-Type': 'application/json' };

      if ([401, 402, 403, 404].includes(statusRes.status)) {
        let parsedBody: Record<string, unknown> = {};
        try { parsedBody = JSON.parse(statusText); } catch { /* ignore */ }
        const parsed = parseFalError(statusRes.status, parsedBody, statusRes);
        return new Response(JSON.stringify({
          status: 'FAILED',
          ...toClientPayload(parsed),
          retryable: parsed.is_retryable,
        }), { headers: corsH });
      }
      if (statusRes.status === 405) {
        console.error(`[generate-image:poll] 405 — URL: ${resolvedStatusUrl}`);
        return new Response(JSON.stringify({
          status: 'FAILED',
          error: 'fal.ai 폴링 URL 오류 (405). 새로 생성을 시도해주세요.',
          retryable: false,
        }), { headers: corsH });
      }

      if (!statusRes.ok) {
        let parsedBody: Record<string, unknown> = {};
        try { parsedBody = JSON.parse(statusText); } catch { /* ignore */ }
        const retryableHeader = getFalRetryableHeader(statusRes);
        const errInfo = parseFalErrorBody(parsedBody, retryableHeader, getFalErrorTypeHeader(statusRes));
        if (errInfo.isRetryable && attempt < MAX_RETRIES) {
          lastError = `HTTP ${statusRes.status}`;
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return new Response(JSON.stringify({ status: 'IN_PROGRESS', error: errInfo.message }), {
          headers: corsH,
        });
      }

      let statusData: Record<string, unknown>;
      try { statusData = JSON.parse(statusText); } catch {
        return new Response(JSON.stringify({ status: 'IN_PROGRESS' }), { headers: corsH });
      }

      const falStatus = (statusData.status as string) ?? 'IN_PROGRESS';
      console.log(`[generate-image:poll] fal.status=${falStatus}, queue_pos=${statusData.queue_position ?? '-'}`);

      if (falStatus === 'COMPLETED') {
        const resultRes = await fetch(resolvedResponseUrl, {
          method: 'GET',
          headers: { 'Authorization': `Key ${FAL_KEY}` },
          signal: AbortSignal.timeout(30000),
        });

        const resultText = await resultRes.text();
        console.log(`[generate-image:poll] response HTTP ${resultRes.status}: ${resultText.slice(0, 400)}`);

        if (!resultRes.ok) {
          let parsedErr: Record<string, unknown> = {};
          try { parsedErr = JSON.parse(resultText); } catch { /* ignore */ }
          const errInfo = parseFalErrorBody(parsedErr, getFalRetryableHeader(resultRes), getFalErrorTypeHeader(resultRes));
          return new Response(JSON.stringify({ status: 'FAILED', error: errInfo.message }), { headers: corsH });
        }

        let resultData: Record<string, unknown>;
        try { resultData = JSON.parse(resultText); } catch {
          return new Response(JSON.stringify({ status: 'FAILED', error: '결과 파싱 실패' }), { headers: corsH });
        }

        console.log(`[generate-image:poll] 응답 키: ${Object.keys(resultData).join(', ')}`);

        if (Array.isArray(resultData.detail)) {
          const errInfo = parseFalErrorBody(resultData, null, null);
          if (!errInfo.isRetryable) {
            return new Response(JSON.stringify({ status: 'FAILED', error: errInfo.message }), { headers: corsH });
          }
        }

        const extracted = extractImgResult(resultData);
        console.log(`[generate-image:poll] imageUrl 추출: ${extracted.url ? extracted.url.slice(0, 80) : 'null'}`);

        if (!extracted.url) {
          return new Response(JSON.stringify({
            status: 'FAILED',
            error: `이미지 URL이 없습니다. 응답 키: ${Object.keys(resultData).join(', ')}`,
            raw: JSON.stringify(resultData).slice(0, 300),
          }), { headers: corsH });
        }

        extracted.url = await persistFalAsset(
          supabase, extracted.url, 'image',
          (saveOpts?.user_id as string | undefined) ?? (saveOpts?.session_id as string | undefined) ?? 'anon',
        );

        let adWorkId: string | null = null;
        if (saveOpts) {
          const soUserId = saveOpts.user_id as string | undefined;
          const soSessionId = saveOpts.session_id as string | undefined;
          const soSource = saveOpts.source as string | undefined;
          const soPrompt = (saveOpts.prompt as string) ?? '';
          const soModel = (saveOpts.model as string) ?? falModel;
          const soRatio = (saveOpts.ratio as string) ?? '16:9';

          await saveGalleryItem(supabase, {
            type: 'image', url: extracted.url, prompt: soPrompt,
            model: soModel, ratio: soRatio,
            userId: soUserId, sessionId: soSessionId, source: soSource ?? 'ai-ad',
          });

          if (soSource === 'ai-ad') {
            adWorkId = await saveAdWork(supabase, {
              userId: soUserId, sessionId: soSessionId,
              templateId: saveOpts.template_id as string | undefined,
              templateTitle: saveOpts.template_title as string | undefined,
              resultType: 'image', resultUrl: extracted.url,
              ratio: soRatio,
              resolution: (saveOpts.resolution as string) ?? '1K',
              format: (saveOpts.format as string) ?? 'PNG',
              productName: saveOpts.product_name as string | undefined,
              productDesc: saveOpts.product_desc as string | undefined,
            });
          }

          await logUsage(supabase, {
            userId: soUserId, sessionId: soSessionId, serviceSlug: 'fal',
            action: `이미지 생성 완료 (${falModel}) - polling_done`,
            creditsDeducted: 0, userPlan: 'user', status: 'success',
            metadata: {
              model: falModel, polling_completed: true,
              has_nsfw: extracted.hasNsfw,
              ad_work_id: adWorkId,
              image_url: extracted.url.slice(0, 100),
            },
          });
        }

        return new Response(JSON.stringify({
          imageUrl: extracted.url,
          status: 'COMPLETED',
          ad_work_id: adWorkId,
          has_nsfw_concepts: extracted.hasNsfw,
        }), { headers: corsH });
      }

      if (falStatus === 'FAILED') {
        const retryableH = getFalRetryableHeader(statusRes);
        const errInfo = parseFalErrorBody(statusData, retryableH, getFalErrorTypeHeader(statusRes));
        return new Response(JSON.stringify({ status: 'FAILED', error: errInfo.message }), { headers: corsH });
      }

      return new Response(JSON.stringify({
        status: falStatus || 'IN_PROGRESS',
        queue_position: statusData.queue_position,
      }), { headers: corsH });

    } catch (e) {
      const isTimeout = e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');
      lastError = isTimeout ? '폴링 타임아웃 (30초)' : (e instanceof Error ? e.message : String(e));
      console.error(`[generate-image:poll] attempt=${attempt} 예외:`, lastError);
      if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 3000)); continue; }
    }
  }

  return new Response(JSON.stringify({ status: 'IN_PROGRESS', _retry_error: lastError }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );


  const _rl = await checkRateLimit(supabase, {
    bucket: `generate-image:${authedUserId}`,
    ...POLICIES.generateImage,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = await req.json();
    console.log('[generate-image] ===== 요청 수신 ===== body_keys:', Object.keys(body).join(','), '| _poll:', body._poll);

    let FAL_KEY = await getFalKey(supabase);
    if (!FAL_KEY) FAL_KEY = Deno.env.get('FAL_KEY') ?? null;
    if (!FAL_KEY) {
      console.error('[generate-image] FAL API 키 없음');
      return respond({ error: 'fal.ai API 키가 설정되지 않았습니다. 어드민 패널에서 키를 등록하세요.' }, 500);
    }
    console.log(`[generate-image] API 키 길이: ${FAL_KEY.length}자`);

    if (body._poll === true) {
      return await handlePollMode(body, FAL_KEY, supabase);
    }

    const {
      prompt, model = 'Flux Realism', model_id,
      ratio = '16:9', aspectRatio, shotType, mode = 'default',
      session_id, image_url, image_strength = 0.85,
      source, template_id, template_title, product_name, product_desc,
      resolution = '1K', format = 'PNG',
      seed,
      output_format = 'jpeg',
      enable_safety_checker = true,
    } = body;

    if (!prompt) {
      return respond({ error: 'prompt가 필요합니다.' }, 400);
    }

    const useImageToImage = Boolean(image_url);
    let falModel: string;

    if (model_id) {
      // Direct fal.ai path supplied (advanced flow). Map to i2i variant if
      // we know one, otherwise use the path as-is and trust the caller.
      const entry = VERIFIED_FAL_IMAGE_MODELS[model_id];
      if (useImageToImage && entry?.i2i) {
        falModel = entry.i2i;
      } else {
        falModel = model_id;
      }
    } else {
      // Display name path. Resolve through the alias table and fall back to
      // schnell with a warning if the name is unknown — this catches
      // miswired frontends instead of silently returning Flux Realism for
      // any string the client sends.
      const resolved = resolveImageModel(model);
      if (!resolved) {
        console.warn(
          `[generate-image] 알 수 없는 모델 이름: "${model}" — 기본 ${DEFAULT_IMAGE_MODEL.id}로 폴백.`
          + ' src/pages/ai-create/components/PromptBar.tsx의 모델 목록과'
          + ' supabase/functions/_shared/fal_image_models.ts의 IMAGE_MODEL_ALIASES를 확인하세요.'
        );
      }
      const entry = resolved ?? DEFAULT_IMAGE_MODEL;
      falModel = useImageToImage
        ? (entry.i2i ?? 'fal-ai/flux/dev/image-to-image')
        : entry.id;
    }

    const isSchnell = falModel.includes('schnell') && !falModel.includes('redux');
    const normalizedRatio = aspectRatio ?? ratio ?? '16:9';
    const imageSizeParam = getImageSize(normalizedRatio);
    const { width, height } = parseDimensions(normalizedRatio);
    const modelDisplayName = useImageToImage ? `${model} (i2i)` : (model ?? 'Flux');

    console.log(`[generate-image] 모델: ${falModel}, ratio: ${normalizedRatio}, isSchnell=${isSchnell}, useI2I=${useImageToImage}`);
    if (useImageToImage) {
      console.log(`[generate-image] image_url: ${(image_url as string).slice(0, 100)}`);
    }

    let finalPrompt = prompt as string;
    if (mode === 'storyboard' && shotType) {
      const suffix = CINEMATIC_SUFFIXES[shotType as string] ?? 'cinematic storyboard frame';
      finalPrompt = `${finalPrompt.trim()}, ${suffix}, high quality, detailed`;
    }

    let falRequestBody: Record<string, unknown>;
    if (useImageToImage && image_url) {
      if (falModel.includes('/redux')) {
        falRequestBody = {
          prompt: finalPrompt,
          image_url,
          num_inference_steps: isSchnell ? 4 : 28,
          num_images: 1,
          output_format,
          enable_safety_checker,
          enable_safety_checks: enable_safety_checker,
          ...(seed != null ? { seed: Number(seed) } : {}),
        };
      } else {
        falRequestBody = {
          prompt: finalPrompt,
          image_url,
          image_size: imageSizeParam,
          strength: typeof image_strength === 'number' ? image_strength : 0.85,
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          output_format,
          enable_safety_checker,
          enable_safety_checks: enable_safety_checker,
          ...(seed != null ? { seed: Number(seed) } : {}),
        };
      }
    } else {
      falRequestBody = {
        prompt: finalPrompt,
        image_size: imageSizeParam,
        num_inference_steps: isSchnell ? 4 : 28,
        ...(isSchnell ? {} : { guidance_scale: 3.5 }),
        num_images: 1,
        output_format,
        enable_safety_checker,
        enable_safety_checks: enable_safety_checker,
        ...(seed != null ? { seed: Number(seed) } : {}),
      };
    }

    console.log(`[generate-image] fal 요청: ${JSON.stringify(falRequestBody).slice(0, 300)}`);

    if (isSchnell) {
      console.log(`[generate-image] schnell 직접 호출: https://fal.run/${falModel}`);
      const res = await fetch(`https://fal.run/${falModel}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(falRequestBody),
        signal: AbortSignal.timeout(55000),
      });

      const falRequestId = getFalRequestId(res);
      const billableUnits = getBillableUnits(res);
      const retryableHeader = getFalRetryableHeader(res);
      const errorTypeHeader = getFalErrorTypeHeader(res);
      if (falRequestId) console.log(`[generate-image] x-fal-request-id: ${falRequestId}`);
      if (billableUnits) console.log(`[generate-image] X-Fal-Billable-Units: ${billableUnits}`);

      const resText = await res.text();
      console.log(`[generate-image] schnell HTTP ${res.status}: ${resText.slice(0, 300)}`);

      // Auth/payment/scope failures: surface the centralised actionable
      // message so the admin sees "결제 등록 필요" vs "키 재발급 필요".
      if ([401, 402, 403, 404].includes(res.status)) {
        let parsedBody: Record<string, unknown> = {};
        try { parsedBody = JSON.parse(resText); } catch { /* ignore */ }
        const parsed = parseFalError(res.status, parsedBody, res);
        return respond(toClientPayload(parsed), res.status);
      }

      if (res.ok) {
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(resText); } catch { /* ignore */ }

        const extracted = extractImgResult(data);
        if (extracted.url) {
          extracted.url = await persistFalAsset(supabase, extracted.url, 'image', authedUserId ?? session_id ?? 'anon');

          await logUsage(supabase, {
            userId: authedUserId, sessionId: session_id, serviceSlug: 'fal',
            action: `이미지 생성 (${model})`, creditsDeducted: 0, userPlan: 'test', status: 'success',
            metadata: { model: falModel, ratio: normalizedRatio, source, has_nsfw: extracted.hasNsfw, image_to_image: useImageToImage },
          });

          let adWorkId: string | null = null;
          if (source === 'ai-ad') {
            adWorkId = await saveAdWork(supabase, {
              userId: authedUserId, sessionId: session_id, templateId: template_id,
              templateTitle: template_title, resultType: 'image', resultUrl: extracted.url,
              ratio: normalizedRatio, resolution: resolution as string,
              format: format as string, productName: product_name, productDesc: product_desc,
            });
          }

          await saveGalleryItem(supabase, {
            type: 'image', url: extracted.url, prompt: finalPrompt,
            model: modelDisplayName, ratio: normalizedRatio,
            userId: authedUserId, sessionId: session_id, source: source ?? 'ai-create',
          });

          return respond({
            success: true, imageUrl: extracted.url,
            ratio: `${width}:${height}`, credits_used: 0,
            model_used: falModel, image_to_image: useImageToImage,
            ad_work_id: adWorkId, has_nsfw_concepts: extracted.hasNsfw,
            fal_request_id: falRequestId,
          });
        }
      } else {
        let errBody: Record<string, unknown> = {};
        try { errBody = JSON.parse(resText); } catch { /* ignore */ }
        const errInfo = parseFalErrorBody(errBody, retryableHeader, errorTypeHeader);

        if (res.status === 422 && !errInfo.isRetryable) {
          await logUsage(supabase, {
            userId: authedUserId, sessionId: session_id, serviceSlug: 'fal',
            action: `이미지 생성 실패 (${model}) - validation`, creditsDeducted: 0, userPlan: 'test',
            status: 'failed', metadata: { error: errInfo.message, model: falModel, error_type: errInfo.errorType },
          });
          return respond({ error: errInfo.message, fal_error_type: errInfo.errorType }, 422);
        }
        console.log(`[generate-image] schnell 실패(HTTP ${res.status}) → Queue 폴백`);
      }
      console.log('[generate-image] schnell fallback → Queue 제출 (pending 반환)');
    }

    console.log(`[generate-image] Queue 제출: ${falModel}`);

    const queueRes = await fetch(`https://queue.fal.run/${falModel}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
        'X-Fal-Object-Lifecycle-Preference': JSON.stringify({ expiration_duration_seconds: 3600 }),
      },
      body: JSON.stringify(falRequestBody),
      signal: AbortSignal.timeout(15000),
    });

    const queueText = await queueRes.text();
    const queueFalReqId = getFalRequestId(queueRes);
    if (queueFalReqId) console.log(`[generate-image] queue x-fal-request-id: ${queueFalReqId}`);
    console.log(`[generate-image] Queue HTTP ${queueRes.status}: ${queueText.slice(0, 400)}`);

    if ([401, 402, 403, 404].includes(queueRes.status)) {
      let parsedBody: Record<string, unknown> = {};
      try { parsedBody = JSON.parse(queueText); } catch { /* ignore */ }
      const parsed = parseFalError(queueRes.status, parsedBody, queueRes);
      return respond(toClientPayload(parsed), queueRes.status);
    }

    if (!queueRes.ok) {
      let errBody: Record<string, unknown> = {};
      try { errBody = JSON.parse(queueText); } catch { /* ignore */ }
      const retryableH = getFalRetryableHeader(queueRes);
      const errInfo = parseFalErrorBody(errBody, retryableH, getFalErrorTypeHeader(queueRes));

      await logUsage(supabase, {
        userId: authedUserId, sessionId: session_id, serviceSlug: 'fal',
        action: `이미지 생성 실패 (${model}) - queue submit`, creditsDeducted: 0, userPlan: 'test',
        status: 'failed', metadata: { error: errInfo.message, model: falModel, http_status: queueRes.status },
      });
      return respond({ error: errInfo.message, fal_error_type: errInfo.errorType }, 502);
    }

    let queueData: Record<string, unknown>;
    try { queueData = JSON.parse(queueText); } catch {
      return respond({ error: 'Queue 응답 파싱 실패' }, 502);
    }

    const immediateExtracted = extractImgResult(queueData);
    if (immediateExtracted.url) {
      immediateExtracted.url = await persistFalAsset(supabase, immediateExtracted.url, 'image', authedUserId ?? session_id ?? 'anon');
      console.log(`[generate-image] Queue 즉시 완료: ${immediateExtracted.url.slice(0, 80)}`);

      await logUsage(supabase, {
        userId: authedUserId, sessionId: session_id, serviceSlug: 'fal',
        action: `이미지 생성 (${model})`, creditsDeducted: 0, userPlan: 'test', status: 'success',
        metadata: { model: falModel, ratio: normalizedRatio, source, immediate: true, image_to_image: useImageToImage },
      });

      let adWorkId: string | null = null;
      if (source === 'ai-ad') {
        adWorkId = await saveAdWork(supabase, {
          userId: authedUserId, sessionId: session_id, templateId: template_id,
          templateTitle: template_title, resultType: 'image', resultUrl: immediateExtracted.url,
          ratio: normalizedRatio, resolution: resolution as string, format: format as string,
          productName: product_name, productDesc: product_desc,
        });
      }
      await saveGalleryItem(supabase, {
        type: 'image', url: immediateExtracted.url, prompt: finalPrompt,
        model: modelDisplayName, ratio: normalizedRatio,
        userId: authedUserId, sessionId: session_id, source: source ?? 'ai-create',
      });

      return respond({
        success: true, imageUrl: immediateExtracted.url,
        ratio: `${width}:${height}`, credits_used: 0, model_used: falModel,
        image_to_image: useImageToImage, ad_work_id: adWorkId,
      });
    }

    const requestId = queueData.request_id as string;
    // status_url이 없어도 표준 URL 조립으로 폴링 가능
    const statusUrl = (queueData.status_url as string) ?? null;
    const responseUrl = (queueData.response_url as string) ?? null;

    const builtStatusUrl = statusUrl ?? `https://queue.fal.run/${falModel}/requests/${requestId}`;
    const builtResponseUrl = responseUrl ?? `https://queue.fal.run/${falModel}/requests/${requestId}/response`;

    if (!requestId) {
      return respond({ error: 'request_id를 받지 못했습니다: ' + JSON.stringify(queueData).slice(0, 150) }, 502);
    }

    console.log(`[generate-image] pending — request_id=${requestId}, status_url=${builtStatusUrl}`);

    await logUsage(supabase, {
      userId: authedUserId, sessionId: session_id, serviceSlug: 'fal',
      action: `이미지 생성 대기 (${model})`, creditsDeducted: 0, userPlan: 'test', status: 'success',
      metadata: {
        model: falModel, request_id: requestId, pending: true,
        has_status_url: Boolean(statusUrl), image_to_image: useImageToImage,
        built_status_url: builtStatusUrl.slice(0, 100),
      },
    });

    return respond({
      pending: true,
      request_id: requestId,
      model: falModel,
      status_url: builtStatusUrl,       // 항상 유효한 URL
      response_url: builtResponseUrl,   // 항상 유효한 URL
      credits_used: 0,
      image_to_image: useImageToImage,
      save_opts: {
        user_id: authedUserId, session_id, prompt: finalPrompt,
        model: modelDisplayName, ratio: normalizedRatio,
        source, template_id, template_title,
        resolution, format, product_name, product_desc,
      },
    });

  } catch (err) {
    console.error('[generate-image] 최상위 오류:', err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
