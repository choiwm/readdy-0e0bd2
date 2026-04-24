import { useEffect } from 'react';
import type { ShotCard } from '../types';
import { SHOT_TYPES, CREDITS_PER_CUT } from '../types';

interface ShotDetailPanelProps {
  shot: ShotCard; isPortrait: boolean; isSquare: boolean;
  onClose: () => void; onPromptChange: (id: string, p: string) => void;
  onShotTypeChange: (id: string, t: string) => void; onGenerate: (id: string) => void;
  onDownload: (shot: ShotCard) => void;
}

export default function ShotDetailPanel({ shot, isPortrait, isSquare, onClose, onPromptChange, onShotTypeChange, onGenerate, onDownload }: ShotDetailPanelProps) {
  const aspectClass = isPortrait ? 'aspect-[9/16]' : isSquare ? 'aspect-square' : 'aspect-video';
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-2xl bg-[#111113] border border-white/10 sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black bg-indigo-500/20 text-indigo-400 px-2.5 py-1 rounded-full">#{shot.index}</span>
            <span className="text-sm font-bold text-white">컷 편집</span>
          </div>
          <div className="flex items-center gap-2">
            {shot.imageUrl && <button onClick={() => onDownload(shot)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-700 border border-white/5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap"><i className="ri-download-2-line text-xs" /><span className="hidden sm:inline">다운로드</span></button>}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"><i className="ri-close-line" /></button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row overflow-y-auto">
          <div className={`relative bg-zinc-950 flex items-center justify-center flex-shrink-0 ${isPortrait ? 'w-full sm:w-48' : 'w-full sm:w-72'}`}>
            <div className={`${aspectClass} w-full`}>
              {shot.imageUrl ? <img src={shot.imageUrl} alt={`Shot ${shot.index}`} className="w-full h-full object-cover" />
                : shot.isGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950">
                    <div className="w-10 h-10 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300" style={{ width: `${shot.progress}%` }} /></div>
                    <span className="text-xs text-zinc-400 font-bold">{shot.progress}%</span>
                  </div>
                ) : <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950"><i className="ri-image-line text-zinc-700 text-3xl" /><span className="text-xs text-zinc-600">이미지 없음</span></div>}
            </div>
          </div>
          <div className="flex-1 p-4 sm:p-5 flex flex-col gap-3 sm:gap-4">
            <div>
              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">샷 타입</label>
              <div className="flex flex-wrap gap-1.5">
                {SHOT_TYPES.map((t) => (
                  <button key={t} onClick={() => onShotTypeChange(shot.id, t)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${shot.shotType === t ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-500 hover:text-white hover:border-white/10'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">프롬프트</label>
              <textarea value={shot.prompt} onChange={(e) => onPromptChange(shot.id, e.target.value)} placeholder="장면을 묘사하세요..." className="w-full bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 resize-none outline-none focus:border-indigo-500/30 transition-colors min-h-[80px] sm:min-h-[100px] leading-relaxed" />
            </div>
            {shot.error && <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl"><i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0" /><span className="text-xs text-red-400">{shot.error}</span></div>}
            <div className="flex gap-2">
              {shot.imageUrl && <button onClick={() => onDownload(shot)} className="flex items-center justify-center py-3 px-4 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 font-bold text-sm rounded-xl transition-all cursor-pointer"><i className="ri-download-2-line" /></button>}
              <button onClick={() => { onGenerate(shot.id); onClose(); }} disabled={shot.isGenerating} className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2">
                {shot.isGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</>
                  : shot.imageUrl ? <><i className="ri-refresh-line" /> 재생성 <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded-md font-black"><i className="ri-copper-diamond-line text-[10px]" /> {CREDITS_PER_CUT}</span></>
                  : <><i className="ri-sparkling-2-line" /> 이미지 생성 <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded-md font-black"><i className="ri-copper-diamond-line text-[10px]" /> {CREDITS_PER_CUT}</span></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
