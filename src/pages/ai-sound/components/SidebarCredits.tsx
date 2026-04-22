// ── SidebarCredits — 사이드바 크레딧 블록 공통 컴포넌트 ──────────────────
import { useNavigate } from 'react-router-dom';

interface SidebarCreditsProps {
  credits: number;
  maxCredits: number;
}

export default function SidebarCredits({ credits, maxCredits }: SidebarCreditsProps) {
  const navigate = useNavigate();
  const pct = Math.min((credits / maxCredits) * 100, 100);
  const isLow = pct <= 20;
  const isMid = pct > 20 && pct <= 50;
  const barColor =
    pct > 50 ? 'from-indigo-500 to-violet-500' :
    isMid    ? 'from-amber-500 to-orange-500' :
               'from-red-500 to-rose-500';

  const statusColor = isLow ? 'text-rose-400' : isMid ? 'text-amber-400' : 'text-indigo-400';
  const containerBorder = isLow ? 'border-rose-500/20' : 'border-white/5';

  return (
    <div className={`p-3 md:p-4 rounded-2xl bg-black/40 border ${containerBorder} transition-colors`}>
      <div className="flex justify-between items-center mb-2.5 md:mb-3">
        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">보유 크레딧</span>
        <span className={`text-xs font-mono flex items-center gap-1 font-bold ${statusColor}`}>
          {credits.toLocaleString()} <i className="ri-copper-diamond-line" />
        </span>
      </div>
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 mb-2.5">
        <span className="text-[9px] text-zinc-700">0</span>
        <span className="text-[9px] text-zinc-700">{maxCredits === Infinity ? '∞' : maxCredits}</span>
      </div>

      {/* 크레딧 부족 경고 + 충전 버튼 */}
      {isLow && (
        <button
          onClick={() => navigate('/credit-purchase')}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer group"
        >
          <i className="ri-copper-diamond-line text-rose-400 text-xs" />
          <span className="text-[10px] font-black text-rose-400 group-hover:text-rose-300 transition-colors">
            크레딧 충전하기
          </span>
          <i className="ri-arrow-right-line text-rose-400/60 text-[10px]" />
        </button>
      )}
      {isMid && (
        <button
          onClick={() => navigate('/credit-purchase')}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-amber-500/8 border border-amber-500/15 hover:bg-amber-500/15 transition-all cursor-pointer group"
        >
          <i className="ri-copper-diamond-line text-amber-400 text-[10px]" />
          <span className="text-[10px] font-bold text-amber-400/80 group-hover:text-amber-300 transition-colors">
            크레딧 충전
          </span>
        </button>
      )}
    </div>
  );
}
