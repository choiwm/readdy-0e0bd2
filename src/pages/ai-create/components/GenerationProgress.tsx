// ── 공통 GenerationProgress 컴포넌트 ──────────────────────────────────────
// AngleView, LookView 양쪽에서 사용하는 단계별 진행 표시 컴포넌트

export interface ProgressStep {
  id: string;
  label: string;
  icon: string;
}

interface GenerationProgressProps {
  steps: ProgressStep[];
  currentStep: string;
  /** 진행 중 색상 (tailwind class, 기본: indigo) */
  activeColor?: string;
  /** 진행 중 바 색상 (tailwind class, 기본: bg-indigo-500) */
  activeBarColor?: string;
}

export default function GenerationProgress({
  steps,
  currentStep,
  activeColor = 'bg-indigo-500/20 text-indigo-400',
  activeBarColor = 'bg-indigo-500',
}: GenerationProgressProps) {
  const stepIds = steps.map((s) => s.id);
  const currentIdx = stepIds.indexOf(currentStep);

  return (
    <div className="flex flex-col gap-3 w-full">
      {steps.map((s, idx) => {
        const isDone = idx < currentIdx;
        const isActive = s.id === currentStep;
        return (
          <div key={s.id} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
              isDone
                ? 'bg-emerald-500/20 text-emerald-400'
                : isActive
                ? activeColor
                : 'bg-zinc-800 text-zinc-600'
            }`}>
              {isDone ? (
                <i className="ri-check-line text-sm" />
              ) : isActive ? (
                <i className={`${s.icon} text-sm animate-pulse`} />
              ) : (
                <i className={`${s.icon} text-sm`} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${
                  isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-zinc-600'
                }`}>{s.label}</span>
                {isDone && <span className="text-[10px] text-emerald-400">완료</span>}
                {isActive && (
                  <span className={`text-[10px] animate-pulse ${
                    activeColor.includes('amber') ? 'text-amber-400' : 'text-indigo-400'
                  }`}>처리 중...</span>
                )}
              </div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  isDone
                    ? 'w-full bg-emerald-500'
                    : isActive
                    ? `w-2/3 ${activeBarColor} animate-pulse`
                    : 'w-0'
                }`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
