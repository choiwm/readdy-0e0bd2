import { useEffect } from 'react';
import type { ShotCard } from '../types';

interface GenerateAllModalProps { shots: ShotCard[]; totalCount: number; onCancel: () => void; onClose: () => void; }

export default function GenerateAllModal({ shots, totalCount, onCancel, onClose }: GenerateAllModalProps) {
  const completed = shots.filter((s) => s.imageUrl && !s.isGenerating).length;
  const generating = shots.filter((s) => s.isGenerating).length;
  const failed = shots.filter((s) => s.error).length;
  const pending = shots.filter((s) => !s.imageUrl && !s.isGenerating && !s.error).length;
  const overallProgress = totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;
  const isDone = completed + failed >= totalCount;

  useEffect(() => { if (isDone) { const t = setTimeout(onClose, 1800); return () => clearTimeout(t); } return undefined; }, [isDone, onClose]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isDone) onCancel(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onCancel, isDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${isDone ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
              {isDone ? <i className="ri-check-line text-emerald-400 text-sm" /> : <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />}
            </div>
            <div><p className="text-sm font-bold text-white">{isDone ? '생성 완료!' : '전체 컷 생성 중...'}</p><p className="text-[11px] text-zinc-500">{isDone ? `${completed}개 완료${failed > 0 ? `, ${failed}개 실패` : ''}` : `${completed} / ${totalCount}개 완료`}</p></div>
          </div>
          {!isDone && <button onClick={onCancel} className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-red-400 bg-zinc-800/60 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap"><i className="ri-stop-circle-line text-xs" /> 취소</button>}
        </div>
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2"><span className="text-[11px] font-black text-zinc-500 uppercase tracking-wider">전체 진행률</span><span className={`text-sm font-black ${isDone ? 'text-emerald-400' : 'text-indigo-400'}`}>{overallProgress}%</span></div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} style={{ width: `${overallProgress}%` }} /></div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-400" /><span className="text-[11px] text-zinc-400 font-bold">{completed} 완료</span></div>
            {generating > 0 && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /><span className="text-[11px] text-zinc-400 font-bold">{generating} 생성 중</span></div>}
            {pending > 0 && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-600" /><span className="text-[11px] text-zinc-400 font-bold">{pending} 대기</span></div>}
            {failed > 0 && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-[11px] text-zinc-400 font-bold">{failed} 실패</span></div>}
          </div>
        </div>
        <div className="px-5 pb-4 max-h-[280px] overflow-y-auto space-y-1.5">
          {shots.map((shot) => {
            const isGen = shot.isGenerating; const isDone2 = !!shot.imageUrl && !isGen; const isErr = !!shot.error; const isPend = !isDone2 && !isGen && !isErr;
            return (
              <div key={shot.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${isDone2 ? 'bg-emerald-500/5 border-emerald-500/15' : isGen ? 'bg-indigo-500/8 border-indigo-500/20' : isErr ? 'bg-red-500/5 border-red-500/15' : 'bg-zinc-900/40 border-white/5'}`}>
                <div className="w-10 h-6 rounded-md overflow-hidden flex-shrink-0 bg-zinc-800">
                  {shot.imageUrl ? <img src={shot.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className={`text-[10px] ${isGen ? 'ri-loader-4-line text-indigo-400 animate-spin' : isErr ? 'ri-error-warning-line text-red-400' : 'ri-image-line text-zinc-600'}`} /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-[11px] font-black text-zinc-400">#{shot.index}</span>{shot.prompt && <span className="text-[11px] text-zinc-600 truncate">{shot.prompt.slice(0, 30)}</span>}</div>
                  {isGen && <div className="mt-1 w-full h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-200" style={{ width: `${shot.progress}%` }} /></div>}
                </div>
                <div className="flex-shrink-0">
                  {isDone2 && <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"><i className="ri-check-line text-[9px]" /> 완료</span>}
                  {isGen && <span className="flex items-center gap-1 text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full"><span className="font-mono">{shot.progress}%</span></span>}
                  {isErr && <span className="flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full"><i className="ri-error-warning-line text-[9px]" /> 실패</span>}
                  {isPend && <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800/60 px-2 py-0.5 rounded-full">대기</span>}
                </div>
              </div>
            );
          })}
        </div>
        {isDone && <div className="px-5 pb-5"><div className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><i className="ri-check-double-line text-emerald-400" /><span className="text-sm font-bold text-emerald-400">모두 완료! 잠시 후 자동으로 닫힙니다</span></div></div>}
      </div>
    </div>
  );
}
