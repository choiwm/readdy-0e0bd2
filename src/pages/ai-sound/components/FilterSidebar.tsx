import { useState, useRef, useEffect } from 'react';
import { Voice } from '@/mocks/voiceLibrary';
import PageHeader from '@/components/feature/PageHeader';
import { SpeechSidebarContent, SpeechModel, SpeechParams } from '@/pages/ai-sound/components/SpeechSidebarContent';
import { EffectsSidebarContent } from '@/pages/ai-sound/components/EffectsPanel';
import { MusicSidebarContent } from '@/pages/ai-sound/components/MusicPanel';
import { TranscribeSidebarContent } from '@/pages/ai-sound/components/TranscribePanel';
import { CleanSidebarContent } from '@/pages/ai-sound/components/CleanPanel';

export type SidebarIcon = 'Voices' | 'Speech' | 'Effects' | 'Music' | 'Transcribe' | 'Clean' | 'Sync';
export type VoiceTab = 'all' | 'library' | 'favorites';
export type GenderFilter = '전체' | '남성' | '여성';
export type SortBy = '이름순' | '최신순' | '인기순';

export type { SpeechModel, SpeechParams };

const sidebarIcons: { icon: string; label: SidebarIcon }[] = [
  { icon: 'ri-equalizer-line', label: 'Voices' },
  { icon: 'ri-chat-voice-line', label: 'Speech' },
  { icon: 'ri-sound-module-line', label: 'Effects' },
  { icon: 'ri-music-2-line', label: 'Music' },
  { icon: 'ri-file-text-line', label: 'Transcribe' },
  { icon: 'ri-scissors-cut-line', label: 'Clean' },
  { icon: 'ri-refresh-line', label: 'Sync' },
];

interface FilterSidebarProps {
  voiceTab: VoiceTab;
  setVoiceTab: (v: VoiceTab) => void;
  genderFilter: GenderFilter;
  setGenderFilter: (g: GenderFilter) => void;
  sortBy: SortBy;
  setSortBy: (s: SortBy) => void;
  speechModel: SpeechModel;
  setSpeechModel: (m: SpeechModel) => void;
  speechParams: SpeechParams;
  setSpeechParams: (p: SpeechParams) => void;
  activeIcon: SidebarIcon;
  setActiveIcon: (i: SidebarIcon) => void;
  selectedVoice: Voice | null;
  starredIds: Set<string | number>;
  langFilters: Set<string>;
  setLangFilters: (f: Set<string>) => void;
  credits: number;
  maxCredits: number;
  onGenerateStart: (id: string, title: string, text: string, voice: Voice) => void;
  onGenerateComplete: (id: string) => void;
  /** 모바일 드로어에서 닫기 버튼 클릭 시 호출 */
  onClose?: () => void;
}

const LANG_OPTIONS = [
  { key: 'ENGLISH',  label: '영어',     flag: '🇺🇸' },
  { key: 'KOREAN',   label: '한국어',   flag: '🇰🇷' },
  { key: 'JAPANESE', label: '일본어',   flag: '🇯🇵' },
  { key: 'CHINESE',  label: '중국어',   flag: '🇨🇳' },
  { key: 'SPANISH',  label: '스페인어', flag: '🇪🇸' },
  { key: 'FRENCH',   label: '프랑스어', flag: '🇫🇷' },
] as const;

type LangKey = typeof LANG_OPTIONS[number]['key'];

