// Single source of truth for parsing fal.ai error responses across every
// generate-* Edge Function.
//
// Why centralise: previously each function had its own parseFalErrorBody
// that handled body shape but ignored HTTP status, so a 401 invalid-key
// failure surfaced to users as "fal.ai 권한 없음" with no hint that the
// admin needs to re-register the API key. The new parser:
//
//   1. Consumes BOTH httpStatus and body.
//   2. Categorises into a stable `kind` enum so the admin diagnostic
//      panel (PR #8) can group failures.
//   3. Always returns a Korean user-facing message + a specific action_kr
//      so failure UI can show "결제 등록 필요" / "키 재발급 필요" instead
//      of a raw fal.ai detail string the end user can't act on.
//
// Reference: https://docs.fal.ai/serverless/error-handling

export type FalErrorKind =
  | 'auth'              // 401 — bad API key
  | 'forbidden'         // 403 — key lacks scope or workspace permission
  | 'payment_required'  // 402 / 403 with billing detail — no payment method on file
  | 'not_found'         // 404 — model id wrong / deprecated path
  | 'validation'        // 422 — body shape / prompt content rejected
  | 'rate_limited'      // 429
  | 'timeout'           // 504 / generation_timeout
  | 'content_policy'    // safety filter triggered
  | 'server_error'      // 5xx
  | 'unknown';

export interface FalErrorParsed {
  kind: FalErrorKind;
  /** Original HTTP status from fal.ai. */
  http_status: number;
  /** fal.ai error_type string, when present. */
  fal_error_type: string | null;
  /** End-user message in Korean. Safe to render in UI. */
  message_kr: string;
  /** Concrete next step in Korean. e.g. "관리자 패널 → AI 엔진 → API 키 재등록". */
  action_kr: string;
  /** True when retrying with the same payload could succeed. */
  is_retryable: boolean;
  /** Raw response body slice for logs (truncated). */
  raw_excerpt?: string;
}

// fal.ai error_type buckets — copied from official docs.
const FAL_RETRYABLE_REQUEST_ERROR_TYPES = new Set([
  'request_timeout', 'startup_timeout', 'runner_scheduling_failure',
  'runner_connection_timeout', 'runner_disconnected',
  'runner_connection_refused', 'runner_connection_error',
  'runner_incomplete_response', 'runner_server_error', 'internal_error',
]);
const FAL_PERMANENT_REQUEST_ERROR_TYPES = new Set([
  'client_disconnected', 'client_cancelled',
  'bad_request', 'auth_error', 'not_found', 'url_error',
]);
const FAL_PERMANENT_MODEL_ERROR_TYPES = new Set([
  'content_policy_violation',
  'no_media_generated',
  'image_too_small', 'image_too_large',
  'image_load_error', 'file_download_error', 'face_detection_error',
  'file_too_large',
  'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal',
  'multiple_of', 'sequence_too_short', 'sequence_too_long', 'one_of',
  'feature_not_supported',
  'unsupported_image_format', 'unsupported_audio_format', 'unsupported_video_format',
]);
const FAL_RETRYABLE_MODEL_ERROR_TYPES = new Set([
  'internal_server_error', 'generation_timeout',
  'downstream_service_error', 'downstream_service_unavailable',
]);

function getHeader(res: Response, name: string): string | null {
  return res.headers.get(name) ?? res.headers.get(name.toLowerCase()) ?? null;
}

export function getFalRequestId(res: Response): string | null {
  return getHeader(res, 'X-Fal-Request-Id');
}
export function getFalErrorTypeHeader(res: Response): string | null {
  return getHeader(res, 'X-Fal-Error-Type');
}
export function getFalRetryableHeader(res: Response): string | null {
  return getHeader(res, 'X-Fal-Retryable');
}
export function getBillableUnits(res: Response): string | null {
  return getHeader(res, 'X-Fal-Billable-Units');
}

interface BodyShape {
  error?: unknown;
  detail?: unknown;
  error_type?: unknown;
  message?: unknown;
}

function extractDetailString(body: BodyShape): string | null {
  if (typeof body.detail === 'string') return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    const first = body.detail[0] as { msg?: string; loc?: string[]; type?: string; ctx?: Record<string, unknown> };
    if (first?.msg) {
      const loc = Array.isArray(first.loc) ? first.loc.join('.') : '';
      return loc ? `${first.msg} (${loc})` : first.msg;
    }
  }
  if (typeof body.error === 'string') return body.error;
  if (typeof body.message === 'string') return body.message as string;
  return null;
}

