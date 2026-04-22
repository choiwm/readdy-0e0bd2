import { useState, useCallback, useRef, useEffect } from 'react';
import PageHeader from '@/components/feature/PageHeader';
import { voices, Voice } from '@/mocks/voiceLibrary';
import AppNavbar from '@/components/feature/AppNavbar';
import HistoryPanel from '@/pages/ai-sound/components/HistoryPanel';
import SyncPanel from '@/pages/ai-sound/components/SyncPanel';
import { useSoundCredits, SoundCostKey } from '@/pages/ai-sound/hooks/useSoundCredits';
import VoiceCard from '@/pages/ai-sound/components/VoiceCard';
import EffectsPanel from '@/pages/ai-sound/components/EffectsPanel';
import MusicPanel from '@/pages/ai-sound/components/MusicPanel';
import TranscribePanel from '@/pages/ai-sound/components/TranscribePanel';
import CleanPanel from '@/pages/ai-sound/components/CleanPanel';
import GenerationToast, { ToastItem } from '@/pages/ai-sound/components/GenerationToast';
import FilterSidebar, {
  SoundIconRail,
  SidebarIcon, VoiceTab, GenderFilter, SortBy, SpeechModel, SpeechParams,
} from '@/pages/ai-sound/components/FilterSidebar';
import SpeechMainPanel from '@/pages/ai-sound/components/SpeechMainPanel';
import { useAudioHistory } from '@/hooks/useAudioHistory';
import type { AudioHistoryItemExtended } from '@/hooks/useAudioHistory';
import { useAuth } from '@/hooks/useAuth';
import InsufficientCreditsModal from '@/components/base/InsufficientCreditsModal';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '방금 전';
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
}

