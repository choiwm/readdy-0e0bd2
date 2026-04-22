import { useState, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import AICreateSidebar from './components/Sidebar';
import PromptBar from './components/PromptBar';
import GalleryGrid from './components/GalleryGrid';
import GenerationStatus from './components/GenerationStatus';
import CharacterView from './components/CharacterView';
import LookView from './components/LookView';
import AngleView from './components/AngleView';
import AppNavbar from '@/components/feature/AppNavbar';
import PageHeader from '@/components/feature/PageHeader';
import EmptyState from '@/components/base/EmptyState';
import { getCharacterAppearanceTags, type AppliedAngle, type AppliedLook } from '@/utils/characterPrompt';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';

type ViewState = 'empty' | 'generating' | 'gallery';
type SidebarTab = '생성' | 'ANGLE' | 'Character' | 'LOOK';

interface GenerationInfo {
  prompt: string;
  model: string;
  type: string;
  ratio: string;
  creditCost: number;
}

export interface AppliedCharacter {
  id: string;
  name: string;
  gender: '여자' | '남자';
  tags: string[];
  img: string;
}

// 세션 ID 가져오기 (비로그인 사용자용)
function getSessionId(): string {
  const SESSION_KEY = 'ai_platform_session_id';
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function AICreatePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>('gallery');
  const [generationInfo, setGenerationInfo] = useState<GenerationInfo | null>(null);
  const generationInfoRef = useRef<GenerationInfo | null>(null);
  const [generationKey, setGenerationKey] = useState(0);
  const [activeTab, setActiveTab] = useState<SidebarTab>('생성');
  const [appliedCharacter, setAppliedCharacter] = useState<AppliedCharacter | null>(null);
  const [activeCharCategory, setActiveCharCategory] = useState<string>('전체');
  const [sidebarCustomChars, setSidebarCustomChars] = useState<AppliedCharacter[]>([]);
  const [characterApplyCounter, setCharacterApplyCounter] = useState(0);
  const [appliedAngle, setAppliedAngle] = useState<AppliedAngle | null>(null);
  const [sharedAngleDraft, setSharedAngleDraft] = useState<{ pan: number; tilt: number; zoom: number } | null>(null);
  const [appliedLook, setAppliedLook] = useState<AppliedLook | null>(null);
  const [refImage, setRefImage] = useState<{ url: string; name: string } | null>(null);
  const [generatedItems, setGeneratedItems] = useState<import('@/mocks/galleryItems').GalleryItem[]>([]);
  const galleryAddItemRef = useRef<((item: Omit<import('@/mocks/galleryItems').GalleryItem, 'id' | 'createdAt'>) => Promise<import('@/mocks/galleryItems').GalleryItem | null>) | null>(null);

  const { refund } = useCredits();
  const { profile, isLoggedIn } = useAuth();
  const sessionId = useRef(getSessionId());

  const userId = isLoggedIn && profile ? profile.id : undefined;

  const handleGalleryAddItemReady = useCallback((fn: typeof galleryAddItemRef.current) => {
    galleryAddItemRef.current = fn;
  }, []);

  const handleGenerate = useCallback((prompt: string, model: string, type: string, ratio?: string, creditCost?: number) => {
    const info = { prompt, model, type, ratio: ratio ?? '1K · 16:9 · PNG', creditCost: creditCost ?? 1 };
    generationInfoRef.current = info;
    setGenerationInfo(info);
    setGenerationKey((k) => k + 1);
    setViewState('generating');
  }, []);

  // resultType: 'image' | 'video' — GenerationStatus에서 전달
  // generationInfo 의존성 제거 → ref에서만 읽음 (리렌더 차단)
  const handleGenerationComplete = useCallback(async (resultUrl: string, resultRatio: string, resultType?: 'image' | 'video') => {
    const info = generationInfoRef.current;
    if (info) {
      const itemData = {
        url: resultUrl,
        prompt: info.prompt,
        model: info.model,
        type: (resultType ?? (info.type === 'VIDEO' ? 'video' : 'image')) as 'image' | 'video',
        ratio: resultRatio,
        liked: false,
      };
      if (galleryAddItemRef.current) {
        try {
          const saved = await galleryAddItemRef.current(itemData);
          if (saved) {
            setGeneratedItems((prev) => [saved, ...prev]);
          }
        } catch {
          const fallback: import('@/mocks/galleryItems').GalleryItem = {
            id: `gen_${Date.now()}`,
            createdAt: new Date().toISOString(),
            ...itemData,
          };
          setGeneratedItems((prev) => [fallback, ...prev]);
        }
      } else {
        const fallback: import('@/mocks/galleryItems').GalleryItem = {
          id: `gen_${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...itemData,
        };
        setGeneratedItems((prev) => [fallback, ...prev]);
      }
    }
    setViewState('gallery');
  }, []); // ref에서 읽으므로 의존성 불필요

  const handleGenerationCancel = useCallback(() => {
    setViewState('gallery');
    setGenerationInfo(null);
  }, []);

  // 취소 시 크레딧 환불
  const handleCreditRefund = useCallback((amount: number) => {
    refund(amount);
  }, [refund]);

  // ... existing code ...

  const handleApplyCharacterOnly = useCallback((character: AppliedCharacter) => {
    setAppliedCharacter(character);
    setCharacterApplyCounter((c) => c + 1);
  }, []);

  const handleApplyCharacterAndGenerate = useCallback((character: AppliedCharacter) => {
    setAppliedCharacter(character);
    setCharacterApplyCounter((c) => c + 1);
    setActiveTab('생성');
  }, []);

  const handleClearCharacter = useCallback(() => {
    setAppliedCharacter(null);
  }, []);

  const handleApplyAngle = useCallback((angle: AppliedAngle) => {
    setAppliedAngle(angle);
  }, []);

  const handleApplyAngleAndSwitch = useCallback((angle: AppliedAngle) => {
    setAppliedAngle(angle);
    setActiveTab('생성');
  }, []);

  const handleClearAngle = useCallback(() => {
    setAppliedAngle(null);
  }, []);

  const handleApplyLook = useCallback((look: AppliedLook) => {
    setAppliedLook(look);
  }, []);

  const handleApplyLookAndSwitch = useCallback((look: AppliedLook) => {
    setAppliedLook(look);
    setActiveTab('생성');
  }, []);

  const handleClearLook = useCallback(() => {
    setAppliedLook(null);
  }, []);

  const handleSetRefImage = useCallback((url: string, name: string, switchToGenerate = false) => {
    setRefImage({ url, name });
    if (switchToGenerate) setActiveTab('생성');
  }, []);

  const isGenerationTab = activeTab === '생성';
  const isCharacterTab = activeTab === 'Character';

  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [initialType, setInitialType] = useState<string | null>(null);

  useEffect(() => {
    const promptParam = searchParams.get('prompt');
    const typeParam = searchParams.get('type');
    if (promptParam) {
      setInitialPrompt(decodeURIComponent(promptParam));
      setInitialType(typeParam);
      setSearchParams({}, { replace: true });
    }
  }, []);

  useEffect(() => {
    document.title = 'AI Create — AI 이미지·영상 생성 | AiMetaWOW';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Flux Realism, Flux Pro, Kling AI 기반의 고품질 AI 이미지·영상 생성 도구. 텍스트 프롬프트 하나로 전문가 수준의 이미지와 영상을 만들어보세요.');
    }
    return () => {
      document.title = 'AiMetaWOW — AI 이미지·영상·음성 생성 크리에이티브 플랫폼';
    };
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const mobileTabItems: { icon: string; label: SidebarTab; dot?: boolean }[] = [
    { icon: 'ri-sparkling-2-line', label: '생성' },
    { icon: 'ri-focus-3-line', label: 'ANGLE', dot: !!appliedAngle },
    { icon: 'ri-user-line', label: 'Character', dot: !!appliedCharacter },
    { icon: 'ri-eye-line', label: 'LOOK', dot: !!appliedLook },
  ];

  return (
    <div className="h-screen bg-[#0a0a0b] text-white flex flex-col overflow-hidden">
      <AppNavbar hideBottomNav />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:flex">
          <AICreateSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onStorageImageSelect={(url, name) => handleSetRefImage(url, name, true)}
            appliedAngle={appliedAngle}
            onClearAngle={handleClearAngle}
            onApplyAngle={handleApplyAngle}
            angleDraft={sharedAngleDraft}
            onAngleDraftChange={setSharedAngleDraft}
            appliedLook={appliedLook}
            onClearLook={handleClearLook}
            onApplyLook={handleApplyLook}
            appliedCharacter={appliedCharacter}
            onClearCharacter={handleClearCharacter}
            onAddCustomChar={(char) => setSidebarCustomChars((prev) => [char, ...prev])}
            activeCharCategory={activeCharCategory}
            onCharCategoryChange={setActiveCharCategory}
          />
        </div>

        {/* Mobile sidebar drawer */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-all duration-300 ${sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
          onClick={() => setSidebarOpen(false)}
        >
          <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`} />
          <div
            className={`absolute top-14 bottom-16 left-0 w-[85vw] max-w-[360px] flex overflow-hidden transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <AICreateSidebar
              activeTab={activeTab}
              onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
              onStorageImageSelect={(url, name) => { handleSetRefImage(url, name, true); setSidebarOpen(false); }}
              appliedAngle={appliedAngle}
              onClearAngle={handleClearAngle}
              onApplyAngle={handleApplyAngle}
              angleDraft={sharedAngleDraft}
              onAngleDraftChange={setSharedAngleDraft}
              appliedLook={appliedLook}
              onClearLook={handleClearLook}
              onApplyLook={handleApplyLook}
              appliedCharacter={appliedCharacter}
              onClearCharacter={handleClearCharacter}
              onAddCustomChar={(char) => setSidebarCustomChars((prev) => [char, ...prev])}
              activeCharCategory={activeCharCategory}
              onCharCategoryChange={setActiveCharCategory}
            />
          </div>
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          {isGenerationTab && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <PageHeader
                icon="ri-sparkling-2-line"
                title="AI Create"
                subtitle="Image & Video Generation"
                badgeColor="indigo"
                statusLabel={viewState === 'gallery' ? undefined : viewState === 'generating' ? '생성 중...' : undefined}
              />
              {viewState === 'empty' && (
                <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8">
                  <EmptyState
                    iconNode={
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
                        <img src="https://static.readdy.ai/image/818485967d328b35909ddcc1d73f5659/99fa675bf72ff13d36de270333b480ff.png" alt="AiMetaWOW" className="w-16 h-16 object-contain" />
                      </div>
                    }
                    title="아직 한번도 만드신 적이 없으시네요"
                    description="아래 프롬프트에 상상하는 장면을 적어보세요. AI가 이미지와 영상을 만들어 드립니다."
                    size="lg"
                  />
                </div>
              )}

              {viewState === 'generating' && generationInfo && (
                <div className="flex-1 overflow-hidden">
                  <GenerationStatus
                    key={generationKey}
                    prompt={generationInfo.prompt}
                    model={generationInfo.model}
                    type={generationInfo.type}
                    ratio={generationInfo.ratio}
                    userId={userId}
                    sessionId={userId ? undefined : sessionId.current}
                    creditCost={generationInfo.creditCost}
                    onComplete={handleGenerationComplete}
                    onCancel={handleGenerationCancel}
                    onCreditRefund={handleCreditRefund}
                  />
                </div>
              )}

              {viewState === 'gallery' && (
                <div className="flex-1 overflow-hidden">
                  <GalleryGrid generatedItems={generatedItems} onItemAdded={handleGalleryAddItemReady} />
                </div>
              )}

              {/* 하단 PromptBar — generating 중에는 비활성화 */}
              <div className={`flex-shrink-0 border-t border-white/5 bg-[#0a0a0b]/80 backdrop-blur-sm px-3 md:px-5 py-3 md:py-4 mb-16 md:mb-0 ${viewState === 'generating' ? 'pointer-events-none opacity-40' : ''}`}>
                {(appliedCharacter || appliedAngle || appliedLook) && (
                  <div className="flex items-center gap-1.5 mb-3 px-1 overflow-x-auto scrollbar-none">
                    <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest flex-shrink-0 mr-0.5">
                      <i className="ri-sparkling-2-fill text-indigo-400/70 mr-1" />적용됨
                    </span>

                    {appliedCharacter && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 group flex-shrink-0">
                        <div className="w-4 h-4 rounded-full overflow-hidden border border-indigo-500/40 flex-shrink-0">
                          <img src={appliedCharacter.img} alt={appliedCharacter.name} className="w-full h-full object-cover object-top" />
                        </div>
                        <i className="ri-user-star-fill text-indigo-400 text-[9px]" />
                        <span className="text-[11px] font-bold text-indigo-300 whitespace-nowrap">{appliedCharacter.name}</span>
                        <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full whitespace-nowrap hidden sm:inline ${
                          appliedCharacter.gender === '여자' ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'
                        }`}>{appliedCharacter.gender}</span>
                        <button
                          onClick={handleClearCharacter}
                          className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-indigo-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer ml-0.5"
                        >
                          <i className="ri-close-line text-[9px]" />
                        </button>
                      </div>
                    )}

                    {appliedCharacter && (appliedAngle || appliedLook) && (
                      <div className="w-px h-4 bg-white/10 flex-shrink-0" />
                    )}

                    {appliedAngle && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 group flex-shrink-0">
                        <i className="ri-camera-3-line text-amber-400 text-[10px]" />
                        <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap">{appliedAngle.label}</span>
                        <span className="text-[9px] text-amber-500/70 whitespace-nowrap hidden md:inline">PAN {appliedAngle.pan}° TILT {appliedAngle.tilt}°</span>
                        <button
                          onClick={handleClearAngle}
                          className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-amber-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer ml-0.5"
                        >
                          <i className="ri-close-line text-[9px]" />
                        </button>
                      </div>
                    )}

                    {appliedAngle && appliedLook && (
                      <div className="w-px h-4 bg-white/10 flex-shrink-0" />
                    )}

                    {appliedLook && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/25 group flex-shrink-0">
                        <i className="ri-palette-line text-orange-400 text-[10px]" />
                        <span className="text-[11px] font-bold text-orange-300 whitespace-nowrap">{appliedLook.label}</span>
                        <span className="text-[9px] text-orange-500/70 whitespace-nowrap hidden md:inline">강도 {appliedLook.intensity}%</span>
                        <button
                          onClick={handleClearLook}
                          className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-orange-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer ml-0.5"
                        >
                          <i className="ri-close-line text-[9px]" />
                        </button>
                      </div>
                    )}

                    {[appliedCharacter, appliedAngle, appliedLook].filter(Boolean).length >= 2 && (
                      <>
                        <div className="w-px h-4 bg-white/10 flex-shrink-0" />
                        <button
                          onClick={() => { handleClearCharacter(); handleClearAngle(); handleClearLook(); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-zinc-600 hover:text-red-400 hover:bg-red-500/8 border border-transparent hover:border-red-500/20 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                          title="전체 해제"
                        >
                          <i className="ri-close-circle-line text-[11px]" />
                          <span className="hidden sm:inline">전체 해제</span>
                        </button>
                      </>
                    )}

                    <span className="ml-auto text-[10px] text-zinc-700 whitespace-nowrap hidden md:block flex-shrink-0">
                      <i className="ri-check-double-line text-emerald-500/50 mr-0.5" />
                      프롬프트 자동 반영
                    </span>
                  </div>
                )}

                {refImage && (
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <div className="w-6 h-6 rounded-lg overflow-hidden border border-emerald-500/40 flex-shrink-0">
                      <img src={refImage.url} alt={refImage.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-bold text-emerald-300 flex-1 truncate">{refImage.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">REF 참조</span>
                    <button
                      onClick={() => setRefImage(null)}
                      className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0"
                    >
                      <i className="ri-close-line text-xs" />
                    </button>
                  </div>
                )}
                <PromptBar
                  onGenerate={handleGenerate}
                  appliedCharacter={appliedCharacter}
                  characterApplyCounter={characterApplyCounter}
                  onClearCharacter={handleClearCharacter}
                  appliedAngle={appliedAngle}
                  onClearAngle={handleClearAngle}
                  appliedLook={appliedLook}
                  onClearLook={handleClearLook}
                  onApplyLook={handleApplyLook}
                  refImage={refImage}
                  onClearRefImage={() => setRefImage(null)}
                  onSetRefImage={(url, name) => handleSetRefImage(url, name, false)}
                  initialPrompt={initialPrompt ?? undefined}
                  initialType={initialType ?? undefined}
                />
              </div>
            </div>
          )}

          {/* Character 탭 */}
          {isCharacterTab && (
            <div className="flex flex-col flex-1 overflow-hidden mb-14 md:mb-0">
              <PageHeader
                icon="ri-user-star-line"
                title="Character"
                subtitle="AI Character Library"
                badgeColor="indigo"
                actions={
                  appliedCharacter ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30">
                      <div className="w-4 h-4 rounded-full overflow-hidden border border-indigo-500/40 flex-shrink-0">
                        <img src={appliedCharacter.img} alt={appliedCharacter.name} className="w-full h-full object-cover object-top" />
                      </div>
                      <span className="text-[11px] font-bold text-indigo-300 whitespace-nowrap">{appliedCharacter.name} 적용 중</span>
                      <button onClick={handleClearCharacter} className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-indigo-500/60 hover:text-red-400 cursor-pointer transition-colors">
                        <i className="ri-close-line text-[9px]" />
                      </button>
                    </div>
                  ) : undefined
                }
              />
              <CharacterView
                onApplyCharacter={handleApplyCharacterOnly}
                onApplyCharacterAndGenerate={handleApplyCharacterAndGenerate}
                appliedCharacterId={appliedCharacter?.id ?? null}
                activeCategory={activeCharCategory}
                onCategoryChange={setActiveCharCategory}
                externalCustomChars={sidebarCustomChars}
              />
            </div>
          )}

          {/* ANGLE 탭 */}
          {activeTab === 'ANGLE' && (
            <div className="flex flex-col flex-1 overflow-hidden mb-14 md:mb-0">
              <PageHeader
                icon="ri-camera-3-line"
                title="ANGLE"
                subtitle="Camera Angle & Composition"
                badgeColor="amber"
                actions={
                  appliedAngle ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                      <i className="ri-camera-3-line text-amber-400 text-[10px]" />
                      <span className="text-[11px] font-bold text-amber-300 whitespace-nowrap">{appliedAngle.label} 적용 중</span>
                      <button onClick={handleClearAngle} className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-amber-500/60 hover:text-red-400 cursor-pointer transition-colors">
                        <i className="ri-close-line text-[9px]" />
                      </button>
                    </div>
                  ) : undefined
                }
              />
              <AngleView
                onApplyAngle={handleApplyAngleAndSwitch}
                appliedAngle={appliedAngle}
                sharedDraft={sharedAngleDraft}
                onDraftChange={setSharedAngleDraft}
                onSaveToGallery={galleryAddItemRef.current ?? undefined}
              />
            </div>
          )}

          {/* LOOK 탭 */}
          {activeTab === 'LOOK' && (
            <div className="flex flex-col flex-1 overflow-hidden mb-14 md:mb-0">
              <PageHeader
                icon="ri-palette-line"
                title="LOOK"
                subtitle="Color · Mood · Visual Style"
                badgeColor="orange"
                actions={
                  appliedLook ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/15 border border-orange-500/30">
                      <i className="ri-palette-line text-orange-400 text-[10px]" />
                      <span className="text-[11px] font-bold text-orange-300 whitespace-nowrap">{appliedLook.label} 적용 중</span>
                      <button onClick={handleClearLook} className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-orange-500/60 hover:text-red-400 cursor-pointer transition-colors">
                        <i className="ri-close-line text-[9px]" />
                      </button>
                    </div>
                  ) : undefined
                }
              />
              <LookView
                onApplyLook={handleApplyLookAndSwitch}
                appliedLook={appliedLook}
                onSaveToGallery={galleryAddItemRef.current ?? undefined}
              />
            </div>
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111113]/95 backdrop-blur-xl border-t border-white/5 flex items-center h-14">
        {mobileTabItems.map((item) => {
          const isActive = activeTab === item.label;
          return (
            <button
              key={item.label}
              onClick={() => {
                setActiveTab(item.label);
                setSidebarOpen(false);
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative cursor-pointer transition-all ${
                isActive ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {item.dot && (
                <div className="absolute top-2 right-1/4 w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
              <div className="w-5 h-5 flex items-center justify-center">
                <i className={`${item.icon} text-lg`} />
              </div>
              <span className="text-[9px] font-bold">
                {item.label === 'Character' ? 'Char' : item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-400 rounded-full" />
              )}
            </button>
          );
        })}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full cursor-pointer transition-all ${
            sidebarOpen ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-hard-drive-2-line text-lg" />
          </div>
          <span className="text-[9px] font-bold">Storage</span>
        </button>
      </div>
    </div>
  );
}
