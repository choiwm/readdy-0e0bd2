// ── GenerateBtn — 생성 버튼 공통 컴포넌트 ────────────────────────────────
// 모든 패널의 생성 버튼을 동일한 스타일로 통일

interface GenerateBtnProps {
  onClick: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  label: string;
  generatingLabel?: string;
  creditCost?: number;
  /** 취소 버튼 표시 여부 */
  onCancel?: () => void;
  /** 버튼 크기: 'md' | 'lg' (기본 lg) */
  size?: 'md' | 'lg';
}

export default function GenerateBtn({
  onClick,
  disabled = false,
  isGenerating = false,
  label,
  generatingLabel,
  creditCost,
  onCancel,
  size = 'lg',
}: GenerateBtnProps) {
  const px = size === 'lg' ? 'px-10' : 'px-6';
  const py = size === 'lg' ? 'py-3' : 'py-2.5';
  const text = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className="flex items-center justify-center gap-3">
      {isGenerating && onCancel && (
        <button
          onClick={onCancel}
          className={`flex items-center gap-2 ${px} ${py} rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold ${text} transition-all cursor-pointer whitespace-nowrap`}
        >
          <i className="ri-stop-circle-line" /> 취소
        </button>
      )}
      <button
        onClick={onClick}
        disabled={disabled || isGenerating}
        className={`flex items-center gap-2 ${px} ${py} bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold ${text} rounded-xl transition-all cursor-pointer whitespace-nowrap`}
      >
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {generatingLabel ?? '생성 중...'}
          </>
        ) : (
          <>
            <i className="ri-sparkling-2-line" />
            {label}
            {creditCost !== undefined && creditCost > 0 && (
              <span className="flex items-center gap-0.5 bg-white/20 px-2 py-0.5 rounded-md text-xs font-black">
                <i className="ri-copper-diamond-line text-xs" /> {creditCost}
              </span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
