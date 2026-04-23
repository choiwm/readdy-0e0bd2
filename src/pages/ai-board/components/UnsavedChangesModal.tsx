import { useEffect } from 'react';

interface Props { projectTitle: string; onSave: () => void; onDiscard: () => void; onCancel: () => void; isSaving: boolean; }

export default function UnsavedChangesModal({ projectTitle, onSave, onDiscard, onCancel, isSaving }: Props) {
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
