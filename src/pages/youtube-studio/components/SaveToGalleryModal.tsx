import { useState } from 'react';

interface SaveToGalleryModalProps {
  onClose: () => void;
  onSave: (title: string) => void;
  thumbnailUrl: string;
  defaultTitle: string;
  duration: number;
  onBackup?: () => void;
}

export default function SaveToGalleryModal({
  onClose,
  onSave,
  thumbnailUrl,
  defaultTitle,
  duration,
  onBackup,
}: SaveToGalleryModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    onSave(title);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={!saving ? onClose : undefined}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <i className="ri-folder-video-line text-emerald-400 text-sm" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">갤러리에 저장</p>
              <p className="text-zinc-500 text-xs mt-0.5">AI Automation 갤러리에 추가됩니다</p>
            </div>
          </div>
          {!saving && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line" />
            </button>
          )}
        </div>
        <div className="p-5 space-y-4">
          {saved ? (
            <div className="flex flex-col items-center gap-4 py-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <i className="ri-checkbox-circle-fill text-emerald-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">저장 완료!</p>
                <p className="text-zinc-500 text-xs mt-1">AI Automation 갤러리에 추가되었습니다</p>
              </div>
              <div className="w-full bg-zinc-800/60 rounded-xl p-3 flex items-center gap-3">
                <img src={thumbnailUrl} alt={title} className="w-14 h-10 rounded-lg object-cover flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-white text-xs font-bold truncate">{title}</p>
                  <p className="text-zinc-500 text-[10px] mt-0.5">{duration}초 · 완료</p>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">완료</span>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                {onBackup && (
                  <button
                    onClick={onBackup}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-400 font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-archive-drawer-line" /> 백업
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  확인
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative rounded-xl overflow-hidden">
                <img src={thumbnailUrl} alt="thumbnail" className="w-full h-32 object-cover object-top" />
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {duration}초
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-400 mb-2 block">영상 제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="영상 제목을 입력하세요..."
                  className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-colors"
                />
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-zinc-500 font-semibold mb-2">저장 정보</p>
                {[
                  { label: '저장 위치', val: 'AI Automation 갤러리' },
                  { label: '상태', val: '완료', color: 'text-emerald-400' },
                  { label: '제작 방식', val: 'YouTube Studio (수동)' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{item.label}</span>
                    <span className={`text-[10px] font-semibold ${item.color ?? 'text-zinc-300'}`}>{item.val}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!title.trim() || saving}
                  className="flex-[2] py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {saving ? (
                    <><i className="ri-loader-4-line animate-spin" /> 저장 중...</>
                  ) : (
                    <><i className="ri-folder-video-line" /> 갤러리에 저장</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
