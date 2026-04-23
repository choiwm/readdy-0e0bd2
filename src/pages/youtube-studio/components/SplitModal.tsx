import { useState, useRef, useEffect } from 'react';
import { type SubtitleSegment, TOTAL_DURATION, formatTime } from './step6-modals-shared';

interface SplitModalProps {
  segments: SubtitleSegment[];
  onClose: () => void;
  onApply: (segs: SubtitleSegment[]) => void;
}

export default function SplitModal({ segments, onClose, onApply }: SplitModalProps) {
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