/**
 * Parse a fal.ai error response into an actionable, categorised structure.
 *
 *   const parsed = parseFalError(res.status, body, res);
 *   if (parsed.kind === 'auth') {
 *     // tell admin to re-register the API key
 *   }
 */
export function parseFalError(
  httpStatus: number,
  body: BodyShape | null | undefined,
  res?: Response,
): FalErrorParsed {
  const safeBody: BodyShape = body ?? {};
  const detail = extractDetailString(safeBody);
  const errorTypeHeader = res ? getFalErrorTypeHeader(res) : null;
  const errorType = errorTypeHeader ?? (typeof safeBody.error_type === 'string' ? (safeBody.error_type as string) : null);
  const retryableHeader = res ? getFalRetryableHeader(res) : null;
  const raw = detail ?? '';

  // ── Auth / scope / payment issues — the most common admin-facing failures ──
  if (httpStatus === 401) {
    return {
      kind: 'auth',
      http_status: 401,
      fal_error_type: errorType,
      message_kr: 'fal.ai 인증에 실패했어요 (HTTP 401).',
      action_kr: '관리자 패널 → AI 엔진 → API 키 관리에서 fal.ai 키를 재등록하세요. fal.ai 대시보드에서 API key with scope 옵션으로 새 키를 생성해야 합니다.',
      is_retryable: false,
      raw_excerpt: raw.slice(0, 200),
    };
  }

  if (httpStatus === 402 || /payment|billing|insufficient.+balance|no payment method/i.test(raw)) {
    return {
      kind: 'payment_required',
      http_status: httpStatus,
      fal_error_type: errorType,
      message_kr: 'fal.ai 계정에 결제수단이 등록되어 있지 않거나 잔고가 부족합니다.',
      action_kr: 'https://fal.ai/dashboard/billing 에서 결제수단을 등록하거나 크레딧을 충전한 뒤 다시 시도해주세요.',
      is_retryable: false,
      raw_excerpt: raw.slice(0, 200),
    };
  }

  if (httpStatus === 403) {
    // 403 can be either "key has no scope" or "this model needs a higher tier".
    const isScope = /scope|permission|forbidden|not allowed/i.test(raw);
    return {
      kind: 'forbidden',
      http_status: 403,
      fal_error_type: errorType,
      message_kr: isScope
        ? 'fal.ai API 키 권한이 부족합니다 (HTTP 403).'
        : 'fal.ai에서 이 요청을 거부했어요 (HTTP 403).',
      action_kr: 'fal.ai 대시보드에서 "API key with scope" 옵션으로 새 키를 발급한 뒤 관리자 패널에서 재등록하세요. 결제수단이 등록되지 않은 경우에도 일부 모델이 403을 반환할 수 있습니다.',
      is_retryable: false,
      raw_excerpt: raw.slice(0, 200),
    };
  }

  // ── 404: typically wrong model id / deprecated path ──────────────────────
  if (httpStatus === 404) {
    return {
      kind: 'not_found',
      http_status: 404,
      fal_error_type: errorType,
      message_kr: '요청하신 fal.ai 모델 경로를 찾을 수 없어요 (HTTP 404).',
      action_kr: 'supabase/functions/_shared/fal_image_models.ts (또는 fal_video_models.ts)의 경로가 fal.ai의 현재 카탈로그와 일치하는지 확인하세요. 모델이 deprecated 됐거나 이름이 변경됐을 수 있습니다.',
      is_retryable: false,
      raw_excerpt: raw.slice(0, 200),
    };
  }

  // ── 422: prompt content / input validation ───────────────────────────────
  if (httpStatus === 422) {
    if (errorType === 'content_policy_violation' || /content.policy|safety|nsfw|forbidden content/i.test(raw)) {
      return {
        kind: 'content_policy',
        http_status: 422,
        fal_error_type: errorType,
        message_kr: '프롬프트가 fal.ai 콘텐츠 정책에 의해 차단됐어요.',
        action_kr: '폭력·성적·증오 표현 등이 포함되지 않도록 프롬프트를 수정 후 다시 시도해주세요.',
        is_retryable: false,
        raw_excerpt: raw.slice(0, 200),
      };
    }
    return {
      kind: 'validation',
      http_status: 422,
      fal_error_type: errorType,
      message_kr: detail ? `입력 검증 실패: ${detail}` : '입력 검증에 실패했어요.',
      action_kr: '프롬프트 길이, 이미지 크기, 비율 등을 확인 후 다시 시도해주세요.',
      is_retryable: false,
      raw_excerpt: raw.slice(0, 200),
    };
  }

  // ── 429: rate limit (workspace level — different from our user level) ───
  if (httpStatus === 429) {
    const retryAfter = res?.headers.get('Retry-After');
    return {
      kind: 'rate_limited',
      http_status: 429,
      fal_error_type: errorType,
      message_kr: 'fal.ai 워크스페이스 호출 한도에 도달했어요.',
      action_kr: retryAfter
        ? `${retryAfter}초 후 다시 시도하거나 fal.ai 대시보드에서 호출 한도를 상향 신청하세요.`
        : '잠시 후 다시 시도하거나 fal.ai 대시보드에서 호출 한도를 상향 신청하세요.',
      is_retryable: true,
      raw_excerpt: raw.slice(0, 200),
    };
  }

  // ── 5xx ─────────────────────────────────────────────────────────────────
  if (httpStatus >= 500) {
    if (httpStatus === 504 || errorType === 'generation_timeout' || /timeout/i.test(raw)) {
      return {
        kind: 'timeout',
        http_status: httpStatus,
        fal_error_type: errorType,
        message_kr: '생성 시간이 초과됐어요 (timeout).',
        action_kr: 'fal.ai 서버가 혼잡하거나 모델 워밍업 중일 수 있어요. 잠시 후 다시 시도해주세요.',
        is_retryable: true,
        raw_excerpt: raw.slice(0, 200),
      };
    }
    return {
      kind: 'server_error',
      http_status: httpStatus,
      fal_error_type: errorType,
      message_kr: `fal.ai 서버 오류 (HTTP ${httpStatus}).`,
      action_kr: '잠시 후 다시 시도해주세요. 반복되면 fal.ai 상태 페이지(https://status.fal.ai)를 확인하세요.',
      is_retryable: true,
      raw_excerpt: raw.slice(0, 200),
    };
  }

  // ── Generic / fallback — categorise via error_type if possible ───────────
  let isRetryable: boolean;
  if (retryableHeader !== null) {
    isRetryable = retryableHeader === 'true';
  } else if (errorType) {
    if (FAL_PERMANENT_REQUEST_ERROR_TYPES.has(errorType) || FAL_PERMANENT_MODEL_ERROR_TYPES.has(errorType)) {
      isRetryable = false;
    } else if (FAL_RETRYABLE_REQUEST_ERROR_TYPES.has(errorType) || FAL_RETRYABLE_MODEL_ERROR_TYPES.has(errorType)) {
      isRetryable = true;
    } else {
      isRetryable = true;
    }
  } else {
    isRetryable = true;
  }

  return {
    kind: 'unknown',
    http_status: httpStatus,
    fal_error_type: errorType,
    message_kr: detail ? `fal.ai 오류: ${detail}` : `알 수 없는 fal.ai 오류 (HTTP ${httpStatus}).`,
    action_kr: isRetryable
      ? '잠시 후 다시 시도해주세요.'
      : '입력값을 확인하거나 다른 모델을 선택해 다시 시도해주세요.',
    is_retryable: isRetryable,
    raw_excerpt: raw.slice(0, 200),
  };
}

/**
 * Convert a parsed error into the JSON payload the frontend expects.
 * Keeps backward-compatible field names (error, fal_error_type, etc.) so
 * existing UI continues to work, but adds the new structured fields.
 */
export function toClientPayload(parsed: FalErrorParsed): {
  error: string;
  message: string;
  action: string;
  kind: FalErrorKind;
  fal_error_type: string | null;
  http_status: number;
  is_retryable: boolean;
} {
  return {
    error: parsed.message_kr,
    message: parsed.message_kr,
    action: parsed.action_kr,
    kind: parsed.kind,
    fal_error_type: parsed.fal_error_type,
    http_status: parsed.http_status,
    is_retryable: parsed.is_retryable,
  };
}
