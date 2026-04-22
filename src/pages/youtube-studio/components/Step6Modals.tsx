import { useState, useRef, useEffect } from 'react';
import {
  downloadJson,
  downloadCsv,
  downloadText,
  buildSrtContent,
  safeFilename,
  dateStamp,
  PROJECT_CSV_HEADER,
  buildProjectCsvRow,
} from '@/utils/exportBackup';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SubtitleSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  trackId: string;
}

export const TOTAL_DURATION = 38;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

// ─── UnsavedExitDialog ────────────────────────────────────────────────────────
export function UnsavedExitDialog({
  onConfirm,
  onCancel,
  onSaveFirst,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  onSaveFirst: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm animate-[slideDown_0.25s_ease-out]">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />

        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <i className="ri-error-warning-line text-amber-400 text-lg" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">저장하지 않고 나가시겠어요?</p>
              <p className="text-zinc-500 text-xs mt-0.5">렌더링된 영상이 갤러리에 저장되지 않습니다</p>
            </div>
          </div>

          {/* Warning detail */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 mb-5 space-y-1.5">
            {[
              { icon: 'ri-film-line', text: '렌더링 결과물이 사라집니다' },
              { icon: 'ri-closed-captioning-line', text: '자막 편집 내용이 저장되지 않습니다' },
              { icon: 'ri-image-line', text: 'AI 썸네일이 저장되지 않습니다' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2">
                <i className={`${item.icon} text-amber-400/70 text-xs flex-shrink-0`} />
                <span className="text-xs text-amber-300/70">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={onSaveFirst}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-folder-video-line" /> 갤러리에 저장 후 나가기
            </button>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
              >
                계속 작업하기
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/8 text-zinc-300 text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap"
              >
                그냥 나가기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CompletionToast ──────────────────────────────────────────────────────────
export function CompletionToast({ title, onClose }: { title: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-[slideDown_0.4s_ease-out]">
      <div className="flex items-center gap-3 bg-zinc-900 border border-emerald-500/40 rounded-2xl px-4 py-3 shadow-2xl min-w-[280px] max-w-[420px]">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <i className="ri-checkbox-circle-fill text-emerald-400 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">영상 완성!</p>
          <p className="text-zinc-400 text-xs mt-0.5 truncate">&quot;{title}&quot; 갤러리에 저장됨</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
            갤러리 이동 중...
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SplitModal ───────────────────────────────────────────────────────────────
export function SplitModal({
  segments,
  onClose,
  onApply,
}: {
  segments: SubtitleSegment[];
  onClose: () => void;
  onApply: (segs: SubtitleSegment[]) => void;
}) {
  const [localSegs, setLocalSegs] = useState<SubtitleSegment[]>(segments.map((s) => ({ ...s })));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitPos, setSplitPos] = useState(50);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const startEdit = (seg: SubtitleSegment) => {
    setEditingId(seg.id);
    setEditText(seg.text);
  };
  const commitEdit = () => {
    if (!editingId) return;
    setLocalSegs((prev) =>
      prev.map((s) => (s.id === editingId ? { ...s, text: editText.trim() || s.text } : s))
    );
    setEditingId(null);
  };

  const splitSegment = (seg: SubtitleSegment) => {
    const duration = seg.endTime - seg.startTime;
    const splitAt = seg.startTime + duration * (splitPos / 100);
    const words = seg.text.split(' ');
    const half = Math.max(1, Math.floor(words.length * (splitPos / 100)));
    const newA: SubtitleSegment = {
      ...seg,
      id: `${seg.id}_a`,
      text: words.slice(0, half).join(' '),
      endTime: splitAt,
    };
    const newB: SubtitleSegment = {
      ...seg,
      id: `${seg.id}_b`,
      text: words.slice(half).join(' ') || '...',
      startTime: splitAt,
    };
    setLocalSegs((prev) => {
      const idx = prev.findIndex((s) => s.id === seg.id);
      const next = [...prev];
      next.splice(idx, 1, newA, newB);
      return next;
    });
    setSelectedId(newA.id);
  };

  const mergeWithNext = (seg: SubtitleSegment) => {
    const idx = localSegs.findIndex((s) => s.id === seg.id);
    if (idx >= localSegs.length - 1) return;
    const next = localSegs[idx + 1];
    const merged: SubtitleSegment = {
      ...seg,
      text: `${seg.text} ${next.text}`,
      endTime: next.endTime,
    };
    setLocalSegs((prev) => {
      const arr = [...prev];
      arr.splice(idx, 2, merged);
      return arr;
    });
    setSelectedId(merged.id);
  };

  const deleteSegment = (id: string) => {
    setLocalSegs((prev) => prev.filter((s) => s.id !== id));
    setSelectedId(null);
  };
  const selected = localSegs.find((s) => s.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4">
      <div className="w-full md:max-w-4xl max-h-[92vh] md:max-h-[90vh] bg-[#141416] border border-white/10 rounded-t-2xl md:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-amber-500/20 rounded-lg">
              <i className="ri-scissors-cut-line text-amber-400 text-sm" />
            </div>
            <div>
              <h2 className="text-xs md:text-sm font-bold text-white">자막 쪼개기 편집기</h2>
              <p className="hidden sm:block text-[11px] text-zinc-500 mt-0.5">
                세그먼트를 클릭해 텍스트 편집 · 분할 · 병합 · 삭제
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApply(localSegs)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3 md:px-4 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-check-line" /> 적용하기
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg hover:bg-white/5 transition-colors"
            >
              <i className="ri-close-line text-sm" />
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
          {/* Left: Segment List */}
          <div className="w-full md:w-[420px] flex-shrink-0 md:border-r border-white/8 flex flex-col overflow-hidden max-h-[40vh] md:max-h-none">
            <div className="px-4 py-2 md:py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-semibold text-zinc-400">
                자막 세그먼트 ({localSegs.length}개)
              </span>
              <span className="text-[10px] text-zinc-600 hidden sm:block">더블클릭하여 편집</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-1.5">
              {localSegs.map((seg, idx) => (
                <div
                  key={seg.id}
                  onClick={() => {
                    setSelectedId(seg.id);
                    if (editingId !== seg.id) setEditingId(null);
                  }}
                  onDoubleClick={() => startEdit(seg)}
                  className={`group relative rounded-xl border transition-all cursor-pointer ${
                    selectedId === seg.id
                      ? 'border-amber-500/50 bg-amber-500/8'
                      : 'border-white/6 bg-zinc-900/60 hover:border-white/12 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start gap-2 md:gap-3 p-2.5 md:p-3">
                    <div
                      className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        selectedId === seg.id ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === seg.id ? (
                        <textarea
                          ref={editRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              commitEdit();
                            }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-zinc-800 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-amber-500/70 leading-relaxed"
                          rows={2}
                        />
                      ) : (
                        <p className="text-xs text-zinc-200 leading-relaxed line-clamp-2">{seg.text}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-zinc-600 font-mono">{formatTime(seg.startTime)}</span>
                        <i className="ri-arrow-right-line text-zinc-700 text-[9px]" />
                        <span className="text-[10px] text-zinc-600 font-mono">{formatTime(seg.endTime)}</span>
                        <span className="text-[10px] text-zinc-700 ml-auto">
                          {(seg.endTime - seg.startTime).toFixed(1)}s
                        </span>
                      </div>
                    </div>
                    <div
                      className={`flex flex-col gap-1 transition-opacity ${
                        selectedId === seg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(seg);
                        }}
                        className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-amber-400 cursor-pointer rounded hover:bg-amber-500/10 transition-colors"
                      >
                        <i className="ri-edit-line text-[11px]" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSegment(seg.id);
                        }}
                        className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-red-400 cursor-pointer rounded hover:bg-red-500/10 transition-colors"
                      >
                        <i className="ri-delete-bin-line text-[11px]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Right: Edit Panel */}
          <div className="flex-1 flex flex-col overflow-hidden border-t md:border-t-0 border-white/8">
            {selected ? (
              <>
                <div className="px-4 md:px-5 py-2.5 md:py-3 border-b border-white/5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-semibold text-zinc-300">선택된 세그먼트 편집</span>
                    <span className="text-[10px] text-zinc-600 ml-auto font-mono">
                      {formatTime(selected.startTime)} → {formatTime(selected.endTime)}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 md:space-y-5">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 mb-2 block">텍스트 편집</label>
                    <textarea
                      value={editingId === selected.id ? editText : selected.text}
                      onChange={(e) => {
                        if (editingId !== selected.id) {
                          setEditingId(selected.id);
                          setEditText(e.target.value);
                        } else setEditText(e.target.value);
                      }}
                      onFocus={() => {
                        if (editingId !== selected.id) {
                          setEditingId(selected.id);
                          setEditText(selected.text);
                        }
                      }}
                      onBlur={commitEdit}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none focus:outline-none focus:border-amber-500/40 leading-relaxed transition-colors"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 mb-3 block">타이밍 조절</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-900 border border-white/8 rounded-xl p-3">
                        <label className="text-[10px] text-zinc-500 mb-1.5 block">시작 시간</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            max={selected.endTime - 0.1}
                            value={selected.startTime.toFixed(1)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setLocalSegs((prev) =>
                                prev.map((s) => (s.id === selected.id ? { ...s, startTime: v } : s))
                              );
                            }}
                            className="flex-1 bg-zinc-800 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/40 text-center"
                          />
                          <span className="text-[10px] text-zinc-600">s</span>
                        </div>
                      </div>
                      <div className="bg-zinc-900 border border-white/8 rounded-xl p-3">
                        <label className="text-[10px] text-zinc-500 mb-1.5 block">종료 시간</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            min={selected.startTime + 0.1}
                            max={TOTAL_DURATION}
                            value={selected.endTime.toFixed(1)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setLocalSegs((prev) =>
                                prev.map((s) => (s.id === selected.id ? { ...s, endTime: v } : s))
                              );
                            }}
                            className="flex-1 bg-zinc-800 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500/40 text-center"
                          />
                          <span className="text-[10px] text-zinc-600">s</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 bg-zinc-900 border border-white/8 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-zinc-500">타임라인 위치</span>
                        <span className="text-[10px] text-zinc-400 font-mono font-bold">
                          {(selected.endTime - selected.startTime).toFixed(1)}s
                        </span>
                      </div>
                      <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="absolute h-full bg-amber-500/70 rounded-full"
                          style={{
                            left: `${(selected.startTime / TOTAL_DURATION) * 100}%`,
                            width: `${((selected.endTime - selected.startTime) / TOTAL_DURATION) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 mb-3 block">자막 쪼개기</label>
                    <div className="bg-zinc-900 border border-white/8 rounded-xl p-3 md:p-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] text-zinc-500">분할 위치</span>
                          <span className="text-[10px] text-amber-400 font-bold">{splitPos}%</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={90}
                          value={splitPos}
                          onChange={(e) => setSplitPos(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(() => {
                          const words = selected.text.split(' ');
                          const half = Math.max(1, Math.floor(words.length * (splitPos / 100)));
                          return (
                            <>
                              <div className="bg-zinc-800/60 rounded-lg p-2.5 border border-amber-500/20">
                                <div className="text-[9px] text-amber-400 mb-1 font-semibold">앞 부분</div>
                                <p className="text-[11px] text-zinc-300 leading-relaxed">
                                  {words.slice(0, half).join(' ')}
                                </p>
                              </div>
                              <div className="bg-zinc-800/60 rounded-lg p-2.5 border border-amber-500/20">
                                <div className="text-[9px] text-amber-400 mb-1 font-semibold">뒷 부분</div>
                                <p className="text-[11px] text-zinc-300 leading-relaxed">
                                  {words.slice(half).join(' ') || '...'}
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <button
                        onClick={() => splitSegment(selected)}
                        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <i className="ri-scissors-cut-line" /> 이 위치에서 쪼개기
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => mergeWithNext(selected)}
                      disabled={localSegs.findIndex((s) => s.id === selected.id) >= localSegs.length - 1}
                      className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 font-semibold text-xs py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-merge-cells-horizontal text-sm" /> 다음과 병합
                    </button>
                    <button
                      onClick={() => deleteSegment(selected.id)}
                      className="flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-xs py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-delete-bin-line text-sm" /> 세그먼트 삭제
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 md:p-8">
                <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center bg-zinc-800/60 rounded-2xl mb-4">
                  <i className="ri-cursor-line text-zinc-500 text-xl md:text-2xl" />
                </div>
                <p className="text-sm font-semibold text-zinc-400 mb-1">세그먼트를 선택하세요</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  왼쪽 목록에서 자막 세그먼트를 클릭하면
                  <br />
                  텍스트 편집, 타이밍 조절, 분할/병합 기능을
                  <br />
                  사용할 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
        {/* Footer mini timeline */}
        <div className="border-t border-white/8 px-4 md:px-5 py-2.5 md:py-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-zinc-600 font-semibold w-10 md:w-12 flex-shrink-0">자막</span>
            <div className="flex-1 relative h-5 md:h-6 bg-zinc-900 rounded-lg overflow-hidden">
              {localSegs.map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => setSelectedId(seg.id)}
                  title={seg.text}
                  className={`absolute h-full flex items-center px-1 text-[9px] font-semibold transition-all cursor-pointer border-r border-black/30 ${
                    selectedId === seg.id
                      ? 'bg-amber-500 text-black'
                      : 'bg-orange-500/70 text-white hover:bg-orange-500/90'
                  }`}
                  style={{
                    left: `${(seg.startTime / TOTAL_DURATION) * 100}%`,
                    width: `${((seg.endTime - seg.startTime) / TOTAL_DURATION) * 100}%`,
                  }}
                >
                  <span className="truncate">{seg.text.slice(0, 8)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProjectBackupModal ───────────────────────────────────────────────────────
interface BackupOptions {
  json: boolean;
  csv: boolean;
  srt: boolean;
}

export function ProjectBackupModal({
  onClose,
  title,
  topic,
  duration,
  thumbnailUrl,
}: {
  onClose: () => void;
  title: string;
  topic: string;
  duration: number;
  thumbnailUrl: string;
}) {
  const [options, setOptions] = useState<BackupOptions>({ json: true, csv: true, srt: true });
  const [step, setStep] = useState<'options' | 'done'>('options');
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);

  const toggle = (key: keyof BackupOptions) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleBackup = () => {
    const base = safeFilename(title);
    const stamp = dateStamp();
    const files: string[] = [];

    if (options.json) {
      const meta = {
        title,
        topic,
        duration,
        thumbnailUrl,
        exportedAt: new Date().toISOString(),
        tool: 'YouTube Studio',
        status: 'completed',
      };
      downloadJson(meta, `${base}_${stamp}.json`);
      files.push(`${base}_${stamp}.json`);
    }
    if (options.csv) {
      const row = buildProjectCsvRow({
        id: `yt_${stamp}`,
        title,
        topic,
        status: 'completed',
        duration,
        ratio: '16:9',
        style: 'YouTube Studio',
        model: 'GoAPI',
        mode: 'manual',
        cuts: 6,
        views: 0,
        likes: 0,
        createdAt: new Date().toISOString(),
      });
      downloadCsv(`${PROJECT_CSV_HEADER}\n${row}`, `${base}_${stamp}_report.csv`);
      files.push(`${base}_${stamp}_report.csv`);
    }
    if (options.srt) {
      const srt = buildSrtContent(title, topic, duration);
      downloadText(srt, `${base}_${stamp}.srt`, 'text/plain');
      files.push(`${base}_${stamp}.srt`);
    }

    setDownloadedFiles(files);
    setStep('done');
  };

  const fileIcons: Record<string, string> = {
    json: 'ri-code-s-slash-line',
    csv: 'ri-table-line',
    srt: 'ri-closed-captioning-line',
  };
  const fileColors: Record<string, string> = {
    json: 'text-amber-400',
    csv: 'text-emerald-400',
    srt: 'text-sky-400',
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <i className="ri-archive-drawer-line text-teal-400 text-sm" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">프로젝트 백업</p>
              <p className="text-zinc-500 text-xs mt-0.5">로컬에 파일로 저장합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
          >
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {step === 'options' ? (
            <>
              <div className="relative rounded-xl overflow-hidden">
                <img src={thumbnailUrl} alt={title} className="w-full h-28 object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end px-3 py-2">
                  <p className="text-white text-xs font-bold truncate">{title}</p>
                </div>
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {duration}초
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">백업할 파일 선택</p>
                <div className="space-y-2">
                  {(
                    [
                      {
                        key: 'json' as const,
                        label: '프로젝트 메타데이터',
                        desc: 'JSON 형식 · 제목, 주제, 설정 정보',
                        icon: 'ri-code-s-slash-line',
                        color: 'text-amber-400',
                        bg: 'bg-amber-500/10',
                      },
                      {
                        key: 'csv' as const,
                        label: '성과 리포트',
                        desc: 'CSV 형식 · Excel 호환',
                        icon: 'ri-table-line',
                        color: 'text-emerald-400',
                        bg: 'bg-emerald-500/10',
                      },
                      {
                        key: 'srt' as const,
                        label: '자막 파일',
                        desc: 'SRT 형식 · 타임코드 포함',
                        icon: 'ri-closed-captioning-line',
                        color: 'text-sky-400',
                        bg: 'bg-sky-500/10',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => toggle(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                        options[item.key]
                          ? 'border-teal-500/40 bg-teal-500/8'
                          : 'border-white/6 bg-zinc-800/40 hover:border-white/12'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                        <i className={`${item.icon} ${item.color} text-sm`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200">{item.label}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          options[item.key] ? 'border-teal-500 bg-teal-500' : 'border-zinc-600'
                        }`}
                      >
                        {options[item.key] && <i className="ri-check-line text-white text-[9px]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {!options.json && !options.csv && !options.srt && (
                <p className="text-[11px] text-amber-400/80 text-center">최소 하나 이상의 파일을 선택해주세요</p>
              )}
              <button
                onClick={handleBackup}
                disabled={!options.json && !options.csv && !options.srt}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-download-2-line" /> 백업 다운로드
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
                <i className="ri-checkbox-circle-fill text-teal-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">백업 완료!</p>
                <p className="text-zinc-500 text-xs mt-1">{downloadedFiles.length}개 파일이 다운로드되었습니다</p>
              </div>
              <div className="w-full bg-zinc-800/60 rounded-xl p-3 space-y-2">
                {downloadedFiles.map((f) => {
                  const ext = f.split('.').pop() ?? '';
                  return (
                    <div key={f} className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <i className={`${fileIcons[ext] ?? 'ri-file-line'} ${fileColors[ext] ?? 'text-zinc-400'} text-sm`} />
                      </div>
                      <span className="text-[11px] text-zinc-300 font-mono truncate">{f}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PremiereExportModal ──────────────────────────────────────────────────────
export function PremiereExportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'options' | 'exporting' | 'done'>('options');
  const [progress, setProgress] = useState(0);
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeMotion, setIncludeMotion] = useState(false);
  const [fps, setFps] = useState('30');

  const handleExport = () => {
    setStep('exporting');
    setProgress(0);
    const steps = [
      { target: 20 }, { target: 40 }, { target: 65 }, { target: 85 }, { target: 100 },
    ];
    let i = 0;
    const go = () => {
      if (i >= steps.length) { setStep('done'); return; }
      const target = steps[i].target;
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= target) { clearInterval(interval); i++; setTimeout(go, 200); return target; }
          return Math.min(p + 3, target);
        });
      }, 60);
    };
    go();
  };

  const handleDownload = () => {
    const blob = new Blob(['Premiere Pro Export Package'], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'premiere_export.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <i className="ri-film-line text-indigo-400 text-sm" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">프리미어 프로 내보내기</p>
              <p className="text-zinc-500 text-xs mt-0.5">ZIP 패키지로 내보내기</p>
            </div>
          </div>
          {step !== 'exporting' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-4">
          {step === 'options' && (
            <>
              <div className="space-y-3">
                <p className="text-xs font-bold text-zinc-300">포함할 항목</p>
                {[
                  { label: '자막 (SRT + XML)', desc: '타임코드 포함 자막 파일', val: includeSubtitles, set: setIncludeSubtitles, icon: 'ri-closed-captioning-line' },
                  { label: '오디오 트랙', desc: '나레이션 + 배경음악', val: includeAudio, set: setIncludeAudio, icon: 'ri-music-line' },
                  { label: '모션 그래픽 템플릿', desc: '.mogrt 파일 포함', val: includeMotion, set: setIncludeMotion, icon: 'ri-magic-line' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center">
                        <i className={`${item.icon} text-zinc-400 text-xs`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{item.label}</p>
                        <p className="text-[10px] text-zinc-500">{item.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => item.set(!item.val)}
                      className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${item.val ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${item.val ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">프레임 레이트</p>
                <div className="flex gap-2">
                  {['24', '30', '60'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${fps === f ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {f} fps
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-download-line" /> ZIP 내보내기 시작
              </button>
            </>
          )}
          {step === 'exporting' && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="relative w-16 h-16">
                <div className="w-16 h-16 rounded-full border-2 border-zinc-700" />
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{progress}%</span>
                </div>
              </div>
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">패키지 생성 중...</span>
                  <span className="text-xs text-zinc-400">{progress}%</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <i className="ri-check-line text-emerald-400 text-2xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">패키지 생성 완료!</p>
                <p className="text-zinc-500 text-xs mt-1">premiere_export.zip 파일이 준비되었습니다</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  닫기
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-download-line" /> 다운로드
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SaveToGalleryModal ───────────────────────────────────────────────────────
export function SaveToGalleryModal({
  onClose,
  onSave,
  thumbnailUrl,
  defaultTitle,
  duration,
  onBackup,
}: {
  onClose: () => void;
  onSave: (title: string) => void;
  thumbnailUrl: string;
  defaultTitle: string;
  duration: number;
  onBackup?: () => void;
}) {
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

// ─── RenderModal ──────────────────────────────────────────────────────────────
export function RenderModal({
  mode,
  onClose,
  onRenderComplete,
}: {
  mode: 'local' | 'server';
  onClose: () => void;
  onRenderComplete?: (quality: string, format: string) => void;
}) {
  const [step, setStep] = useState<'options' | 'rendering' | 'done'>('options');
  const [progress, setProgress] = useState(0);
  const [currentCut, setCurrentCut] = useState(0);
  const [quality, setQuality] = useState('1080p');
  const [format, setFormat] = useState('mp4');
  const [currentStepLabel, setCurrentStepLabel] = useState('');

  const renderSteps = [
    '영상 클립 로딩 중...',
    '자막 합성 중...',
    '오디오 믹싱 중...',
    '컷 편집 처리 중...',
    '최종 인코딩 중...',
    '파일 저장 중...',
  ];

  const handleRender = () => {
    setStep('rendering');
    setProgress(0);
    setCurrentCut(0);
    let p = 0;
    let stepIdx = 0;
    setCurrentStepLabel(renderSteps[0]);
    const interval = setInterval(() => {
      p += mode === 'server' ? 4 : 1.5;
      if (p >= 100) {
        clearInterval(interval);
        setProgress(100);
        setCurrentCut(6);
        setTimeout(() => setStep('done'), 500);
        return;
      }
      setProgress(Math.min(p, 100));
      setCurrentCut(Math.floor((p / 100) * 6));
      const newStepIdx = Math.floor((p / 100) * renderSteps.length);
      if (newStepIdx !== stepIdx && newStepIdx < renderSteps.length) {
        stepIdx = newStepIdx;
        setCurrentStepLabel(renderSteps[stepIdx]);
      }
    }, mode === 'server' ? 80 : 200);
  };

  const handleDownload = () => {
    const blob = new Blob(['FAKE VIDEO FILE'], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_video_${quality}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={step !== 'rendering' ? onClose : undefined}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'local' ? 'bg-indigo-500/20' : 'bg-violet-500/20'}`}>
              <i className={`${mode === 'local' ? 'ri-computer-line text-indigo-400' : 'ri-server-line text-violet-400'} text-sm`} />
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                {mode === 'local' ? '로컬 렌더링' : '서버 초고속 렌더링'}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {mode === 'local' ? '브라우저에서 직접 처리 · 무료' : '클라우드 GPU 가속 · 크레딧 7 소모'}
              </p>
            </div>
          </div>
          {step !== 'rendering' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-4">
          {step === 'options' && (
            <>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">출력 품질</p>
                <div className="grid grid-cols-3 gap-2">
                  {['720p', '1080p', '4K'].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${quality === q ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {q}
                      {q === '4K' && <span className="block text-[9px] font-normal opacity-70">크레딧 추가</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">파일 형식</p>
                <div className="flex gap-2">
                  {['mp4', 'webm', 'mov'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap uppercase ${format === f ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '총 컷 수', val: '6컷' },
                    { label: '영상 길이', val: '0:38' },
                    { label: '예상 크기', val: quality === '4K' ? '~280MB' : quality === '1080p' ? '~45MB' : '~22MB' },
                    { label: '예상 시간', val: mode === 'server' ? '~30초' : '~3분' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600">{item.label}</span>
                      <span className="text-[10px] text-zinc-300 font-semibold">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleRender}
                className={`w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                  mode === 'local'
                    ? 'bg-indigo-500 hover:bg-indigo-400'
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500'
                }`}
              >
                <i className={mode === 'local' ? 'ri-computer-line' : 'ri-server-line'} />
                {mode === 'local' ? '로컬 렌더링 시작' : '서버 렌더링 시작'}
                {mode === 'server' && (
                  <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                    <i className="ri-sparkling-2-line text-[10px]" />7
                  </span>
                )}
              </button>
            </>
          )}
          {step === 'rendering' && (
            <div className="flex flex-col items-center gap-5 py-2">
              <div className="relative w-full h-[140px] rounded-xl overflow-hidden bg-zinc-800">
                <img
                  src="https://readdy.ai/api/search-image?query=busy%20modern%20city%20street%20morning%20people%20checking%20smartphones%20digital%20billboards%20cinematic&width=400&height=140&seq=render_anim&orientation=landscape"
                  alt=""
                  className="w-full h-full object-cover object-top opacity-60"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-xs font-bold">렌더링 중...</span>
                  </div>
                  <span className="text-zinc-400 text-[10px]">{currentStepLabel}</span>
                </div>
              </div>
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{Math.round(progress)}% 완료</span>
                  <span className="text-xs text-zinc-400">Cut {currentCut}/6</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${mode === 'server' ? 'bg-gradient-to-r from-violet-500 to-purple-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className={`flex-1 h-1.5 rounded-full transition-all ${n <= currentCut ? (mode === 'server' ? 'bg-violet-500' : 'bg-indigo-500') : 'bg-zinc-700'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="relative w-full h-[120px] rounded-xl overflow-hidden">
                <img
                  src="https://readdy.ai/api/search-image?query=busy%20modern%20city%20street%20morning%20people%20checking%20smartphones%20digital%20billboards%20cinematic&width=400&height=120&seq=render_done&orientation=landscape"
                  alt=""
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/80 flex items-center justify-center">
                    <i className="ri-check-line text-white text-2xl" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                  0:38 · {quality} · {format.toUpperCase()}
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">렌더링 완료!</p>
                <p className="text-zinc-500 text-xs mt-1">
                  ai_video_{quality}.{format} 파일이 준비되었습니다
                </p>
              </div>
              <div className="w-full bg-zinc-800/60 rounded-xl p-3 space-y-1.5">
                {[
                  { label: '파일 크기', val: quality === '4K' ? '~280MB' : quality === '1080p' ? '~45MB' : '~22MB' },
                  { label: '해상도', val: quality === '4K' ? '3840×2160' : quality === '1080p' ? '1920×1080' : '1280×720' },
                  { label: '형식', val: `${format.toUpperCase()} · H.264` },
                  { label: '렌더링 방식', val: mode === 'local' ? '로컬 (무료)' : '서버 GPU' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{item.label}</span>
                    <span className="text-[10px] text-zinc-300 font-semibold">{item.val}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  닫기
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-download-line" /> 다운로드
                </button>
              </div>
              <div className="w-full bg-teal-500/8 border border-teal-500/20 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <i className="ri-archive-drawer-line text-teal-400 text-sm flex-shrink-0" />
                <p className="text-[11px] text-teal-300/80 flex-1">
                  렌더링 완료 후 프로젝트 메타데이터를 백업하려면 갤러리 저장 후 백업 버튼을 이용하세요.
                </p>
              </div>
              {onRenderComplete && (
                <button
                  onClick={() => onRenderComplete(quality, format)}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-folder-video-line" /> 갤러리에 저장하기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
