import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { checkRateLimit, rateLimitedResponse, POLICIES } from '../_shared/rateLimit.ts';
import { persistFalAsset } from '../_shared/fal_storage.ts';

const VTON_CREDIT_COST_FALLBACK = 133;
const VTON_WORKFLOW_MODEL_ID = 'workflows/fal-vton';

// ── 공식 문서: 재시도 가능 에러 타입 분류 ──
const RETRYABLE_REQUEST_ERROR_TYPES = new Set([
  'request_timeout', 'startup_timeout', 'runner_scheduling_failure',
  'runner_connection_timeout', 'runner_disconnected', 'runner_connection_refused',
  'runner_connection_error', 'runner_incomplete_response', 'runner_server_error', 'internal_error',
]);

// ── 암호화 키 파생: SHA-256 해시 (aes_v2) ──
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
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) },
        key,
        combined.slice(12)
      );
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
      } catch {
        console.warn('[generate-vton] aes_v1 복호화 실패');
        return null;
      }
    }
    if (encrypted.startsWith('enc_v1:')) {
      const parts = encrypted.split(':');
      if (parts.length >= 3) { try { return atob(parts[2]); } catch { return null; } }
    }
    return encrypted;
  } catch (e) { console.error('[generate-vton] decryptKey 오류:', e); return null; }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key, status').eq('service_slug', 'fal').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptKey(data.encrypted_key as string);
  } catch { return null; }
}

async function getVtonCreditCost(supabase: ReturnType<typeof createClient>): Promise<number> {
  try {
    const { data } = await supabase.from('credit_costs').select('cost').eq('category', 'workflow').eq('model_id', VTON_WORKFLOW_MODEL_ID).eq('is_active', true).maybeSingle();
    if (data?.cost != null) { return data.cost as number; }
  } catch (e) { console.warn('[generate-vton] credit_costs 조회 실패:', e); }
  return VTON_CREDIT_COST_FALLBACK;
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
  } catch (e) { console.error('[generate-vton] getUserPlan error:', e); }
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
  } catch (e) { console.error('[generate-vton] deductCredits error:', e); }
  return false;
}

async function logUsage(supabase: ReturnType<typeof createClient>, opts: { userId?: string; sessionId?: string; serviceSlug: string; action: string; creditsDeducted: number; userPlan: string; status: 'success' | 'failed' | 'insufficient_credits'; metadata?: Record<string, unknown>; }) {
  try { await supabase.from('usage_logs').insert({ user_id: opts.userId ?? null, session_id: opts.sessionId ?? null, service_slug: opts.serviceSlug, action: opts.action, credits_deducted: opts.creditsDeducted, user_plan: opts.userPlan, status: opts.status, metadata: opts.metadata ?? {} }); } catch { /* 무시 */ }
}

/** 공식 문서: x-fal-request-id 응답 헤더 수집 */
function extractFalRequestId(res: Response): string | null {
  return res.headers.get('x-fal-request-id') ?? res.headers.get('X-Fal-Request-Id') ?? null;
}

/** 공식 문서: X-Fal-Billable-Units 응답 헤더 수집 */
function extractBillableUnits(res: Response): string | null {
  return res.headers.get('X-Fal-Billable-Units') ?? res.headers.get('x-fal-billable-units') ?? null;
}

/** 공식 문서: X-Fal-Retryable 헤더로 재시도 여부 확인 */
function getFalRetryableHeader(res: Response): string | null {
  return res.headers.get('X-Fal-Retryable') ?? res.headers.get('x-fal-retryable') ?? null;
}

/** 공식 문서: X-Fal-Error-Type 헤더 우선 확인 */
function getFalErrorType(res: Response, body: Record<string, unknown>): string | null {
  return res.headers.get('X-Fal-Error-Type') ?? res.headers.get('x-fal-error-type') ?? (body.error_type as string) ?? null;
}

/**
 * fal.ai 에러 응답 파싱
 * 공식 문서: Request Error vs Model Validation Error 두 구조 처리
 */
