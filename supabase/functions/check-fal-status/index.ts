import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function decryptKey(enc: string): Promise<string | null> {
  try {
    if (enc.startsWith('aes_v2:')) {
      const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['decrypt']);
      const buf = Uint8Array.from(atob(enc.slice(7)), c => c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
      return new TextDecoder().decode(dec);
    }
    if (enc.startsWith('aes_v1:')) {
      const combined = Uint8Array.from(atob(enc.slice(7)), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      const secret = Deno.env.get('APP_JWT_SECRET') ?? '';
      const secretBytes = new TextEncoder().encode(secret);
      const keyMaterial = secretBytes.length >= 32
        ? secretBytes.slice(0, 32)
        : new Uint8Array(32).fill(0).map((_, i) => secretBytes[i] ?? 48);
      const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encryptedData);
      return new TextDecoder().decode(decrypted);
    }
    if (enc.startsWith('enc_v1:')) {
      const parts = enc.split(':');
      if (parts.length >= 3) { try { return atob(parts[2]); } catch { return null; } }
    }
    return enc;
  } catch (e) {
    console.error('[check-fal-status] decryptKey 오류:', e);
    return null;
  }
}

/**
 * fal.ai 에러 응답 분류 진단
 */
function diagnoseFalError(body: string, headers: Record<string, string>): Record<string, unknown> {
  const errorTypeHeader = headers['x-fal-error-type'] ?? headers['X-Fal-Error-Type'] ?? null;
  const retryableHeader = headers['x-fal-retryable'] ?? headers['X-Fal-Retryable'] ?? null;
  const diag: Record<string, unknown> = {
    error_type_header: errorTypeHeader,
    retryable_header: retryableHeader,
  };

  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(body); } catch {
    diag.parse_failed = true;
    return diag;
  }

  if (Array.isArray(parsed.detail)) {
    diag.error_format = 'Model Validation Error (detail array)';
    diag.model_errors = parsed.detail;
    const first = (parsed.detail as Record<string, unknown>[])[0];
    if (first) {
      diag.primary_error_type = first.type;
      diag.primary_error_msg = first.msg;
      diag.primary_error_loc = first.loc;
      diag.primary_error_ctx = first.ctx;
      diag.primary_error_input = first.input;

      const retryableModelTypes = new Set(['internal_server_error', 'generation_timeout', 'downstream_service_error', 'downstream_service_unavailable']);
      const permanentModelTypes = new Set(['content_policy_violation', 'no_media_generated', 'image_too_small', 'image_too_large', 'image_load_error', 'file_download_error', 'face_detection_error', 'file_too_large', 'unsupported_image_format', 'unsupported_video_format', 'feature_not_supported']);

      if (retryableHeader) {
        diag.is_retryable = retryableHeader === 'true';
        diag.retryable_source = 'X-Fal-Retryable header';
      } else if (permanentModelTypes.has(first.type as string)) {
        diag.is_retryable = false;
        diag.retryable_source = 'type classification (permanent)';
      } else if (retryableModelTypes.has(first.type as string)) {
        diag.is_retryable = true;
        diag.retryable_source = 'type classification (retryable)';
      } else {
        diag.is_retryable = false;
        diag.retryable_source = 'default (unknown type)';
      }
    }
    return diag;
  }

  if (typeof parsed.detail === 'string' && parsed.error_type) {
    diag.error_format = 'Request Error (flat object)';
    diag.detail_message = parsed.detail;
    diag.error_type = parsed.error_type;
    const retryableTypes = new Set(['request_timeout', 'startup_timeout', 'runner_scheduling_failure', 'runner_connection_timeout', 'runner_disconnected', 'runner_connection_refused', 'runner_connection_error', 'runner_incomplete_response', 'runner_server_error', 'internal_error']);
    if (retryableHeader) {
      diag.is_retryable = retryableHeader === 'true';
      diag.retryable_source = 'X-Fal-Retryable header';
    } else {
      diag.is_retryable = retryableTypes.has(parsed.error_type as string);
      diag.retryable_source = 'error_type classification';
    }
    return diag;
  }

  if (parsed.status === 'FAILED' && parsed.error) {
    diag.error_format = 'Queue FAILED status';
    const err = parsed.error as Record<string, unknown>;
    diag.error_detail = err.detail ?? err.message;
    diag.error_type = err.error_type;
    return diag;
  }

  diag.error_format = 'Unknown format';
  diag.raw = body.slice(0, 400);
  return diag;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청' }), { status: 400, headers: corsHeaders });
  }

  const { request_id, model } = body;
  const status_url = body.status_url as string | undefined;
  const response_url = body.response_url as string | undefined;

  // FAL 키 획득
  const { data: keyData } = await supabase.from('api_keys')
    .select('encrypted_key')
    .eq('service_slug', 'fal')
    .eq('status', 'active')
    .maybeSingle();

  const FAL_KEY = keyData?.encrypted_key ? await decryptKey(keyData.encrypted_key as string) : Deno.env.get('FAL_KEY');
  if (!FAL_KEY) {
    return new Response(JSON.stringify({ error: 'API 키 없음' }), { status: 500, headers: corsHeaders });
  }

  const results: Record<string, unknown> = {
    request_id,
    model,
    fal_key_length: FAL_KEY.length,
  };

  /**
   * [핵심 수정] fal.ai Queue 폴링 URL 결정 규칙:
   *
   * fal.ai Queue API 공식 스펙:
   * - POST https://queue.fal.run/{model} → 응답: { request_id, status_url, response_url }
   * - 폴링: GET status_url (POST 응답에서 받은 URL 그대로 사용)
   * - 폴백: GET https://queue.fal.run/{model}/requests/{id} (trailing /status 없이!)
   *   → /status suffix는 일부 모델에서 405 Method Not Allowed 발생
   *
   * 이전 코드: `https://queue.fal.run/${model}/requests/${request_id}/status` → 405 발생
   * 수정 후:   `https://queue.fal.run/${model}/requests/${request_id}` (no /status suffix)
   */
  const resolvedStatusUrl = status_url
    ?? `https://queue.fal.run/${model}/requests/${request_id}`;

  const resolvedResponseUrl = response_url
    ?? `https://queue.fal.run/${model}/requests/${request_id}/response`;

  results.used_status_url = resolvedStatusUrl;
  results.url_source = status_url
    ? 'from_post_response (recommended)'
    : 'manually_built_without_status_suffix (fixed — was causing 405)';

  console.log(`[check-fal-status] GET ${resolvedStatusUrl}`);
  console.log(`[check-fal-status] URL 출처: ${results.url_source}`);

  try {
    const statusRes = await fetch(resolvedStatusUrl, {
      method: 'GET',
      headers: { 'Authorization': `Key ${FAL_KEY}` },
      signal: AbortSignal.timeout(20000),
    });
    const statusText = await statusRes.text();
    results.status_http = statusRes.status;
    results.status_response = statusText.slice(0, 800);

    // 응답 헤더 수집
    const relevantHeaders: Record<string, string> = {};
    for (const [k, v] of statusRes.headers.entries()) {
      if (k.toLowerCase().startsWith('x-fal') || k.toLowerCase() === 'content-type') {
        relevantHeaders[k] = v;
      }
    }
    results.fal_headers = relevantHeaders;

    if (statusRes.status === 401) {
      results.fal_status = 'AUTH_ERROR';
      results.error_diagnosis = {
        error_format: 'Authentication Error',
        http_status: 401,
        message: 'API 키가 올바르지 않습니다. Authorization 헤더에 "Key" 접두사가 포함되어야 합니다.',
        action: 'fal.ai/dashboard/keys에서 API 키를 확인하거나 재발급해주세요.',
        is_retryable: false,
      };
    } else if (statusRes.status === 403) {
      results.fal_status = 'AUTH_ERROR';
      results.error_diagnosis = {
        error_format: 'Authorization Error',
        http_status: 403,
        message: 'API 키의 scope 권한이 없습니다. API scope 키가 필요합니다.',
        action: 'fal.ai/dashboard/keys에서 API scope 키를 생성해주세요.',
        is_retryable: false,
      };
    } else if (statusRes.status === 404) {
      results.fal_status = 'NOT_FOUND';
      results.error_diagnosis = {
        error_format: 'Not Found',
        http_status: 404,
        message: 'request_id를 찾을 수 없어요. 이미 만료됐거나 존재하지 않는 요청이에요.',
        is_retryable: false,
      };
    } else if (statusRes.status === 405) {
      // [수정됨] 이제 이 분기는 실행되지 않아야 함 (URL 조립 방식 수정)
      results.fal_status = 'URL_ERROR';
      results.error_diagnosis = {
        error_format: 'Method Not Allowed',
        http_status: 405,
        message: '405 Method Not Allowed: status_url 조립 방식이 잘못됐어요. POST 응답의 status_url을 직접 사용하거나 /requests/{id} (no /status suffix) 방식을 사용해야 해요.',
        fixed_url: `https://queue.fal.run/${model}/requests/${request_id}`,
        is_retryable: false,
      };
    } else if (!statusRes.ok) {
      results.fal_status = 'ERROR';
      results.error_diagnosis = diagnoseFalError(statusText, relevantHeaders);
    } else {
      try {
        const statusData = JSON.parse(statusText);
        results.fal_status = statusData.status;
        results.queue_position = statusData.queue_position;
        results.logs = statusData.logs;

        if (statusData.status === 'FAILED') {
          results.failed_diagnosis = diagnoseFalError(statusText, relevantHeaders);
        }

        if (statusData.status === 'COMPLETED') {
          console.log(`[check-fal-status] COMPLETED! 결과 조회: GET ${resolvedResponseUrl}`);
          const responseRes = await fetch(resolvedResponseUrl, {
            method: 'GET',
            headers: { 'Authorization': `Key ${FAL_KEY}` },
            signal: AbortSignal.timeout(20000),
          });
          const responseText = await responseRes.text();
          results.response_http = responseRes.status;
          results.response_data = responseText.slice(0, 1000);

          if (!responseRes.ok) {
            const respHeaders: Record<string, string> = {};
            for (const [k, v] of responseRes.headers.entries()) {
              if (k.toLowerCase().startsWith('x-fal')) respHeaders[k] = v;
            }
            results.response_error_diagnosis = diagnoseFalError(responseText, respHeaders);
          }
        }
      } catch {
        results.parse_error = '응답 파싱 실패';
      }
    }
  } catch (e) {
    results.status_error = String(e);
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
