interface Props { currentCount: number; newCount: number; onConfirm: () => void; onCancel: () => void; }

export default function CutCountConfirmModal({ currentCount, newCount, onConfirm, onCancel }: Props) {
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