function parseFalErrorBody(body: Record<string, unknown>, retryableHeader: string | null, errorTypeHeader: string | null): {
  message: string;
  isRetryable: boolean;
  errorType: string | null;
} {
  // Model Validation Error: detail이 배열
  if (Array.isArray(body.detail)) {
    const first = (body.detail as Record<string, unknown>[])[0];
    const errType = (first?.type as string) ?? null;
    let isRetryable: boolean;
    if (retryableHeader !== null) {
      isRetryable = retryableHeader === 'true';
    } else {
      const retryableTypes = new Set(['internal_server_error', 'generation_timeout', 'downstream_service_error', 'downstream_service_unavailable']);
      isRetryable = retryableTypes.has(errType ?? '');
    }
    return { message: (first?.msg as string) ?? '입력값 오류', isRetryable, errorType: errType };
  }

  // Request Error: flat object
  if (typeof body.detail === 'string' && body.error_type) {
    const errType = (body.error_type as string);
    const finalType = errorTypeHeader ?? errType;
    let isRetryable: boolean;
    if (retryableHeader !== null) {
      isRetryable = retryableHeader === 'true';
    } else {
      isRetryable = RETRYABLE_REQUEST_ERROR_TYPES.has(finalType);
    }
    return { message: body.detail, isRetryable, errorType: finalType };
  }

  // Queue FAILED error 객체
  const errObj = body.error as Record<string, unknown> | undefined;
  if (errObj && typeof errObj === 'object') {
    const errType = (errObj.error_type as string) ?? errorTypeHeader ?? null;
    const finalType = errType;
    let isRetryable: boolean;
    if (retryableHeader !== null) {
      isRetryable = retryableHeader === 'true';
    } else {
      isRetryable = finalType ? RETRYABLE_REQUEST_ERROR_TYPES.has(finalType) : true;
    }
    return {
      message: (errObj.detail as string) ?? (errObj.message as string) ?? '가상 피팅 생성 실패',
      isRetryable,
      errorType: finalType,
    };
  }

  if (typeof body.error === 'string') {
    return { message: body.error, isRetryable: true, errorType: errorTypeHeader };
  }

  return { message: '알 수 없는 fal.ai 오류', isRetryable: true, errorType: errorTypeHeader };
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
    bucket: `generate-vton:${authedUserId}`,
    ...POLICIES.generateVton,
  });
  if (!_rl.ok) return rateLimitedResponse(_rl.resetAt, buildCorsHeaders(req));
  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    if (body._get_cost) {
      const cost = await getVtonCreditCost(supabase);
      return respond({ cost });
    }

    // ── 환불 모드 ─────────────────────────────────────────────────────
    // Submit 시점에 차감된 credit 을 client polling 이 실패했을 때 회수해요.
    // 함수가 timeout 임박으로 pending 응답을 돌려주면 그 이후의 폴링은 클라가
    // 직접 fal.ai 결과를 본다 → 거기서 영구 실패가 발생하면 서버는 모르니까,
    // 프런트가 이 모드로 명시적 환불 요청을 보내요. usage_logs 의 request_id
    // 를 멱등 키로 사용해 중복 환불을 막아요.
    if (body._refund && body.request_id) {
      const requestId = body.request_id as string;
      const { data: existingLogs } = await supabase
        .from('usage_logs')
        .select('status, metadata')
        .eq('user_id', authedUserId)
        .eq('service_slug', 'fal')
        .filter('metadata->>request_id', 'eq', requestId);

      const alreadyResolved = (existingLogs ?? []).some((r) => {
        const m = (r.metadata ?? {}) as Record<string, unknown>;
        return r.status === 'success' || m.refunded === true;
      });
      if (alreadyResolved) {
        return respond({ ok: false, reason: 'already_resolved' });
      }

      const cost = await getVtonCreditCost(supabase);
      const userIdForRefund = body.user_id as string | undefined ?? authedUserId;
      const sessionIdForRefund = body.session_id as string | undefined;
      await deductCredits(supabase, -cost, userIdForRefund, sessionIdForRefund);
      await logUsage(supabase, {
        userId: userIdForRefund, sessionId: sessionIdForRefund, serviceSlug: 'fal',
        action: 'VTON 가상 피팅 환불 (클라이언트 폴링 실패)',
        creditsDeducted: -cost, userPlan: 'unknown', status: 'failed',
        metadata: { request_id: requestId, refunded: true, cost },
      });
      return respond({ ok: true, refunded: cost });
    }

    // ── 폴링 모드 ─────────────────────────────────────────────────────
    if (body._poll && body.request_id) {
      let FAL_KEY = await getFalKey(supabase);
      if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
      if (!FAL_KEY) return respond({ error: "API 키 없음" }, 500);

      const requestId = body.request_id as string;
      // 공식 문서: POST 응답에서 받은 status_url / response_url을 우선 사용.
      // fal.ai Queue API: status는 GET /requests/<id> (NO /status suffix — 405 발생).
      // Reference: https://fal.ai/docs/model-api-reference#queue-api
      const statusUrl = (body.status_url as string | undefined) ?? `https://queue.fal.run/${VTON_WORKFLOW_MODEL_ID}/requests/${requestId}`;
      const responseUrl = (body.response_url as string | undefined) ?? `https://queue.fal.run/${VTON_WORKFLOW_MODEL_ID}/requests/${requestId}/response`;

      if (!body.status_url) {
        console.warn(`[generate-vton:poll] status_url 없음 — 조립: ${statusUrl}`);
      }

      try {
        const statusRes = await fetch(statusUrl, {
          headers: { "Authorization": `Key ${FAL_KEY}` },
          signal: AbortSignal.timeout(20000),
        });

        // 공식 문서: 응답 헤더 수집
        const falReqId = extractFalRequestId(statusRes);
        const billableUnits = extractBillableUnits(statusRes);
        const retryableHeader = getFalRetryableHeader(statusRes);
        if (falReqId) console.log(`[generate-vton:poll] x-fal-request-id: ${falReqId}`);
        if (billableUnits) console.log(`[generate-vton:poll] billable-units: ${billableUnits}`);

        // 공식 문서: 401/403 → 인증 오류
        if (statusRes.status === 401 || statusRes.status === 403) {
          return respond({ status: 'FAILED', error: `fal.ai 인증 실패 (HTTP ${statusRes.status}). fal.ai 대시보드(fal.ai/dashboard/keys)에서 API 키를 확인해주세요.`, fal_error_type: 'auth_error', retryable: false });
        }

        if (!statusRes.ok) {
          const errText = await statusRes.text();
          let errBody: Record<string, unknown> = {};
          try { errBody = JSON.parse(errText); } catch { /* ignore */ }
          const errorType = getFalErrorType(statusRes, errBody);
          const errInfo = parseFalErrorBody(errBody, retryableHeader, errorType);
          console.warn(`[generate-vton:poll] 상태 조회 실패 HTTP ${statusRes.status}: ${errText.slice(0, 200)}`);
          return respond({ status: 'IN_PROGRESS', _error: errInfo.message });
        }

        const statusData = await statusRes.json();
        const status = statusData?.status;
        console.log(`[generate-vton:poll] fal.status=${status}, queue_pos=${statusData?.queue_position ?? '-'}`);

        if (status === "COMPLETED") {
          const resultRes = await fetch(responseUrl, {
            headers: { "Authorization": `Key ${FAL_KEY}` },
            signal: AbortSignal.timeout(20000),
          });

          // 결과 헤더 수집
          const resultReqId = extractFalRequestId(resultRes);
          const resultBillable = extractBillableUnits(resultRes);
          if (resultReqId) console.log(`[generate-vton:poll] result x-fal-request-id: ${resultReqId}`);
          if (resultBillable) console.log(`[generate-vton:poll] result billable-units: ${resultBillable}`);

          if (resultRes.ok) {
            const resultData = await resultRes.json();
            const rawVideoUrl = resultData?.video?.url ?? resultData?.video_url ?? resultData?.url;
            if (rawVideoUrl) {
              const ownerId = (body.save_opts?.user_id as string | undefined) ?? (body.save_opts?.session_id as string | undefined) ?? 'anon';
              const videoUrl = await persistFalAsset(supabase, rawVideoUrl, 'video', ownerId);
              if (body.save_opts) {
                const opts = body.save_opts;
                const workId = `vton_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                await supabase.from('ad_works').insert({
                  id: workId, user_id: opts.user_id ?? null, session_id: opts.session_id ?? null,
                  title: 'AI 가상 피팅', template_id: 'vton', template_title: 'Virtual Try-On',
                  result_type: 'video', result_url: videoUrl, ratio: '9:16', resolution: '1K', format: 'MP4',
                }).catch(() => {});
              }
              return respond({ videoUrl, status: 'COMPLETED', fal_request_id: resultReqId });
            }
          } else {
            // 결과 조회 실패 처리
            const errText = await resultRes.text();
            let errBody: Record<string, unknown> = {};
            try { errBody = JSON.parse(errText); } catch { /* ignore */ }
            const retryHdr = getFalRetryableHeader(resultRes);
            const errorType = getFalErrorType(resultRes, errBody);
            const errInfo = parseFalErrorBody(errBody, retryHdr, errorType);
            console.error(`[generate-vton:poll] 결과 조회 실패 HTTP ${resultRes.status}: ${errText.slice(0, 200)}`);
            return respond({ status: 'FAILED', error: errInfo.message, fal_error_type: errInfo.errorType, retryable: errInfo.isRetryable });
          }
        }

        if (status === "FAILED") {
          // Queue FAILED: 에러 구조 파싱
          const errorType = getFalErrorType(statusRes, statusData);
          const errInfo = parseFalErrorBody(statusData, retryableHeader, errorType);
          console.error(`[generate-vton:poll] FAILED: ${errInfo.message}, retryable=${errInfo.isRetryable}`);
          return respond({ status: 'FAILED', error: errInfo.message, fal_error_type: errInfo.errorType, retryable: errInfo.isRetryable });
        }

        return respond({ status: status ?? 'IN_PROGRESS', queue_position: statusData?.queue_position });
      } catch (pollErr) {
        const isTimeout = pollErr instanceof Error && (pollErr.name === 'AbortError' || pollErr.name === 'TimeoutError');
        return respond({ status: 'IN_PROGRESS', _error: isTimeout ? '응답 타임아웃 (20초)' : String(pollErr) });
      }
    }

    // ── 생성 모드 ─────────────────────────────────────────────────────
    const { model_image, garment_image, user_id, session_id } = body;
    if (!model_image || !garment_image) {
      return respond({ error: "model_image와 garment_image가 필요합니다." }, 400);
    }

    let FAL_KEY = await getFalKey(supabase);
    if (!FAL_KEY) FAL_KEY = Deno.env.get("FAL_KEY") ?? null;
    if (!FAL_KEY) {
      return respond({ error: "API 키가 설정되지 않았습니다. 관리자 페이지에서 fal.ai API 키를 등록해주세요." }, 500);
    }

    const VTON_CREDIT_COST = await getVtonCreditCost(supabase);
    const { plan, credits, isVip } = await getUserPlan(supabase, user_id, session_id);

    console.log(`[generate-vton] user_id=${user_id}, plan=${plan}, credits=${credits}, isVip=${isVip}, cost=${VTON_CREDIT_COST}`);

    if (!isVip && credits < VTON_CREDIT_COST) {
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'VTON 가상 피팅', creditsDeducted: 0, userPlan: plan, status: 'insufficient_credits', metadata: { required: VTON_CREDIT_COST, available: credits } });
      return respond({ error: `크레딧이 부족합니다. 필요: ${VTON_CREDIT_COST} CR, 보유: ${credits} CR`, insufficient_credits: true, required: VTON_CREDIT_COST, available: credits }, 402);
    }
    if (!isVip) await deductCredits(supabase, VTON_CREDIT_COST, user_id, session_id);

    // 공식 문서: queue 제출 + Platform Headers
    const falRes = await fetch(`https://queue.fal.run/${VTON_WORKFLOW_MODEL_ID}`, {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
        // 공식 문서: 생성물 1시간 보관
        "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
      },
      body: JSON.stringify({ model_image, garment_image }),
      signal: AbortSignal.timeout(30000),
    });

    // 공식 문서: 응답 헤더 수집
    const falReqId = extractFalRequestId(falRes);
    const billableUnits = extractBillableUnits(falRes);
    if (falReqId) console.log(`[generate-vton] x-fal-request-id: ${falReqId}`);
    if (billableUnits) console.log(`[generate-vton] billable-units: ${billableUnits}`);

    if (!falRes.ok) {
      const errText = await falRes.text();
      let errBody: Record<string, unknown> = {};
      try { errBody = JSON.parse(errText); } catch { /* ignore */ }
      const retryableHeader = getFalRetryableHeader(falRes);
      const errorType = getFalErrorType(falRes, errBody);
      const errInfo = parseFalErrorBody(errBody, retryableHeader, errorType);

      // 공식 문서: 401/403 → 인증 오류 명시적 처리
      if (falRes.status === 401 || falRes.status === 403) {
        if (!isVip) await deductCredits(supabase, -VTON_CREDIT_COST, user_id, session_id);
        return respond({ error: `fal.ai 인증 실패 (HTTP ${falRes.status}). fal.ai 대시보드(fal.ai/dashboard/keys)에서 API 키를 확인해주세요.`, fal_error_type: 'auth_error' }, 401);
      }

      // 공식 문서: 429 → 큐 혼잡
      if (falRes.status === 429) {
        if (!isVip) await deductCredits(supabase, -VTON_CREDIT_COST, user_id, session_id);
        return respond({ error: 'fal.ai 대기열이 혼잡해요. 잠시 후 다시 시도해주세요.', fal_error_type: 'queue_full' }, 429);
      }

      if (!isVip) await deductCredits(supabase, -VTON_CREDIT_COST, user_id, session_id);
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'VTON 가상 피팅', creditsDeducted: 0, userPlan: plan, status: 'failed', metadata: { error: errInfo.message, error_type: errInfo.errorType, http_status: falRes.status, fal_request_id: falReqId } });
      return respond({ error: `fal.ai VTON 요청 실패 (HTTP ${falRes.status}): ${errInfo.message}`, fal_error_type: errInfo.errorType }, 502);
    }

    const falData = await falRes.json();

    // 즉시 완료 확인
    const immediateVideoUrl = falData?.video?.url ?? falData?.video_url ?? falData?.url;
    if (immediateVideoUrl) {
      await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'VTON 가상 피팅', creditsDeducted: isVip ? 0 : VTON_CREDIT_COST, userPlan: plan, status: 'success', metadata: { immediate: true, cost: VTON_CREDIT_COST, fal_request_id: falReqId } });
      return respond({ success: true, videoUrl: immediateVideoUrl, credits_used: isVip ? 0 : VTON_CREDIT_COST });
    }

    const requestId = falData?.request_id;
    // 공식 문서: POST 응답의 status_url / response_url 수집
    const statusUrl = (falData?.status_url as string) ?? null;
    const responseUrl = (falData?.response_url as string) ?? null;

    console.log(`[generate-vton] request_id=${requestId}, status_url=${statusUrl ?? '(없음)'}, response_url=${responseUrl ?? '(없음)'}`);

    if (!requestId) {
      if (!isVip) await deductCredits(supabase, -VTON_CREDIT_COST, user_id, session_id);
      return respond({ error: "request_id를 받지 못했습니다." }, 502);
    }

    // 내부 폴링 (최대 80초)
    const startTime = Date.now();
    const maxPollMs = 80000;
    const pollInterval = 5000;

    for (let attempt = 0; attempt < 16; attempt++) {
      const elapsed = Date.now() - startTime;
      if (elapsed > maxPollMs - 12000) {
        // 타임아웃 임박 → 클라이언트 폴링으로 전환
        return respond({
          pending: true,
          request_id: requestId,
          // 공식 문서: status_url / response_url 프론트에 전달
          status_url: statusUrl,
          response_url: responseUrl,
          credits_used: isVip ? 0 : VTON_CREDIT_COST,
          save_opts: { user_id, session_id },
          message: "가상 피팅 영상 생성 중입니다. 약 2~3분 소요됩니다.",
        });
      }

      await new Promise((r) => setTimeout(r, pollInterval));

      try {
        // 공식 문서: POST 응답 status_url 우선 사용. fallback도 /status suffix 없이 — fal.ai는
        // GET /requests/<id> 를 사용하며 /status suffix는 405 반환.
        const resolvedStatusUrl = statusUrl ?? `https://queue.fal.run/${VTON_WORKFLOW_MODEL_ID}/requests/${requestId}`;
        const statusRes = await fetch(resolvedStatusUrl, {
          headers: { "Authorization": `Key ${FAL_KEY}` },
          signal: AbortSignal.timeout(10000),
        });

        if (statusRes.status === 401 || statusRes.status === 403) {
          if (!isVip) await deductCredits(supabase, -VTON_CREDIT_COST, user_id, session_id);
          return respond({ error: `fal.ai 인증 실패 (HTTP ${statusRes.status}). API 키를 확인해주세요.` }, 401);
        }

        if (!statusRes.ok) {
          console.warn(`[generate-vton] 폴링 ${attempt + 1} 상태 오류: ${statusRes.status}`);
          continue;
        }

        const statusData = await statusRes.json();
        const status = statusData?.status;
        console.log(`[generate-vton] 폴링 ${attempt + 1}: status=${status}, queue_pos=${statusData?.queue_position ?? '-'}`);

        if (status === "COMPLETED") {
          // 공식 문서: response_url 우선 사용
          const resolvedResponseUrl = responseUrl ?? `https://queue.fal.run/${VTON_WORKFLOW_MODEL_ID}/requests/${requestId}/response`;
          const resultRes = await fetch(resolvedResponseUrl, {
            headers: { "Authorization": `Key ${FAL_KEY}` },
            signal: AbortSignal.timeout(15000),
          });

          const resultFalReqId = extractFalRequestId(resultRes);
          const resultBillable = extractBillableUnits(resultRes);
          if (resultFalReqId) console.log(`[generate-vton] result x-fal-request-id: ${resultFalReqId}`);
          if (resultBillable) console.log(`[generate-vton] result billable-units: ${resultBillable}`);

          if (resultRes.ok) {
            const resultData = await resultRes.json();
            const rawVideoUrl = resultData?.video?.url ?? resultData?.video_url ?? resultData?.url;
            if (rawVideoUrl) {
              const videoUrl = await persistFalAsset(supabase, rawVideoUrl, 'video', user_id ?? session_id ?? 'anon');
              await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'VTON 가상 피팅', creditsDeducted: isVip ? 0 : VTON_CREDIT_COST, userPlan: plan, status: 'success', metadata: { attempts: attempt + 1, cost: VTON_CREDIT_COST, fal_request_id: resultFalReqId, billable_units: resultBillable, request_id: requestId } });
              const workId = `vton_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              await supabase.from('ad_works').insert({ id: workId, user_id: user_id ?? null, session_id: session_id ?? null, title: 'AI 가상 피팅', template_id: 'vton', template_title: 'Virtual Try-On', result_type: 'video', result_url: videoUrl, ratio: '9:16', resolution: '1K', format: 'MP4' }).catch(() => {});
              return respond({ success: true, videoUrl, credits_used: isVip ? 0 : VTON_CREDIT_COST });
            }
          }
        }

        if (status === "FAILED") {
          // 공식 문서: FAILED 에러 구조 파싱
          const retryHdr = getFalRetryableHeader(statusRes);
          const errorType = getFalErrorType(statusRes, statusData);
          const errInfo = parseFalErrorBody(statusData, retryHdr, errorType);

          if (!isVip) await deductCredits(supabase, -VTON_CREDIT_COST, user_id, session_id);
          await logUsage(supabase, { userId: user_id, sessionId: session_id, serviceSlug: 'fal', action: 'VTON 가상 피팅', creditsDeducted: 0, userPlan: plan, status: 'failed', metadata: { error: errInfo.message, error_type: errInfo.errorType } });
          return respond({ error: errInfo.message, fal_error_type: errInfo.errorType, retryable: errInfo.isRetryable }, 502);
        }
      } catch (pollErr) {
        const isTimeout = pollErr instanceof Error && (pollErr.name === 'AbortError' || pollErr.name === 'TimeoutError');
        console.warn(`[generate-vton] 폴링 ${attempt + 1} 오류:`, isTimeout ? '타임아웃' : pollErr);
      }
    }

    // 폴링 횟수 초과 → 클라이언트 폴링으로 전환
    return respond({
      pending: true,
      request_id: requestId,
      status_url: statusUrl,
      response_url: responseUrl,
      credits_used: isVip ? 0 : VTON_CREDIT_COST,
      save_opts: { user_id, session_id },
      message: "가상 피팅 영상 생성 중입니다. 약 2~3분 소요됩니다.",
    });

  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    console.error("generate-vton Edge Function 오류:", err);
    return new Response(JSON.stringify({ error: isTimeout ? '요청 타임아웃. 잠시 후 다시 시도해주세요.' : String(err) }), { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