export default function AISoundPage() {
  const [activeIcon, setActiveIcon] = useState<SidebarIcon>('Voices');
  const [voiceTab, setVoiceTab] = useState<VoiceTab>('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('전체');
  const [sortBy, setSortBy] = useState<SortBy>('이름순');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [speechModel, setSpeechModel] = useState<SpeechModel>('flash');
  const [speechParams, setSpeechParams] = useState<SpeechParams>({
    stability: 0.5, similarity: 0.75, style: 0.0, speed: 1.0,
  });
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [visibleCount, setVisibleCount] = useState(9);
  const [starredIds, setStarredIds] = useState<Set<string | number>>(new Set());
  const [langFilters, setLangFilters] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const { credits, maxCredits, deduct: deductCreditsRaw, refund: refundCreditsRaw, SOUND_COSTS: soundCosts } = useSoundCredits();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  // ── 크레딧 부족 모달 상태 ──────────────────────────────────────────
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditModalData, setCreditModalData] = useState<{
    required: number;
    featureName: string;
  }>({ required: 0, featureName: '' });

  // 크레딧 환불 래퍼
  const refundCredits = useCallback((key: SoundCostKey): void => {
    refundCreditsRaw(soundCosts[key]);
  }, [refundCreditsRaw, soundCosts]);

  // 크레딧 차감 래퍼 — 부족 시 모달 표시
  const deductCredits = useCallback((key: SoundCostKey): boolean => {
    const cost = soundCosts[key];
    if (credits < cost) {
      const featureNames: Record<SoundCostKey, string> = {
        tts_flash: 'TTS Flash',
        tts_v3: 'TTS V3 Alpha',
        sfx: '효과음(SFX) 생성',
        music: 'AI 음악 생성',
        transcribe: '음성 전사',
        clean_noise: '노이즈 제거',
        clean_isolate: '보컬 분리',
        clean_separate: '음원 분리',
        sync: '오디오 싱크',
      };
      setCreditModalData({ required: cost, featureName: featureNames[key] ?? key });
      setCreditModalOpen(true);
      return false;
    }
    return deductCreditsRaw(key);
  }, [credits, soundCosts, deductCreditsRaw]);

  // ── SEO: 페이지 타이틀 & 메타 설정 ──────────────────────────────────
  useEffect(() => {
    document.title = 'AI Sound — AI 음성 합성·음악·SFX 생성 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'ElevenLabs 기반 AI TTS 음성 합성, AI 음악 생성, AI 음향 효과(SFX) 생성, 오디오 클리닝까지. 전문가 수준의 AI 사운드 제작 도구.');
    }
    return () => {
      document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    };
  }, []);

  const { user } = useAuth();

  // Supabase DB 기반 오디오 히스토리 (로그인 사용자: 계정 기반, 비로그인: 세션 기반)
  const { items: audioItems, addItem, updateItem, removeItem, setItems: setAudioItems } = useAudioHistory(user?.id ?? null);

  // body scroll lock
  useEffect(() => {
    if (mobileSidebarOpen || mobileHistoryOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen, mobileHistoryOpen]);

  const handleToggleStar = useCallback((id: string | number) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filtered = voices.filter((v) => {
    const matchGender =
      genderFilter === '전체' ||
      (genderFilter === '남성' && v.gender === 'MALE') ||
      (genderFilter === '여성' && v.gender === 'FEMALE');
    const matchSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchFavorites = voiceTab !== 'favorites' || starredIds.has(v.id);
    const matchLang = langFilters.size === 0 || langFilters.has(v.lang);
    return matchGender && matchSearch && matchFavorites && matchLang;
  });

  const sorted = [...filtered].sort((a, b) => sortBy === '이름순' ? a.name.localeCompare(b.name) : 0);
  const visibleVoices = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const handleGenerateStart = useCallback((id: string, title: string, text: string, voice: Voice, type?: AudioHistoryItemExtended['type']) => {
    const newItem: AudioHistoryItemExtended = {
      id, title, text, voiceName: voice.name, voiceAvatar: voice.avatar,
      duration: 0, status: 'generating', type: type ?? 'tts',
      createdAt: new Date().toISOString(), fileSize: '-', lang: voice.lang, liked: false, progress: 0,
    };
    addItem(newItem);

    let prog = 0;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      prog = Math.min(prog + Math.floor(Math.random() * 8) + 4, 95);
      updateItem(id, { progress: prog });
      if (prog >= 95 && progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    }, 150);
  }, [addItem, updateItem]);

  const handleGenerateCancel = useCallback((id: string) => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    removeItem(id);
  }, [removeItem]);

  const handleGenerateComplete = useCallback((id: string, audioUrl?: string, storageUrl?: string, durationSec?: number) => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    // 실제 duration이 전달되면 사용, 없으면 fallback으로 추정값 사용
    const dur = durationSec ?? Math.floor(Math.random() * 15) + 5;
    const kb = Math.floor(dur * 96);
    const fileSize = kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`;

    updateItem(id, {
      status: 'completed',
      progress: 100,
      duration: dur,
      fileSize,
      audioUrl: storageUrl ?? audioUrl,
      storageUrl: storageUrl,
    });

    // 토스트 알림
    const item = audioItems.find((i) => i.id === id);
    if (item) {
      const toastEntry: ToastItem = {
        id: `toast-${id}`,
        title: item.title,
        voiceName: item.voiceName,
        voiceAvatar: item.voiceAvatar,
        duration: dur,
        type: item.type,
      };
      setToasts((t) => [...t, toastEntry]);
      setTimeout(() => { setToasts((t) => t.filter((x) => x.id !== toastEntry.id)); }, 4000);
    }

    setHighlightedId(id);
    setTimeout(() => setHighlightedId(null), 3000);
  }, [audioItems, updateItem]);

  // 히스토리 실패 항목 재시도 — 해당 패널로 이동하고 항목 상태 초기화
  const handleRetry = useCallback((item: AudioHistoryItemExtended) => {
    // 실패 항목을 삭제하고 해당 패널로 이동
    removeItem(item.id);
    const panelMap: Record<string, SidebarIcon> = {
      tts: 'Speech', clone: 'Speech', effect: 'Effects', music: 'Music',
    };
    const targetPanel = panelMap[item.type] ?? 'Speech';
    setActiveIcon(targetPanel);
  }, [removeItem]);

  const handleVoiceSelect = (voice: Voice) => {
    setSelectedVoice(voice);
    requestAnimationFrame(() => {
      setActiveIcon('Speech');
    });
  };

  const mobileNavItems: { icon: string; label: string; id: SidebarIcon }[] = [
    { icon: 'ri-user-voice-line', label: 'Voices', id: 'Voices' },
    { icon: 'ri-mic-line', label: 'Speech', id: 'Speech' },
    { icon: 'ri-music-ai-line', label: 'Music', id: 'Music' },
    { icon: 'ri-sound-module-line', label: 'Effects', id: 'Effects' },
    { icon: 'ri-more-line', label: 'More', id: 'Transcribe' },
  ];

  return (
    <div className="h-screen bg-[#0a0a0b] text-white flex flex-col overflow-hidden">
      <AppNavbar hideBottomNav />
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Desktop: 아이콘 레일 + 설정 패널 */}
        <div className="hidden md:flex">
          <SoundIconRail
            activeIcon={activeIcon}
            setActiveIcon={setActiveIcon}
            onPanelToggle={() => {}}
          />
        </div>
        <div className="hidden md:flex">
          <FilterSidebar
            voiceTab={voiceTab} setVoiceTab={setVoiceTab}
            genderFilter={genderFilter} setGenderFilter={setGenderFilter}
            sortBy={sortBy} setSortBy={setSortBy}
            activeIcon={activeIcon} setActiveIcon={setActiveIcon}
            selectedVoice={selectedVoice}
            onGenerateStart={handleGenerateStart}
            onGenerateComplete={handleGenerateComplete}
            speechModel={speechModel} setSpeechModel={setSpeechModel}
            speechParams={speechParams} setSpeechParams={setSpeechParams}
            starredIds={starredIds}
            langFilters={langFilters}
            setLangFilters={setLangFilters}
            credits={credits}
            maxCredits={maxCredits}
          />
        </div>

        {/* Mobile: FilterSidebar 드로어 (슬라이드 애니메이션) */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ${mobileSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          onClick={() => setMobileSidebarOpen(false)}
        >
          {/* 오버레이 */}
          <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileSidebarOpen ? 'opacity-100' : 'opacity-0'}`} />
          {/* 드로어 패널 */}
          <div
            className={`absolute top-0 bottom-14 right-0 w-[88vw] max-w-[320px] overflow-hidden transition-transform duration-300 ease-out ${mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <FilterSidebar
              voiceTab={voiceTab} setVoiceTab={setVoiceTab}
              genderFilter={genderFilter} setGenderFilter={setGenderFilter}
              sortBy={sortBy} setSortBy={setSortBy}
              activeIcon={activeIcon} setActiveIcon={(icon) => { setActiveIcon(icon); setMobileSidebarOpen(false); }}
              selectedVoice={selectedVoice}
              onGenerateStart={handleGenerateStart}
              onGenerateComplete={handleGenerateComplete}
              speechModel={speechModel} setSpeechModel={setSpeechModel}
              speechParams={speechParams} setSpeechParams={setSpeechParams}
              starredIds={starredIds}
              langFilters={langFilters}
              setLangFilters={setLangFilters}
              credits={credits}
              maxCredits={maxCredits}
              onClose={() => setMobileSidebarOpen(false)}
            />
          </div>
        </div>

        {/* Mobile: History 하단 시트 */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ${mobileHistoryOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          onClick={() => setMobileHistoryOpen(false)}
        >
          <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileHistoryOpen ? 'opacity-100' : 'opacity-0'}`} />
          <div
            className={`absolute bottom-14 left-0 right-0 h-[80vh] rounded-t-2xl overflow-hidden transition-transform duration-300 ease-out ${mobileHistoryOpen ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <HistoryPanel items={audioItems} onItemsChange={setAudioItems} onRemoveItem={removeItem} onRetry={handleRetry} highlightedId={highlightedId} />
          </div>
        </div>

        <main className="flex-1 flex flex-col overflow-hidden relative bg-zinc-950/50 pb-14 md:pb-0" style={{ isolation: 'isolate', contain: 'layout style', willChange: 'contents' }}>
          <div className="flex-1 overflow-y-auto">
            {activeIcon === 'Speech' ? (
              <SpeechMainPanel
                selectedVoice={selectedVoice}
                model={speechModel}
                onModelChange={setSpeechModel}
                params={speechParams}
                recentItems={audioItems}
                credits={credits}
                onDeductCredits={deductCredits}
                onGenerateStart={handleGenerateStart}
                onGenerateComplete={handleGenerateComplete}
                onGenerateCancel={handleGenerateCancel}
              />
            ) : activeIcon === 'Sync' ? (
              <SyncPanel key="sync-panel" onDeductCredits={deductCredits} credits={credits} onRefundCredits={refundCredits} />
            ) : activeIcon === 'Effects' ? (
              <EffectsPanel
                onGenerateStart={handleGenerateStart}
                onGenerateComplete={handleGenerateComplete}
                onGenerateCancel={handleGenerateCancel}
                recentItems={audioItems}
                credits={credits}
                onDeductCredits={deductCredits}
              />
            ) : activeIcon === 'Music' ? (
              <MusicPanel
                onGenerateStart={handleGenerateStart}
                onGenerateComplete={handleGenerateComplete}
                onGenerateCancel={handleGenerateCancel}
                recentItems={audioItems}
                credits={credits}
                onDeductCredits={deductCredits}
              />
            ) : activeIcon === 'Transcribe' ? (
              <TranscribePanel onDeductCredits={deductCredits} credits={credits} />
            ) : activeIcon === 'Clean' ? (
              <CleanPanel onDeductCredits={deductCredits} credits={credits} onRefundCredits={refundCredits} />
            ) : (
              /* ── Voice Library ── */
              <div className="flex flex-col min-h-full">
                <PageHeader
                  title="Voice Library"
                  subtitle="Professional AI Voice Talents"
                />
                <div className="mx-auto w-full max-w-5xl px-3 md:px-8 pt-4 md:pt-6 pb-8">
                  {/* Tabs — 모바일 가로 스크롤 */}
                  <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-none pb-1">
                    {(['all', 'library', 'favorites'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setVoiceTab(t)}
                        className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors duration-150 cursor-pointer border flex-shrink-0 whitespace-nowrap outline-none focus:outline-none ${
                          voiceTab === t ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'text-zinc-400 hover:text-white hover:bg-white/5 border-transparent'
                        }`}
                      >
                        <i className={t === 'all' ? 'ri-user-voice-line' : t === 'library' ? 'ri-equalizer-line' : 'ri-star-line'} />
                        {t === 'all' ? 'All Voices' : t === 'library' ? 'My Library' : 'Favorites'}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="flex gap-3 md:gap-4 mb-4 md:mb-5">
                    <div className="relative flex-1">
                      <i className="ri-search-line absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or style..."
                        className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-3 md:px-4 pl-9 md:pl-10 py-2.5 md:py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                      />
                    </div>
                  </div>

                  {/* Language filter chips — 모바일 가로 스크롤 */}
                  <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-none pb-1">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex-shrink-0">언어</span>
                    {([
                      { key: 'ENGLISH', label: '영어', flag: '🇺🇸' },
                      { key: 'KOREAN', label: '한국어', flag: '🇰🇷' },
                      { key: 'JAPANESE', label: '일본어', flag: '🇯🇵' },
                      { key: 'CHINESE', label: '중국어', flag: '🇨🇳' },
                      { key: 'SPANISH', label: '스페인어', flag: '🇪🇸' },
                      { key: 'FRENCH', label: '프랑스어', flag: '🇫🇷' },
                    ] as const).map(({ key, label, flag }) => {
                      const active = langFilters.has(key);
                      const count = voices.filter((v) => v.lang === key).length;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            const next = new Set(langFilters);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            setLangFilters(next);
                            setVisibleCount(9);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors duration-150 border cursor-pointer whitespace-nowrap flex-shrink-0 outline-none focus:outline-none ${
                            active ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-zinc-900/60 border-transparent text-zinc-500 hover:border-indigo-500/20 hover:text-zinc-300'
                          }`}
                        >
                          <span>{flag}</span>
                          <span className="hidden sm:inline">{label}</span>
                          <span className={`text-[9px] font-black px-1 py-px rounded ${active ? 'bg-indigo-500/30 text-indigo-300' : 'bg-zinc-800 text-zinc-600'}`}>{count}</span>
                          {active && <i className="ri-close-line text-[10px]" />}
                        </button>
                      );
                    })}
                    {langFilters.size > 0 && (
                      <button
                        onClick={() => { setLangFilters(new Set()); setVisibleCount(9); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold text-zinc-600 hover:text-zinc-300 border border-transparent hover:border-white/10 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                      >
                        <i className="ri-close-circle-line text-xs" /> 전체
                      </button>
                    )}
                  </div>

                  {/* Active filter summary */}
                  {(langFilters.size > 0 || genderFilter !== '전체') && (
                    <div className="flex items-center gap-2 mb-5 px-4 py-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
                      <i className="ri-filter-3-line text-indigo-400 text-xs flex-shrink-0" />
                      <span className="text-[10px] text-indigo-400 font-bold flex-shrink-0">필터 적용 중</span>
                      <div className="flex items-center gap-1.5 flex-wrap flex-1">
                        {langFilters.size > 0 && (
                          <span className="text-[10px] text-zinc-400">
                            언어: {Array.from(langFilters).map((l) => ({
                              ENGLISH: '영어', KOREAN: '한국어', JAPANESE: '일본어',
                              CHINESE: '중국어', SPANISH: '스페인어', FRENCH: '프랑스어',
                            }[l] ?? l)).join(', ')}
                          </span>
                        )}
                        {genderFilter !== '전체' && <span className="text-[10px] text-zinc-400">성별: {genderFilter}</span>}
                      </div>
                      <span className="text-[10px] font-bold text-indigo-400 flex-shrink-0">{sorted.length}개</span>
                      <button
                        onClick={() => { setLangFilters(new Set()); setGenderFilter('전체'); setVisibleCount(9); }}
                        className="text-[10px] text-zinc-600 hover:text-zinc-300 cursor-pointer transition-colors flex-shrink-0"
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </div>
                  )}

                  <div className="mb-4 text-xs text-zinc-500">
                    {visibleVoices.length} / {sorted.length} voices
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                    {visibleVoices.map((voice) => (
                      <VoiceCard
                        key={voice.id}
                        voice={voice}
                        onSelect={handleVoiceSelect}
                        starred={starredIds.has(voice.id)}
                        onToggleStar={handleToggleStar}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="flex items-center justify-center py-8">
                      <button
                        onClick={() => setVisibleCount((prev) => Math.min(prev + 9, sorted.length))}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-indigo-500/30 text-zinc-400 hover:text-indigo-400 text-sm font-medium transition-all cursor-pointer"
                      >
                        <i className="ri-arrow-down-line" />
                        더 보기 ({sorted.length - visibleCount}개 남음)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <div className="hidden md:flex">
          <HistoryPanel items={audioItems} onItemsChange={setAudioItems} onRemoveItem={removeItem} onRetry={handleRetry} highlightedId={highlightedId} />
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111113]/95 backdrop-blur-xl border-t border-white/5 flex items-center h-14">
        {mobileNavItems.map((item) => {
          const isActive = activeIcon === item.id || (item.id === 'Transcribe' && ['Transcribe', 'Clean', 'Sync'].includes(activeIcon));
          return (
            <button
              key={item.id}
              onClick={() => { setActiveIcon(item.id); setMobileSidebarOpen(false); setMobileHistoryOpen(false); }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer transition-all relative ${
                isActive ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${item.icon} text-lg`} />
              </div>
              <span className="text-[9px] font-bold">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-400 rounded-full" />
              )}
            </button>
          );
        })}
        {/* History 버튼 */}
        <button
          onClick={() => { setMobileHistoryOpen((v) => !v); setMobileSidebarOpen(false); }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer transition-all relative ${
            mobileHistoryOpen ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center relative">
            <i className="ri-history-line text-lg" />
            {audioItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-500 text-[8px] font-black text-white flex items-center justify-center">
                {audioItems.length > 9 ? '9+' : audioItems.length}
              </span>
            )}
          </div>
          <span className="text-[9px] font-bold">History</span>
          {mobileHistoryOpen && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-400 rounded-full" />
          )}
        </button>
        {/* Settings 버튼 */}
        <button
          onClick={() => { setMobileSidebarOpen((v) => !v); setMobileHistoryOpen(false); }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer transition-all ${
            mobileSidebarOpen ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-settings-3-line text-lg" />
          </div>
          <span className="text-[9px] font-bold">Settings</span>
        </button>
      </div>

      <GenerationToast toasts={toasts} onDismiss={(tid) => setToasts((t) => t.filter((x) => x.id !== tid))} />

      {/* 크레딧 부족 모달 */}
      <InsufficientCreditsModal
        isOpen={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        required={creditModalData.required}
        current={credits}
        featureName={creditModalData.featureName}
      />
    </div>
  );
}
