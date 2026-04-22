type ErrorType = 'api_key' | 'credits' | 'timeout' | 'server' | 'model_unavailable' | 'rate_limit' | 'content_policy' | 'network' | 'unknown';

interface ErrorPanelProps {
  errorType: ErrorType;
  errorMsg: string;
  genType: 'image' | 'video';
  modelName?: string;
  onRetry: () => void;
  onReset: () => void;
}

interface ErrorConfig {
  icon: string;
  color: string;
  bg: string;
  border: string;
  title: string;
  hint: string;
  steps?: string[];
  canRetry: boolean;
  severity: 'warning' | 'error' | 'info';
}

const ERROR_CONFIG: Record<ErrorType, ErrorConfig> = {
  api_key: {
    icon: 'ri-key-2-line',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    title: 'API 키 인증 실패',
    hint: 'fal.ai API 키가 유효하지 않거나 만료되었습니다.',
    steps: [
      'fal.ai 대시보드(fal.ai/dashboard)에서 키 상태 확인',
      '관리자 페이지 → AI 엔진 탭에서 키 재등록',
      '진단 패널에서 키 연결 상태 재확인',
    ],
    canRetry: false,
    severity: 'warning',
  },
  credits: {
    icon: 'ri-copper-diamond-line',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    title: '크레딧 부족',
    hint: '보유 크레딧이 이 작업을 수행하기에 부족합니다.',
    steps: [
      '크레딧 충전 페이지에서 충전',
      '더 저렴한 모델(Wan 2.5 추천)로 변경',
      '이미지 생성(더 저렴)으로 먼저 시도',
    ],
    canRetry: false,
    severity: 'warning',
  },
  timeout: {
    icon: 'ri-time-line',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    title: '생성 시간 초과',
    hint: 'fal.ai 서버 대기열이 혼잡하거나 요청이 처리되지 않았습니다.',
    steps: [
      '잠시 후(1~2분) 재시도',
      '더 빠른 모델(Wan 2.5)로 변경 후 시도',
      '피크 시간대(한국 기준 낮 12시~오후 6시) 피하기',
    ],
    canRetry: true,
    severity: 'info',
  },
  server: {
    icon: 'ri-server-line',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    title: 'AI 서버 오류',
    hint: 'fal.ai 서버에서 오류가 발생했습니다. 일시적인 문제일 가능성이 높습니다.',
    steps: [
      '바로 재시도 (대부분 해결됨)',
      '다른 AI 모델로 변경 후 시도',
      'fal.ai 상태 페이지(status.fal.ai) 확인',
    ],
    canRetry: true,
    severity: 'error',
  },
  model_unavailable: {
    icon: 'ri-cpu-line',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    title: '모델 사용 불가',
    hint: '선택한 AI 모델이 현재 사용 불가 상태이거나 점검 중입니다.',
    steps: [
      'Wan 2.5 또는 Kling v1으로 변경 후 시도',
      '잠시 후 다시 시도 (보통 수분 내 복구)',
      '다른 모델로 동일한 작업 진행 가능',
    ],
    canRetry: true,
    severity: 'warning',
  },
  rate_limit: {
    icon: 'ri-speed-line',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    title: 'API 요청 한도 초과',
    hint: '짧은 시간에 너무 많은 요청이 발생했습니다. 잠시 기다려주세요.',
    steps: [
      '1~2분 대기 후 재시도',
      '동시에 여러 생성 요청 자제',
      '요청이 계속 실패하면 관리자에게 문의',
    ],
    canRetry: true,
    severity: 'warning',
  },
  content_policy: {
    icon: 'ri-shield-check-line',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    title: '콘텐츠 정책 위반',
    hint: '입력한 프롬프트 또는 이미지가 AI 콘텐츠 정책에 위반될 수 있습니다.',
    steps: [
      '제품 설명을 더 중립적으로 수정',
      '업로드한 이미지 내용 확인',
      '다른 템플릿으로 변경 후 시도',
    ],
    canRetry: false,
    severity: 'error',
  },
  network: {
    icon: 'ri-wifi-off-line',
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/60',
    border: 'border-zinc-700/40',
    title: '네트워크 연결 오류',
    hint: '인터넷 연결이 불안정하거나 서버와의 통신이 실패했습니다.',
    steps: [
      '인터넷 연결 상태 확인',
      '페이지 새로고침 후 재시도',
      'VPN 사용 중이라면 해제 후 시도',
    ],
    canRetry: true,
    severity: 'warning',
  },
  unknown: {
    icon: 'ri-error-warning-line',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    title: '생성 실패',
    hint: '예상치 못한 오류가 발생했습니다.',
    steps: [
      '재시도 (대부분 해결됨)',
      '다른 모델로 변경 후 시도',
      '문제가 지속되면 진단 패널에서 상태 확인',
    ],
    canRetry: true,
    severity: 'error',
  },
};

