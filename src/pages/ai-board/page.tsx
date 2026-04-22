import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavbar from '@/components/feature/AppNavbar';
import ExportModal from './components/ExportModal';
import SidebarContent from './components/SidebarContent';
import ConfirmModal from '@/components/base/ConfirmModal';
import { Toast } from '@/components/base/Toast';
import { useBoardProjects } from './hooks/useBoardProjects';
import SfxPickerModal from '@/components/feature/SfxPickerModal';
import { useSfxStore, useSfxStoreListener, SfxItem } from '@/hooks/useSfxStore';
import { useCredits as useGlobalCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { SUPABASE_URL } from '@/lib/env';

import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, DragMoveEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, rectSortingStrategy, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ReferenceSlot { id: string; label: string; icon: string; imageUrl: string | null; }
interface ShotCard { id: string; index: number; imageUrl: string | null; prompt: string; shotType: string; isGenerating: boolean; progress: number; error: string | null; }
interface Project { id: string; title: string; aspectRatio: string; model: string; resolution: string; outputMode: 'image' | 'video'; shots: ShotCard[]; refSlots: ReferenceSlot[]; }

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'];
const CUT_COUNTS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];

interface ModelOption {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  description: string;
  speed: string;
}

const MODELS: ModelOption[] = [
  { id: 'Flux Realism', label: 'Flux Realism', badge: 'Fast', badgeColor: 'emerald', description: '사실적인 인물·장면 표현에 최적화. 빠른 생성 속도.', speed: '~15s' },
  { id: 'Flux Pro', label: 'Flux Pro', badge: 'Balanced', badgeColor: 'indigo', description: '품질과 속도의 균형. 다양한 스타일 지원.', speed: '~25s' },
  { id: 'Flux Pro Ultra', label: 'Flux Pro Ultra', badge: 'Best Quality', badgeColor: 'amber', description: '최고 품질 출력. 세밀한 디테일과 품질 높은 색감.', speed: '~45s' },
];

const RESOLUTIONS = ['1K', '2K', '4K'];
const SHOT_TYPES = ['Wide Shot', 'Medium Shot', 'Close Up', 'Over Shoulder', 'Two Shot', 'POV', 'Aerial', 'Tracking'];
const CREDITS_PER_CUT = 3;

function createEmptyShot(index: number): ShotCard {
  return { id: `shot-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`, index, imageUrl: null, prompt: '', shotType: 'Wide Shot', isGenerating: false, progress: 0, error: null };
}

async function generateShotImage(prompt: string, shotType: string, aspectRatio: string, model: string, supabaseFnUrl: string): Promise<string> {
  const res = await fetch(supabaseFnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt.trim() || '', model, mode: 'storyboard', aspectRatio, shotType }),
  });
  if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error ?? `HTTP ${res.status}`); }
  const data = await res.json();
  if (!data.imageUrl) throw new Error(data.error ?? '이미지 URL을 받지 못했습니다');
  return data.imageUrl;
}

async function downloadSingleImage(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = objUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(objUrl);
  } catch {
    const a = document.createElement('a'); a.href = url; a.download = filename; a.target = '_blank';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
}

const defaultRefSlots: ReferenceSlot[] = [
  { id: 'char1', label: '캐릭터 1', icon: 'ri-user-line', imageUrl: null },
  { id: 'char2', label: '캐릭터 2', icon: 'ri-user-line', imageUrl: null },
  { id: 'char3', label: '캐릭터 3', icon: 'ri-user-line', imageUrl: null },
  { id: 'bg1', label: '배경', icon: 'ri-map-pin-line', imageUrl: null },
];

// 로컬 useCredits 제거 — 전역 useGlobalCredits 사용

