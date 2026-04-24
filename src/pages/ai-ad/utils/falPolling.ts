import { supabase } from '@/lib/supabase';
import { logDev } from '@/lib/logger';

const SESSION_KEY = 'ai_ad_session_id';

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `ad_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// fal.ai error_type 중 재시도 가능한 타입 목록 (공식 문서 기준)
export const FAL_RETRYABLE_ERROR_TYPES = new Set([
  'request_timeout', 'startup_timeout', 'runner_scheduling_failure',
  'runner_connection_timeout', 'runner_disconnected', 'runner_connection_refused',
  'runner_connection_error', 'runner_incomplete_response', 'runner_server_error',
  'internal_error',
]);

// 영구 실패 타입 — 재시도해도 소용 없음
export const FAL_PERMANENT_ERROR_TYPES = new Set([
  'client_disconnected', 'client_cancelled', 'bad_request',
  'auth_error', 'not_found', 'url_error',
]);

/**
 * 이미지 생성 pending 폴링 — generate-image Edge Function 프록시 사용
 * maxAttempts=60, intervalMs=5000 → 최대 5분 대기
 */
export async function pollImageResult(
  falModel: string,
  requestId: string,
  statusUrl?: string | null,
  responseUrl?: string | null,
  saveOpts?: Record<string, unknown>,
  maxAttempts = 75,
  intervalMs = 4000,
): Promise<string | null> {
  let consecutiveErrors = 0;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          _poll: true,
          request_id: requestId,
          model: falModel,
          status_url: statusUrl ?? undefined,
          response_url: responseUrl ?? undefined,
          save_opts: saveOpts,
        },
      });
      if (error) {
        consecutiveErrors++;
        console.warn(`[pollImageResult] Edge Function 오류 (${consecutiveErrors}회):`, error.message);
        if (consecutiveErrors >= 8) throw new Error(`이미지 폴링 연속 오류: ${error.message}`);
        continue;
      }
      consecutiveErrors = 0;
      if (data?.imageUrl) return data.imageUrl;
      if (data?.status === 'FAILED') throw new Error(data.error ?? '이미지 생성 실패');
      const queuePos = data?.queue_position;
      logDev(`[pollImageResult] ${i + 1}/${maxAttempts}: status=${data?.status ?? 'IN_PROGRESS'}${queuePos != null ? `, queue_pos=${queuePos}` : ''}`);
    } catch (e) {
      if (e instanceof Error && (e.message.includes('실패') || e.message.includes('FAILED') || e.message.includes('오류'))) throw e;
      consecutiveErrors++;
      if (consecutiveErrors >= 8) throw new Error('이미지 폴링 중 반복 오류가 발생했습니다.');
    }
  }
  return null;
}

/**
 * Edge Function이 pending 반환 시 프론트에서 Edge Function 폴링 프록시를 통해 결과 확인
 * fal.ai API 키는 Edge Function 내부에서만 사용 (보안)
 * statusUrl: pending 응답에 포함된 status_url — Edge Function에 전달해 정확한 폴링
 * responseUrl: pending 응답에 포함된 response_url — COMPLETED 시 결과 조회에 사용
 * saveOpts: pending 시 반환된 save_opts — 폴링 완료 시 Edge Function에서 ad_works 저장
 * 절대 타임아웃: 20분 (1200초) — 이 시간이 지나면 무조건 포기
 */
export async function pollFalVideoResult(
  falModel: string,
  requestId: string,
  statusUrl?: string,
  responseUrl?: string,
  saveOpts?: Record<string, unknown>,
  onCancelRef?: React.MutableRefObject<boolean>,
  onStepUpdate?: (step: string) => void,
): Promise<string | null> {
  const ABSOLUTE_TIMEOUT_MS = 20 * 60 * 1000; // 20분 절대 타임아웃
  const POLL_INTERVAL_MS = 6000; // 6초마다 폴링
  const startTime = Date.now();
  let consecutiveErrors = 0;
  let attempt = 0;

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= ABSOLUTE_TIMEOUT_MS) {
      throw new Error('영상 생성 시간이 초과되었습니다 (20분). fal.ai 서버가 혼잡하거나 요청이 실패했을 수 있어요. 잠시 후 다시 시도해주세요.');
    }

    if (onCancelRef?.current) throw new Error('사용자가 생성을 취소했습니다.');

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    attempt++;

    if (onCancelRef?.current) throw new Error('사용자가 생성을 취소했습니다.');

    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          _poll: true,
          request_id: requestId,
          model: falModel,
          status_url: statusUrl,
          response_url: responseUrl,
          save_opts: saveOpts,
        },
      });

      if (error) {
        consecutiveErrors++;
        console.warn(`[pollFalVideoResult] Edge Function 오류 (${consecutiveErrors}회):`, error.message);
        if (consecutiveErrors >= 8) throw new Error(`영상 폴링 연속 오류: ${error.message}`);
        continue;
      }

      consecutiveErrors = 0;

      if (data?.videoUrl) return data.videoUrl;

      if (data?.status === 'FAILED') {
        const falErrorType: string | undefined = data.fal_error_type;
        const errMsg: string = data.error ?? '영상 생성 실패';
        const isPermanent: boolean = falErrorType ? FAL_PERMANENT_ERROR_TYPES.has(falErrorType) : false;

        console.error(`[pollFalVideoResult] FAILED — error_type=${falErrorType}, msg=${errMsg}`);
        if (isPermanent) throw new Error(errMsg);
        throw new Error(errMsg);
      }

      const elapsedSec = Math.round(elapsed / 1000);
      const queuePos = data?.queue_position;
      const queuePosMsg = queuePos != null ? ` (대기열 ${queuePos}위)` : '';
      logDev(`[pollFalVideoResult] 시도 ${attempt} (${elapsedSec}s): status=${data?.status ?? 'IN_PROGRESS'}, queue_pos=${queuePos ?? '-'}`);

      // queue_position UI 업데이트
      if (queuePos != null && queuePos > 0) {
        onStepUpdate?.(`영상 렌더링 대기 중${queuePosMsg} — ${Math.floor(elapsedSec / 60)}분 ${elapsedSec % 60}초 경과`);
      } else if (queuePos === 0 || data?.status === 'IN_PROGRESS') {
        onStepUpdate?.(`영상 렌더링 진행 중... ${Math.floor(elapsedSec / 60)}분 ${elapsedSec % 60}초 경과`);
      }

    } catch (e) {
      if (e instanceof Error && (
        e.message.includes('취소') ||
        e.message.includes('실패') ||
        e.message.includes('FAILED') ||
        e.message.includes('초과') ||
        e.message.includes('timeout') ||
        e.message.includes('fal.ai') ||
        e.message.includes('오류')
      )) throw e;
      consecutiveErrors++;
      if (consecutiveErrors >= 8) throw new Error('영상 폴링 중 반복 오류가 발생했습니다.');
    }
  }
}
