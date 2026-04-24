import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioHistoryItem } from '@/mocks/audioHistory';
import { useAudioPlayer } from '@/pages/ai-sound/hooks/useAudioPlayer';
import ConfirmModal from '@/components/base/ConfirmModal';
import { Toast } from '@/components/base/Toast';
import EmptyState from '@/components/base/EmptyState';

type AudioStatus = 'completed' | 'generating' | 'failed';
type AudioType = 'tts' | 'clone' | 'effect' | 'music';
type TypeFilter = 'all' | AudioType;
type StatusFilter = 'all' | 'completed' | 'generating' | 'failed';

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '방금 전';
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const TYPE_CONFIG: Record<AudioType, { label: string; color: string; bg: string; border: string; dot: string }> = {
  tts:    { label: 'TTS',   color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/25',  dot: 'bg-indigo-400'  },
  clone:  { label: 'Clone', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/25',  dot: 'bg-violet-400'  },
  effect: { label: 'SFX',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  music:  { label: 'Music', color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/25',    dot: 'bg-pink-400'    },
};

const STATUS_CONFIG: Record<AudioStatus, { dot: string; label: string }> = {
  completed:  { dot: 'bg-emerald-400',              label: '완료'    },
  generating: { dot: 'bg-indigo-400 animate-pulse', label: '생성 중' },
  failed:     { dot: 'bg-red-400',                  label: '실패'    },
};

const TYPE_FILTERS: { key: TypeFilter; label: string; icon: string }[] = [
  { key: 'all',    label: 'All',   icon: 'ri-apps-2-line'       },
  { key: 'tts',    label: 'TTS',   icon: 'ri-chat-voice-line'   },
  { key: 'clone',  label: 'Clone', icon: 'ri-user-voice-line'   },
  { key: 'music',  label: 'Music', icon: 'ri-music-2-line'      },
  { key: 'effect', label: 'SFX',   icon: 'ri-sound-module-line' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all',        label: '전체'    },
  { key: 'completed',  label: '완료'    },
  { key: 'generating', label: '생성 중' },
  { key: 'failed',     label: '실패'    },
];

// audioUrl 없는 항목 다운로드 fallback — WAV 합성음
function generateAudioBlob(durationSec: number, type: AudioType): Blob {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  const freqSets: Record<AudioType, number[]> = {
    tts: [220, 330, 440], music: [261, 329, 392], effect: [80, 160, 320], clone: [196, 294, 392],
  };
  const freqs = freqSets[type];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(t * 4, 1) * Math.min((durationSec - t) * 4, 1);
    let sample = 0;
    freqs.forEach((f, idx) => { sample += Math.sin(2 * Math.PI * f * t) * (0.3 / (idx + 1)); });
    const val = Math.max(-1, Math.min(1, sample * envelope));
    view.setInt16(44 + i * 2, val * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

interface HistoryPanelProps {
  items: AudioHistoryItem[];
  onItemsChange: (items: AudioHistoryItem[]) => void;
  onRemoveItem?: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onRetry?: (item: any) => void;
  highlightedId?: string | null;
}

export default function HistoryPanel({ items, onItemsChange, onRemoveItem, onRetry, highlightedId }: HistoryPanelProps) {
  const [search, setSearch]             = useState('');
  const [typeFilter, setTypeFilter]     = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collapsed, setCollapsed]       = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [starredOnly, setStarredOnly]   = useState(false);
  const [liked,   setLiked]   = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((a) => [a.id, a.liked]))
  );
  const [starred, setStarred] = useState<Record<string, boolean>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedId,  setDownloadedId]  = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showDeletedToast, setShowDeletedToast] = useState(false);

  const listRef  = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { playingId: _playingId, progress: playProgress, toggle, isPlaying } = useAudioPlayer();

  useEffect(() => {
    if (!highlightedId) return;
    const el = itemRefs.current[highlightedId];
    if (el && listRef.current) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightedId]);

  useEffect(() => {
    setLiked((prev) => {
      const next = { ...prev };
      items.forEach((a) => { if (!(a.id in next)) next[a.id] = a.liked; });
      return next;
    });
    setStarred((prev) => {
      const next = { ...prev };
      items.forEach((a) => { if (!(a.id in next)) next[a.id] = false; });
      return next;
    });
  }, [items]);

  const starredCount = Object.values(starred).filter(Boolean).length;

  const filtered = items.filter((item) => {
    const matchType   = typeFilter === 'all'   || item.type   === typeFilter;
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchSearch = !search.trim()
      || item.title.toLowerCase().includes(search.toLowerCase())
      || item.voiceName.toLowerCase().includes(search.toLowerCase());
    const matchStarred = !starredOnly || starred[item.id];
    return matchType && matchStatus && matchSearch && matchStarred;
  });

  const countByType = (t: TypeFilter) =>
    t === 'all' ? items.length : items.filter((i) => i.type === t).length;

  const handleDeleteRequest = useCallback((id: string) => setDeleteTargetId(id), []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTargetId) return;
    onItemsChange(items.filter((i) => i.id !== deleteTargetId));
    onRemoveItem?.(deleteTargetId);
    setDeleteTargetId(null);
    setShowDeletedToast(true);
    setTimeout(() => setShowDeletedToast(false), 2800);
  }, [deleteTargetId, items, onItemsChange, onRemoveItem]);

  const handleDeleteCancel = useCallback(() => setDeleteTargetId(null), []);
  const handleLike = (id: string) => setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleStar = (id: string) => setStarred((prev) => ({ ...prev, [id]: !prev[id] }));

  const getAudioUrl = (item: AudioHistoryItem): string | undefined => {
    const ext = item as AudioHistoryItem & { audioUrl?: string; storageUrl?: string };
    return ext.storageUrl ?? ext.audioUrl;
  };

  const handlePlay = useCallback((item: AudioHistoryItem) => {
    if (item.status !== 'completed') return;
    const audioUrl = getAudioUrl(item);
    if (!audioUrl) return;
    toggle(item.id, item.duration || 5, item.type, audioUrl);
  }, [toggle]);

  const handleDownload = useCallback(async (item: AudioHistoryItem) => {
    if (item.status !== 'completed') return;
    const audioUrl = getAudioUrl(item);
    setDownloadingId(item.id);
    try {
      if (audioUrl) {
        const res = await fetch(audioUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = blob.type.includes('wav') ? 'wav' : 'mp3';
        a.download = `${item.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_').trim()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const blob = generateAudioBlob(item.duration || 5, item.type);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_').trim()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setDownloadedId(item.id);
      setTimeout(() => setDownloadedId(null), 2000);
    } catch (_) { /* ignore */ }
    finally { setDownloadingId(null); }
  }, []);

  /* ── Collapsed ── */
  if (collapsed) {
    return (
      <div className="h-full bg-[#111113] border-l border-white/5 flex flex-col w-[48px] flex-shrink-0 items-center py-4 gap-3">
        <button onClick={() => setCollapsed(false)} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer text-zinc-500 hover:text-white" title="History 열기">
          <i className="ri-arrow-left-s-line text-sm" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <i className="ri-history-line text-indigo-400 text-sm" />
        </div>
        {starredCount > 0 && (
          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <span className="text-[9px] font-black text-yellow-400">{starredCount}</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-1 mt-1">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className={`w-7 h-7 rounded-full overflow-hidden border flex-shrink-0 ${starred[item.id] ? 'border-yellow-400/50' : 'border-white/10'}`}>
              <img src={item.voiceAvatar} alt={item.voiceName} className="w-full h-full object-cover" />
            </div>
          ))}
          {items.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
              <span className="text-[9px] text-zinc-400 font-bold">+{items.length - 5}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const deleteTarget = deleteTargetId ? items.find((i) => i.id === deleteTargetId) : null;

  /* ── Expanded ── */
  return (
    <div className="h-full bg-[#111113] border-l border-white/5 flex flex-col w-full md:w-[360px] flex-shrink-0">
      {deleteTarget && (
        <ConfirmModal
          title="히스토리 삭제"
          description="이 항목을 삭제하면 복구할 수 없습니다."
          confirmLabel="삭제"
          cancelLabel="취소"
          variant="danger"
          previewText={deleteTarget.title}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
      {showDeletedToast && (
        <Toast message="히스토리 항목이 삭제되었습니다" type="info" onClose={() => setShowDeletedToast(false)} />
      )}

      {/* Header */}
      <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 md:pb-4 border-b border-white/5 flex-shrink-0 space-y-3 md:space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <i className="ri-history-line text-indigo-400 text-sm" />
            </div>
            <h2 className="font-bold text-white text-base md:text-lg">History</h2>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-bold">{items.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setStarredOnly(!starredOnly)}
              className={`relative w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${starredOnly ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'hover:bg-white/5 text-zinc-500 hover:text-yellow-400'}`}
              title={starredOnly ? '전체 보기' : '즐겨찾기만 보기'}
            >
              <i className={`${starredOnly ? 'ri-star-fill' : 'ri-star-line'} text-sm`} />
              {starredCount > 0 && !starredOnly && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 text-[8px] font-black text-black flex items-center justify-center">{starredCount}</span>
              )}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${showFilters ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-white/5 text-zinc-500 hover:text-white'}`}
              title="필터 토글"
            >
              <i className="ri-equalizer-3-line text-sm" />
            </button>
            <button
              onClick={() => setCollapsed(true)}
              className="w-7 h-7 md:w-8 md:h-8 rounded-lg hover:bg-white/5 hidden md:flex items-center justify-center transition-colors cursor-pointer text-zinc-500 hover:text-white"
              title="History 접기"
            >
              <i className="ri-arrow-right-s-line text-sm" />
            </button>
          </div>
        </div>

        {starredOnly && (
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-yellow-500/8 border border-yellow-500/20">
            <div className="flex items-center gap-2">
              <i className="ri-star-fill text-yellow-400 text-xs" />
              <span className="text-[11px] font-bold text-yellow-400">즐겨찾기</span>
              <span className="text-[10px] text-yellow-500/70">{starredCount}개</span>
            </div>
            <button onClick={() => setStarredOnly(false)} className="text-[10px] text-yellow-500/60 hover:text-yellow-400 cursor-pointer transition-colors flex items-center gap-1">
              <i className="ri-close-line text-xs" /> 해제
            </button>
          </div>
        )}

        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목, 보이스 검색..."
            className="w-full bg-zinc-900/60 border border-white/5 rounded-xl py-2 md:py-2.5 pl-9 pr-4 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer">
              <i className="ri-close-line text-xs" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {TYPE_FILTERS.map(({ key, label, icon }) => {
            const count  = countByType(key);
            const active = typeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${active ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-zinc-900/60 border border-transparent text-zinc-500 hover:text-zinc-300 hover:border-white/10'}`}
              >
                <i className={`${icon} text-xs`} />
                {label}
                <span className={`ml-0.5 px-1 py-px rounded text-[9px] font-black ${active ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800 text-zinc-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {showFilters && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 pt-1">
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mr-1 flex-shrink-0">상태</span>
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${statusFilter === key ? 'bg-white/10 border border-white/15 text-white' : 'bg-zinc-900/60 border border-transparent text-zinc-500 hover:text-zinc-300'}`}
              >
                {label}
                {key !== 'all' && <span className="ml-1 text-[9px]">{items.filter((i) => i.status === key).length}</span>}
              </button>
            ))}
          </div>
        )}

        {(typeFilter !== 'all' || statusFilter !== 'all' || starredOnly) && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500"><span className="text-indigo-400 font-bold">{filtered.length}</span>개 표시 중</span>
            <button onClick={() => { setTypeFilter('all'); setStatusFilter('all'); setStarredOnly(false); }} className="text-[10px] text-zinc-600 hover:text-zinc-300 cursor-pointer flex items-center gap-1 transition-colors">
              <i className="ri-close-line text-xs" /> 필터 초기화
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={starredOnly ? 'ri-star-line' : items.length === 0 ? 'ri-mic-line' : 'ri-inbox-line'}
            title={starredOnly ? '즐겨찾기가 없습니다' : items.length === 0 ? '아직 생성된 항목이 없습니다' : '필터 조건에 맞는 항목이 없습니다'}
            description={starredOnly ? '항목의 별표를 클릭해서 즐겨찾기에 추가하세요' : items.length === 0 ? 'TTS, 음악, 효과음을 생성해보세요' : '다른 필터를 선택해보세요'}
            size="sm"
            actions={(typeFilter !== 'all' || statusFilter !== 'all' || starredOnly) ? [
              { label: '필터 초기화', onClick: () => { setTypeFilter('all'); setStatusFilter('all'); setStarredOnly(false); }, icon: 'ri-close-line', variant: 'ghost' },
            ] : []}
          />
        ) : (
          filtered.map((item) => {
            const typeCfg     = TYPE_CONFIG[item.type];
            const statusCfg   = STATUS_CONFIG[item.status];
            const playing     = isPlaying(item.id);
            const playPct     = playProgress[item.id] ?? 0;
            const isLiked     = liked[item.id];
            const isStarred   = starred[item.id];
            const isHighlight = highlightedId === item.id;
            const audioUrl    = getAudioUrl(item);
            const hasAudio    = !!audioUrl;

            return (
              <div
                key={item.id}
                ref={(el) => { itemRefs.current[item.id] = el; }}
                className={`group rounded-xl border p-3 transition-all duration-500 ${
                  isHighlight
                    ? 'bg-emerald-500/8 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : isStarred
                    ? playing ? 'bg-yellow-500/5 border-yellow-500/25' : 'bg-yellow-500/5 border-yellow-500/15 hover:border-yellow-500/30'
                    : playing ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-zinc-900/50 border-white/5 hover:border-white/10 hover:bg-zinc-900/70'
                }`}
              >
                {isHighlight && (
                  <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">방금 생성됨</span>
                  </div>
                )}

                {/* Row 1 */}
                <div className="flex items-start gap-2.5 mb-2">
                  <div className="relative flex-shrink-0">
                    <img src={item.voiceAvatar} alt={item.voiceName} className={`w-8 h-8 rounded-full object-cover transition-all ${isStarred ? 'ring-1 ring-yellow-400/50' : ''}`} />
                    {item.status === 'generating' && (
                      <div className="absolute inset-0 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white truncate leading-tight">{item.title}</p>
                      {isStarred && <i className="ri-star-fill text-yellow-400 text-[10px] flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] text-zinc-500 truncate">{item.voiceName} · {item.lang}</p>
                  </div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border flex-shrink-0 ${typeCfg.color} ${typeCfg.bg} ${typeCfg.border}`}>
                    {typeCfg.label}
                  </span>
                </div>

                <p className="text-[10px] text-zinc-600 line-clamp-1 mb-2 leading-relaxed">{item.text}</p>

                {/* Waveform + play */}
                {item.status === 'completed' && (
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => handlePlay(item)}
                      disabled={!hasAudio}
                      title={hasAudio ? (playing ? '정지' : '재생') : '오디오 없음'}
                      className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 transition-colors ${
                        !hasAudio
                          ? 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'
                          : playing
                          ? 'bg-indigo-500 text-white cursor-pointer'
                          : 'bg-zinc-800 hover:bg-indigo-600 text-white cursor-pointer'
                      }`}
                    >
                      <i className={`${playing ? 'ri-pause-fill' : 'ri-play-fill'} text-[10px] ${!playing ? 'ml-px' : ''}`} />
                    </button>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center gap-[2px] h-5">
                        {[3, 7, 5, 10, 6, 9, 4, 8, 5, 7, 3, 6, 9, 5, 8, 4, 7].map((h, i) => (
                          <div
                            key={i}
                            className={`w-[2px] rounded-full ${playing ? 'bg-indigo-400' : 'bg-zinc-600'} ${playing ? 'animate-pulse' : ''}`}
                            style={{ height: `${h * 1.8}px`, animationDelay: `${i * 60}ms`, opacity: playing ? 1 : 0.5 }}
                          />
                        ))}
                      </div>
                      {playing && (
                        <div className="h-0.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full transition-all duration-100" style={{ width: `${playPct}%` }} />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600 flex-shrink-0 font-mono">{formatDuration(item.duration)}</span>
                  </div>
                )}

                {/* Generating progress */}
                {item.status === 'generating' && item.progress !== undefined && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-indigo-400 animate-pulse">생성 중...</span>
                      <span className="text-[10px] text-indigo-400 font-mono">{item.progress}%</span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                )}

                {/* Failed */}
                {item.status === 'failed' && (
                  <div className="flex items-center gap-2 mb-2 bg-red-500/8 rounded-lg px-2 py-1.5 border border-red-500/15">
                    <i className="ri-error-warning-line text-red-400 text-xs" />
                    <span className="text-[10px] text-red-400">생성 실패</span>
                    {onRetry && (
                      <button onClick={() => onRetry(item)} className="ml-auto text-[10px] text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-0.5 transition-colors">
                        <i className="ri-refresh-line text-[10px]" /> 재시도
                      </button>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                    <span className="text-[10px] text-zinc-600">{timeAgo(item.createdAt)}</span>
                    {item.status === 'completed' && <span className="text-[10px] text-zinc-700">· {item.fileSize}</span>}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleStar(item.id)}
                      className={`w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer transition-all ${isStarred ? 'text-yellow-400 bg-yellow-500/10' : 'text-zinc-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100'}`}
                      title={isStarred ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    >
                      <i className={`${isStarred ? 'ri-star-fill' : 'ri-star-line'} text-[10px]`} />
                    </button>
                    <button
                      onClick={() => handleLike(item.id)}
                      className={`w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${isLiked ? 'text-red-400' : 'text-zinc-600 hover:text-red-400'}`}
                    >
                      <i className={`${isLiked ? 'ri-heart-fill' : 'ri-heart-line'} text-[10px]`} />
                    </button>
                    {item.status === 'completed' && (
                      <button
                        onClick={() => handleDownload(item)}
                        className={`w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${downloadedId === item.id ? 'text-emerald-400' : downloadingId === item.id ? 'text-indigo-400' : 'text-zinc-600 hover:text-indigo-400'}`}
                        title="다운로드"
                      >
                        {downloadingId === item.id ? (
                          <div className="w-2.5 h-2.5 border border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin" />
                        ) : (
                          <i className={`${downloadedId === item.id ? 'ri-check-line' : 'ri-download-line'} text-[10px]`} />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteRequest(item.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      title="삭제"
                    >
                      <i className="ri-delete-bin-line text-[10px]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