function LangFilterDropdown({
  langFilters,
  setLangFilters,
}: {
  langFilters: Set<string>;
  setLangFilters: (f: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (key: LangKey) => {
    const next = new Set(langFilters);
    if (next.has(key)) next.delete(key); else next.add(key);
    setLangFilters(next);
  };

  const selectedLabels = LANG_OPTIONS.filter((o) => langFilters.has(o.key));

  return (
    <div className="space-y-2" ref={ref}>
      <div className="flex items-center justify-between px-1">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">언어</h4>
        {langFilters.size > 0 && (
          <button
            onClick={() => setLangFilters(new Set())}
            className="text-[9px] text-zinc-600 hover:text-indigo-400 cursor-pointer transition-colors flex items-center gap-0.5"
          >
            <i className="ri-close-line text-[10px]" /> 초기화
          </button>
        )}
      </div>

      {/* Trigger */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            open
              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
              : 'bg-zinc-800/60 border-white/5 text-zinc-300 hover:border-white/10 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {selectedLabels.length === 0 ? (
              <span className="text-zinc-500">전체 언어</span>
            ) : selectedLabels.length === 1 ? (
              <>
                <span>{selectedLabels[0].flag}</span>
                <span className="truncate">{selectedLabels[0].label}</span>
              </>
            ) : (
              <>
                <span className="flex -space-x-0.5">
                  {selectedLabels.slice(0, 3).map((o) => (
                    <span key={o.key} className="text-[11px]">{o.flag}</span>
                  ))}
                </span>
                <span className="text-indigo-400">{selectedLabels.length}개 선택</span>
              </>
            )}
          </div>
          <i className={`ri-arrow-down-s-line text-sm flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1.5 z-30 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
            {LANG_OPTIONS.map(({ key, label, flag }) => {
              const active = langFilters.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-500/15 text-indigo-400'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="text-sm w-5 text-center">{flag}</span>
                  <span className="flex-1 text-left">{label}</span>
                  {active && <i className="ri-check-line text-indigo-400 text-xs flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** 아이콘 레일만 렌더링 — 80px 고정 */
export function SoundIconRail({
  activeIcon,
  setActiveIcon,
  onPanelToggle,
}: {
  activeIcon: SidebarIcon;
  setActiveIcon: (i: SidebarIcon) => void;
  onPanelToggle: () => void;
}) {
  return (
    <div className="w-20 flex-shrink-0 bg-[#0d0d0f] border-r border-white/5 flex flex-col items-center py-6 gap-4">
      <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 mb-2 w-10 h-10 flex items-center justify-center">
        <i className="ri-sound-module-line text-lg" />
      </div>
      <div className="flex flex-col gap-4 w-full px-2">
        {sidebarIcons.map((item) => (
          <button
            key={item.label}
            onClick={() => { setActiveIcon(item.label); onPanelToggle(); }}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer w-full outline-none focus:outline-none ${
              activeIcon === item.label
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
          >
            <i className={`${item.icon} text-lg`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-4 mb-2">
        <button
          onClick={() => { setActiveIcon('Speech'); onPanelToggle(); }}
          className={`p-2 transition-colors cursor-pointer rounded-lg ${activeIcon === 'Speech' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
          title="Speech 설정"
        >
          <i className="ri-settings-3-line text-lg" />
        </button>
        <button
          onClick={() => { setActiveIcon('Voices'); onPanelToggle(); }}
          className={`p-2 transition-colors cursor-pointer rounded-lg ${activeIcon === 'Voices' ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
          title="보이스 라이브러리"
        >
          <i className="ri-information-line text-lg" />
        </button>
      </div>
    </div>
  );
}

/** 설정 패널 — 데스크탑 280px 고정 / 모바일 full-width */
export default function FilterSidebar({
  voiceTab, setVoiceTab, genderFilter, setGenderFilter, sortBy, setSortBy,
  speechModel, setSpeechModel, speechParams, setSpeechParams,
  activeIcon, setActiveIcon: _setActiveIcon, selectedVoice: _selectedVoice, starredIds,
  langFilters, setLangFilters, credits, maxCredits,
  onGenerateStart: _onGenerateStart, onGenerateComplete: _onGenerateComplete, onClose,
}: FilterSidebarProps) {
  const panelTitle: Record<SidebarIcon, string> = {
    Voices: '보이스', Speech: 'Speech', Effects: '효과음',
    Music: '뮤직', Transcribe: '트랜스크라이브', Clean: '클린', Sync: 'Sync',
  };
  const panelSub: Record<SidebarIcon, string> = {
    Voices: 'Filter & Sort Voice Library', Speech: 'Model · Parameters', Effects: 'Category & Tips',
    Music: 'Genre & Composition Tips', Transcribe: 'Formats & Features', Clean: 'Noise · Isolate · Stems', Sync: 'Video to SFX',
  };

  return (
    <aside className="w-full md:w-[280px] flex-shrink-0 bg-[#111113] border-r border-white/5 flex flex-col overflow-hidden h-full">
      <PageHeader
        title={panelTitle[activeIcon]}
        subtitle={panelSub[activeIcon]}
        badgeColor="indigo"
        actions={
          /* 모바일 드로어에서만 닫기 버튼 표시 (onClose가 있을 때만) */
          onClose ? (
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-sm" />
            </button>
          ) : undefined
        }
      />

      {/* ── Speech 설정 ── */}
      {activeIcon === 'Speech' ? (
        <SpeechSidebarContent
          model={speechModel}
          setModel={setSpeechModel}
          params={speechParams}
          setParams={setSpeechParams}
          credits={credits}
          maxCredits={maxCredits}
        />
      ) : activeIcon === 'Effects' ? (
        <EffectsSidebarContent credits={credits} maxCredits={maxCredits} />
      ) : activeIcon === 'Music' ? (
        <MusicSidebarContent credits={credits} maxCredits={maxCredits} />
      ) : activeIcon === 'Transcribe' ? (
        <TranscribeSidebarContent credits={credits} maxCredits={maxCredits} />
      ) : activeIcon === 'Clean' ? (
        <CleanSidebarContent credits={credits} maxCredits={maxCredits} />
      ) : (
        /* ── Voices / 기본 패널 ── */
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6 md:space-y-8">
          {/* Credits bar */}
          <div className="p-3 md:p-4 rounded-2xl bg-black/40 border border-white/5 shadow-inner">
            <div className="flex justify-between items-center mb-3 md:mb-4">
              <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">보유 크레딧</span>
              <span className="text-xs font-mono text-indigo-400 flex items-center gap-1">
                {credits} <i className="ri-copper-diamond-line" />
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                style={{ width: `${(credits / maxCredits) * 100}%` }}
              />
            </div>
          </div>

          {activeIcon === 'Voices' && (
            <div className="space-y-5 md:space-y-6">
              {/* 보이스 컬렉션 */}
              <div className="space-y-2 md:space-y-3">
                <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">보이스 컬렉션</h4>
                <div className="flex flex-col gap-1 md:gap-1.5">
                  {([
                    { key: 'all',       icon: 'ri-user-voice-line', label: '전체 보이스' },
                    { key: 'library',   icon: 'ri-equalizer-line',  label: '내 라이브러리' },
                    { key: 'favorites', icon: 'ri-star-line',       label: '즐겨찾기' },
                  ] as const).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setVoiceTab(t.key)}
                      className={`flex items-center gap-2 md:gap-2.5 px-3 py-2 md:py-2.5 rounded-xl text-xs font-bold transition-colors duration-150 border cursor-pointer outline-none focus:outline-none ${
                        voiceTab === t.key
                          ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                          : 'bg-zinc-800/50 border-transparent text-zinc-400 hover:border-indigo-500/15 hover:text-zinc-200'
                      }`}
                    >
                      <i className={`${t.icon} text-sm`} />
                      {t.label}
                      {t.key === 'favorites' && starredIds.size > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 text-[9px] font-black">
                          {starredIds.size}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 성별 필터 */}
              <div className="space-y-2 md:space-y-3">
                <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">성별</h4>
                <div className="flex gap-1.5 md:gap-2">
                  {(['전체', '남성', '여성'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGenderFilter(g)}
                      className={`flex-1 px-2 md:px-3 py-1.5 md:py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 border cursor-pointer outline-none focus:outline-none ${
                        genderFilter === g
                          ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                          : 'bg-zinc-800/50 border-transparent text-zinc-500 hover:text-white hover:border-indigo-500/15'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 언어 필터 */}
              <LangFilterDropdown langFilters={langFilters} setLangFilters={setLangFilters} />

              {/* 정렬 */}
              <div className="space-y-2 md:space-y-3">
                <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">정렬</h4>
                {/* 모바일: 가로 3버튼 / 데스크탑: 세로 리스트 */}
                <div className="flex md:hidden gap-1.5">
                  {(['이름순', '최신순', '인기순'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border outline-none focus:outline-none ${
                        sortBy === s
                          ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                          : 'bg-zinc-800/50 border-transparent text-zinc-500 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="hidden md:block space-y-1">
                  {(['이름순', '최신순', '인기순'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        sortBy === s ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {s}
                      {sortBy === s && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 업그레이드 카드 */}
          <div className="mt-auto pt-4 md:pt-6">
            <div className="p-4 md:p-5 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 text-center shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-[10px] text-zinc-500 mb-2.5 md:mb-3 leading-relaxed">
                더 높은 품질과<br />무제한 렌더링이 필요하신가요?
              </p>
              <button className="w-full py-2 md:py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em] cursor-pointer">
                유료로 업그레이드
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