// HTTP 상태 코드 → 사람이 읽기 쉬운 설명
function getHttpCodeLabel(msg: string): string | null {
  if (msg.includes('502')) return 'HTTP 502 — fal.ai 게이트웨이 오류';
  if (msg.includes('503')) return 'HTTP 503 — fal.ai 서비스 일시 중단';
  if (msg.includes('504')) return 'HTTP 504 — fal.ai 응답 시간 초과';
  if (msg.includes('500')) return 'HTTP 500 — fal.ai 내부 서버 오류';
  if (msg.includes('429')) return 'HTTP 429 — API 요청 한도 초과';
  if (msg.includes('401')) return 'HTTP 401 — API 키 인증 실패';
  if (msg.includes('403')) return 'HTTP 403 — API 키 권한 없음';
  if (msg.includes('422')) return 'HTTP 422 — 요청 파라미터 오류';
  if (msg.includes('402')) return 'HTTP 402 — 크레딧/결제 필요';
  return null;
}

// 모델 ID → 사람이 읽기 쉬운 이름
function getModelLabel(modelName?: string): string | null {
  if (!modelName) return null;
  if (modelName.includes('wan-25') || modelName.includes('wan25')) return 'Wan 2.5';
  if (modelName.includes('v3/pro') || modelName.includes('v3-pro')) return 'Kling 3.0 Pro';
  if (modelName.includes('v2.5-turbo') || modelName.includes('v25-turbo')) return 'Kling 2.5 Turbo';
  if (modelName.includes('v2.1') || modelName.includes('v2-pro')) return 'Kling v2';
  if (modelName.includes('v1.5')) return 'Kling v1.5';
  if (modelName.includes('veo3') || modelName.includes('veo-3')) return 'Veo 3 (Google)';
  if (modelName.includes('kling')) return 'Kling v1';
  if (modelName.includes('flux')) return 'FLUX Pro';
  return modelName;
}

const SEVERITY_BADGE: Record<string, { label: string; cls: string }> = {
  warning: { label: '주의', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  error:   { label: '오류', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  info:    { label: '안내', cls: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
};

export default function ErrorPanel({ errorType, errorMsg, genType, modelName, onRetry, onReset }: ErrorPanelProps) {
  const cfg = ERROR_CONFIG[errorType];
  const httpLabel = getHttpCodeLabel(errorMsg);
  const modelLabel = getModelLabel(modelName);
  const badge = SEVERITY_BADGE[cfg.severity];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6 overflow-y-auto">
      {/* 아이콘 + 심각도 배지 */}
      <div className="flex flex-col items-center gap-2">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
          <i className={`text-2xl ${cfg.icon} ${cfg.color}`} />
        </div>
        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* 제목 */}
      <div className="text-center">
        <p className="text-white font-black text-sm mb-1">{cfg.title}</p>
        <p className="text-zinc-400 text-xs leading-relaxed max-w-[260px]">{cfg.hint}</p>
      </div>

      {/* 상세 오류 정보 박스 */}
      <div className="w-full max-w-[280px] bg-zinc-900/80 border border-zinc-800/60 rounded-xl overflow-hidden">
        {/* 오류 메시지 */}
        <div className="px-3.5 py-2.5 border-b border-zinc-800/60">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-black mb-1">오류 상세</p>
          <p className="text-[11px] text-zinc-300 leading-relaxed break-words">{errorMsg}</p>
        </div>

        {/* HTTP 코드 / 모델 정보 */}
        {(httpLabel || modelLabel || genType) && (
          <div className="px-3.5 py-2 flex flex-wrap gap-x-4 gap-y-1">
            {httpLabel && (
              <div className="flex items-center gap-1.5">
                <i className="ri-code-line text-zinc-600 text-[10px]" />
                <span className="text-[10px] text-zinc-500">{httpLabel}</span>
              </div>
            )}
            {modelLabel && (
              <div className="flex items-center gap-1.5">
                <i className="ri-cpu-line text-zinc-600 text-[10px]" />
                <span className="text-[10px] text-zinc-500">모델: {modelLabel}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <i className={`text-[10px] text-zinc-600 ${genType === 'video' ? 'ri-movie-line' : 'ri-image-line'}`} />
              <span className="text-[10px] text-zinc-500">{genType === 'video' ? '영상 생성' : '이미지 생성'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 해결 방법 스텝 */}
      {cfg.steps && cfg.steps.length > 0 && (
        <div className="w-full max-w-[280px]">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-black mb-2">해결 방법</p>
          <div className="flex flex-col gap-1.5">
            {cfg.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5 ${cfg.bg} border ${cfg.border} ${cfg.color}`}>
                  {i + 1}
                </span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-col items-center gap-2 w-full max-w-[280px]">
        {cfg.canRetry && (
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500/20 to-orange-500/20 hover:from-rose-500/30 hover:to-orange-500/30 border border-rose-500/30 text-rose-300 text-xs font-black px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-refresh-line" /> 바로 재시도
          </button>
        )}
        {errorType === 'credits' && (
          <a
            href="/credit-purchase"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-300 text-xs font-black px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-copper-diamond-line" /> 크레딧 충전하기
          </a>
        )}
        <button
          onClick={onReset}
          className="w-full flex items-center justify-center gap-2 bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/[0.06] text-zinc-300 text-xs font-bold px-5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-arrow-left-line" /> 설정으로 돌아가기
        </button>
      </div>
    </div>
  );
}

export type { ErrorType };
