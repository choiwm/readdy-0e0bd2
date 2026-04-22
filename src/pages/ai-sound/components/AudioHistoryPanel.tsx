import { useState, useEffect } from 'react';
import { AudioHistoryItem, AudioType } from '@/mocks/audioHistory';
import EmptyState from '@/components/base/EmptyState';

const typeConfig: Record<AudioType, { label: string; color: string; bg: string; icon: string }> = {
  tts: { label: 'TTS', color: 'text-indigo-400', bg: 'bg-indigo-500/15', icon: 'ri-chat-voice-line' },
  clone: { label: 'Clone', color: 'text-violet-400', bg: 'bg-violet-500/15', icon: 'ri-user-voice-line' },
  effect: { label: 'Effect', color: 'text-cyan-400', bg: 'bg-cyan-500/15', icon: 'ri-sound-module-line' },
  music: { label: 'Music', color: 'text-pink-400', bg: 'bg-pink-500/15', icon: 'ri-music-2-line' },
};

const statusConfig = {
  completed: { color: 'text-emerald-400', dot: 'bg-emerald-400' },
  generating: { color: 'text-violet-400', dot: 'bg-violet-400' },
  failed: { color: 'text-red-400', dot: 'bg-red-400' },
};

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

interface WaveformProps {
  playing: boolean;
  color: string;
  compact?: boolean;
}

