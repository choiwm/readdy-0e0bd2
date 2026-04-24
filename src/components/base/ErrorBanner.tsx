/* eslint-disable react-refresh/only-export-components */
import { useState, useCallback } from 'react';

// ── 에러 타입 분류 ─────────────────────────────────────────────────────────
export type ApiErrorType =
  | 'api_key'       // API 키 미설정
  | 'quota'         // 할당량 초과
  | 'network'       // 네트워크 오류
  | 'timeout'       // 타임아웃
  | 'server'        // 서버 오류 (5xx)
  | 'invalid_input' // 잘못된 입력
  | 'credit'        // 크레딧 부족
  | 'unknown';      // 알 수 없는 오류

export interface ApiError {
  type: ApiErrorType;
  message: string;
  detail?: string;
  retryable: boolean;
}

// ── 에러 메시지 파싱 ───────────────────────────────────────────────────────
export function parseApiError(err: unknown, rawMessage?: string): ApiError {
  const msg = rawMessage ?? (err instanceof Error ? err.message : String(err));
  const lower = msg.toLowerCase();

  if (lower.includes('goapi_key') || lower.includes('api 키') || lower.includes('api key') || lower.includes('no_api_key')) {
    return {
      type: 'api_key',
      message: 'API 키가 설정되지 않았습니다',
      detail: 'Supabase Secrets에 GOAPI_KEY를 추가해야 합니다.',
      retryable: false,
    };
  }

  if (lower.includes('quota') || lower.includes('rate limit') || lower.includes('too many') || lower.includes('429')) {
    return {
      type: 'quota',
      message: 'API 요청 한도 초과',
      detail: '잠시 후 다시 시도해 주세요. (보통 1~2분 후 해결됩니다)',
      retryable: true,
    };
  }

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('시간 초과')) {
    return {
      type: 'timeout',
      message: '요청 시간이 초과되었습니다',
      detail: '서버가 응답하지 않습니다. 네트워크 상태를 확인하거나 다시 시도해 주세요.',
      retryable: true,
    };
  }

  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch') || lower.includes('연결')) {
    return {
      type: 'network',
      message: '네트워크 연결 오류',
      detail: '인터넷 연결을 확인하고 다시 시도해 주세요.',
      retryable: true,
    };
  }

  if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('서버 오류')) {
    return {
      type: 'server',
      message: '서버 오류가 발생했습니다',
      detail: `서버에서 오류가 반환되었습니다. (${msg.match(/\d{3}/)?.[0] ?? '5xx'})`,
      retryable: true,
    };
  }

  if (lower.includes('invalid') || lower.includes('잘못된') || lower.includes('400')) {
    return {
      type: 'invalid_input',
      message: '입력값이 올바르지 않습니다',
      detail: msg,
      retryable: false,
    };
  }

  if (lower.includes('credit') || lower.includes('크레딧') || lower.includes('insufficient')) {
    return {
      type: 'credit',
      message: '크레딧이 부족합니다',
      detail: '플랜을 업그레이드하거나 크레딧을 충전해 주세요.',
      retryable: false,
    };
  }

  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다',
    detail: msg,
    retryable: true,
  };
}

