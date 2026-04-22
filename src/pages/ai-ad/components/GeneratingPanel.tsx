import { useEffect, useRef, useState } from 'react';

interface GeneratingPanelProps {
  genType: 'image' | 'video';
  genState: 'uploading' | 'generating';
  genStep: string;
  genProgress: number;
  hasProductImages: boolean;
  productImageCount: number;
  onForceCancel?: () => void;
}

export default function GeneratingPanel({
  genType,
  genState,
  genStep,
  genProgress,
  hasProductImages,
  productImageCount,
  onForceCancel,
}: GeneratingPanelProps) {
  const [elapsedSec, setElapsedSec] = useState(0);
  // 전체 생성 시작 시간 (uploading 포함) — 컴포넌트 마운트 시 고정
  const startRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 컴포넌트 마운트 시 한 번만 타이머 시작 (genState 변경 시 리셋 안 함)
    startRef.current = Date.now();
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 의도적으로 빈 deps — 마운트 시 한 번만 실행

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  const expectedTime =
    genType === 'video' && hasProductImages
      ? '약 2~4분'
      : genType === 'video'
      ? '약 1~3분'
      : '약 30~60초';

  if (genState === 'uploading') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-zinc-950">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
          <div className="absolute inset-0 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="ri-upload-cloud-2-line text-rose-400 text-2xl" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-black text-base mb-1">제품 이미지 업로드 중...</p>
          <p className="text-zinc-400 text-sm">{productImageCount}개 이미지를 AI 서버에 전송하고 있어요</p>
        </div>
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
          <i className="ri-information-line text-rose-400 text-sm" />
          <p className="text-xs text-rose-300">업로드 완료 후 AI 생성이 시작됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-zinc-950 px-8">
      {/* 스피너 */}
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
        <div className="absolute inset-0 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin" />
        <div
          className="absolute inset-2 rounded-full border border-orange-500/20 border-t-orange-400 animate-spin"
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-sm font-black">{Math.round(genProgress)}%</span>
        </div>
      </div>

      {/* 제목 + 단계 */}
      <div className="text-center">
        <p className="text-white font-black text-base mb-1">
          {genType === 'image' ? 'AI 광고 이미지 생성 중...' : 'AI 광고 영상 생성 중...'}
        </p>
        <p className="text-zinc-400 text-sm">{genStep}</p>
        {hasProductImages && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold px-3 py-1.5 rounded-full">
            <i className="ri-image-2-line text-xs" />
            제품 이미지 {productImageCount}장 반영 중
          </div>
        )}
      </div>

      {/* 프로그레스 바 */}
      <div className="w-72 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-rose-500 to-orange-500 rounded-full transition-all duration-200"
          style={{ width: `${genProgress}%` }}
        />
      </div>

      {/* 경과 시간 + 예상 시간 */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <i className="ri-time-line text-zinc-600" />
          <span>경과: <span className="text-zinc-300 font-black">{formatElapsed(elapsedSec)}</span></span>
        </div>
        <div className="w-px h-3 bg-zinc-700" />
        <div className="flex items-center gap-1.5 text-zinc-500">
          <i className="ri-hourglass-line text-zinc-600" />
          <span>예상: <span className="text-zinc-300 font-black">{expectedTime}</span></span>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="w-full max-w-xs bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3 text-center">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          {genType === 'video' && hasProductImages
            ? '제품 이미지 → 광고 이미지 → 영상 순서로 생성됩니다.\nAPI 처리 시간에 따라 더 걸릴 수 있어요.'
            : genType === 'video'
            ? 'AI가 영상을 렌더링하고 있습니다.\n창을 닫지 말고 잠시 기다려주세요.'
            : 'AI가 광고 이미지를 생성하고 있습니다.\n잠시만 기다려주세요.'}
        </p>
      </div>

      {/* 오래 걸릴 때 추가 안내 (5분 이상) */}
      {elapsedSec >= 300 && (
        <div className="w-full max-w-xs bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <i className="ri-information-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-amber-400 font-black mb-0.5">생성이 오래 걸리고 있어요</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                fal.ai 서버 혼잡으로 대기 중일 수 있어요. 최대 15분까지 자동으로 기다립니다. 창을 닫지 마세요.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 10분 이상 경과 시 추가 경고 + 강제 취소 버튼 */}
      {elapsedSec >= 600 && (
        <div className="w-full max-w-xs bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2 mb-2.5">
            <i className="ri-alert-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] text-red-400 font-black mb-0.5">비정상적으로 오래 걸리고 있어요</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                20분 후 자동으로 타임아웃 처리됩니다. 지금 취소하면 크레딧이 환불됩니다.
              </p>
            </div>
          </div>
          {onForceCancel && (
            <button
              onClick={onForceCancel}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-[11px] font-black transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-stop-circle-line text-xs" /> 지금 취소하고 크레딧 환불받기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
