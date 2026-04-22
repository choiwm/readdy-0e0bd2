import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  required: number;
  current: number;
  featureName?: string;
}

export default function InsufficientCreditsModal({
  isOpen,
  onClose,
  required,
  current,
  featureName,
}: InsufficientCreditsModalProps) {
  const navigate = useNavigate();
  const shortage = required - current;

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoCharge = () => {
    onClose();
    navigate('/credit-purchase');
  };

  // 추천 패키지 계산
  const recommendedPackage = (() => {
    if (shortage <= 500) return { name: 'Starter', credits: 500, price: '₩6,900' };
    if (shortage <= 1500) return { name: 'Basic', credits: 1500, price: '₩17,900' };
    return { name: 'Pro', credits: 4000, price: '₩41,900' };
  })();

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'modalSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          {/* Icon */}
          <div className="relative mx-auto w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-2xl bg-rose-500/10 border border-rose-500/20 animate-pulse" />
            <div className="relative w-full h-full rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
              <i className="ri-copper-diamond-line text-rose-400 text-2xl" />
            </div>
          </div>

          <h3 className="text-lg font-black text-white mb-1">크레딧이 부족해요</h3>
          {featureName && (
            <p className="text-xs text-zinc-500 mb-3">
              <span className="text-zinc-400 font-bold">{featureName}</span> 기능을 사용하려면 크레딧이 필요합니다
            </p>
          )}
          {!featureName && (
            <p className="text-xs text-zinc-500 mb-3">이 기능을 사용하려면 크레딧을 충전해 주세요</p>
          )}
        </div>

        {/* Credit status */}
        <div className="mx-6 mb-4 rounded-2xl bg-zinc-900/80 border border-white/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-center flex-1">
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-1">필요</p>
              <div className="flex items-center justify-center gap-1">
                <i className="ri-copper-diamond-line text-rose-400 text-sm" />
                <span className="text-xl font-black text-rose-400">{required}</span>
                <span className="text-xs text-zinc-500">CR</span>
              </div>
            </div>

            <div className="w-px h-10 bg-white/5" />

            <div className="text-center flex-1">
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-1">보유</p>
              <div className="flex items-center justify-center gap-1">
                <i className="ri-copper-diamond-line text-zinc-500 text-sm" />
                <span className="text-xl font-black text-zinc-400">{current}</span>
                <span className="text-xs text-zinc-600">CR</span>
              </div>
            </div>

            <div className="w-px h-10 bg-white/5" />

            <div className="text-center flex-1">
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-1">부족</p>
              <div className="flex items-center justify-center gap-1">
                <i className="ri-subtract-line text-amber-400 text-sm" />
                <span className="text-xl font-black text-amber-400">{shortage}</span>
                <span className="text-xs text-zinc-500">CR</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all"
              style={{ width: `${Math.min((current / required) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-zinc-700">0</span>
            <span className="text-[9px] text-zinc-700">{required} CR 필요</span>
          </div>
        </div>

        {/* Recommended package */}
        <div className="mx-6 mb-5">
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-2">추천 충전 패키지</p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <i className="ri-copper-diamond-line text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-white">{recommendedPackage.name} 패키지</p>
              <p className="text-[10px] text-zinc-500">
                {recommendedPackage.credits.toLocaleString()} CR · {recommendedPackage.price}
              </p>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
              <i className="ri-check-line text-emerald-400 text-[10px]" />
              <span className="text-[10px] font-bold text-emerald-400">충분</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2.5">
          <button
            onClick={handleGoCharge}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-black text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <i className="ri-copper-diamond-line" />
            크레딧 충전하러 가기
            <i className="ri-arrow-right-line text-xs opacity-70" />
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-zinc-400 hover:text-white font-bold text-sm rounded-2xl transition-all cursor-pointer whitespace-nowrap"
          >
            나중에
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
