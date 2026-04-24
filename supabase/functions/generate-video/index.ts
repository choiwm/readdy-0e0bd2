import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { requireUser, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const T2V_MODELS: Record<string, string> = {
  "wan25":            "fal-ai/wan-25-preview/text-to-video",
  "wan-t2v":          "fal-ai/wan-t2v",
  "kling-v1":         "fal-ai/kling-video/v1/standard/text-to-video",
  "kling-v1.5":       "fal-ai/kling-video/v1.5/pro/text-to-video",
  "kling-v2.1":       "fal-ai/kling-video/v2.1/standard/text-to-video",
  "kling-v2.1-pro":   "fal-ai/kling-video/v2.1/pro/text-to-video",
  "kling-v25-turbo":  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
  "kling-v3-pro":     "fal-ai/kling-video/v3/pro/text-to-video",
  "veo3":             "fal-ai/veo3",
};

const I2V_MODELS: Record<string, string> = {
  "wan25":            "fal-ai/wan-25-preview/image-to-video",
  "wan-t2v":          "fal-ai/wan-t2v",
  "minimax":          "fal-ai/minimax-video/image-to-video",
  "kling-v1":         "fal-ai/kling-video/v1/standard/image-to-video",
  "kling-v1.5":       "fal-ai/kling-video/v1.5/pro/image-to-video",
  "kling-v2.1":       "fal-ai/kling-video/v2.1/standard/image-to-video",
  "kling-v2.1-pro":   "fal-ai/kling-video/v2.1/pro/image-to-video",
  "kling-v25-turbo":  "fal-ai/kling-video/v2.5-turbo/standard/image-to-video",
  "kling-v3-pro":     "fal-ai/kling-video/v3/pro/image-to-video",
  "veo3":             "fal-ai/veo3",
};

const T2V_TO_I2V_MAP: Record<string, string> = {
  "fal-ai/kling-video/v1/standard/text-to-video":     "fal-ai/kling-video/v1/standard/image-to-video",
  "fal-ai/kling-video/v1.5/pro/text-to-video":        "fal-ai/kling-video/v1.5/pro/image-to-video",
  "fal-ai/kling-video/v2.1/standard/text-to-video":   "fal-ai/kling-video/v2.1/standard/image-to-video",
  "fal-ai/kling-video/v2.1/pro/text-to-video":        "fal-ai/kling-video/v2.1/pro/image-to-video",
  "fal-ai/wan-25-preview/text-to-video":               "fal-ai/wan-25-preview/image-to-video",
  "fal-ai/wan-t2v":                                    "fal-ai/wan-t2v",
};

function resolveModelId(modelId: string, hasImage: boolean): string {
  if (!hasImage) return modelId;
  if (modelId.includes('veo3')) return modelId;
  if (modelId.includes('minimax')) return modelId;
  if (modelId === 'fal-ai/wan-t2v') return modelId;
  if (T2V_TO_I2V_MAP[modelId]) return T2V_TO_I2V_MAP[modelId];
  if (modelId.includes('text-to-video')) return modelId.replace('text-to-video', 'image-to-video');
  return modelId;
}

const CREDIT_COSTS: Record<string, number> = {
  "fal-ai/wan-25-preview/text-to-video":              35,
  "fal-ai/wan-25-preview/image-to-video":             35,
  "fal-ai/wan-t2v":                                   70,
  "fal-ai/minimax-video/image-to-video":              60,
  "fal-ai/kling-video/v1/standard/text-to-video":     50,
  "fal-ai/kling-video/v1/standard/image-to-video":    50,
  "fal-ai/kling-video/v1.5/pro/text-to-video":        80,
  "fal-ai/kling-video/v1.5/pro/image-to-video":       80,
  "fal-ai/kling-video/v2.1/standard/text-to-video":   100,
  "fal-ai/kling-video/v2.1/standard/image-to-video":  100,
  "fal-ai/kling-video/v2.1/pro/text-to-video":        150,
  "fal-ai/kling-video/v2.1/pro/image-to-video":       150,
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video":  80,
  "fal-ai/kling-video/v2.5-turbo/standard/image-to-video": 80,
  "fal-ai/kling-video/v3/pro/text-to-video":          125,
  "fal-ai/kling-video/v3/pro/image-to-video":         125,
  "fal-ai/veo3":                                       150,
};

const RETRYABLE_REQUEST_ERROR_TYPES = new Set([
  'request_timeout','startup_timeout','runner_scheduling_failure',
  'runner_connection_timeout','runner_disconnected','runner_connection_refused',
  'runner_connection_error','runner_incomplete_response','runner_server_error','internal_error',
]);
const PERMANENT_REQUEST_ERROR_TYPES = new Set(['client_disconnected','client_cancelled','bad_request']);
const PERMANENT_MODEL_ERROR_TYPES = new Set([
  'content_policy_violation','no_media_generated','image_too_small','image_too_large',
  'image_load_error','file_download_error','face_detection_error','file_too_large',
  'greater_than','greater_than_equal','less_than','less_than_equal','multiple_of',
  'sequence_too_short','sequence_too_long','one_of','feature_not_supported',
  'invalid_archive','archive_file_count_below_minimum','archive_file_count_exceeds_maximum',
  'audio_duration_too_long','audio_duration_too_short','unsupported_audio_format',
  'unsupported_image_format','unsupported_video_format','video_duration_too_long','video_duration_too_short',
]);
const RETRYABLE_MODEL_ERROR_TYPES = new Set([
  'internal_server_error','generation_timeout','downstream_service_error','downstream_service_unavailable',
]);

interface ModelErrorObject { loc: string[]; msg: string; type: string; url?: string; ctx?: Record<string,unknown>; input?: unknown; }
interface ParsedFalError { message: string; errorType: string|null; isRetryable: boolean; httpStatus?: number; modelErrors?: ModelErrorObject[]; }

function parseFalError(data: Record<string,unknown>, httpStatus?: number, retryableHeader?: string|null): ParsedFalError {
  if (Array.isArray(data.detail)) {
    const errors = data.detail as ModelErrorObject[];
    const first = errors[0];
    if (first) {
      const modelType = first.type;
      const msg = buildModelErrorMessage(first);
      const isRetryable = retryableHeader != null
        ? retryableHeader === 'true'
        : (RETRYABLE_MODEL_ERROR_TYPES.has(modelType) && !PERMANENT_MODEL_ERROR_TYPES.has(modelType));
      return { message: msg, errorType: modelType, isRetryable, httpStatus, modelErrors: errors };
    }
  }
  if (typeof data.detail === 'string' && data.error_type) {
    const errorType = data.error_type as string;
    const isRetryable = retryableHeader != null
      ? retryableHeader === 'true'
      : RETRYABLE_REQUEST_ERROR_TYPES.has(errorType);
    return { message: data.detail as string, errorType, isRetryable, httpStatus };
  }
  const errorObj = data.error as Record<string,unknown> | undefined;
  if (errorObj && typeof errorObj === 'object') {
    const detail = (errorObj.detail as string) ?? (errorObj.message as string) ?? '영상 생성 실패';
    const errorType = (errorObj.error_type as string) ?? null;
    const isRetryable = retryableHeader != null
      ? retryableHeader === 'true'
      : (errorType ? RETRYABLE_REQUEST_ERROR_TYPES.has(errorType) : true);
    return { message: detail, errorType, isRetryable, httpStatus };
  }
  if (typeof data.error === 'string') {
    const errorType = (data.error_type as string) ?? null;
    const isRetryable = retryableHeader != null
      ? retryableHeader === 'true'
      : (errorType ? RETRYABLE_REQUEST_ERROR_TYPES.has(errorType) : !PERMANENT_REQUEST_ERROR_TYPES.has(errorType ?? ''));
    return { message: data.error as string, errorType, isRetryable, httpStatus };
  }
  if (typeof data.detail === 'string') return { message: data.detail as string, errorType: null, isRetryable: true, httpStatus };
  return { message: '알 수 없는 fal.ai 오류', errorType: null, isRetryable: true, httpStatus };
}

function buildModelErrorMessage(err: ModelErrorObject): string {
  const ctx = err.ctx ?? {};
  switch (err.type) {
    case 'content_policy_violation': return '프롬프트 또는 이미지가 콘텐츠 정책에 위반됐어요.';
    case 'no_media_generated': return '영상 생성은 완료됐지만 결과물이 없어요. 프롬프트를 바꿔서 다시 시도해주세요.';
    case 'image_too_small': { const minW=ctx.min_width as number|undefined; const minH=ctx.min_height as number|undefined; return minW&&minH?`이미지가 너무 작아요. 최소 ${minW}x${minH}px`:'이미지가 너무 작아요.'; }
    case 'image_too_large': { const maxW=ctx.max_width as number|undefined; const maxH=ctx.max_height as number|undefined; return maxW&&maxH?`이미지가 너무 커요. 최대 ${maxW}x${maxH}px`:'이미지가 너무 커요.'; }
    case 'image_load_error': return '이미지를 불러올 수 없어요.';
    case 'file_download_error': return '이미지 URL에 접근할 수 없어요.';
    case 'face_detection_error': return '이미지에서 얼굴을 감지하지 못했어요.';
    case 'internal_server_error': return 'fal.ai 서버 내부 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'generation_timeout': return '영상 생성 시간이 초과됐어요. 잠시 후 다시 시도해주세요.';
    case 'downstream_service_error': return 'fal.ai 외부 서비스 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'downstream_service_unavailable': return 'fal.ai 외부 서비스가 일시적으로 이용 불가해요. 잠시 후 다시 시도해주세요.';
    default: return err.msg || '입력값 검증 오류가 발생했어요.';
  }
}

function getFalErrorTypeFromResponse(res: Response, bodyData: Record<string,unknown>): string|null {
  return res.headers.get('X-Fal-Error-Type') ?? res.headers.get('x-fal-error-type') ?? (bodyData.error_type as string) ?? null;
}
function getFalRetryableHeader(res: Response): string|null {
  return res.headers.get('X-Fal-Retryable') ?? res.headers.get('x-fal-retryable');
}
function extractFalRequestId(res: Response): string|null {
  return res.headers.get('x-fal-request-id') ?? res.headers.get('X-Fal-Request-Id') ?? null;
}

async function decryptKey(enc: string): Promise<string|null> {
  try {
    if (enc.startsWith('aes_v2:')) {
      const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      const key = await crypto.subtle.importKey('raw', hash, {name:'AES-GCM'}, false, ['decrypt']);
      const buf = Uint8Array.from(atob(enc.slice(7)), c=>c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt({name:'AES-GCM',iv:buf.slice(0,12)}, key, buf.slice(12));
      return new TextDecoder().decode(dec);
    }
    if (enc.startsWith('aes_v1:')) {
      const combined = Uint8Array.from(atob(enc.slice(7)), c=>c.charCodeAt(0));
      const iv = combined.slice(0,12); const encryptedData = combined.slice(12);
      const secret = Deno.env.get('APP_JWT_SECRET') ?? '';
      const secretBytes = new TextEncoder().encode(secret);
      const keyMaterial = secretBytes.length>=32 ? secretBytes.slice(0,32) : new Uint8Array(32).fill(0).map((_,i)=>secretBytes[i]??48);
      const cryptoKey = await crypto.subtle.importKey('raw',keyMaterial,{name:'AES-GCM'},false,['decrypt']);
      const decrypted = await crypto.subtle.decrypt({name:'AES-GCM',iv},cryptoKey,encryptedData);
      return new TextDecoder().decode(decrypted);
    }
    if (enc.startsWith('enc_v1:')) { const parts=enc.split(':'); if(parts.length>=3){try{return atob(parts[2]);}catch{return null;}} }
    return enc;
  } catch(e) { console.error('[generate-video] decryptKey 오류:',e); return null; }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string|null> {
  try {
    const {data} = await supabase.from('api_keys').select('encrypted_key').eq('service_slug','fal').eq('status','active').maybeSingle();
    if(!data?.encrypted_key) return null;
    return decryptKey(data.encrypted_key as string);
  } catch { return null; }
}

function extractVideoUrl(data: Record<string,unknown>): string|null {
  if (!data) return null;
  if (typeof data.video_url==='string') return data.video_url;
  if (typeof data.url==='string') return data.url;
  const v = data.video as Record<string,unknown>|undefined;
  if (v&&typeof v.url==='string') return v.url;
  const vs = data.videos as Array<Record<string,unknown>>|undefined;
  if (vs&&vs.length>0) { const url=vs[0].url??vs[0].video_url; if(typeof url==='string') return url; }
  const output = data.output as Record<string,unknown>|undefined;
  if (output) {
    if (typeof output.video_url==='string') return output.video_url;
    if (typeof output.url==='string') return output.url;
    const ov = output.video as Record<string,unknown>|undefined;
    if (ov&&typeof ov.url==='string') return ov.url;
  }
  return null;
}

async function logUsage(supabase: ReturnType<typeof createClient>, opts: {
  userId?: string; sessionId?: string; action: string; status: string;
  creditsDeducted: number; metadata?: Record<string,unknown>;
}): Promise<void> {
  try {
    await supabase.from('usage_logs').insert({
      user_id: opts.userId??null, session_id: opts.sessionId??null,
      service_slug: 'fal', action: opts.action,
      credits_deducted: opts.creditsDeducted, user_plan: 'user',
      status: opts.status, metadata: opts.metadata??{},
    });
  } catch(e) { console.error('[generate-video] logUsage 실패:',e); }
}

async function saveResults(supabase: ReturnType<typeof createClient>, opts: {
  videoUrl: string; prompt: string; model: string; ratio: string;
  userId?: string; sessionId?: string; source?: string;
  templateId?: string; templateTitle?: string;
  resolution?: string; format?: string;
  productName?: string; productDesc?: string;
}): Promise<string|null> {
  try {
    await supabase.from('gallery_items').insert({
      type:'video', url:opts.videoUrl, prompt:opts.prompt, model:opts.model,
      ratio:opts.ratio, liked:false, duration:5,
      user_id: opts.userId??opts.sessionId??'anonymous',
      session_id: opts.userId?null:(opts.sessionId??null),
      source: opts.source??'ai-create',
    });
    console.log('[generate-video] gallery_items 저장 성공');
  } catch(e) { console.warn('[generate-video] gallery 저장 실패:',e); }

  if (opts.source==='ai-ad'||!opts.source) {
    try {
      const workId = `adwork_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
      const {error:adErr} = await supabase.from('ad_works').insert({
        id:workId, user_id:opts.userId??null, session_id:opts.sessionId??null,
        title:opts.templateTitle??'AI 광고 영상', template_id:opts.templateId??null,
        template_title:opts.templateTitle??null, result_type:'video',
        result_url:opts.videoUrl, ratio:opts.ratio,
        resolution:opts.resolution??'1K', format:opts.format??'MP4',
        product_name:opts.productName??null, product_desc:opts.productDesc??null,
      });
      if(adErr){console.error('[generate-video] ad_works INSERT 실패:',adErr.message);return null;}
      console.log('[generate-video] ad_works 저장 성공:',workId);
      return workId;
    } catch(e){console.warn('[generate-video] ad_works 저장 실패:',e);}
  }
  return null;
}

// fal.ai Queue 폴링 URL 조립 (status_url 우선, 없으면 표준 조립)
function resolvePollingUrls(falModel: string, requestId: string, statusUrl?: string|null, responseUrl?: string|null) {
  const resolvedStatusUrl = statusUrl ?? `https://queue.fal.run/${falModel}/requests/${requestId}`;
  const resolvedResponseUrl = responseUrl ?? `https://queue.fal.run/${falModel}/requests/${requestId}/response`;
  if (!statusUrl) {
    console.warn(`[generate-video:poll] ⚠️ status_url 없음 — 조립: ${resolvedStatusUrl}`);
  } else {
    console.log(`[generate-video:poll] status_url 사용: ${resolvedStatusUrl}`);
  }
  return { statusUrl: resolvedStatusUrl, responseUrl: resolvedResponseUrl };
}

async function pollOnce(
  resolvedStatusUrl: string, resolvedResponseUrl: string,
  falModel: string, requestId: string, FAL_KEY: string,
  supabase: ReturnType<typeof createClient>,
  saveOpts?: Record<string,unknown>,
): Promise<Response|null> {
  const MAX_RETRIES = 2;
  let lastError = '';

  for (let attempt=0; attempt<=MAX_RETRIES; attempt++) {
    try {
      console.log(`[generate-video:poll] attempt=${attempt}, status URL: ${resolvedStatusUrl}`);

      const statusRes = await fetch(resolvedStatusUrl, {
        method:'GET',
        headers:{'Authorization':`Key ${FAL_KEY}`},
        signal:AbortSignal.timeout(30000),
      });

      const statusText = await statusRes.text();
      console.log(`[generate-video:poll] attempt=${attempt} HTTP ${statusRes.status}: ${statusText.slice(0,500)}`);

      const corsH = {...corsHeaders,'Content-Type':'application/json'};

      if (statusRes.status===401) return new Response(JSON.stringify({status:'FAILED',error:'fal.ai 인증 실패 (HTTP 401). API 키가 올바른지 확인하세요.',fal_error_type:'auth_error',retryable:false}),{headers:corsH});
      if (statusRes.status===403) return new Response(JSON.stringify({status:'FAILED',error:'fal.ai 권한 없음 (HTTP 403). API 키의 scope를 확인하세요.',fal_error_type:'auth_error',retryable:false}),{headers:corsH});
      if (statusRes.status===404) return new Response(JSON.stringify({status:'FAILED',error:'요청을 찾을 수 없습니다 (request_id 만료). 새로 생성해주세요.',fal_error_type:'not_found',retryable:false}),{headers:corsH});
      if (statusRes.status===405) {
        console.error(`[generate-video:poll] 405 Method Not Allowed — URL: ${resolvedStatusUrl}`);
        return new Response(JSON.stringify({status:'FAILED',error:'fal.ai 폴링 URL 오류 (405). 새로 생성을 시도해주세요.',fal_error_type:'url_error',retryable:false}),{headers:corsH});
      }

      if (!statusRes.ok) {
        let parsedBody: Record<string,unknown>={};
        try{parsedBody=JSON.parse(statusText);}catch{/* ignore */}
        const retryableHeader=getFalRetryableHeader(statusRes);
        const errorType=getFalErrorTypeFromResponse(statusRes,parsedBody);
        const errInfo=parseFalError(parsedBody,statusRes.status,retryableHeader);
        if (statusRes.status===422) return new Response(JSON.stringify({status:'FAILED',error:errInfo.message,fal_error_type:errInfo.errorType,retryable:errInfo.isRetryable,model_errors:errInfo.modelErrors}),{headers:corsH});
        if (errInfo.isRetryable&&attempt<MAX_RETRIES){lastError=`HTTP ${statusRes.status} (${errorType??'unknown'})`;await new Promise(r=>setTimeout(r,2000*(attempt+1)));continue;}
        return new Response(JSON.stringify({status:'IN_PROGRESS',error:lastError||errInfo.message,fal_error_type:errorType}),{headers:corsH});
      }

      let statusData: Record<string,unknown>;
      try{statusData=JSON.parse(statusText);}catch{return new Response(JSON.stringify({status:'IN_PROGRESS'}),{headers:corsH});}

      const falStatus=(statusData.status as string)?? 'IN_PROGRESS';
      const queuePosition = statusData.queue_position ?? null;
      console.log(`[generate-video:poll] fal.status=${falStatus}, queue_pos=${queuePosition??'-'}`);

      if (falStatus==='COMPLETED') {
        console.log(`[generate-video:poll] COMPLETED! 결과 조회: ${resolvedResponseUrl}`);
        let resultData: Record<string,unknown>|null = null;
        for (let ri=0; ri<=MAX_RETRIES; ri++) {
          const resultRes = await fetch(resolvedResponseUrl,{method:'GET',headers:{'Authorization':`Key ${FAL_KEY}`},signal:AbortSignal.timeout(30000)});
          const resultText = await resultRes.text();
          console.log(`[generate-video:poll] response attempt=${ri} HTTP ${resultRes.status}: ${resultText.slice(0,500)}`);
          if (!resultRes.ok) {
            let parsedErr:Record<string,unknown>={};
            try{parsedErr=JSON.parse(resultText);}catch{/* ignore */}
            const retryableHeader=getFalRetryableHeader(resultRes);
            const errType=getFalErrorTypeFromResponse(resultRes,parsedErr);
            const errInfo=parseFalError(parsedErr,resultRes.status,retryableHeader);
            if(errInfo.isRetryable&&ri<MAX_RETRIES){await new Promise(r=>setTimeout(r,3000));continue;}
            return new Response(JSON.stringify({status:'FAILED',error:errInfo.message,fal_error_type:errType,model_errors:errInfo.modelErrors}),{headers:corsH});
          }
          try{resultData=JSON.parse(resultText);break;}catch{return new Response(JSON.stringify({status:'FAILED',error:'결과 파싱 실패'}),{headers:corsH});}
        }

        if (!resultData) return new Response(JSON.stringify({status:'FAILED',error:'결과 데이터 없음'}),{headers:corsH});

        if (Array.isArray(resultData.detail)) {
          const errInfo=parseFalError(resultData);
          if(!errInfo.isRetryable) return new Response(JSON.stringify({status:'FAILED',error:errInfo.message,fal_error_type:errInfo.errorType,retryable:false,model_errors:errInfo.modelErrors}),{headers:corsH});
        }

        const videoUrl=extractVideoUrl(resultData);
        console.log(`[generate-video:poll] videoUrl 추출: ${videoUrl?videoUrl.slice(0,100):'null'}`);
        console.log(`[generate-video:poll] 전체 응답 키: ${Object.keys(resultData).join(', ')}`);

        if (!videoUrl) {
          return new Response(JSON.stringify({
            status:'FAILED',
            error:`videoUrl을 찾을 수 없습니다. 응답 키: ${Object.keys(resultData).join(', ')}`,
            raw:JSON.stringify(resultData).slice(0,500),
          }),{headers:corsH});
        }

        // DB 저장
        let adWorkId: string|null=null;
        if (saveOpts) {
          adWorkId=await saveResults(supabase,{
            videoUrl,
            prompt:(saveOpts.prompt as string)??'',
            model:(saveOpts.model_display_name as string)??falModel,
            ratio:(saveOpts.ratio as string)??'16:9',
            userId:saveOpts.user_id as string|undefined,
            sessionId:saveOpts.session_id as string|undefined,
            source:(saveOpts.source as string)??'ai-ad',
            templateId:saveOpts.template_id as string|undefined,
            templateTitle:saveOpts.template_title as string|undefined,
            resolution:saveOpts.resolution as string|undefined,
            format:saveOpts.format as string|undefined,
            productName:saveOpts.product_name as string|undefined,
            productDesc:saveOpts.product_desc as string|undefined,
          });

          await logUsage(supabase,{
            userId:saveOpts.user_id as string|undefined,
            sessionId:saveOpts.session_id as string|undefined,
            action:`영상 생성 완료 (${falModel}) - polling_done`,
            status:'success', creditsDeducted:0,
            metadata:{
              model:falModel,request_id:requestId,
              polling_completed:true,
              ad_work_id:adWorkId,
              video_url_prefix:videoUrl.slice(0,80),
            },
          });
        }

        return new Response(JSON.stringify({videoUrl,status:'COMPLETED',ad_work_id:adWorkId}),{headers:corsH});
      }

      if (falStatus==='FAILED') {
        const errInfo=parseFalError(statusData,undefined,null);
        if(errInfo.isRetryable&&attempt<MAX_RETRIES){await new Promise(r=>setTimeout(r,3000*(attempt+1)));continue;}
        const koreanMsg=getKoreanRequestErrorMessage(errInfo.errorType,errInfo.message);
        return new Response(JSON.stringify({status:'FAILED',error:koreanMsg,fal_error_type:errInfo.errorType,retryable:errInfo.isRetryable,model_errors:errInfo.modelErrors}),{headers:corsH});
      }

      // IN_QUEUE 또는 IN_PROGRESS
      return new Response(JSON.stringify({
        status:falStatus||'IN_PROGRESS',
        queue_position:queuePosition,
      }),{headers:corsH});

    } catch(e) {
      const isTimeout=e instanceof Error&&(e.name==='AbortError'||e.name==='TimeoutError');
      lastError=isTimeout?'fal.ai 응답 타임아웃 (30초)':(e instanceof Error?e.message:String(e));
      console.error(`[generate-video:poll] attempt=${attempt} 예외:`,lastError);
      if(attempt<MAX_RETRIES){await new Promise(r=>setTimeout(r,3000));continue;}
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});

  let authedUserId: string;
  try {
    const authed = await requireUser(req);
    authedUserId = authed.id;
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const corsH = {...corsHeaders,'Content-Type':'application/json'};
  const respond = (data: unknown,status=200) => new Response(JSON.stringify(data),{status,headers:corsH});

  let body: Record<string,unknown>;
  try{body=await req.json();}catch{return respond({error:'잘못된 요청 형식'},400);}

  console.log('[generate-video] ===== 요청 수신 ===== body_keys:', Object.keys(body).join(','), '| _poll:', body._poll);

  const FAL_KEY = await getFalKey(supabase)??Deno.env.get('FAL_KEY')??null;
  if(!FAL_KEY){
    console.error('[generate-video] FAL API 키 없음');
    return respond({error:'fal.ai API 키가 설정되지 않았습니다.'},500);
  }
  console.log(`[generate-video] API 키 확인 완료 (길이: ${FAL_KEY.length}자)`);

  // ── 폴링 모드 ──────────────────────────────────────────────────────────────
  if (body._poll===true) {
    const requestId=body.request_id as string;
    const falModel=body.model as string;
    const statusUrlInput=body.status_url as string|undefined|null;
    const responseUrlInput=body.response_url as string|undefined|null;
    const saveOpts=body.save_opts as Record<string,unknown>|undefined;

    if(!requestId||!falModel){return respond({error:'request_id, model 필요'},400);}

    console.log(`[generate-video:poll] === 폴링 시작 ===`);
    console.log(`[generate-video:poll] request_id=${requestId}`);
    console.log(`[generate-video:poll] model=${falModel}`);
    console.log(`[generate-video:poll] has_status_url=${Boolean(statusUrlInput)}`);
    console.log(`[generate-video:poll] status_url=${statusUrlInput??'(없음)'}`);
    console.log(`[generate-video:poll] has_save_opts=${Boolean(saveOpts)}`);

    const {statusUrl:resolvedStatusUrl,responseUrl:resolvedResponseUrl} = resolvePollingUrls(falModel,requestId,statusUrlInput,responseUrlInput);
    const result = await pollOnce(resolvedStatusUrl,resolvedResponseUrl,falModel,requestId,FAL_KEY,supabase,saveOpts);
    if(result) return result;
    return respond({status:'IN_PROGRESS',_error:'폴링 재시도 모두 실패'});
  }

  // ── 생성 모드 ──────────────────────────────────────────────────────────────
  const {
    prompt,ratio='16:9',model='kling-v1',model_id,
    user_id,session_id,image_url,source,
    template_id,template_title,product_name,product_desc,
    resolution='1K',format='MP4',seed,
  } = body;

  const duration = typeof body.duration==='number' ? body.duration : Number(body.duration??5);
  if(!prompt) return respond({error:'prompt가 필요합니다'},400);

  const hasImage=Boolean(image_url);
  let falModel: string;

  if(model_id){
    falModel=resolveModelId(model_id as string,hasImage);
    console.log(`[generate-video] model_id: ${model_id} → ${falModel} (hasImage=${hasImage})`);
  } else {
    falModel=hasImage?(I2V_MODELS[model as string]??'fal-ai/kling-video/v1/standard/image-to-video'):(T2V_MODELS[model as string]??'fal-ai/kling-video/v1/standard/text-to-video');
  }

  const creditCost=CREDIT_COSTS[falModel]??50;
  console.log(`[generate-video] 생성 모드: model=${falModel}, hasImage=${hasImage}, cost=${creditCost}CR`);

  const aspectRatio=ratio==='9:16'?'9:16':ratio==='1:1'?'1:1':'16:9';
  const falBody: Record<string,unknown>={prompt,aspect_ratio:aspectRatio};

  if(!falModel.includes('veo3')&&!falModel.includes('minimax')){
    falBody.duration=duration<=5?5:10;
    falBody.negative_prompt='blurry, low quality, watermark';
  }
  if(falModel==='fal-ai/wan-25-preview/text-to-video') falBody.num_frames=81;
  if(falModel==='fal-ai/wan-t2v'){falBody.seconds=duration<=5?5:10;delete falBody.duration;}
  if(hasImage){
    falBody.image_url=image_url;
    console.log(`[generate-video] image_url 설정: ${(image_url as string).slice(0,100)}`);
  }
  if(seed!=null) falBody.seed=Number(seed);

  console.log(`[generate-video] fal 요청: ${JSON.stringify(falBody).slice(0,400)}`);

  try {
    const maxQueueLength=(body.max_queue_length as number|undefined)??20;
    const falRes = await fetch(`https://queue.fal.run/${falModel}?fal_max_queue_length=${maxQueueLength}`,{
      method:'POST',
      headers:{
        'Authorization':`Key ${FAL_KEY}`,
        'Content-Type':'application/json',
        'X-Fal-Object-Lifecycle-Preference':JSON.stringify({expiration_duration_seconds:3600}),
      },
      body:JSON.stringify(falBody),
      signal:AbortSignal.timeout(30000),
    });

    const falText=await falRes.text();
    const falReqId=extractFalRequestId(falRes);
    if(falReqId) console.log(`[generate-video] x-fal-request-id: ${falReqId}`);
    console.log(`[generate-video] queue HTTP ${falRes.status}: ${falText.slice(0,500)}`);

    if(!falRes.ok){
      let parsedErr:Record<string,unknown>={};
      try{parsedErr=JSON.parse(falText);}catch{/* ignore */}
      const retryableHeader=getFalRetryableHeader(falRes);
      const errorType=getFalErrorTypeFromResponse(falRes,parsedErr);
      const errInfo=parseFalError(parsedErr,falRes.status,retryableHeader);

      if(falRes.status===422&&errInfo.modelErrors){
        await logUsage(supabase,{userId:user_id as string|undefined,sessionId:session_id as string|undefined,action:`영상 생성 실패 (${falModel}) - model_error`,status:'failed',creditsDeducted:0,metadata:{model:falModel,error:errInfo.message,error_type:errInfo.errorType,http_status:falRes.status,model_errors:errInfo.modelErrors}});
        return respond({error:errInfo.message,fal_error_type:errInfo.errorType,retryable:errInfo.isRetryable,model_errors:errInfo.modelErrors},422);
      }

      const errMsg=falRes.status===401?'fal.ai 인증 실패 (HTTP 401). API 키가 올바른지 확인하세요.'
        :falRes.status===403?'fal.ai 권한 없음 (HTTP 403). API 키의 scope를 확인하세요.'
        :falRes.status===429?'fal.ai 대기열이 혼잡해요. 잠시 후 다시 시도해주세요.'
        :getKoreanRequestErrorMessage(errorType,`fal.ai 오류 (HTTP ${falRes.status}): ${errInfo.message}`);

      await logUsage(supabase,{userId:user_id as string|undefined,sessionId:session_id as string|undefined,action:`영상 생성 실패 (${falModel})`,status:'failed',creditsDeducted:0,metadata:{model:falModel,error:errMsg,error_type:errorType,http_status:falRes.status}});
      return respond({error:errMsg,fal_error_type:errorType},502);
    }

    let falData: Record<string,unknown>;
    try{falData=JSON.parse(falText);}catch{return respond({error:'fal.ai 응답 파싱 실패'},502);}

    // 즉시 완료 확인
    const immediateUrl=extractVideoUrl(falData);
    if(immediateUrl){
      console.log(`[generate-video] 즉시 완료: ${immediateUrl.slice(0,100)}`);
      await logUsage(supabase,{userId:user_id as string|undefined,sessionId:session_id as string|undefined,action:`영상 생성 완료 (${falModel}) - immediate`,status:'success',creditsDeducted:creditCost,metadata:{model:falModel,immediate:true}});
      const adWorkId=await saveResults(supabase,{videoUrl:immediateUrl,prompt:prompt as string,model:falModel,ratio:aspectRatio,userId:user_id as string|undefined,sessionId:session_id as string|undefined,source:source as string|undefined,templateId:template_id as string|undefined,templateTitle:template_title as string|undefined,resolution:resolution as string,format:format as string,productName:product_name as string|undefined,productDesc:product_desc as string|undefined});
      return respond({videoUrl:immediateUrl,status:'COMPLETED',ad_work_id:adWorkId});
    }

    // pending 응답 처리 — fal.ai Queue API가 다양한 필드명을 쓸 수 있음
    const requestId = (falData.request_id as string) ?? null;
    
    // status_url: fal.ai가 응답에 포함하는 경우 사용, 없으면 표준 URL 조립
    const statusUrl = (falData.status_url as string)
      ?? (falData.statusUrl as string)
      ?? null;
    const responseUrl = (falData.response_url as string)
      ?? (falData.responseUrl as string)
      ?? null;

    console.log(`[generate-video] pending 응답 파싱:`);
    console.log(`  request_id = ${requestId}`);
    console.log(`  status_url = ${statusUrl ?? '(없음, 표준 URL 조립 예정)'}`);
    console.log(`  response_url = ${responseUrl ?? '(없음, 표준 URL 조립 예정)'}`);
    console.log(`  전체 fal 응답 키: ${Object.keys(falData).join(', ')}`);

    if(!requestId){
      return respond({error:'request_id를 받지 못했습니다. fal.ai 응답: '+JSON.stringify(falData).slice(0,200)},502);
    }

    // [중요] status_url이 없어도 request_id로 표준 URL 조립 가능
    const builtStatusUrl = statusUrl ?? `https://queue.fal.run/${falModel}/requests/${requestId}`;
    const builtResponseUrl = responseUrl ?? `https://queue.fal.run/${falModel}/requests/${requestId}/response`;

    await logUsage(supabase,{
      userId:user_id as string|undefined,
      sessionId:session_id as string|undefined,
      action:`영상 생성 대기 (${falModel})`,
      status:'success',creditsDeducted:creditCost,
      metadata:{
        model:falModel,request_id:requestId,pending:true,
        has_status_url:Boolean(statusUrl),
        status_url_preview:builtStatusUrl.slice(0,100),
        has_image:hasImage,image_to_video:hasImage,
        fal_response_keys:Object.keys(falData).join(','),
      },
    });

    return respond({
      pending:true,
      request_id:requestId,
      status_url:builtStatusUrl,      // 항상 유효한 URL 반환
      response_url:builtResponseUrl,  // 항상 유효한 URL 반환
      model:falModel,
      credits_used:creditCost,
      save_opts:{
        user_id,session_id,prompt,model_display_name:falModel,
        ratio:aspectRatio,source:source??'ai-ad',
        template_id,template_title,resolution,format,product_name,product_desc,
      },
    });

  } catch(e) {
    const isTimeout=e instanceof Error&&(e.name==='AbortError'||e.name==='TimeoutError');
    const errMsg=isTimeout?'fal.ai 응답 시간 초과 (30초). 잠시 후 다시 시도해주세요.':(e instanceof Error?e.message:String(e));
    console.error('[generate-video] 최상위 예외:',errMsg);
    return respond({error:errMsg,fal_error_type:isTimeout?'request_timeout':null},isTimeout?504:502);
  }
});

function getKoreanRequestErrorMessage(errorType: string|null, fallback: string): string {
  switch(errorType){
    case 'request_timeout': return 'fal.ai 처리 시간이 초과됐어요. 잠시 후 다시 시도해주세요.';
    case 'startup_timeout': return 'fal.ai 서버 시작 시간이 초과됐어요. 잠시 후 다시 시도해주세요.';
    case 'runner_scheduling_failure': return 'fal.ai 서버 할당에 실패했어요. 잠시 후 다시 시도해주세요.';
    case 'runner_connection_timeout': return 'fal.ai 서버 연결이 타임아웃됐어요. 잠시 후 다시 시도해주세요.';
    case 'runner_disconnected': return 'fal.ai 서버가 예기치 않게 연결이 끊겼어요. 잠시 후 다시 시도해주세요.';
    case 'runner_connection_refused': return 'fal.ai 서버가 연결을 거부했어요. 잠시 후 다시 시도해주세요.';
    case 'runner_connection_error': return 'fal.ai 서버와 연결 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'runner_incomplete_response': return 'fal.ai 서버가 불완전한 응답을 보냈어요. 잠시 후 다시 시도해주세요.';
    case 'runner_server_error': return 'fal.ai 서버 내부 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'internal_error': return 'fal.ai 내부 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
    case 'client_disconnected': return '클라이언트 연결이 끊겼어요. 다시 시도해주세요.';
    case 'client_cancelled': return '요청이 취소됐어요.';
    case 'bad_request': return '잘못된 요청이에요. 입력 내용을 확인해주세요.';
    case 'auth_error': return 'fal.ai API 키 인증 실패. 관리자 페이지에서 키를 확인해주세요.';
    case 'not_found': return 'request_id가 만료됐거나 찾을 수 없어요. 새로 생성해주세요.';
    case 'url_error': return 'fal.ai 폴링 URL 오류. 새로 생성해주세요.';
    default: return fallback;
  }
}
