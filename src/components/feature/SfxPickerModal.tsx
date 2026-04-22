/**
 * SfxPickerModal — AI Sound에서 생성된 효과음/음악을 선택하는 공통 모달
 * AI Board, YouTube Studio 등에서 배경음으로 활용할 때 사용
 * SFX + Music 통합 탭 지원
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSfxStore, useSfxStoreListener, SfxItem } from '@/hooks/useSfxStore';
import { useNavigate } from 'react-router-dom';

interface SfxPickerModalProps {
  onSelect: (sfx: SfxItem) => void;
  onClose: () => void;
  selectedId?: string | null;
  title?: string;
}

// ── 미니 오디오 플레이어 ──────────────────────────────────────────────
function MiniPlayer({ sfx, isSelected }: { sfx: SfxItem; isSelected: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (audio.duration > 0) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnded = () => { setIsPlaying(false); setProgress(0); };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const fmt = (s: number | null) => {
    if (!s) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <audio ref={audioRef} src={sfx.audioUrl} preload="metadata" />
      <button
        onClick={toggle}
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
          isSelected ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-zinc-700 hover:bg-zinc-600'
        }`}
      >
        <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-[10px] ${!isPlaying ? 'ml-px' : ''}`} />
      </button>
      <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-100 ${isSelected ? 'bg-emerald-400' : 'bg-zinc-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[9px] text-zinc-600 font-mono flex-shrink-0">{fmt(sfx.duration)}</span>
    </div>
  );
}

// ── SFX/Music 아이템 카드 ─────────────────────────────────────────────
function SfxCard({
  sfx,
  isSelected,
  onSelect,
  onRemove,
}: {
  sfx: SfxItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const isMusic = sfx.type === 'music';
  const accentColor = isMusic ? 'indigo' : 'emerald';

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border p-3 cursor-pointer transition-all group ${
        isSelected
          ? isMusic
            ? 'bg-indigo-500/10 border-indigo-500/40'
            : 'bg-emerald-500/10 border-emerald-500/40'
          : 'bg-zinc-900/60 border-white/5 hover:border-white/15 hover:bg-zinc-900'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
            isSelected
              ? isMusic
                ? 'bg-indigo-500/20 border border-indigo-500/30'
                : 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-zinc-800 border border-white/5'
          }`}>
            {isSelected
              ? <i className={`ri-checkbox-circle-fill text-${accentColor}-400 text-sm`} />
              : isMusic
                ? <i className="ri-music-2-line text-zinc-500 text-xs" />
                : <i className="ri-sound-module-line text-zinc-500 text-xs" />
            }
          </div>
          <div className="min-w-0 flex-1">
            {sfx.title && (
              <p className="text-[10px] font-bold text-zinc-400 truncate">{sfx.title}</p>
            )}
            <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{sfx.prompt}</p>
            {sfx.tags && (
              <p className="text-[9px] text-zinc-600 truncate mt-0.5">{sfx.tags}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {sfx.storageUrl && (
            <div className="w-4 h-4 flex items-center justify-center" title="Supabase Storage에 저장됨">
              <i className="ri-cloud-fill text-emerald-500/60 text-[10px]" />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 transition-all cursor-pointer"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      </div>

      <MiniPlayer sfx={sfx} isSelected={isSelected} />

      <div className="flex items-center gap-2 mt-2">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
          isMusic
            ? 'bg-indigo-500/10 text-indigo-400'
            : 'bg-emerald-500/10 text-emerald-400'
        }`}>
          {isMusic ? 'Music' : 'SFX'}
        </span>
        <span className="text-[9px] text-zinc-600">
          {new Date(sfx.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
        {isSelected && (
          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-auto">
            선택됨
          </span>
        )}
      </div>
    </div>
  );
}

export default function SfxPickerModal({
  onSelect,
  onClose,
  selectedId,
  title = '배경음 선택',
}: SfxPickerModalProps) {
  const navigate = useNavigate();
  const { items, addBlobSfx, removeSfx, updateStorageUrl } = useSfxStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'sfx' | 'music'>('all');

  // 실시간으로 새 SFX 추가 감지
  useSfxStoreListener(useCallback((sfx) => {
    addBlobSfx(sfx);
  }, [addBlobSfx]));

  // Storage 업로드 완료 이벤트 감지
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, storageUrl } = (e as CustomEvent<{ id: string; storageUrl: string }>).detail;
      updateStorageUrl(id, storageUrl);
    };
    window.addEventListener('sfx:storage-updated', handler);
    return () => window.removeEventListener('sfx:storage-updated', handler);
  }, [updateStorageUrl]);

  // ESC 닫기
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const filtered = items.filter((i) => {
    const matchSearch = i.prompt.toLowerCase().includes(search.toLowerCase()) ||
      (i.title ?? '').toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'all' || i.type === activeTab || (!i.type && activeTab === 'sfx');
    return matchSearch && matchTab;
  });

  const sfxCount = items.filter((i) => !i.type || i.type === 'sfx').length;
  const musicCount = items.filter((i) => i.type === 'music').length;

  const handleGoToSfx = () => {
    onClose();
    navigate('/ai-sound');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <i className="ri-music-2-line text-emerald-400 text-sm" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{title}</p>
              <p className="text-[10px] text-zinc-500">효과음 & 음악 라이브러리 · {items.length}개</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {/* 탭 + 검색 */}
        {items.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-white/5 flex-shrink-0 space-y-2">
            {/* 탭 */}
            <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 rounded-xl p-1">
              {[
                { id: 'all' as const, label: '전체', count: items.length },
                { id: 'sfx' as const, label: 'SFX', count: sfxCount },
                { id: 'music' as const, label: 'Music', count: musicCount },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab.label}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                    activeTab === tab.id ? 'bg-white/15 text-white' : 'bg-zinc-800 text-zinc-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
            {/* 검색 */}
            <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2">
              <i className="ri-search-line text-zinc-500 text-sm" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="효과음 / 음악 검색..."
                className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-zinc-600 hover:text-zinc-400 cursor-pointer">
                  <i className="ri-close-line text-xs" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-white/5 flex items-center justify-center">
                <i className="ri-music-2-line text-zinc-600 text-2xl" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-zinc-400 mb-1">생성된 배경음이 없어요</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  AI Sound → Sound Effects 또는 Music 탭에서<br />
                  오디오를 먼저 생성해주세요
                </p>
              </div>
              <button
                onClick={handleGoToSfx}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-bold rounded-xl hover:bg-emerald-500/25 transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-sparkling-2-line text-sm" />
                AI Sound로 이동
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <i className="ri-search-line text-zinc-600 text-2xl" />
              <p className="text-sm text-zinc-500">검색 결과가 없어요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((sfx) => (
                <SfxCard
                  key={sfx.id}
                  sfx={sfx}
                  isSelected={selectedId === sfx.id}
                  onSelect={() => onSelect(sfx)}
                  onRemove={() => removeSfx(sfx.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 하단 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <button
            onClick={handleGoToSfx}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-external-link-line text-xs" />
            AI Sound에서 더 만들기
          </button>
          <div className="flex items-center gap-2">
            {selectedId && (
              <button
                onClick={() => onSelect({ id: '', prompt: '', audioUrl: '', duration: null, createdAt: '', promptInfluence: 0 })}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                배경음 제거
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/5 text-zinc-300 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
