import { useEffect, useRef, type FC } from 'react';

const steps = [
  { id: 1, label: '설정',   icon: 'ri-settings-3-line' },
  { id: 2, label: '대본',   icon: 'ri-file-text-line' },
  { id: 3, label: '음성',   icon: 'ri-mic-line' },
  { id: 4, label: '이미지', icon: 'ri-image-line' },
  { id: 5, label: '영상',   icon: 'ri-movie-line' },
  { id: 6, label: '자막',   icon: 'ri-closed-captioning-line' },
];

interface StepIndicatorProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const StepIndicator: FC<StepIndicatorProps> = ({ currentStep, onStepClick }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const elLeft = el.offsetLeft;
      const elWidth = el.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollTarget = elLeft - containerWidth / 2 + elWidth / 2;
      container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  }, [currentStep]);

  return (
    <>
      {/* ── Desktop: 슬림 pill 스타일 ── */}
      <div className="hidden sm:flex items-center w-full gap-0.5">
        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => onStepClick?.(step.id)}
                disabled={!isCompleted && !isActive}
                title={step.label}
                className={`
                  flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all min-w-0 flex-shrink-0
                  ${isActive
                    ? 'bg-indigo-500/20 border border-indigo-500/40 cursor-pointer'
                    : isCompleted
                    ? 'bg-transparent border border-transparent cursor-pointer hover:bg-white/5'
                    : 'bg-transparent border border-transparent cursor-default'
                  }
                `}
              >
                {/* 번호 or 체크 */}
                <div
                  className={`
                    w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0 transition-all
                    ${isActive
                      ? 'bg-indigo-500 text-white'
                      : isCompleted
                      ? 'bg-indigo-500/25 text-indigo-400'
                      : 'bg-zinc-800 text-zinc-600'
                    }
                  `}
                >
                  {isCompleted
                    ? <i className="ri-check-line text-[8px]" />
                    : <span>{step.id}</span>
                  }
                </div>

                {/* 라벨 — 활성 스텝만 표시 */}
                {isActive && (
                  <span className="text-[10px] font-bold text-indigo-300 whitespace-nowrap leading-none">
                    {step.label}
                  </span>
                )}
              </button>

              {/* 연결선 */}
              {!isLast && (
                <div className="flex-1 mx-0.5">
                  <div
                    className={`h-px transition-all ${
                      isCompleted ? 'bg-indigo-500/35' : 'bg-zinc-800'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile: 가로 스크롤 스텝 바 ── */}
      <div
        ref={scrollRef}
        className="sm:hidden flex items-center overflow-x-auto scrollbar-none gap-0 -mx-3 px-3"
      >
        {steps.map((step, idx) => {
          const isCompleted = step.id < currentStep;
          const isActive = step.id === currentStep;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <button
                ref={isActive ? activeRef : undefined}
                onClick={() => onStepClick?.(step.id)}
                disabled={!isCompleted && !isActive}
                className={`flex items-center gap-1 py-0.5 transition-all flex-shrink-0 ${
                  !isCompleted && !isActive ? 'cursor-default' : 'cursor-pointer'
                } ${isActive ? 'px-2' : 'px-1'}`}
              >
                <div
                  className={`flex items-center justify-center rounded-full font-black flex-shrink-0 transition-all ${
                    isActive
                      ? 'w-4 h-4 bg-indigo-500 text-white text-[9px]'
                      : isCompleted
                      ? 'w-3.5 h-3.5 bg-indigo-500/25 text-indigo-400 text-[8px]'
                      : 'w-3.5 h-3.5 bg-zinc-800 text-zinc-600 text-[8px]'
                  }`}
                >
                  {isCompleted
                    ? <i className="ri-check-line text-[7px]" />
                    : step.id
                  }
                </div>
                {isActive && (
                  <span className="text-[10px] font-bold text-indigo-300 whitespace-nowrap leading-none">
                    {step.label}
                  </span>
                )}
              </button>

              {!isLast && (
                <div className={`w-3 h-px flex-shrink-0 transition-all ${
                  isCompleted ? 'bg-indigo-500/35' : 'bg-zinc-800'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default StepIndicator;
