import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ShotCard } from '../types';
import { SHOT_TYPES, CREDITS_PER_CUT } from '../types';

interface ShotCardItemProps {
  shot: ShotCard; isPortrait: boolean; isSquare: boolean;
  onPromptChange: (id: string, p: string) => void; onShotTypeChange: (id: string, t: string) => void;
  onGenerate: (id: string) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void;
  onOpenDetail: (id: string) => void; onDownload: (shot: ShotCard) => void; isDragging?: boolean;
  dragOverIndex?: number | null;
}

export default function ShotCardItem({ shot, isPortrait, isSquare, onPromptChange, onShotTypeChange, onGenerate, onDelete, onDuplicate, onOpenDetail, onDownload, isDragging = false }: ShotCardItemProps) {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const aspectClass = isPortrait ? 'aspect-[9/16]' : isSquare ? 'aspect-square' : 'aspect-video';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging, isOver } = useSortable({ id: shot.id });
  const style = { transform: CSS.Transform.toString(transform), transition: transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)', opacity: isSortableDragging ? 0 : 1, zIndex: isSortableDragging ? 50 : undefined };
  const stopGen = (e: React.MouseEvent) => { e.stopPropagation(); onGenerate(shot.id); };
  const stopDl = (e: React.MouseEvent) => { e.stopPropagation(); onDownload(shot); };

  return (
    <div ref={setNodeRef} style={style} className={`bg-[#1a1a1e] border rounded-xl overflow-visible group flex flex-col relative ${isSortableDragging ? 'border-indigo-500/40' : isOver ? 'border-indigo-400/60 ring-2 ring-indigo-400/20 bg-indigo-500/5' : isDragging ? 'border-indigo-500/50 ring-2 ring-indigo-500/30' : 'border-zinc-700/40 hover:border-zinc-600/60'} transition-colors duration-150`}>
      {isOver && !isSortableDragging && <div className="absolute -top-0.5 left-0 right-0 h-0.5 bg-indigo-400 rounded-full z-10" />}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-700/30 flex-shrink-0">
        <div className="flex items-center gap-1">
          <div {...attributes} {...listeners} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-grab active:cursor-grabbing touch-none select-none"><i className="ri-draggable text-sm" /></div>
          <span className="text-[10px] font-black text-zinc-500">#{shot.index}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {shot.imageUrl && (
            <button onClick={stopDl} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              <i className="ri-download-2-line text-[10px]" />
            </button>
          )}
          <div className="relative">
            <button onClick={(e) => { e.stopPropagation(); setShowTypeDropdown(!showTypeDropdown); }} className="flex items-center gap-0.5 text-[9px] text-zinc-500 hover:text-white bg-zinc-800/60 px-1 py-0.5 rounded-md transition-all cursor-pointer whitespace-nowrap border border-zinc-700/40 hover:border-zinc-600/60 max-w-[60px] sm:max-w-none">
              <i className="ri-camera-line text-[8px]" />
              <span className="truncate hidden sm:inline">{shot.shotType}</span>
              <i className="ri-arrow-down-s-line text-[8px]" />
            </button>
            {showTypeDropdown && (
              <div className="absolute top-full right-0 mt-1 w-36 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {SHOT_TYPES.map((t) => (
                  <button key={t} onClick={() => { onShotTypeChange(shot.id, t); setShowTypeDropdown(false); }} className={`w-full text-left px-3 py-2 text-[11px] transition-colors cursor-pointer flex items-center justify-between ${shot.shotType === t ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}>
                    {t}{shot.shotType === t && <i className="ri-check-line text-indigo-400 text-[9px]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={(e) => { e.stopPropagation(); onDuplicate(shot.id); }} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"><i className="ri-file-copy-line text-[10px]" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(shot.id); }} className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer opacity-0 group-hover:opacity-100"><i className="ri-close-line text-[10px]" /></button>
          </div>
        </div>
      </div>
      <div className={`relative ${aspectClass} bg-zinc-950 overflow-hidden cursor-pointer flex-shrink-0`} onClick={() => onOpenDetail(shot.id)}>
        {shot.imageUrl ? (
          <>
            <img src={shot.imageUrl} alt={`Shot ${shot.index}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 sm:gap-2">
              <button onClick={stopGen} className="flex items-center gap-1.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-600/60 text-white text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-700/90 transition-all"><i className="ri-refresh-line text-xs" /> 재생성</button>
              <button onClick={(e) => { e.stopPropagation(); onOpenDetail(shot.id); }} className="flex items-center gap-1.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-600/60 text-white text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-700/90 transition-all"><i className="ri-edit-line text-xs" /> 편집</button>
              <button onClick={(e) => { e.stopPropagation(); onDuplicate(shot.id); }} className="flex items-center gap-1.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-600/60 text-white text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all"><i className="ri-file-copy-line text-xs" /> 복제</button>
              <button onClick={stopDl} className="flex items-center gap-1.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-600/60 text-white text-[11px] font-bold px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-700/90 transition-all"><i className="ri-download-2-line text-xs" /> 다운로드</button>
            </div>
          </>
        ) : shot.isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-zinc-950">
            <div className="relative w-10 h-10"><div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full" /><div className="absolute inset-0 border-2 border-transparent border-t-indigo-400 rounded-full animate-spin" /><div className="absolute inset-0 flex items-center justify-center"><i className="ri-sparkling-2-line text-indigo-400 text-xs" /></div></div>
            <div className="w-20 h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-200" style={{ width: `${shot.progress}%` }} /></div>
            <span className="text-[10px] text-zinc-500 font-mono">{shot.progress}%</span>
          </div>
        ) : shot.error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 p-3">
            <i className="ri-error-warning-line text-red-400 text-xl" /><span className="text-[10px] text-red-400 text-center leading-tight">{shot.error}</span>
            <button onClick={stopGen} className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer mt-1">다시 시도</button>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950 group/empty">
            <div className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700/40 flex items-center justify-center group-hover/empty:bg-indigo-500/10 group-hover/empty:border-indigo-500/20 transition-all"><i className="ri-image-line text-zinc-600 group-hover/empty:text-indigo-400 text-base transition-colors" /></div>
            <span className="text-[10px] text-zinc-600 group-hover/empty:text-zinc-400 transition-colors">이미지 생성 대기</span>
            <button onClick={stopGen} className="opacity-0 group-hover/empty:opacity-100 flex items-center gap-1 text-[10px] text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg cursor-pointer transition-all hover:bg-indigo-500/20"><i className="ri-sparkling-2-line text-[9px]" /> 생성</button>
          </div>
        )}
        {shot.imageUrl && !shot.isGenerating && <div className="absolute top-1.5 left-1.5"><span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">완료</span></div>}
      </div>
      <div className="px-2 pt-1.5 pb-1.5 flex-1 flex flex-col gap-1">
        <textarea value={shot.prompt} onChange={(e) => onPromptChange(shot.id, e.target.value)} placeholder="프롬프트를 입력하세요..." className="w-full bg-transparent text-[11px] text-zinc-400 placeholder-zinc-700 resize-none outline-none leading-relaxed min-h-[32px] max-h-[52px]" rows={2} onClick={(e) => e.stopPropagation()} />
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-zinc-700">{shot.prompt.length > 0 ? `${shot.prompt.length}자` : ''}</span>
          <button onClick={stopGen} disabled={shot.isGenerating} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${shot.imageUrl ? 'text-zinc-500 hover:text-white hover:bg-zinc-800/60' : 'text-indigo-400 hover:bg-indigo-500/10 bg-indigo-500/5 border border-indigo-500/20'}`}>
            {shot.isGenerating ? <div className="w-2.5 h-2.5 border border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> : <i className={`${shot.imageUrl ? 'ri-refresh-line' : 'ri-sparkling-2-line'} text-[10px]`} />}
            {shot.isGenerating ? '생성 중' : shot.imageUrl ? '재생성' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