// ── 에러 타입별 UI 설정 ────────────────────────────────────────────────────
const ERROR_CONFIG: Record<ApiErrorType, {
  icon: string;
  color: string;
  bg: string;
  border: string;
  guide?: { label: string; steps: string[] };
}> = {
  api_key: {
    icon: 'ri-key-2-line',
    color: 'text-amber-400',
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/25',
    guide: {
      label: 'API 키 설정 방법',
      steps: [
        'Supabase 대시보드 접속',
        'Edge Functions → Secrets 메뉴',
        'GOAPI_KEY 항목 추가',
        'goapi.ai에서 발급한 키 입력 후 저장',
      ],
    },
  },
  quota: {
    icon: 'ri-time-line',
    color: 'text-orange-400',
    bg: 'bg-orange-500/8',
    border: 'border-orange-500/25',
  },
  network: {
    icon: 'ri-wifi-off-line',
    color: 'text-red-400',
    bg: 'bg-red-500/8',
    border: 'border-red-500/25',
  },
  timeout: {
    icon: 'ri-timer-line',
    color: 'text-orange-400',
    bg: 'bg-orange-500/8',
    border: 'border-orange-500/25',
  },
  server: {
    icon: 'ri-server-line',
    color: 'text-red-400',
    bg: 'bg-red-500/8',
    border: 'border-red-500/25',
  },
  invalid_input: {
    icon: 'ri-error-warning-line',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/8',
    border: 'border-yellow-500/25',
  },
  credit: {
    icon: 'ri-copper-diamond-line',
    color: 'text-rose-400',
    bg: 'bg-rose-500/8',
    border: 'border-rose-500/25',
  },
  unknown: {
    icon: 'ri-question-line',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/60',
    border: 'border-white/10',
  },
};

// ── ErrorBanner 컴포넌트 ───────────────────────────────────────────────────
interface ErrorBannerProps {
  error: ApiError;
  onRetry?: () => void;
  onDismiss?: () => void;
  /** 인라인 배너 (기본) vs 토스트 팝업 */
  variant?: 'inline' | 'toast';
  className?: string;
}

export function ErrorBanner({ error, onRetry, onDismiss, variant = 'inline', className = '' }: ErrorBannerProps) {
  const [showGuide, setShowGuide] = useState(false);
  const cfg = ERROR_CONFIG[error.type];

  if (variant === 'toast') {
    return (
      <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-start gap-3 px-5 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl max-w-md w-full ${cfg.bg} ${cfg.border} ${className}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg} border ${cfg.border}`}>
          <i className={`${cfg.icon} ${cfg.color} text-sm`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${cfg.color}`}>{error.message}</p>
          {error.detail && (
            <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{error.detail}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {error.retryable && onRetry && (
            <button
              onClick={onRetry}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer whitespace-nowrap ${cfg.border} ${cfg.color} hover:opacity-80`}
            >
              <i className="ri-refresh-line text-[10px]" /> 재시도
            </button>
          )}
          {onDismiss && (
            <button onClick={onDismiss} className="text-zinc-600 hover:text-zinc-300 cursor-pointer transition-colors">
              <i className="ri-close-line text-sm" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <div className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg} ${cfg.border}`}>
          <i className={`${cfg.icon} ${cfg.color} text-base`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${cfg.color} mb-0.5`}>{error.message}</p>
          {error.detail && (
            <p className="text-[11px] text-zinc-500 leading-relaxed">{error.detail}</p>
          )}

          {/* 가이드 토글 */}
          {cfg.guide && (
            <button
              onClick={() => setShowGuide((v) => !v)}
              className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${cfg.color} opacity-70 hover:opacity-100 cursor-pointer transition-opacity`}
            >
              <i className={`${showGuide ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xs`} />
              {cfg.guide.label}
            </button>
          )}

          {showGuide && cfg.guide && (
            <div className="mt-2 p-3 rounded-xl bg-zinc-900/60 border border-white/5">
              <ol className="space-y-1.5">
                {cfg.guide.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[10px] text-zinc-400">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-black ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {onDismiss && (
            <button onClick={onDismiss} className="text-zinc-600 hover:text-zinc-300 cursor-pointer transition-colors">
              <i className="ri-close-line text-sm" />
            </button>
          )}
          {error.retryable && onRetry && (
            <button
              onClick={onRetry}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${cfg.border} ${cfg.color} hover:opacity-80`}
            >
              <i className="ri-refresh-line text-xs" /> 다시 시도
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── useApiError 훅 ─────────────────────────────────────────────────────────
export function useApiError() {
  const [error, setError] = useState<ApiError | null>(null);

  const setApiError = useCallback((err: unknown, rawMessage?: string) => {
    setError(parseApiError(err, rawMessage));
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { error, setApiError, clearError };
}