function UnsavedChangesModal({ projectTitle, onSave, onDiscard, onCancel, isSaving }: { projectTitle: string; onSave: () => void; onDiscard: () => void; onCancel: () => void; isSaving: boolean; }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-sm bg-[#111113] border border-white/10 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 flex-shrink-0"><i className="ri-save-3-line text-amber-400 text-lg" /></div>
            <div><p className="text-sm font-bold text-white">미저장 변경사항</p><p className="text-[11px] text-zinc-500 truncate max-w-[180px]">{projectTitle}</p></div>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed mb-5">이 프로젝트에 저장되지 않은 변경사항이 있습니다.<br /><span className="text-amber-400 font-bold">다른 프로젝트로 이동하기 전에 저장하시겠습니까?</span></p>
          <div className="flex flex-col gap-2">
            <button onClick={onSave} disabled={isSaving} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap">
              {isSaving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</> : <><i className="ri-save-line text-sm" /> 저장하고 이동</>}
            </button>
            <button onClick={onDiscard} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 font-bold text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap">버리고 이동</button>
            <button onClick={onCancel} className="w-full py-2 text-zinc-600 hover:text-zinc-400 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">취소</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CutCountConfirmModal({ currentCount, newCount, onConfirm, onCancel }: { currentCount: number; newCount: number; onConfirm: () => void; onCancel: () => void; }) {
  const isReducing = newCount < currentCount;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-sm bg-[#111113] border border-white/10 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isReducing ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-indigo-500/10 border border-indigo-500/20'}`}>
              <i className={`${isReducing ? 'ri-error-warning-line text-amber-400' : 'ri-film-line text-indigo-400'} text-lg`} />
            </div>
            <div><p className="text-sm font-bold text-white">컷 수 변경</p><p className="text-[11px] text-zinc-500">{currentCount}컷 → {newCount}컷</p></div>
          </div>
          {isReducing ? <p className="text-sm text-zinc-300 leading-relaxed mb-5">컷 수를 줄이면 <strong className="text-amber-400">뒤쪽 {currentCount - newCount}개 컷이 삭제</strong>됩니다. 계속하시겠습니까?</p>
            : <p className="text-sm text-zinc-300 leading-relaxed mb-5"><strong className="text-indigo-400">{newCount - currentCount}개의 빈 컷</strong>이 추가됩니다.</p>}
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 font-bold text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap">취소</button>
            <button onClick={onConfirm} className={`flex-1 py-2.5 font-bold text-sm rounded-xl transition-all cursor-pointer text-white ${isReducing ? 'bg-amber-500 hover:bg-amber-400' : 'bg-indigo-500 hover:bg-indigo-400'}`}>{isReducing ? '삭제하고 변경' : '컷 추가'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefSlot({ slot, onUpload }: { slot: ReferenceSlot; onUpload: (id: string, url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div onClick={() => inputRef.current?.click()} className="flex-shrink-0 w-[80px] h-[80px] rounded-xl border border-zinc-700/50 bg-zinc-900/60 hover:border-indigo-500/40 hover:bg-zinc-900 transition-all cursor-pointer overflow-hidden relative group">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(slot.id, URL.createObjectURL(f)); }} />
      {slot.imageUrl ? (
        <><img src={slot.imageUrl} alt={slot.label} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><i className="ri-edit-line text-white text-sm" /></div></>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5"><i className={`${slot.icon} text-zinc-600 text-xl group-hover:text-indigo-400 transition-colors`} /><span className="text-[10px] text-zinc-500 font-medium text-center leading-tight px-1">{slot.label}</span></div>
      )}
    </div>
  );
}

interface ShotDetailPanelProps {
  shot: ShotCard; isPortrait: boolean; isSquare: boolean;
  onClose: () => void; onPromptChange: (id: string, p: string) => void;
  onShotTypeChange: (id: string, t: string) => void; onGenerate: (id: string) => void;
  onDownload: (shot: ShotCard) => void;
}
function ShotDetailPanel({ shot, isPortrait, isSquare, onClose, onPromptChange, onShotTypeChange, onGenerate, onDownload }: ShotDetailPanelProps) {
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

interface ShotCardItemProps {
  shot: ShotCard; isPortrait: boolean; isSquare: boolean;
  onPromptChange: (id: string, p: string) => void; onShotTypeChange: (id: string, t: string) => void;
  onGenerate: (id: string) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void;
  onOpenDetail: (id: string) => void; onDownload: (shot: ShotCard) => void; isDragging?: boolean;
  dragOverIndex?: number | null;
}
function ShotCardItem({ shot, isPortrait, isSquare, onPromptChange, onShotTypeChange, onGenerate, onDelete, onDuplicate, onOpenDetail, onDownload, isDragging = false }: ShotCardItemProps) {
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

function AIScenarioModal({ onClose, onGenerate }: { onClose: () => void; onGenerate: (s: string, c: number) => void }) {
  const [scenario, setScenario] = useState(''); const [count, setCount] = useState(4); const [autoGen, setAutoGen] = useState(true);
  const examples = ['새벽 카페에서 바리스타가 첫 손님을 맞이하며 하루를 시작하는 이야기. 따뜻한 조명과 커피 향이 가득한 공간.', '우주 탐험가가 미지의 행성에 착륙해 외계 생명체와 조우하는 장면.', '도시의 옥상에서 두 연인이 마지막 작별을 고하는 감성적인 씬.'];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2"><i className="ri-sparkling-2-line text-indigo-400" /><span className="text-sm font-bold text-white">AI 시나리오 추가</span></div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"><i className="ri-close-line" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">시나리오</label><textarea value={scenario} onChange={(e) => setScenario(e.target.value)} placeholder="영상의 스토리, 장면 흐름을 자연스럽게 입력하세요..." className="w-full bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-3 text-sm text-zinc-300 placeholder-zinc-600 resize-none outline-none focus:border-indigo-500/30 transition-colors min-h-[90px] leading-relaxed" /></div>
          <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">예시 시나리오</label><div className="space-y-1.5">{examples.map((ex, i) => <button key={i} onClick={() => setScenario(ex)} className="w-full text-left text-[11px] text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-900 border border-white/5 hover:border-indigo-500/20 rounded-xl px-3 py-2.5 transition-all cursor-pointer leading-relaxed">{ex}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">생성할 컷 수</label><div className="flex gap-1.5">{[2, 4, 6, 8].map((n) => <button key={n} onClick={() => setCount(n)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${count === n ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:text-white'}`}>{n}</button>)}</div></div>
            <div><label className="text-[11px] font-black text-zinc-500 uppercase tracking-wider mb-2 block">자동 이미지 생성</label><button onClick={() => setAutoGen(!autoGen)} className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${autoGen ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-zinc-800/60 border-white/5 text-zinc-400'}`}>{autoGen ? '켜짐 — 바로 생성' : '꺼짐 — 나중에 생성'}</button></div>
          </div>
        </div>
        <div className="px-5 pb-5"><button onClick={() => { if (scenario.trim()) { onGenerate(scenario, count); onClose(); } }} disabled={!scenario.trim()} className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"><i className="ri-sparkling-2-line" />{autoGen ? `${count}컷 생성 + 이미지 자동 생성` : `${count}컷 추가`}</button></div>
      </div>
    </div>
  );
}

interface GenerateAllModalProps { shots: ShotCard[]; totalCount: number; onCancel: () => void; onClose: () => void; }
function GenerateAllModal({ shots, totalCount, onCancel, onClose }: GenerateAllModalProps) {
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
            {failed > 0 && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-[11px] text-red-400 font-bold">{failed} 실패</span></div>}
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

export default function AIBoardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits, deduct, maxCredits } = useGlobalCredits();
  const {
    projects,
    setProjects,
    isLoading: _isDbLoading,
    isSaving: isDbSaving,
    loadProjects,
    saveProject,
    deleteProject,
    autoSave,
    hasUnsavedChanges,
  } = useBoardProjects(user?.id ?? null);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projectTitle, setProjectTitle] = useState('새벽 카페 씬');
  const [editingTitle, setEditingTitle] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [_cutCount, setCutCount] = useState(4);
  const [model, setModel] = useState('Flux Realism');
  const [resolution, setResolution] = useState('1K');
  const [outputMode, setOutputMode] = useState<'image' | 'video'>('image');
  const [refSlots, setRefSlots] = useState<ReferenceSlot[]>(defaultRefSlots.map((s) => ({ ...s })));
  const [shots, setShots] = useState<ShotCard[]>([createEmptyShot(1)]);
  const shotsRef = useRef<ShotCard[]>(shots);
  useEffect(() => { shotsRef.current = shots; }, [shots]);
  const [showAspectDropdown, setShowAspectDropdown] = useState(false);
  const [showCutDropdown, setShowCutDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showResDropdown, setShowResDropdown] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [detailShotId, setDetailShotId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateTotalCount, setGenerateTotalCount] = useState(0);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [_dragOverId, setDragOverId] = useState<string | null>(null);
  const [pendingCutCount, setPendingCutCount] = useState<number | null>(null);
  const [deleteShotId, setDeleteShotId] = useState<string | null>(null);
  const [showShotDeletedToast, setShowShotDeletedToast] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [unsavedModal, setUnsavedModal] = useState<{ targetProjectId: string; } | null>(null);

  // Mobile state
  const [mobileProjectsOpen, setMobileProjectsOpen] = useState(false);
  const [mobileRefOpen, setMobileRefOpen] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  // ── 배경음 상태 ──────────────────────────────────────────────────────
  const { items: sfxItems, addBlobSfx, updateStorageUrl } = useSfxStore();
  const [selectedBgm, setSelectedBgm] = useState<SfxItem | null>(null);
  const [showSfxPicker, setShowSfxPicker] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.3);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  // bgmTab removed — not used in current UI

  useSfxStoreListener(useCallback((sfx) => { addBlobSfx(sfx); }, [addBlobSfx]));

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, storageUrl } = (e as CustomEvent<{ id: string; storageUrl: string }>).detail;
      updateStorageUrl(id, storageUrl);
      setSelectedBgm((prev) => {
        if (prev && prev.id === id) return { ...prev, storageUrl, audioUrl: storageUrl };
        return prev;
      });
    };
    window.addEventListener('sfx:storage-updated', handler);
    return () => window.removeEventListener('sfx:storage-updated', handler);
  }, [updateStorageUrl]);

  const toggleBgm = useCallback(() => {
    if (!selectedBgm) return;
    if (bgmPlaying) { bgmAudioRef.current?.pause(); setBgmPlaying(false); }
    else {
      if (!bgmAudioRef.current) { bgmAudioRef.current = new Audio(selectedBgm.audioUrl); bgmAudioRef.current.loop = true; bgmAudioRef.current.volume = bgmVolume; }
      bgmAudioRef.current.play().catch(() => {});
      setBgmPlaying(true);
    }
  }, [selectedBgm, bgmPlaying, bgmVolume]);

  useEffect(() => { if (bgmAudioRef.current) bgmAudioRef.current.volume = bgmVolume; }, [bgmVolume]);
  useEffect(() => { if (bgmAudioRef.current) { bgmAudioRef.current.pause(); bgmAudioRef.current = null; } setBgmPlaying(false); }, [selectedBgm]);
  useEffect(() => { return () => { bgmAudioRef.current?.pause(); }; }, []);

  useEffect(() => {
    document.title = 'AI Board — AI 스토리보드 제작 도구 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'AI 기반 스토리보드 제작 도구. 텍스트 프롬프트로 각 씬의 이미지를 자동 생성하고, 드래그&드롭으로 컷 순서를 편집하세요.');
    return () => { document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼'; };
  }, []);

  const creditColor = credits > 150 ? 'text-emerald-400' : credits > 60 ? 'text-amber-400' : 'text-red-400';
  const creditBg = credits > 150 ? 'bg-emerald-500/10 border-emerald-500/20' : credits > 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
  const displayMaxCredits = maxCredits === Infinity ? null : maxCredits;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const progressTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const isPortrait = aspectRatio === '9:16'; const isSquare = aspectRatio === '1:1';
  const totalCredits = shots.filter((s) => !s.imageUrl).length * CREDITS_PER_CUT;
  const completedCount = shots.filter((s) => s.imageUrl).length;
  const generatingCount = shots.filter((s) => s.isGenerating).length;

  useEffect(() => {
    loadProjects().then((loaded) => {
      if (loaded.length > 0) {
        const first = loaded[0];
        setActiveProjectId(first.id);
        setProjectTitle(first.title);
        setAspectRatio(first.aspectRatio);
        setModel(first.model);
        setResolution(first.resolution);
        setOutputMode(first.outputMode);
        setShots(first.shots.length > 0 ? first.shots : [createEmptyShot(1)]);
        setRefSlots(first.refSlots.length > 0 ? first.refSlots : defaultRefSlots.map((s) => ({ ...s })));
        setCutCount(first.shots.length || 1);
      } else {
        const newId = `p-${Date.now()}`;
        const newProject: Project = { id: newId, title: '새벽 카페 씬', aspectRatio: '16:9', model: 'Flux Realism', resolution: '1K', outputMode: 'image', shots: [createEmptyShot(1)], refSlots: defaultRefSlots.map((s) => ({ ...s })) };
        setActiveProjectId(newId);
        setProjectTitle(newProject.title);
        setShots(newProject.shots);
        setRefSlots(newProject.refSlots);
        saveProject(newProject);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const h = () => { setShowAspectDropdown(false); setShowCutDropdown(false); setShowModelDropdown(false); setShowResDropdown(false); };
    window.addEventListener('click', h); return () => window.removeEventListener('click', h);
  }, []);
  useEffect(() => {
    const timers = progressTimers.current;
    return () => { Object.values(timers).forEach(clearInterval); };
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => { setToast({ message, type }); }, []);

  const doSwitchProject = useCallback((projectId: string) => {
    const target = projects.find((p) => p.id === projectId);
    if (!target) return;
    setActiveProjectId(projectId);
    setProjectTitle(target.title);
    setAspectRatio(target.aspectRatio);
    setModel(target.model);
    setResolution(target.resolution);
    setOutputMode(target.outputMode);
    setShots(target.shots.length > 0 ? target.shots : [createEmptyShot(1)]);
    setRefSlots(target.refSlots.length > 0 ? target.refSlots : defaultRefSlots.map((s) => ({ ...s })));
    setCutCount(target.shots.length || 1);
  }, [projects]);

  const handleSwitchProject = useCallback((projectId: string) => {
    if (projectId === activeProjectId) return;
    const currentProject: Project = { id: activeProjectId, title: projectTitle, aspectRatio, model, resolution, outputMode, shots: shotsRef.current, refSlots };
    if (hasUnsavedChanges(currentProject)) { setUnsavedModal({ targetProjectId: projectId }); }
    else { doSwitchProject(projectId); }
  }, [activeProjectId, projectTitle, aspectRatio, model, resolution, outputMode, refSlots, hasUnsavedChanges, doSwitchProject]);

  const handleUnsavedSave = useCallback(async () => {
    if (!unsavedModal) return;
    const currentProject: Project = { id: activeProjectId, title: projectTitle, aspectRatio, model, resolution, outputMode, shots: shotsRef.current, refSlots };
    setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? currentProject : p)));
    const ok = await saveProject(currentProject);
    if (!ok) { showToast('저장 중 오류가 발생했습니다', 'error'); return; }
    const targetId = unsavedModal.targetProjectId;
    setUnsavedModal(null);
    doSwitchProject(targetId);
  }, [unsavedModal, activeProjectId, projectTitle, aspectRatio, model, resolution, outputMode, refSlots, saveProject, setProjects, doSwitchProject, showToast]);

  const handleUnsavedDiscard = useCallback(() => {
    if (!unsavedModal) return;
    const targetId = unsavedModal.targetProjectId;
    setUnsavedModal(null);
    doSwitchProject(targetId);
  }, [unsavedModal, doSwitchProject]);

  const handleTitleBlur = useCallback(() => {
    setEditingTitle(false);
    setProjects((prev) => prev.map((p) => p.id === activeProjectId ? { ...p, title: projectTitle } : p));
    const updated: Project = { id: activeProjectId, title: projectTitle, aspectRatio, model, resolution, outputMode, shots: shotsRef.current, refSlots };
    autoSave(updated);
  }, [activeProjectId, projectTitle, aspectRatio, model, resolution, outputMode, refSlots, autoSave, setProjects]);

  const handleCutCountSelect = useCallback((newCount: number) => {
    setShowCutDropdown(false);
    if (newCount === shots.length) return;
    setPendingCutCount(newCount);
  }, [shots.length]);

  const handleCutCountConfirm = useCallback(() => {
    if (pendingCutCount === null) return;
    const newCount = pendingCutCount;
    setPendingCutCount(null);
    setCutCount(newCount);
    setShots((prev) => {
      if (newCount > prev.length) {
        const additions = Array.from({ length: newCount - prev.length }, (_, i) => createEmptyShot(prev.length + i + 1));
        return [...prev, ...additions];
      } else {
        return prev.slice(0, newCount).map((s, i) => ({ ...s, index: i + 1 }));
      }
    });
  }, [pendingCutCount]);

  const handleDownloadShot = useCallback(async (shot: ShotCard) => {
    if (!shot.imageUrl) return;
    const name = shot.prompt.trim() ? `${shot.prompt.trim().slice(0, 25).replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim().replace(/\s+/g, '_')}_cut${shot.index}.jpg` : `cut${String(shot.index).padStart(2, '0')}.jpg`;
    await downloadSingleImage(shot.imageUrl, name);
    showToast(`컷 #${shot.index} 다운로드 완료`, 'success');
  }, [showToast]);

  const handleGenerateShot = useCallback(async (id: string) => {
    if (credits < CREDITS_PER_CUT) { showToast(`크레딧이 부족합니다 (필요: ${CREDITS_PER_CUT}, 보유: ${credits})`, 'error'); return; }
    deduct(CREDITS_PER_CUT);
    if (progressTimers.current[id]) { clearInterval(progressTimers.current[id]); delete progressTimers.current[id]; }
    setShots((prev) => prev.map((s) => s.id === id ? { ...s, isGenerating: true, progress: 0, error: null } : s));
    let prog = 0;
    const timer = setInterval(() => {
      prog = Math.min(prog + Math.floor(Math.random() * 3) + 1, 85);
      setShots((prev) => prev.map((s) => s.id === id ? { ...s, progress: prog } : s));
    }, 800);
    progressTimers.current[id] = timer;
    try {
      const cur = shotsRef.current.find((s) => s.id === id);
      const fnUrl = `${SUPABASE_URL}/functions/v1/generate-image`;
      const imgUrl = await generateShotImage(cur?.prompt ?? '', cur?.shotType ?? 'Wide Shot', aspectRatio, model, fnUrl);
      clearInterval(timer);
      delete progressTimers.current[id];
      const completedShots = shotsRef.current.map((s) => s.id === id ? { ...s, isGenerating: false, progress: 100, imageUrl: imgUrl, error: null } : s);
      setShots(completedShots);
      autoSave({ id: activeProjectId, title: projectTitle, aspectRatio, model, resolution, outputMode, shots: completedShots, refSlots });
    } catch (err) {
      clearInterval(timer);
      delete progressTimers.current[id];
      const errMsg = err instanceof Error ? err.message : '이미지 생성에 실패했습니다';
      setShots((prev) => prev.map((s) => s.id === id ? { ...s, isGenerating: false, progress: 0, error: errMsg } : s));
      showToast(`컷 생성 실패: ${errMsg}`, 'error');
    }
  }, [credits, deduct, showToast, autoSave, activeProjectId, projectTitle, aspectRatio, model, resolution, outputMode, refSlots]);

  const handleGenerateAll = useCallback(() => {
    const pending = shotsRef.current.filter((s) => !s.imageUrl && !s.isGenerating);
    if (pending.length === 0) { showToast('모든 컷이 이미 생성되었습니다', 'info'); return; }
    const totalCost = pending.length * CREDITS_PER_CUT;
    if (credits < totalCost) { showToast(`크레딧이 부족합니다 (필요: ${totalCost}, 보유: ${credits})`, 'error'); return; }
    setGenerateTotalCount(pending.length);
    setShowGenerateModal(true);
    const CONCURRENCY = 3;
    pending.forEach((s, i) => { const delay = Math.floor(i / CONCURRENCY) * 1500 + (i % CONCURRENCY) * 300; setTimeout(() => handleGenerateShot(s.id), delay); });
  }, [handleGenerateShot, showToast, credits]);

  const handlePromptChange = useCallback((id: string, prompt: string) => { setShots((prev) => prev.map((s) => s.id === id ? { ...s, prompt } : s)); }, []);
  const handleShotTypeChange = useCallback((id: string, type: string) => { setShots((prev) => prev.map((s) => s.id === id ? { ...s, shotType: type } : s)); }, []);
  const handleDeleteShot = useCallback((id: string) => { setDeleteShotId(id); }, []);
  const handleDeleteShotConfirm = useCallback(() => {
    if (!deleteShotId) return;
    if (progressTimers.current[deleteShotId]) { clearInterval(progressTimers.current[deleteShotId]); delete progressTimers.current[deleteShotId]; }
    setShots((prev) => prev.filter((s) => s.id !== deleteShotId).map((s, i) => ({ ...s, index: i + 1 })));
    setDeleteShotId(null);
    setShowShotDeletedToast(true);
    setTimeout(() => setShowShotDeletedToast(false), 2500);
  }, [deleteShotId]);
  const handleDuplicateShot = useCallback((id: string) => {
    setShots((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const newShot: ShotCard = { id: `shot-${Date.now()}-dup-${Math.random().toString(36).slice(2, 7)}`, index: src.index + 1, imageUrl: src.imageUrl, prompt: src.prompt, shotType: src.shotType, isGenerating: false, progress: src.imageUrl ? 100 : 0, error: null };
      const next = [...prev.slice(0, idx + 1), newShot, ...prev.slice(idx + 1)];
      return next.map((s, i) => ({ ...s, index: i + 1 }));
    });
    showToast('컷이 복제되었습니다', 'success');
  }, [showToast]);
  const handleAddEmptyShot = useCallback(() => { setShots((prev) => [...prev, createEmptyShot(prev.length + 1)]); }, []);
  const handleAIScenario = useCallback((scenario: string, count: number) => {
    const words = scenario.trim().split(/\s+/);
    const chunkSize = Math.max(4, Math.floor(words.length / count));
    const newShots: ShotCard[] = Array.from({ length: count }, (_, i) => ({
      id: `shot-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      index: shotsRef.current.length + i + 1,
      imageUrl: null,
      prompt: words.slice(i * chunkSize, i * chunkSize + chunkSize).join(' ') || scenario.slice(0, 50),
      shotType: SHOT_TYPES[i % SHOT_TYPES.length],
      isGenerating: false,
      progress: 0,
      error: null,
    }));
    setShots((prev) => [...prev, ...newShots]);
    setTimeout(() => {
      newShots.forEach((s, i) => setTimeout(() => handleGenerateShot(s.id), i * 1500));
      showToast(`${count}개 컷 추가 + GoAPI AI 이미지 생성 시작`, 'info');
    }, 50);
  }, [handleGenerateShot, showToast]);
  const handleRefUpload = useCallback((id: string, url: string) => { setRefSlots((prev) => prev.map((s) => s.id === id ? { ...s, imageUrl: url } : s)); }, []);

  const buildCurrentProject = useCallback((): Project => ({
    id: activeProjectId, title: projectTitle, aspectRatio, model, resolution, outputMode, shots: shotsRef.current, refSlots,
  }), [activeProjectId, projectTitle, aspectRatio, model, resolution, outputMode, refSlots]);

  const handleSave = useCallback(async () => {
    const project = buildCurrentProject();
    setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? project : p)));
    const ok = await saveProject(project);
    showToast(ok ? '프로젝트가 저장되었습니다' : '저장 중 오류가 발생했습니다', ok ? 'success' : 'error');
  }, [buildCurrentProject, activeProjectId, saveProject, setProjects, showToast]);

  const handleDragStart = useCallback((event: DragStartEvent) => { setActiveDragId(event.active.id as string); setDragOverId(null); }, []);
  const handleDragMove = useCallback((event: DragMoveEvent) => { setDragOverId(event.over?.id as string ?? null); }, []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null); setDragOverId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setShots((prev) => {
      const oi = prev.findIndex((s) => s.id === active.id);
      const ni = prev.findIndex((s) => s.id === over.id);
      if (oi === -1 || ni === -1) return prev;
      return arrayMove(prev, oi, ni).map((s, i) => ({ ...s, index: i + 1 }));
    });
  }, []);

  const handleNewProject = useCallback(() => {
    const newId = `p-${Date.now()}`;
    const newProject: Project = { id: newId, title: '새 스토리보드', aspectRatio: '16:9', model: 'Flux Realism', resolution: '1K', outputMode: 'image', shots: [createEmptyShot(1)], refSlots: defaultRefSlots.map((s) => ({ ...s })) };
    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newId);
    setProjectTitle('새 스토리보드');
    setShots([createEmptyShot(1)]);
    setRefSlots(defaultRefSlots.map((s) => ({ ...s })));
    setAspectRatio('16:9');
    setCutCount(1);
    saveProject(newProject);
  }, [saveProject, setProjects]);

  const handleDeleteProject = useCallback((projectId: string) => { setDeleteProjectId(projectId); }, []);

  const handleDeleteProjectConfirm = useCallback(async () => {
    if (!deleteProjectId) return;
    const ok = await deleteProject(deleteProjectId);
    if (ok) {
      if (deleteProjectId === activeProjectId) {
        const remaining = projects.filter((p) => p.id !== deleteProjectId);
        if (remaining.length > 0) {
          const next = remaining[0];
          setActiveProjectId(next.id); setProjectTitle(next.title); setAspectRatio(next.aspectRatio); setModel(next.model); setResolution(next.resolution); setOutputMode(next.outputMode);
          setShots(next.shots.length > 0 ? next.shots : [createEmptyShot(1)]); setRefSlots(next.refSlots.length > 0 ? next.refSlots : defaultRefSlots.map((s) => ({ ...s }))); setCutCount(next.shots.length || 1);
        } else {
          const newId = `p-${Date.now()}`;
          const newProject: Project = { id: newId, title: '새 스토리보드', aspectRatio: '16:9', model: 'Flux Realism', resolution: '1K', outputMode: 'image', shots: [createEmptyShot(1)], refSlots: defaultRefSlots.map((s) => ({ ...s })) };
          setProjects([newProject]); setActiveProjectId(newId); setProjectTitle('새 스토리보드'); setShots([createEmptyShot(1)]); setRefSlots(defaultRefSlots.map((s) => ({ ...s }))); setAspectRatio('16:9'); setCutCount(1); saveProject(newProject);
        }
      }
      showToast('프로젝트가 삭제되었습니다', 'success');
    } else { showToast('삭제 중 오류가 발생했습니다', 'error'); }
    setDeleteProjectId(null);
  }, [deleteProjectId, activeProjectId, projects, deleteProject, saveProject, setProjects, showToast]);

  const detailShot = detailShotId ? shots.find((s) => s.id === detailShotId) ?? null : null;

  // SidebarContent는 외부 컴포넌트로 분리됨 (src/pages/ai-board/components/SidebarContent.tsx)
  // 매 렌더마다 새 컴포넌트가 생성되는 문제를 방지하기 위해 외부로 분리
  const sidebarProps = {
    projects,
    activeProjectId,
    projectTitle,
    sfxItems,
    selectedBgm,
    bgmPlaying,
    bgmVolume,
    onNewProject: handleNewProject,
    onSwitchProject: handleSwitchProject,
    onDeleteProject: handleDeleteProject,
    onToggleBgm: toggleBgm,
    onVolumeChange: setBgmVolume,
    onSelectBgm: setSelectedBgm,
    onShowSfxPicker: () => setShowSfxPicker(true),
  };

  return (
    <div className="h-screen bg-[#0d0d0f] text-white flex flex-col overflow-hidden">
      <AppNavbar hideBottomNav />

      {/* ── 스토리보드 ── */}
      {(
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — desktop only */}
        <aside className={`hidden md:flex flex-shrink-0 bg-[#111113] border-r border-white/5 flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-[220px]'}`}>

          {sidebarCollapsed ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <button onClick={() => setSidebarCollapsed(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"><i className="ri-arrow-right-s-line text-lg" /></button>
              <button onClick={handleNewProject} className="w-8 h-8 flex items-center justify-center rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer"><i className="ri-add-line text-lg" /></button>
            </div>
          ) : (
            <SidebarContent {...sidebarProps} onCollapse={() => setSidebarCollapsed(true)} />
          )}
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Toolbar */}
          <div className="flex-shrink-0 flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 border-b border-white/5 bg-[#111113] overflow-x-auto scrollbar-none">
            <button onClick={() => navigate(-1)} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex-shrink-0">
              <i className="ri-arrow-left-line text-sm" />
            </button>
            {/* Mobile: projects button */}
            <button onClick={() => setMobileProjectsOpen(true)} className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex-shrink-0">
              <i className="ri-folder-line text-sm" />
            </button>
            <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
              <i className="ri-layout-grid-line text-zinc-400 text-sm flex-shrink-0" />
              {editingTitle
                ? <input autoFocus value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} onBlur={handleTitleBlur} onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()} className="bg-transparent text-white font-bold text-sm outline-none border-b border-zinc-600 w-24 md:w-36" />
                : <button onClick={() => setEditingTitle(true)} className="text-white font-bold text-sm hover:text-zinc-300 transition-colors cursor-pointer truncate max-w-[80px] sm:max-w-[120px] md:max-w-[160px]">{projectTitle}</button>}
            </div>
            {generatingCount > 0 && <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 border border-indigo-500/25 rounded-lg flex-shrink-0"><div className="w-2 h-2 border border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /><span className="text-xs text-indigo-400 font-bold whitespace-nowrap">{generatingCount}개 생성 중</span></div>}
            <div className="flex-1" />
            <div className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-bold flex-shrink-0 ${creditBg} ${creditColor}`}>
              <i className="ri-copper-diamond-line text-xs" />
              <span>{credits.toLocaleString()}</span>
              {displayMaxCredits !== null && <span className="hidden sm:inline text-zinc-600 font-normal">/ {displayMaxCredits}</span>}
              <span className="hidden sm:inline text-zinc-600 font-normal text-[10px]">CR</span>
            </div>
            {completedCount > 0 && (
              <button onClick={() => setShowExportModal(true)} className="hidden sm:flex items-center gap-1.5 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 text-zinc-300 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex-shrink-0">
                <i className="ri-download-2-line text-xs" /> 내보내기
              </button>
            )}
            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setShowAspectDropdown(!showAspectDropdown); setShowCutDropdown(false); }} className="flex items-center gap-1 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 text-zinc-300 text-xs font-medium px-2 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-aspect-ratio-line text-zinc-500 text-xs" />{aspectRatio}<i className="ri-arrow-down-s-line text-zinc-500 text-xs" />
              </button>
              {showAspectDropdown && (
                <div className="absolute top-full right-0 mt-1 w-24 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                  {ASPECT_RATIOS.map((r) => (
                    <button key={r} onClick={() => { setAspectRatio(r); setShowAspectDropdown(false); }} className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${aspectRatio === r ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-300 hover:bg-white/5'}`}>
                      {r}{aspectRatio === r && <i className="ri-check-line text-indigo-400 text-[10px]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-px h-4 bg-white/5 flex-shrink-0" />
            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setShowCutDropdown(!showCutDropdown); setShowAspectDropdown(false); }} className="flex items-center gap-1 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 text-zinc-300 text-xs font-medium px-2 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-film-line text-zinc-500 text-xs" />{shots.length}컷<i className="ri-arrow-down-s-line text-zinc-500 text-xs" />
              </button>
              {showCutDropdown && (
                <div className="absolute top-full right-0 mt-1 w-20 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl max-h-48 overflow-y-auto">
                  {CUT_COUNTS.map((c) => (
                    <button key={c} onClick={() => handleCutCountSelect(c)} className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer flex items-center justify-between ${shots.length === c ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
                      {c}컷{shots.length === c && <i className="ri-check-line text-indigo-400 text-[10px]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {(() => {
              const currentProject: Project = { id: activeProjectId, title: projectTitle, aspectRatio, model, resolution, outputMode, shots: shotsRef.current, refSlots };
              const isDirty = hasUnsavedChanges(currentProject);
              return isDirty && !isDbSaving ? (
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-amber-400 font-bold flex-shrink-0 whitespace-nowrap">
                  <i className="ri-circle-fill text-[6px]" /> 미저장
                </span>
              ) : null;
            })()}
            <button onClick={handleSave} className="flex items-center gap-1 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 text-zinc-300 text-xs font-medium px-2 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex-shrink-0">
              {isDbSaving ? <div className="w-3 h-3 border border-zinc-400/30 border-t-zinc-400 rounded-full animate-spin" /> : <i className="ri-save-line text-xs" />}<span className="hidden sm:inline ml-1">저장</span>
            </button>
          </div>

          {/* Reference Bar — desktop only */}
          <div className="hidden md:flex flex-shrink-0 items-center gap-4 px-4 py-2.5 border-b border-white/5 bg-[#0f0f11]">
            <div className="flex items-start gap-3">
              <div className="flex flex-col justify-center"><div className="flex items-center gap-1.5 mb-0.5"><span className="text-[11px] font-bold text-zinc-300">캐릭터 레퍼런스</span><i className="ri-user-line text-zinc-500 text-xs" /></div><p className="text-[10px] text-zinc-600 leading-tight">외모/의상 일관성 유지<br />(최대 3명)</p></div>
              <div className="flex items-center gap-2">{refSlots.filter((s) => s.id !== 'bg1').map((slot) => <RefSlot key={slot.id} slot={slot} onUpload={handleRefUpload} />)}</div>
            </div>
            <div className="w-px h-14 bg-zinc-700/40 flex-shrink-0" />
            <div className="flex items-start gap-3">
              <RefSlot slot={refSlots.find((s) => s.id === 'bg1')!} onUpload={handleRefUpload} />
              <div className="flex flex-col justify-center"><div className="flex items-center gap-1.5 mb-0.5"><i className="ri-map-pin-line text-indigo-400 text-xs" /><span className="text-[11px] font-bold text-zinc-300">배경 레퍼런스</span></div><p className="text-[10px] text-zinc-600 leading-tight">장소 변동 없이 각도만 변경<br />(1장 사용)</p></div>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-3 text-[11px] text-zinc-600 flex-shrink-0">
              <span>{completedCount}/{shots.length} 완료</span>
              {generatingCount > 0 && <span className="text-indigo-400">{generatingCount}개 생성 중</span>}
              {totalCredits > 0 && <span className={creditColor}>예상 {totalCredits}크레딧</span>}
            </div>
            <button onClick={handleGenerateAll} className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-400 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap flex-shrink-0"><i className="ri-sparkling-2-line text-xs" /> 전체 생성</button>
          </div>

          {/* Mobile quick bar */}
          <div className="md:hidden flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-[#0f0f11]">
            <span className="text-[11px] text-zinc-500 font-bold">{completedCount}/{shots.length}</span>
            {generatingCount > 0 && <span className="text-[11px] text-indigo-400 animate-pulse font-bold">{generatingCount}개 생성 중</span>}
            <div className="flex-1" />
            <button onClick={() => setMobileRefOpen(true)} className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 text-zinc-400 text-xs px-2 py-1.5 rounded-lg cursor-pointer whitespace-nowrap">
              <i className="ri-user-line text-xs" /><span className="hidden xs:inline">레퍼런스</span>
            </button>
            <button onClick={() => setMobileSettingsOpen(true)} className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 text-zinc-400 text-xs px-2 py-1.5 rounded-lg cursor-pointer whitespace-nowrap">
              <i className="ri-settings-3-line text-xs" /><span className="hidden xs:inline">설정</span>
            </button>
            <button onClick={() => setShowAIModal(true)} className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer whitespace-nowrap">
              <i className="ri-sparkling-2-line text-xs" /> AI 씬
            </button>
          </div>

          {/* Shot Grid */}
          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            {activeDragId && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-pulse">
                <i className="ri-drag-move-2-line text-indigo-400 text-sm" />
                <span className="text-xs font-bold text-indigo-400">드래그하여 원하는 위치에 놓으세요</span>
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
              <SortableContext items={shots.map((s) => s.id)} strategy={rectSortingStrategy}>
                <div className={`grid gap-2 md:gap-3 ${isPortrait ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
                  {shots.map((shot) => (
                    <ShotCardItem key={shot.id} shot={shot} isPortrait={isPortrait} isSquare={isSquare} onPromptChange={handlePromptChange} onShotTypeChange={handleShotTypeChange} onGenerate={handleGenerateShot} onDelete={handleDeleteShot} onDuplicate={handleDuplicateShot} onOpenDetail={(id) => setDetailShotId(id)} onDownload={handleDownloadShot} isDragging={activeDragId === shot.id} />
                  ))}
                  <div onClick={() => setShowAIModal(true)} className={`bg-[#1a1a1e] border border-zinc-700/40 hover:border-indigo-500/40 rounded-xl cursor-pointer hover:bg-indigo-500/5 transition-all group flex flex-col items-center justify-center gap-2.5 ${isPortrait ? 'aspect-[9/16]' : isSquare ? 'aspect-square' : 'aspect-video'}`}>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all"><i className="ri-sparkling-2-line text-indigo-400 text-lg" /></div>
                    <span className="text-xs font-bold text-indigo-400 text-center px-2">AI 씬 추가</span>
                  </div>
                  <div onClick={handleAddEmptyShot} className={`bg-[#1a1a1e] border border-dashed border-zinc-700/50 rounded-xl cursor-pointer hover:border-zinc-500/60 hover:bg-zinc-800/20 transition-all group flex flex-col items-center justify-center gap-2.5 ${isPortrait ? 'aspect-[9/16]' : isSquare ? 'aspect-square' : 'aspect-video'}`}>
                    <div className="w-10 h-10 rounded-xl border border-dashed border-zinc-700/60 group-hover:border-zinc-500/70 flex items-center justify-center transition-all"><i className="ri-add-line text-zinc-600 group-hover:text-zinc-400 text-lg transition-colors" /></div>
                    <span className="text-xs font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">빈 컷 추가</span>
                  </div>
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeDragId ? (() => {
                  const activeShot = shots.find((s) => s.id === activeDragId);
                  if (!activeShot) return null;
                  const ac = isPortrait ? 'aspect-[9/16]' : isSquare ? 'aspect-square' : 'aspect-video';
                  return (
                    <div className="bg-[#1a1a1e] border-2 border-indigo-400/70 rounded-xl overflow-hidden ring-4 ring-indigo-500/20 rotate-[1.5deg] scale-[1.06] shadow-2xl shadow-indigo-500/20 flex flex-col cursor-grabbing">
                      <div className="flex items-center px-2.5 py-2 border-b border-indigo-500/20 bg-indigo-500/10">
                        <i className="ri-draggable text-indigo-400 text-sm" />
                        <span className="text-[10px] font-black text-indigo-400 ml-1.5">#{activeShot.index}</span>
                      </div>
                      <div className={`relative ${ac} bg-zinc-950 overflow-hidden`}>
                        {activeShot.imageUrl ? <img src={activeShot.imageUrl} alt="" className="w-full h-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center bg-zinc-950"><i className="ri-image-line text-zinc-700 text-2xl" /></div>}
                      </div>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Bottom Bar — desktop only */}
          <div className="hidden md:flex flex-shrink-0 items-center gap-3 px-4 py-2.5 border-t border-white/5 bg-[#111113]">
            <div className="flex items-center bg-zinc-900/60 border border-white/5 rounded-xl p-1 gap-0.5 flex-shrink-0">
              {(['image', 'video'] as const).map((mode) => (
                <button key={mode} onClick={() => setOutputMode(mode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${outputMode === mode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}>
                  <i className={`${mode === 'image' ? 'ri-image-line' : 'ri-video-line'} text-xs`} />{mode === 'image' ? '이미지' : '영상'}
                </button>
              ))}
            </div>
            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setShowModelDropdown(!showModelDropdown); setShowResDropdown(false); }} className="flex items-center gap-2 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 text-zinc-300 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
                {model}
                {(() => {
                  const m = MODELS.find((m) => m.id === model);
                  return m ? <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${m.badgeColor === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : m.badgeColor === 'amber' ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-400'}`}>{m.badge}</span> : null;
                })()}
                <i className="ri-arrow-down-s-line text-zinc-500 text-xs" />
              </button>
              {showModelDropdown && (
                <div className="absolute bottom-full left-0 mb-1 w-72 bg-[#111113] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl">
                  <div className="px-3 pt-3 pb-1.5"><p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">AI 모델 선택</p></div>
                  <div className="px-2 pb-2 space-y-1">
                    {MODELS.map((m) => {
                      const isSelected = model === m.id;
                      const badgeClass = m.badgeColor === 'emerald' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : m.badgeColor === 'amber' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20';
                      const selectedBg = m.badgeColor === 'emerald' ? 'bg-emerald-500/8 border-emerald-500/20' : m.badgeColor === 'amber' ? 'bg-amber-500/8 border-amber-500/20' : 'bg-indigo-500/8 border-indigo-500/20';
                      return (
                        <button key={m.id} onClick={() => { setModel(m.id); setShowModelDropdown(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer border ${isSelected ? selectedBg : 'border-transparent hover:bg-white/5 hover:border-white/5'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${isSelected ? (m.badgeColor === 'emerald' ? 'text-emerald-300' : m.badgeColor === 'amber' ? 'text-amber-300' : 'text-indigo-300') : 'text-zinc-200'}`}>{m.label}</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${badgeClass}`}>{m.badge}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-600 font-mono">{m.speed}</span>
                              {isSelected && <i className="ri-check-line text-indigo-400 text-xs" />}
                            </div>
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-relaxed">{m.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-wider">RES</span>
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setShowResDropdown(!showResDropdown); setShowModelDropdown(false); }} className="flex items-center gap-1.5 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 text-zinc-300 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap"><i className="ri-map-pin-line text-indigo-400 text-xs" />{resolution}<i className="ri-arrow-down-s-line text-zinc-500 text-xs" /></button>
                {showResDropdown && (
                  <div className="absolute bottom-full left-0 mb-1 w-20 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                    {RESOLUTIONS.map((r) => (
                      <button key={r} onClick={() => { setResolution(r); setShowResDropdown(false); }} className={`w-full text-left px-3 py-2.5 text-xs transition-colors cursor-pointer flex items-center justify-between ${resolution === r ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-300 hover:bg-white/5'}`}>
                        {r}{resolution === r && <i className="ri-check-line text-indigo-400 text-[10px]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1" />
            {completedCount > 0 && (
              <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 hover:border-white/10 text-zinc-300 font-bold text-sm px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex-shrink-0">
                <i className="ri-download-2-line text-sm" /> 내보내기
              </button>
            )}
            <button onClick={handleGenerateAll} disabled={credits < CREDITS_PER_CUT} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex-shrink-0">
              <i className="ri-sparkling-2-line text-sm" />전체 생성
            </button>
          </div>

          {/* Mobile Bottom Tab Bar */}
          <div className="md:hidden flex-shrink-0 flex items-center bg-[#0d0d0f] border-t border-white/5 px-2 py-1">
            <button onClick={() => setMobileProjectsOpen(true)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-zinc-600 cursor-pointer">
              <div className="w-6 h-6 flex items-center justify-center"><i className="ri-folder-line text-lg" /></div>
              <span className="text-[10px] font-bold">프로젝트</span>
            </button>
            <button onClick={handleGenerateAll} disabled={credits < CREDITS_PER_CUT} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-indigo-400 cursor-pointer disabled:opacity-40">
              <div className="w-6 h-6 flex items-center justify-center"><i className="ri-sparkling-2-line text-lg" /></div>
              <span className="text-[10px] font-bold">전체 생성</span>
            </button>
            {completedCount > 0 && (
              <button onClick={() => setShowExportModal(true)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-emerald-400 cursor-pointer">
                <div className="w-6 h-6 flex items-center justify-center"><i className="ri-download-2-line text-lg" /></div>
                <span className="text-[10px] font-bold">내보내기</span>
              </button>
            )}
            <button onClick={() => setMobileSettingsOpen(true)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-zinc-600 cursor-pointer">
              <div className="w-6 h-6 flex items-center justify-center"><i className="ri-settings-3-line text-lg" /></div>
              <span className="text-[10px] font-bold">설정</span>
            </button>
          </div>
        </div>
      </div>

      )}

      {/* ── Mobile Projects Drawer ── */}
      {mobileProjectsOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileProjectsOpen(false)} />
          <div className="relative bg-[#111113] border-t border-white/10 rounded-t-2xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <i className="ri-folder-line text-indigo-400" />
                <span className="text-sm font-bold text-white">프로젝트 목록</span>
              </div>
              <button onClick={() => setMobileProjectsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-400 cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto flex flex-col">
              <SidebarContent {...sidebarProps} onCloseMobile={() => setMobileProjectsOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Reference Drawer ── */}
      {mobileRefOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileRefOpen(false)} />
          <div className="relative bg-[#111113] border-t border-white/10 rounded-t-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <i className="ri-user-line text-indigo-400" />
                <span className="text-sm font-bold text-white">레퍼런스 설정</span>
              </div>
              <button onClick={() => setMobileRefOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-400 cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <i className="ri-user-line text-zinc-400 text-sm" />
                  <span className="text-xs font-bold text-zinc-300">캐릭터 레퍼런스</span>
                  <span className="text-[10px] text-zinc-600 ml-1">외모/의상 일관성 유지 (최대 3명)</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {refSlots.filter((s) => s.id !== 'bg1').map((slot) => <RefSlot key={slot.id} slot={slot} onUpload={handleRefUpload} />)}
                </div>
              </div>
              <div className="w-full h-px bg-white/5" />
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <i className="ri-map-pin-line text-indigo-400 text-sm" />
                  <span className="text-xs font-bold text-zinc-300">배경 레퍼런스</span>
                  <span className="text-[10px] text-zinc-600 ml-1">장소 변동 없이 각도만 변경</span>
                </div>
                <RefSlot slot={refSlots.find((s) => s.id === 'bg1')!} onUpload={handleRefUpload} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Settings Drawer ── */}
      {mobileSettingsOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileSettingsOpen(false)} />
          <div className="relative bg-[#111113] border-t border-white/10 rounded-t-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <i className="ri-settings-3-line text-indigo-400" />
                <span className="text-sm font-bold text-white">생성 설정</span>
              </div>
              <button onClick={() => setMobileSettingsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-800/60 text-zinc-400 cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Output mode */}
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">출력 모드</p>
                <div className="flex items-center bg-zinc-900/60 border border-white/5 rounded-xl p-1 gap-0.5">
                  {(['image', 'video'] as const).map((mode) => (
                    <button key={mode} onClick={() => setOutputMode(mode)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${outputMode === mode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/25' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}>
                      <i className={`${mode === 'image' ? 'ri-image-line' : 'ri-video-line'} text-xs`} />{mode === 'image' ? '이미지' : '영상'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Model */}
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">AI 모델</p>
                <div className="space-y-1.5">
                  {MODELS.map((m) => {
                    const isSelected = model === m.id;
                    const badgeClass = m.badgeColor === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : m.badgeColor === 'amber' ? 'bg-amber-500/15 text-amber-400' : 'bg-indigo-500/15 text-indigo-400';
                    return (
                      <button key={m.id} onClick={() => setModel(m.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'bg-indigo-500/10 border-indigo-500/25' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'}`}>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isSelected ? 'text-indigo-300' : 'text-zinc-300'}`}>{m.label}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badgeClass}`}>{m.badge}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{m.description}</p>
                        </div>
                        {isSelected && <i className="ri-check-line text-indigo-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Resolution */}
              <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">해상도</p>
                <div className="flex gap-2">
                  {RESOLUTIONS.map((r) => (
                    <button key={r} onClick={() => setResolution(r)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${resolution === r ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'}`}>{r}</button>
                  ))}
                </div>
              </div>
              {/* Credits info */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${creditBg}`}>
                <i className={`ri-copper-diamond-line text-lg ${creditColor}`} />
                <div>
                  <p className={`text-sm font-black ${creditColor}`}>
                    {credits.toLocaleString()} CR
                    {displayMaxCredits !== null && <span className="text-zinc-500 font-normal text-xs"> / {displayMaxCredits}</span>}
                  </p>
                  <p className="text-[10px] text-zinc-500">보유 크레딧 · 컷당 {CREDITS_PER_CUT} 크레딧</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailShot && <ShotDetailPanel shot={detailShot} isPortrait={isPortrait} isSquare={isSquare} onClose={() => setDetailShotId(null)} onPromptChange={handlePromptChange} onShotTypeChange={handleShotTypeChange} onGenerate={handleGenerateShot} onDownload={handleDownloadShot} />}
      {showAIModal && <AIScenarioModal onClose={() => setShowAIModal(false)} onGenerate={handleAIScenario} />}
      {showExportModal && <ExportModal shots={shots} projectTitle={projectTitle} onClose={() => setShowExportModal(false)} onToast={showToast} />}
      {showGenerateModal && (
        <GenerateAllModal
          shots={shots}
          totalCount={generateTotalCount}
          onCancel={() => {
            Object.keys(progressTimers.current).forEach((id) => { clearInterval(progressTimers.current[id]); delete progressTimers.current[id]; });
            setShots((prev) => prev.map((s) => s.isGenerating ? { ...s, isGenerating: false, progress: 0, error: '취소됨' } : s));
            setShowGenerateModal(false);
            showToast('생성이 취소되었습니다', 'info');
          }}
          onClose={() => {
            setShowGenerateModal(false);
            const currentShots = shotsRef.current;
            const done = currentShots.filter((s) => s.imageUrl).length;
            const project = buildCurrentProject();
            saveProject({ ...project, shots: currentShots }).then((ok) => {
              showToast(ok ? `${done}개 컷 생성 완료! 자동 저장됨` : `${done}개 컷 생성 완료 (저장 실패)`, ok ? 'success' : 'error');
            });
          }}
        />
      )}

      {pendingCutCount !== null && (
        <CutCountConfirmModal currentCount={shots.length} newCount={pendingCutCount} onConfirm={handleCutCountConfirm} onCancel={() => setPendingCutCount(null)} />
      )}
      {deleteShotId && (
        <ConfirmModal title="컷을 삭제할까요?" description="삭제된 컷은 복구할 수 없습니다." confirmLabel="삭제" cancelLabel="취소" variant="danger" previewText={`#${shots.find((s) => s.id === deleteShotId)?.index ?? ''} 씬 — ${shots.find((s) => s.id === deleteShotId)?.prompt || '(프롬프트 없음)'}`} onConfirm={handleDeleteShotConfirm} onCancel={() => setDeleteShotId(null)} />
      )}
      {showShotDeletedToast && <Toast message="컷이 삭제되었습니다" type="info" onClose={() => setShowShotDeletedToast(false)} />}
      {deleteProjectId && (
        <ConfirmModal title="프로젝트를 삭제할까요?" description="삭제된 프로젝트와 모든 컷 데이터는 복구할 수 없습니다." confirmLabel="삭제" cancelLabel="취소" variant="danger" previewText={projects.find((p) => p.id === deleteProjectId)?.title ?? ''} onConfirm={handleDeleteProjectConfirm} onCancel={() => setDeleteProjectId(null)} />
      )}
      {unsavedModal && (
        <UnsavedChangesModal projectTitle={projectTitle} onSave={handleUnsavedSave} onDiscard={handleUnsavedDiscard} onCancel={() => setUnsavedModal(null)} isSaving={isDbSaving} />
      )}
      {toast && <Toast message={toast.message} type={toast.type as 'success' | 'error' | 'info'} onClose={() => setToast(null)} />}
      {showSfxPicker && (
        <SfxPickerModal
          title="스토리보드 배경음 선택"
          selectedId={selectedBgm?.id ?? null}
          onSelect={(sfx) => { if (!sfx.id) setSelectedBgm(null); else setSelectedBgm(sfx); setShowSfxPicker(false); }}
          onClose={() => setShowSfxPicker(false)}
        />
      )}
    </div>
  );
}