function Waveform({ playing, color, compact = false }: WaveformProps) {
  const bars = compact
    ? [3, 7, 5, 10, 6, 9, 4, 8, 5]
    : [3, 7, 5, 10, 6, 9, 4, 8, 5, 7, 3, 6, 9, 5, 8];
  return (
    <div className={`flex items-center gap-[2px] ${compact ? 'h-5' : 'h-6'}`}>
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-[2px] rounded-full transition-all ${color} ${playing ? 'animate-pulse' : ''}`}
          style={{
            height: `${h * (compact ? 1.6 : 2)}px`,
            animationDelay: `${i * 60}ms`,
            opacity: playing ? 1 : 0.4,
          }}
        />
      ))}
    </div>
  );
}

interface AudioHistoryPanelProps {
  items: AudioHistoryItem[];
  onItemsChange: (items: AudioHistoryItem[]) => void;
}

export default function AudioHistoryPanel({ items, onItemsChange }: AudioHistoryPanelProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | AudioType>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [liked, setLiked] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((a) => [a.id, a.liked]))
  );

  useEffect(() => {
    setLiked((prev) => {
      const next = { ...prev };
      items.forEach((a) => {
        if (!(a.id in next)) next[a.id] = a.liked;
      });
      return next;
    });
  }, [items]);

  const filtered = items.filter((item) => {
    const matchFilter = filter === 'all' || item.type === filter;
    const matchSearch =
      !search.trim() ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.voiceName.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleDelete = (id: string) => onItemsChange(items.filter((i) => i.id !== id));
  const handleLike = (id: string) => setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  const handlePlay = (id: string) => setPlayingId(playingId === id ? null : id);

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const totalDuration = items.filter((i) => i.status === 'completed').reduce((s, i) => s + i.duration, 0);

  return (
    <div
      className="w-full md:w-[300px] flex-shrink-0 bg-[#111113] border border-white/5 rounded-2xl flex flex-col overflow-hidden"
      style={{ maxHeight: 'calc(100vh - 200px)' }}
    >
      {/* Header */}
      <div className="px-3 md:px-4 pt-3 md:pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2.5 md:mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-lg bg-indigo-500/15">
              <i className="ri-history-line text-indigo-400 text-xs md:text-sm" />
            </div>
            <span className="text-xs md:text-sm font-bold text-white">History</span>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 md:px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>
          <div className="flex gap-1">
            <button className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer">
              <i className="ri-download-line text-xs" />
            </button>
            <button className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer">
              <i className="ri-delete-bin-line text-xs" />
            </button>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-2 gap-1.5 md:gap-2 mb-2.5 md:mb-3">
          <div className="bg-zinc-900/60 border border-white/5 rounded-lg p-1.5 md:p-2 text-center">
            <p className="text-xs md:text-sm font-bold text-indigo-400">{completedCount}</p>
            <p className="text-[9px] md:text-[10px] text-zinc-500">생성 완료</p>
          </div>
          <div className="bg-zinc-900/60 border border-white/5 rounded-lg p-1.5 md:p-2 text-center">
            <p className="text-xs md:text-sm font-bold text-violet-400">{formatDuration(totalDuration)}</p>
            <p className="text-[9px] md:text-[10px] text-zinc-500">총 길이</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2.5 md:mb-3">
          <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-xs" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목, 보이스 검색..."
            className="w-full bg-zinc-900/60 border border-white/5 text-zinc-300 text-xs pl-7 pr-3 py-1.5 md:py-2 rounded-lg outline-none focus:border-indigo-500/40 transition-colors"
          />
        </div>

        {/* Type filter — horizontal scroll on mobile */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {(['all', 'tts', 'clone', 'effect', 'music'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap border flex-shrink-0 ${
                filter === t
                  ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                  : 'bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10'
              }`}
            >
              {t === 'all' ? '전체' : typeConfig[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-1.5 md:p-2 flex flex-col gap-1 md:gap-1.5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={items.length === 0 ? 'ri-mic-line' : 'ri-inbox-line'}
            title={items.length === 0 ? '아직 생성된 항목이 없습니다' : '결과가 없습니다'}
            description={items.length === 0 ? '음성을 생성해보세요' : '다른 필터를 선택해보세요'}
            size="sm"
            actions={
              filter !== 'all'
                ? [{ label: '필터 초기화', onClick: () => setFilter('all'), icon: 'ri-close-line', variant: 'ghost' }]
                : []
            }
          />
        ) : (
          filtered.map((item) => {
            const typeCfg = typeConfig[item.type];
            const statusCfg = statusConfig[item.status];
            const isPlaying = playingId === item.id;
            const isLiked = liked[item.id];

            return (
              <HistoryCard
                key={item.id}
                item={item}
                typeCfg={typeCfg}
                statusCfg={statusCfg}
                isPlaying={isPlaying}
                isLiked={isLiked}
                onPlay={() => handlePlay(item.id)}
                onLike={() => handleLike(item.id)}
                onDelete={() => handleDelete(item.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── History Card (extracted for clarity) ─── */
interface HistoryCardProps {
  item: AudioHistoryItem;
  typeCfg: { label: string; color: string; bg: string; icon: string };
  statusCfg: { color: string; dot: string };
  isPlaying: boolean;
  isLiked: boolean;
  onPlay: () => void;
  onLike: () => void;
  onDelete: () => void;
}

function HistoryCard({
  item,
  typeCfg,
  statusCfg,
  isPlaying,
  isLiked,
  onPlay,
  onLike,
  onDelete,
}: HistoryCardProps) {
  return (
    <div
      className={`group rounded-xl border transition-all p-2.5 md:p-3 active:scale-[0.99] ${
        isPlaying
          ? 'bg-indigo-500/8 border-indigo-500/30'
          : 'bg-zinc-900/50 border-white/5 hover:border-white/10'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start gap-2 mb-1.5 md:mb-2">
        <div className="relative flex-shrink-0">
          <img
            src={item.voiceAvatar}
            alt={item.voiceName}
            className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover"
          />
          {item.status === 'generating' && (
            <div className="absolute inset-0 rounded-full border-2 border-violet-400/40 border-t-violet-400 animate-spin" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] md:text-xs font-bold text-white truncate leading-tight">{item.title}</p>
          <p className="text-[9px] md:text-[10px] text-zinc-500 truncate">
            {item.voiceName}
            <span className="hidden sm:inline"> · {item.lang}</span>
          </p>
        </div>

        <span
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${typeCfg.bg} ${typeCfg.color}`}
        >
          {typeCfg.label}
        </span>
      </div>

      {/* Text preview — 1 line on mobile, 2 on desktop */}
      <p className="text-[10px] text-zinc-600 line-clamp-1 md:line-clamp-2 mb-1.5 md:mb-2 leading-relaxed">
        {item.text}
      </p>

      {/* Waveform + play */}
      {item.status === 'completed' && (
        <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
          <button
            onClick={onPlay}
            className={`w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full flex-shrink-0 cursor-pointer transition-colors ${
              isPlaying
                ? 'bg-indigo-500 text-white'
                : 'bg-zinc-800 hover:bg-indigo-600 text-white'
            }`}
          >
            <i
              className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-[9px] md:text-[10px] ${
                isPlaying ? '' : 'ml-px'
              }`}
            />
          </button>
          <div className="flex-1 overflow-hidden">
            <Waveform playing={isPlaying} color="bg-indigo-400" compact />
          </div>
          <span className="text-[10px] text-zinc-600 flex-shrink-0">{formatDuration(item.duration)}</span>
        </div>
      )}

      {/* Generating progress */}
      {item.status === 'generating' && item.progress !== undefined && (
        <div className="mb-1.5 md:mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-violet-400 animate-pulse">생성 중...</span>
            <span className="text-[10px] text-violet-400">{item.progress}%</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 rounded-full"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Failed */}
      {item.status === 'failed' && (
        <div className="flex items-center gap-2 mb-1.5 md:mb-2 bg-red-500/10 rounded-lg px-2 py-1.5">
          <i className="ri-error-warning-line text-red-400 text-xs" />
          <span className="text-[10px] text-red-400">생성 실패</span>
          <button className="ml-auto text-[10px] text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-0.5">
            <i className="ri-refresh-line text-[10px]" /> 재시도
          </button>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
          <span className="text-[10px] text-zinc-600">{timeAgo(item.createdAt)}</span>
          {item.status === 'completed' && (
            <span className="text-[10px] text-zinc-700 hidden sm:inline">· {item.fileSize}</span>
          )}
        </div>

        {/* Action buttons:
            - Desktop: hidden until hover (group-hover)
            - Mobile: always visible (touch-friendly) */}
        <div className="flex items-center gap-0.5 md:gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={onLike}
            className={`w-6 h-6 md:w-5 md:h-5 flex items-center justify-center rounded cursor-pointer transition-colors ${
              isLiked ? 'text-red-400' : 'text-zinc-500 hover:text-red-400'
            }`}
          >
            <i className={`${isLiked ? 'ri-heart-fill' : 'ri-heart-line'} text-[11px] md:text-[10px]`} />
          </button>
          {item.status === 'completed' && (
            <button className="w-6 h-6 md:w-5 md:h-5 flex items-center justify-center rounded text-zinc-500 hover:text-indigo-400 cursor-pointer transition-colors">
              <i className="ri-download-line text-[11px] md:text-[10px]" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="w-6 h-6 md:w-5 md:h-5 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 cursor-pointer transition-colors"
          >
            <i className="ri-delete-bin-line text-[11px] md:text-[10px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
