import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import GallerySaveToast from './GallerySaveToast';
import PromptOptimizePanel from './PromptOptimizePanel';
import {
  initialCuts,
  stylePromptModifiers,
  libraryImages,
  styleList,
  stylePreviewImages,
  durationColor,
  buildOptimizedPrompt,
  type Cut,
  type GalleryToast,
  type Step4ImageData,
} from './step4-image-data';

export type { Step4ImageData };

interface Step4ImageProps {
  onNext: (images: string[], cuts?: Cut[]) => void;
  onBack: () => void;
  selectedStyle: string | null;
  selectedRatio: string;
  onGoToStep1: () => void;
  onStyleChange?: (style: string) => void;
  selectedKeywords?: string[];
  channelName?: string;
  initialCuts?: Cut[];
}

type ModalType = 'library' | 'upload' | 'regen' | 'style' | null;

// ── Main Component ─────────────────────────────────────────────────────────
export default function Step4Image({
  onNext, onBack, selectedStyle, selectedRatio, onGoToStep1, onStyleChange,
  selectedKeywords = [], channelName: _channelName = '', initialCuts: initialCutsProp,
}: Step4ImageProps) {
  const [cuts, setCuts] = useState<Cut[]>(initialCutsProp ?? initialCuts);

  // initialCutsProp이 외부에서 변경될 때 state 재초기화 (편집 프로젝트 전환 시)
  // undefined → 기본값, 빈 배열 → 기본값, 데이터 있음 → 해당 데이터로 초기화
  useEffect(() => {
    if (initialCutsProp !== undefined) {
      setCuts(initialCutsProp.length > 0 ? initialCutsProp : initialCuts);
    }
  }, [initialCutsProp]);
  const [selectedCut, setSelectedCut] = useState<number>(1);
  const [imageModel, setImageModel] = useState('Flux Realism');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isInsufficientCredits, setIsInsufficientCredits] = useState(false);
  const [galleryToasts, setGalleryToasts] = useState<GalleryToast[]>([]);
  const savedUrlsRef = useRef<Set<string>>(new Set()); // 중복 저장 방지
  const { user } = useAuth();

  // 토스트 자동 제거
  useEffect(() => {
    if (galleryToasts.length === 0) return;
    const timer = setTimeout(() => {
      setGalleryToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [galleryToasts]);

  // ── 갤러리 자동 저장 (백그라운드) ─────────────────────────────────────
  const saveToGallery = useCallback(async (
    imageUrl: string,
    prompt: string,
    cutId: number,
    showToast = true
  ) => {
    // 비로그인 사용자는 저장 안 함
    if (!user?.id) return;
    // 이미 저장된 URL이면 스킵 (재생성 시 중복 방지)
    if (savedUrlsRef.current.has(imageUrl)) return;

    try {
      const styleLabel = selectedStyle
        ? (stylePromptModifiers[selectedStyle]?.label ?? selectedStyle)
        : '기본';

      await supabase.from('gallery_items').insert({
        type: 'image',
        url: imageUrl,
        prompt: prompt || `YouTube Studio Cut ${cutId} — ${styleLabel} 스타일`,
        model: imageModel,
        ratio: selectedRatio,
        liked: false,
        duration: null,
        user_id: user.id,
        source: 'youtube-studio',
      });

      savedUrlsRef.current.add(imageUrl);

      if (showToast) {
        const toastId = `gallery_${Date.now()}_${cutId}`;
        setGalleryToasts((prev) => [
          ...prev.slice(-2), // 최대 3개만 표시
          { id: toastId, message: `Cut ${cutId} 이미지가 갤러리에 저장됨`, count: 1, type: 'success' },
        ]);
      }
    } catch (err) {
      // 갤러리 저장 실패는 조용히 무시 (이미지 생성 결과에 영향 없음)
      console.warn('[Gallery] 자동 저장 실패:', err);
    }
  }, [user, selectedStyle, imageModel, selectedRatio]);
  const [modelOpen, setModelOpen] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingCutId, setGeneratingCutId] = useState<number | null>(null);
  const [generateAllProgress, setGenerateAllProgress] = useState(0);
  const [generateAllDoneCount, setGenerateAllDoneCount] = useState(0);
  const [isFreeEnabled, setIsFreeEnabled] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isRegenAll, setIsRegenAll] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [regenDone, setRegenDone] = useState(false);
  const [showOptimizePanel, setShowOptimizePanel] = useState(false);
  const [_isOptimizingAll, setIsOptimizingAll] = useState(false);
  const [_optimizeAllProgress, setOptimizeAllProgress] = useState(0);
  const [_optimizeAllDone, setOptimizeAllDone] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [styleHover, setStyleHover] = useState<string | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Mobile cut list drawer
  const [showMobileCutList, setShowMobileCutList] = useState(false);

  const current = cuts.find((c) => c.id === selectedCut)!;
  const styleLabel = selectedStyle ? (stylePromptModifiers[selectedStyle]?.label || selectedStyle) : null;
  const generatedCount = cuts.filter((c) => c.image).length;

  // Credit cost per model
  const modelCreditMap: Record<string, number> = {
    'Flux Realism': 2,
    'Flux Pro': 4,
    'Flux Pro Ultra': 8,
  };
  const creditPerImage = modelCreditMap[imageModel] ?? 2;
  const totalCreditsNeeded = creditPerImage * cuts.length;

  // Check if current cut's image URL contains the style modifier (i.e., was generated with style applied)
  const currentImageHasStyle = Boolean(
    current.image &&
    selectedStyle &&
    stylePromptModifiers[selectedStyle] &&
    current.image.includes(encodeURIComponent(stylePromptModifiers[selectedStyle].prefix.slice(0, 15)))
  );
  const optimizedCount = cuts.filter((c) => c.optimized).length;
  const filteredStyles = styleList.filter((s) => s.label.toLowerCase().includes(styleSearch.toLowerCase()));
  const filteredLibraryImages = libraryImages.filter((img) =>
    img.label.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const handlePromptChange = (val: string) => {
    setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, prompt: val, optimized: false } : c));
  };

  const handleAutoPrompt = () => {
    const prompt = buildOptimizedPrompt(selectedCut, selectedStyle, selectedKeywords);
    setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, prompt, optimized: true } : c));
    // Show a brief visual cue that style was applied
    setShowOptimizePanel(false);
  };

  const handleApplyOptimized = (prompt: string) => {
    setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, prompt, optimized: true } : c));
  };

  const handleGenerateCut = useCallback(async (id: number) => {
    setGeneratingCutId(id);
    setGenerateError(null);
    setIsInsufficientCredits(false);

    const cut = cuts.find((c) => c.id === id);
    if (!cut) { setGeneratingCutId(null); return; }

    // Build final prompt with style modifier
    let finalPrompt = cut.prompt.trim();
    if (!finalPrompt) {
      finalPrompt = buildOptimizedPrompt(id, selectedStyle, selectedKeywords);
    } else {
      const modifier = selectedStyle ? stylePromptModifiers[selectedStyle] : null;
      if (modifier) {
        const alreadyHasStyle = finalPrompt.toLowerCase().includes(modifier.prefix.slice(0, 20).toLowerCase());
        if (!alreadyHasStyle) {
          finalPrompt = `${modifier.prefix} ${finalPrompt}${modifier.suffix}`;
        }
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: finalPrompt,
          model: imageModel,
          ratio: selectedRatio,
          mode: 'default',
          ...(user?.id ? { user_id: user.id } : {}),
        },
      });

      if (error) {
        const detail = data?.error || data?.detail || error.message;
        throw Object.assign(new Error(detail), { data });
      }
      if (!data?.success || !data?.imageUrl) {
        throw Object.assign(new Error(data?.error || '이미지 생성에 실패했습니다.'), { data });
      }

      setCuts((prev) => prev.map((c) =>
        c.id === id ? { ...c, image: data.imageUrl } : c
      ));

      // 갤러리 자동 저장 (백그라운드)
      const finalPromptForGallery = cut.prompt.trim() || buildOptimizedPrompt(id, selectedStyle, selectedKeywords);
      saveToGallery(data.imageUrl, finalPromptForGallery, id, true);

    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const errData = (err as Error & { data?: { insufficient_credits?: boolean; required?: number; available?: number } }).data;

      let msg = '이미지 생성 중 오류가 발생했습니다.';
      let isCredits = false;

      if (errData?.insufficient_credits) {
        msg = `크레딧이 부족합니다. 필요: ${errData.required} CR, 보유: ${errData.available} CR`;
        isCredits = true;
      } else if (raw.includes('크레딧') || raw.includes('insufficient') || raw.includes('402')) {
        msg = '크레딧이 부족합니다. 크레딧을 충전해주세요.';
        isCredits = true;
      } else if (raw.includes('API 키') || raw.includes('api key') || raw.includes('FAL_KEY')) {
        msg = 'fal.ai API 키가 설정되지 않았습니다. 관리자 페이지에서 API 키를 등록해주세요.';
      } else if (raw.includes('401') || raw.includes('Unauthorized')) {
        msg = 'fal.ai 인증 실패: API 키를 확인해주세요.';
      } else if (raw.includes('timeout') || raw.includes('504')) {
        msg = '이미지 생성 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (raw && raw !== 'Edge Function returned a non-2xx status code') {
        msg = raw;
      }

      setIsInsufficientCredits(isCredits);
      setGenerateError(msg);
      if (!isCredits) setTimeout(() => setGenerateError(null), 8000);
    } finally {
      setGeneratingCutId(null);
    }
  }, [cuts, selectedStyle, selectedKeywords, imageModel, selectedRatio, user, saveToGallery]);

  const handleGenerateAll = useCallback(async () => {
    setIsGeneratingAll(true);
    setGenerateError(null);
    setIsInsufficientCredits(false);
    setGenerateAllProgress(0);
    setGenerateAllDoneCount(0);

    let savedCount = 0;

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      setGeneratingCutId(cut.id);

      // Build prompt for this cut
      let finalPrompt = cut.prompt.trim();
      if (!finalPrompt) {
        finalPrompt = buildOptimizedPrompt(cut.id, selectedStyle, selectedKeywords);
      } else {
        const modifier = selectedStyle ? stylePromptModifiers[selectedStyle] : null;
        if (modifier) {
          const alreadyHasStyle = finalPrompt.toLowerCase().includes(modifier.prefix.slice(0, 20).toLowerCase());
          if (!alreadyHasStyle) {
            finalPrompt = `${modifier.prefix} ${finalPrompt}${modifier.suffix}`;
          }
        }
      }

      try {
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: finalPrompt,
            model: imageModel,
            ratio: selectedRatio,
            mode: 'default',
            ...(user?.id ? { user_id: user.id } : {}),
          },
        });

        if (error) {
          const detail = data?.error || data?.detail || error.message;
          throw Object.assign(new Error(detail), { data });
        }
        if (data?.success && data?.imageUrl) {
          setCuts((prev) => prev.map((c) =>
            c.id === cut.id ? { ...c, image: data.imageUrl } : c
          ));
          // 갤러리 자동 저장 (개별 토스트 없이 백그라운드 저장)
          const promptForGallery = finalPrompt;
          saveToGallery(data.imageUrl, promptForGallery, cut.id, false);
          savedCount++;
        } else if (data?.error) {
          throw Object.assign(new Error(data.error), { data });
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const errData = (err as Error & { data?: { insufficient_credits?: boolean; required?: number; available?: number } }).data;

        if (errData?.insufficient_credits || raw.includes('크레딧') || raw.includes('insufficient') || raw.includes('402')) {
          const msg = errData?.insufficient_credits
            ? `크레딧이 부족합니다. 필요: ${errData.required} CR, 보유: ${errData.available} CR`
            : '크레딧이 부족합니다. 크레딧을 충전해주세요.';
          setIsInsufficientCredits(true);
          setGenerateError(msg);
          setIsGeneratingAll(false);
          setGeneratingCutId(null);
          // 지금까지 저장된 것 토스트 표시
          if (savedCount > 0 && user?.id) {
            setGalleryToasts((prev) => [...prev.slice(-2), {
              id: `gallery_all_${Date.now()}`,
              message: `${savedCount}개 이미지가 갤러리에 저장됨`,
              count: savedCount,
              type: 'success',
            }]);
          }
          return;
        }

        if (raw.includes('API 키') || raw.includes('FAL_KEY') || raw.includes('api key')) {
          const msg = 'fal.ai API 키가 설정되지 않았습니다. 관리자 페이지에서 API 키를 등록해주세요.';
          setGenerateError(msg);
          setIsGeneratingAll(false);
          setGeneratingCutId(null);
          return;
        }

        if (raw.includes('401') || raw.includes('Unauthorized')) {
          setGenerateError('fal.ai 인증 실패: API 키를 확인해주세요.');
          setIsGeneratingAll(false);
          setGeneratingCutId(null);
          return;
        }

        // 기타 에러는 해당 컷만 스킵하고 계속
        const msg = raw && raw !== 'Edge Function returned a non-2xx status code'
          ? `Cut ${cut.id}: ${raw}`
          : `Cut ${cut.id} 생성 실패`;
        setGenerateError(msg);
        console.error(`Cut ${cut.id} 생성 실패:`, raw);
        setTimeout(() => setGenerateError(null), 5000);
      } finally {
        setGeneratingCutId(null);
        const doneCount = i + 1;
        setGenerateAllDoneCount(doneCount);
        setGenerateAllProgress(Math.round((doneCount / cuts.length) * 100));
      }
    }

    setIsGeneratingAll(false);

    // 전체 생성 완료 후 일괄 갤러리 저장 토스트
    if (savedCount > 0 && user?.id) {
      setGalleryToasts((prev) => [...prev.slice(-2), {
        id: `gallery_all_${Date.now()}`,
        message: `${savedCount}개 이미지가 갤러리에 저장됨`,
        count: savedCount,
        type: 'success',
      }]);
    }
  }, [cuts, selectedStyle, selectedKeywords, imageModel, selectedRatio, user, saveToGallery]);

  // Optimize all prompts with channel data
  const _handleOptimizeAll = useCallback(() => {
    setIsOptimizingAll(true);
    setOptimizeAllDone(false);
    setOptimizeAllProgress(0);
    let i = 0;
    const go = () => {
      if (i >= cuts.length) {
        setIsOptimizingAll(false);
        setOptimizeAllProgress(100);
        setOptimizeAllDone(true);
        return;
      }
      const cut = cuts[i];
      const prompt = buildOptimizedPrompt(cut.id, selectedStyle, selectedKeywords);
      setCuts((prev) => prev.map((c) => c.id === cut.id ? { ...c, prompt, optimized: true } : c));
      setOptimizeAllProgress(Math.round(((i + 1) / cuts.length) * 100));
      i++;
      setTimeout(go, 280);
    };
    go();
  }, [cuts, selectedStyle, selectedKeywords]);

  const handleRegenAllPrompts = () => {
    setIsRegenAll(true);
    setRegenDone(false);
    setRegenProgress(0);
    let i = 0;
    const go = () => {
      if (i >= cuts.length) {
        setIsRegenAll(false);
        setRegenProgress(100);
        setRegenDone(true);
        return;
      }
      const cut = cuts[i];
      const prompt = buildOptimizedPrompt(cut.id, selectedStyle, selectedKeywords);
      setCuts((prev) => prev.map((c) => c.id === cut.id ? { ...c, prompt, optimized: true } : c));
      setRegenProgress(Math.round(((i + 1) / cuts.length) * 100));
      i++;
      setTimeout(go, 300);
    };
    go();
  };

  const handleUploadFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          const url = URL.createObjectURL(file);
          setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, image: url } : c));
          setActiveModal(null);
          return 100;
        }
        return Math.min(p + Math.floor(Math.random() * 20) + 10, 100);
      });
    }, 100);
  };

  const dismissToast = useCallback((id: string) => {
    setGalleryToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="flex flex-col h-full" onClick={() => setModelOpen(false)}>

      {/* ── 갤러리 저장 토스트 ── */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <GallerySaveToast toasts={galleryToasts} onDismiss={dismissToast} />

      {/* ── Library Modal ── */}
      {activeModal === 'library' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">이미지 라이브러리</p>
                <p className="text-zinc-500 text-xs mt-0.5">Cut {selectedCut}에 적용할 이미지를 선택하세요</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-4 md:p-5">
              <div className="flex items-center gap-2 bg-zinc-800 border border-white/5 rounded-xl px-3 py-2 mb-4">
                <i className="ri-search-line text-zinc-500 text-sm" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="이미지 검색..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                />
                {librarySearch && (
                  <button onClick={() => setLibrarySearch('')} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
                    <i className="ri-close-line text-sm" />
                  </button>
                )}
              </div>
              {filteredLibraryImages.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  <i className="ri-search-line text-2xl mb-2 block" />
                  &quot;{librarySearch}&quot; 검색 결과가 없습니다
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto">
                {filteredLibraryImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, image: img.url.replace('160', '480').replace('100', '270') } : c));
                      setActiveModal(null);
                    }}
                    className="relative rounded-xl overflow-hidden cursor-pointer group ring-1 ring-white/5 hover:ring-indigo-500 transition-all"
                  >
                    <img src={img.url} alt={img.label} className="w-full h-[70px] object-cover object-top" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center">
                        <i className="ri-add-line text-white text-sm" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pb-1.5 pt-4 px-1.5">
                      <p className="text-[9px] text-white font-semibold truncate">{img.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Modal ── */}
      {activeModal === 'upload' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">이미지 업로드</p>
                <p className="text-zinc-500 text-xs mt-0.5">Cut {selectedCut}에 적용할 이미지를 업로드하세요</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-5 md:p-6 space-y-4">
              {isUploading ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <p className="text-zinc-300 text-sm font-semibold">업로드 중...</p>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-zinc-500 text-xs">{uploadProgress}%</p>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingUpload(true); }}
                  onDragLeave={() => setIsDraggingUpload(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDraggingUpload(false); const file = e.dataTransfer.files[0]; if (file) handleUploadFile(file); }}
                  onClick={() => uploadInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 md:p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${isDraggingUpload ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'}`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <i className="ri-image-add-line text-zinc-400 text-2xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">이미지를 드래그하거나 클릭하여 업로드</p>
                    <p className="text-zinc-500 text-xs mt-1">JPG, PNG, WEBP · 최대 20MB</p>
                  </div>
                  <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadFile(file); }} />
                </div>
              )}
              <button onClick={() => setActiveModal(null)} className="w-full py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Regen All Modal ── */}
      {activeModal === 'regen' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => !isRegenAll && setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">프롬프트 전체 재생성</p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {selectedKeywords.length > 0 ? `채널 키워드 ${selectedKeywords.length}개 + 스타일 반영` : '스타일 기반 자동 생성'}
                </p>
              </div>
              {!isRegenAll && !regenDone && (
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                  <i className="ri-close-line" />
                </button>
              )}
            </div>
            <div className="p-5 md:p-6 space-y-5">
              {regenDone ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <i className="ri-check-line text-emerald-400 text-2xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">전체 재생성 완료!</p>
                    <p className="text-zinc-500 text-xs mt-1">총 {cuts.length}개 컷의 프롬프트가 최적화되었습니다</p>
                  </div>
                  <div className="w-full space-y-2 max-h-[160px] overflow-y-auto bg-zinc-800/50 rounded-xl p-3">
                    {cuts.map((c) => (
                      <div key={c.id} className="flex items-start gap-2">
                        <span className="text-[10px] text-emerald-400 font-bold whitespace-nowrap mt-0.5 w-10 flex-shrink-0">Cut {c.id}</span>
                        <p className="text-[10px] text-zinc-300 leading-relaxed line-clamp-2 flex-1">{c.prompt || '—'}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setRegenDone(false); setActiveModal(null); }} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap">확인</button>
                </div>
              ) : isRegenAll ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative w-14 h-14">
                    <div className="w-14 h-14 rounded-full border-2 border-zinc-700" />
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{regenProgress}%</span>
                    </div>
                  </div>
                  <p className="text-zinc-300 text-sm font-semibold">AI 프롬프트 최적화 중...</p>
                  <div className="w-full bg-zinc-700 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${regenProgress}%` }} />
                  </div>
                  <div className="w-full space-y-1.5 max-h-[140px] overflow-y-auto">
                    {cuts.map((c) => {
                      const isDone = c.optimized;
                      return (
                        <div key={c.id} className="flex items-start gap-2 rounded-lg px-2 py-1">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isDone ? 'bg-emerald-500/20' : 'bg-zinc-700'}`}>
                            {isDone && <i className="ri-check-line text-emerald-400 text-[8px]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-zinc-500 font-semibold">Cut {c.id}</span>
                            {isDone && <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-1 mt-0.5">{c.prompt}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {(selectedKeywords.length > 0 || selectedStyle) && (
                    <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-bold text-zinc-400 mb-2">반영될 데이터</p>
                      {selectedStyle && (
                        <div className="flex items-center gap-2">
                          <i className="ri-palette-line text-indigo-400 text-xs" />
                          <span className="text-[10px] text-zinc-400">스타일:</span>
                          <span className="text-[10px] text-indigo-300 font-semibold">{styleLabel}</span>
                        </div>
                      )}
                      {selectedKeywords.length > 0 && (
                        <div className="flex items-start gap-2">
                          <i className="ri-price-tag-3-line text-emerald-400 text-xs mt-0.5" />
                          <div className="flex flex-wrap gap-1">
                            {selectedKeywords.map((kw) => (
                              <span key={kw} className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5">
                    <i className="ri-alert-line text-amber-400 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">기존 프롬프트가 있는 컷도 모두 새로 생성됩니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setActiveModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap">취소</button>
                    <button onClick={handleRegenAllPrompts} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                      <i className="ri-sparkling-2-line" /> 전체 재생성
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Style Modal ── */}
      {activeModal === 'style' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">이미지 스타일 선택</p>
                <p className="text-zinc-500 text-xs mt-0.5">전체 컷에 적용할 스타일을 선택하세요</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex h-[400px] md:h-[480px]">
              <div className="flex-1 flex flex-col border-r border-white/5">
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2 bg-zinc-800 border border-white/5 rounded-xl px-3 py-2">
                    <i className="ri-search-line text-zinc-500 text-sm" />
                    <input type="text" value={styleSearch} onChange={(e) => setStyleSearch(e.target.value)} placeholder="스타일 검색..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {filteredStyles.map((s) => {
                      const isSelected = selectedStyle === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { onStyleChange?.(s.id); setActiveModal(null); }}
                          onMouseEnter={() => setStyleHover(s.id)}
                          onMouseLeave={() => setStyleHover(null)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-zinc-800/50 hover:border-white/15 hover:bg-zinc-800'}`}
                        >
                          <div className="w-full h-[60px] rounded-lg overflow-hidden relative">
                            {stylePreviewImages[s.id] ? (
                              <img src={stylePreviewImages[s.id]} alt={s.label} className="w-full h-full object-cover object-top" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                                <i className={`${s.icon} text-white text-xl`} />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                                  <i className="ri-check-line text-white text-xs" />
                                </div>
                              </div>
                            )}
                          </div>
                          <span className={`text-[11px] font-semibold text-center leading-tight ${isSelected ? 'text-indigo-300' : 'text-zinc-300'}`}>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex w-[220px] flex-shrink-0 flex-col">
                {(styleHover || selectedStyle) ? (
                  <>
                    <div className="flex-1 h-[140px] flex-shrink-0 overflow-hidden">
                      {stylePreviewImages[styleHover || selectedStyle || ''] ? (
                        <img src={stylePreviewImages[styleHover || selectedStyle || '']} alt="preview" className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${styleList.find((s) => s.id === (styleHover || selectedStyle))?.color || 'from-zinc-700 to-zinc-900'} flex items-center justify-center`}>
                          <i className={`${styleList.find((s) => s.id === (styleHover || selectedStyle))?.icon || 'ri-image-line'} text-white text-3xl`} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-4 space-y-3">
                      <div>
                        <p className="text-white font-bold text-sm">{styleList.find((s) => s.id === (styleHover || selectedStyle))?.label}</p>
                        {selectedStyle === (styleHover || selectedStyle) && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-semibold">현재 적용 중</span>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { onStyleChange?.(styleHover || selectedStyle || ''); setActiveModal(null); }} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold cursor-pointer transition-colors whitespace-nowrap">이 스타일 적용</button>
                      <button onClick={() => { setActiveModal(null); onGoToStep1(); }} className="w-full py-2 rounded-xl border border-white/10 text-zinc-400 text-xs font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap">
                        <i className="ri-arrow-left-line text-xs mr-1" />Step 1에서 선택
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <i className="ri-palette-line text-zinc-500 text-xl" />
                    </div>
                    <p className="text-zinc-500 text-xs">스타일에 마우스를 올려 미리보기</p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 md:px-6 py-3 border-t border-white/5 flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                {selectedStyle ? <><span className="text-indigo-400 font-semibold">{styleLabel}</span> 스타일 적용 중</> : '스타일 미선택'}
              </p>
              <button onClick={() => setActiveModal(null)} className="text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors whitespace-nowrap">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Cut List Drawer ── */}
      {showMobileCutList && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileCutList(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-[#0d0d0f] border-t border-white/10 rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
              <span className="text-sm font-bold text-white">컷 목록 ({generatedCount}/{cuts.length})</span>
              <button onClick={() => setShowMobileCutList(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cuts.map((cut) => {
                const dur = (cut.end - cut.start).toFixed(1);
                const isSelected = selectedCut === cut.id;
                const isGen = generatingCutId === cut.id;
                return (
                  <div
                    key={cut.id}
                    onClick={() => { setSelectedCut(cut.id); setShowMobileCutList(false); }}
                    className={`border-b border-white/5 p-3 cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/3'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-zinc-500 font-semibold">Cut {cut.id}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGenerateCut(cut.id); }}
                        className="w-5 h-5 rounded-full bg-zinc-700 hover:bg-indigo-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                      >
                        {isGen ? <i className="ri-loader-4-line animate-spin text-white text-[9px]" /> : <i className="ri-play-fill text-white text-[9px] ml-px" />}
                      </button>
                      <span className="text-[9px] text-zinc-600">{cut.start.toFixed(1)}s–{cut.end.toFixed(1)}s</span>
                      <span className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full ml-auto ${durationColor(Number(dur))}`}>{dur}s</span>
                    </div>
                    {cut.image ? (
                      <div className="relative group mb-2">
                        <img src={cut.image} alt={`Cut ${cut.id}`} className="w-full h-[70px] object-cover object-top rounded-lg" />
                        {isGen && (
                          <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
                            <i className="ri-loader-4-line animate-spin text-white text-lg" />
                          </div>
                        )}
                        {cut.optimized && (
                          <div className="absolute top-1 right-1 bg-indigo-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <i className="ri-sparkling-2-line text-[8px]" /> 최적화
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 leading-relaxed mb-2 whitespace-pre-line line-clamp-2">{cut.text}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Toolbar ── */}
      <div className="flex-shrink-0 border-b border-white/5 bg-[#0f0f11] px-2 md:px-6 py-2 md:py-3 flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-none">
        {/* Mobile cut list button */}
        <button
          onClick={() => setShowMobileCutList(true)}
          className="md:hidden flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-2.5 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-list-check text-xs" />
          컷 {selectedCut}/{cuts.length}
          {generatedCount > 0 && <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">{generatedCount}생성</span>}
        </button>

        {/* Model dropdown */}
        <div className="relative hidden md:block flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setModelOpen(!modelOpen)} className="flex items-center gap-2 bg-zinc-800 border border-white/10 hover:border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap">
            <i className="ri-flashlight-line text-indigo-400 text-xs" />
            {imageModel}
            <i className={`ri-arrow-down-s-line text-zinc-500 text-xs transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelOpen && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden min-w-[200px]">
              {[
                { id: 'Flux Realism', label: 'Flux Realism', desc: '빠른 사실적 이미지', icon: 'ri-flashlight-line' },
                { id: 'Flux Pro', label: 'Flux Pro', desc: '고품질 균형', icon: 'ri-image-line' },
                { id: 'Flux Pro Ultra', label: 'Flux Pro Ultra', desc: '최고 품질', icon: 'ri-sparkling-2-line' },
              ].map((m) => (
                <button key={m.id} onClick={() => { setImageModel(m.id); setModelOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${imageModel === m.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <i className={`${m.icon} text-xs flex-shrink-0`} />
                  <div className="text-left">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-[10px] text-zinc-500">{m.desc}</div>
                  </div>
                  {imageModel === m.id && <i className="ri-check-line text-indigo-400 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Style button */}
        <button
          onClick={() => setActiveModal('style')}
          className={`flex items-center gap-1 md:gap-1.5 border text-xs font-semibold px-2 md:px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${selectedStyle ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 hover:border-indigo-500/60' : 'bg-zinc-800 border-white/10 text-zinc-300 hover:border-white/20'}`}
        >
          <i className="ri-palette-line text-xs" />
          <span className="hidden sm:inline">{styleLabel || '스타일 미선택'}</span>
          <span className="sm:hidden">{styleLabel ? styleLabel.slice(0, 4) : '스타일'}</span>
          {selectedStyle ? (
            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-500/20">적용</span>
          ) : (
            <span className="hidden sm:block text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">선택</span>
          )}
        </button>

        {/* Ratio - desktop only */}
        <div className="hidden md:flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0">
          <i className="ri-aspect-ratio-line text-xs" />
          {selectedRatio}
          <span className="text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">Step 1</span>
        </div>

        {/* Channel keywords badge - desktop only */}
        {selectedKeywords.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0">
            <i className="ri-price-tag-3-line text-xs" />
            키워드 {selectedKeywords.length}개
          </div>
        )}

        {/* Optimize all button */}
        <button
          onClick={() => { setOptimizeAllDone(false); setActiveModal('regen'); }}
          className="hidden md:flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer hover:border-indigo-500/40 hover:text-indigo-300 transition-all whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
          프롬프트 재생성
          {optimizedCount > 0 && (
            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">{optimizedCount}/{cuts.length}</span>
          )}
        </button>

        {/* Mobile: AI optimize button */}
        <button
          onClick={() => { setOptimizeAllDone(false); setActiveModal('regen'); }}
          className="md:hidden flex items-center gap-1 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-2 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
          AI
        </button>

        <div className="flex-1 min-w-0" />

        {/* Free toggle - desktop only */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <i className="ri-sparkling-2-line text-zinc-500 text-xs" />
          <span className="text-xs text-zinc-500">Free (200/200)</span>
          <button onClick={() => setIsFreeEnabled(!isFreeEnabled)} className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${isFreeEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isFreeEnabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Credit cost badge - desktop only */}
        {!isGeneratingAll && (
          <div className="hidden md:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0">
            <i className="ri-coin-line text-xs" />
            {totalCreditsNeeded} 크레딧
            <span className="text-[9px] text-amber-400/70 font-normal">({creditPerImage}/컷)</span>
          </div>
        )}

        {/* Generate all */}
        <button
          onClick={handleGenerateAll}
          disabled={isGeneratingAll}
          className="flex items-center gap-1 md:gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 text-white font-bold text-xs px-2.5 md:px-4 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
        >
          {isGeneratingAll ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              <span className="hidden sm:inline">
                {generatingCutId ? `Cut ${generatingCutId} 생성 중...` : '생성 중...'}
              </span>
              <span className="sm:hidden">생성 중</span>
              <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                {generateAllDoneCount}/{cuts.length}
              </span>
            </>
          ) : (
            <>
              <i className="ri-play-fill text-xs ml-0.5" />
              <span className="hidden sm:inline">전체 생성</span>
              <span className="sm:hidden">전체</span>
              <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                <i className="ri-sparkling-2-line text-[10px]" />{cuts.length}
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Generate All Progress Bar ── */}
      {isGeneratingAll && (
        <div className="flex-shrink-0 bg-[#0a0a0c] border-b border-white/5 px-4 md:px-6 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
              <span className="text-xs font-semibold text-zinc-300">
                전체 이미지 생성 중
                {generatingCutId && (
                  <span className="text-zinc-500 font-normal ml-1">— Cut {generatingCutId} 처리 중</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-semibold">
                <span className="text-white">{generateAllDoneCount}</span>
                <span className="text-zinc-600">/{cuts.length}</span>
                <span className="text-zinc-600 ml-1">컷 완료</span>
              </span>
              <span className="text-xs font-bold text-indigo-400">{generateAllProgress}%</span>
              <div className="hidden md:flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <i className="ri-coin-line text-[10px]" />
                {generateAllDoneCount * creditPerImage}/{totalCreditsNeeded} 크레딧 사용
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${generateAllProgress}%` }}
            />
            {/* Cut markers */}
            {cuts.map((_, idx) => {
              const pos = ((idx + 1) / cuts.length) * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 w-px bg-black/40"
                  style={{ left: `${pos}%` }}
                />
              );
            })}
          </div>
          {/* Cut status dots */}
          <div className="flex items-center gap-1 mt-2">
            {cuts.map((cut) => {
              const isDone = generateAllDoneCount >= cut.id;
              const isCurrent = generatingCutId === cut.id;
              return (
                <div key={cut.id} className="flex flex-col items-center gap-0.5 flex-1">
                  <div className={`w-full h-1 rounded-full transition-all duration-300 ${
                    isDone
                      ? 'bg-emerald-500'
                      : isCurrent
                      ? 'bg-indigo-500 animate-pulse'
                      : 'bg-zinc-700'
                  }`} />
                  <span className={`text-[8px] font-semibold ${
                    isDone ? 'text-emerald-400' : isCurrent ? 'text-indigo-400' : 'text-zinc-700'
                  }`}>
                    {isDone ? <i className="ri-check-line" /> : isCurrent ? <i className="ri-loader-4-line animate-spin" /> : cut.id}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Cut list (desktop only) */}
        <div className="hidden md:block w-[260px] flex-shrink-0 border-r border-white/5 overflow-y-auto bg-[#0d0d0f]">
          <div className="sticky top-0 bg-[#0d0d0f] border-b border-white/5 px-3 py-2 flex items-center gap-2 z-10">
            <span className="text-xs text-zinc-400 font-semibold">{generatedCount}/{cuts.length} Cut</span>
            <div className="w-px h-3 bg-zinc-700" />
            <span className="text-xs text-zinc-500">0:38</span>
            {optimizedCount > 0 && (
              <>
                <div className="w-px h-3 bg-zinc-700" />
                <span className="text-[10px] text-indigo-400 font-semibold">{optimizedCount}개 최적화됨</span>
              </>
            )}
          </div>

          {cuts.map((cut) => {
            const dur = (cut.end - cut.start).toFixed(1);
            const isSelected = selectedCut === cut.id;
            const isGen = generatingCutId === cut.id;
            return (
              <div
                key={cut.id}
                onClick={() => setSelectedCut(cut.id)}
                className={`border-b border-white/5 p-3 cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/3'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-zinc-500 font-semibold">Cut {cut.id}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateCut(cut.id); }}
                    className="w-5 h-5 rounded-full bg-zinc-700 hover:bg-indigo-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                  >
                    {isGen ? <i className="ri-loader-4-line animate-spin text-white text-[9px]" /> : <i className="ri-play-fill text-white text-[9px] ml-px" />}
                  </button>
                  <span className="text-[9px] text-zinc-600">{cut.start.toFixed(1)}s–{cut.end.toFixed(1)}s</span>
                  <span className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full ml-auto ${durationColor(Number(dur))}`}>{dur}s</span>
                </div>

                {cut.image ? (
                  <div className="relative group mb-2">
                    <img src={cut.image} alt={`Cut ${cut.id}`} className="w-full h-[80px] object-cover object-top rounded-lg" />
                    {isGen && (
                      <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
                        <i className="ri-loader-4-line animate-spin text-white text-lg" />
                      </div>
                    )}
                    {cut.optimized && (
                      <div className="absolute top-1 right-1 bg-indigo-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <i className="ri-sparkling-2-line text-[8px]" /> 최적화
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 leading-relaxed mb-2 whitespace-pre-line line-clamp-3">{cut.text}</p>
                )}

                <div className="flex items-center gap-2">
                  {cut.optimized && (
                    <span className="text-[9px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">AI 최적화</span>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedCut(cut.id); setActiveModal('library'); }} className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-300 cursor-pointer">
                      <i className="ri-image-line text-xs" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 가위 버튼: 해당 컷 이미지 제거 (재생성 준비)
                        setCuts((prev) => prev.map((c) => c.id === cut.id ? { ...c, image: null } : c));
                        setSelectedCut(cut.id);
                      }}
                      className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
                      title="이미지 제거 (재생성 준비)"
                    >
                      <i className="ri-scissors-line text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — Image editor + Optimize panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main editor */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0f0f11]">
            {/* Style + channel data banner */}
            {(selectedStyle || selectedKeywords.length > 0) && (
              <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 bg-indigo-500/5 border-b border-indigo-500/10 flex-wrap">
                {selectedStyle && (
                  <div className="flex items-center gap-1.5">
                    <i className="ri-palette-line text-indigo-400 text-xs" />
                    <span className="text-xs text-indigo-300 font-semibold">{styleLabel}</span>
                  </div>
                )}
                {selectedStyle && selectedKeywords.length > 0 && <div className="w-px h-3 bg-indigo-500/30" />}
                {selectedKeywords.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <i className="ri-price-tag-3-line text-emerald-400 text-xs" />
                    {selectedKeywords.slice(0, 2).map((kw) => (
                      <span key={kw} className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">{kw}</span>
                    ))}
                    {selectedKeywords.length > 2 && (
                      <span className="text-[9px] text-zinc-500">+{selectedKeywords.length - 2}개</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setShowOptimizePanel(!showOptimizePanel)}
                  className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    showOptimizePanel
                      ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                      : 'text-indigo-400 hover:text-indigo-300'
                  }`}
                >
                  <i className="ri-sparkling-2-line text-xs" />
                  <span className="hidden sm:inline">{showOptimizePanel ? '최적화 패널 닫기' : 'AI 프롬프트 최적화'}</span>
                  <span className="sm:hidden">AI 최적화</span>
                </button>
              </div>
            )}

            {/* Error banner */}
            {generateError && (
              <div className={`flex-shrink-0 flex items-start gap-2 px-4 py-2.5 border-b ${
                isInsufficientCredits
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <i className={`text-sm flex-shrink-0 mt-0.5 ${
                  isInsufficientCredits ? 'ri-coin-line text-amber-400' : 'ri-error-warning-line text-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isInsufficientCredits ? 'text-amber-300' : 'text-red-300'}`}>
                    {isInsufficientCredits ? '크레딧 부족' : '이미지 생성 오류'}
                  </p>
                  <p className={`text-xs mt-0.5 ${isInsufficientCredits ? 'text-amber-200/70' : 'text-red-200/70'}`}>
                    {generateError}
                  </p>
                  {isInsufficientCredits && (
                    <p className="text-[10px] text-amber-400/60 mt-1">크레딧 충전 후 다시 시도하거나, 라이브러리에서 이미지를 선택하세요.</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!isInsufficientCredits && (
                    <button
                      onClick={() => { setGenerateError(null); setIsInsufficientCredits(false); handleGenerateCut(selectedCut); }}
                      className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-refresh-line text-[11px]" /> 재시도
                    </button>
                  )}
                  <button
                    onClick={() => { setGenerateError(null); setIsInsufficientCredits(false); }}
                    className={`cursor-pointer transition-colors ${
                      isInsufficientCredits ? 'text-amber-400 hover:text-amber-300' : 'text-red-400 hover:text-red-300'
                    }`}
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* Image preview */}
            <div className="flex-1 flex items-center justify-center p-2 md:p-6">
              <div className="relative rounded-2xl overflow-hidden max-w-[560px] w-full">
                {current.image ? (
                  generatingCutId === current.id ? (
                    <div className="w-full h-[160px] md:h-[315px] bg-zinc-800 flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-zinc-400 text-sm font-semibold">AI 이미지 생성 중...</p>
                      <p className="text-zinc-600 text-xs">fal.ai {imageModel} · 최대 2분 소요</p>
                    </div>
                  ) : (
                    <>
                      <img src={current.image} alt="Selected cut" className="w-full h-[160px] md:h-[315px] object-cover object-top" />
                      <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">Cut {current.id}</div>
                      {selectedStyle && (
                        <div className={`absolute top-3 left-16 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${currentImageHasStyle ? 'bg-indigo-500/70' : 'bg-amber-500/70'}`}>
                          <i className={`text-[10px] ${currentImageHasStyle ? 'ri-palette-line' : 'ri-alert-line'}`} />
                          {currentImageHasStyle ? styleLabel : `${styleLabel} 미반영`}
                        </div>
                      )}
                      {current.optimized && (
                        <div className="absolute top-3 right-16 bg-emerald-500/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <i className="ri-sparkling-2-line text-[10px]" /> AI 최적화
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-2">
                        {selectedStyle && !currentImageHasStyle && (
                          <button
                            onClick={() => handleGenerateCut(current.id)}
                            className="bg-amber-500/80 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <i className="ri-palette-line text-xs" /> 스타일 적용 재생성
                          </button>
                        )}
                        {(!selectedStyle || currentImageHasStyle) && (
                          <button onClick={() => handleGenerateCut(current.id)} className="bg-black/60 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap">
                            <i className="ri-refresh-line text-xs" /> 재생성
                          </button>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3 flex gap-2">
                        <button onClick={() => setActiveModal('library')} className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                          <i className="ri-folder-line text-xs" /> 라이브러리
                        </button>
                        <button onClick={() => setActiveModal('upload')} className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                          <i className="ri-upload-line text-xs" /> 업로드
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center max-w-xs mx-auto py-6 md:py-0">
                    {generatingCutId === current.id ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="text-zinc-400 text-sm font-semibold">AI 이미지 생성 중...</p>
                        <p className="text-zinc-600 text-xs">fal.ai {imageModel} · 최대 2분 소요</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                          <i className="ri-image-add-line text-zinc-500 text-2xl" />
                        </div>
                        <p className="text-zinc-500 text-sm">이미지를 생성하거나 업로드해 보세요.</p>
                        <div className="flex gap-3">
                          <button onClick={() => setActiveModal('library')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                            <i className="ri-folder-line" /> 라이브러리
                          </button>
                          <button onClick={() => setActiveModal('upload')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                            <i className="ri-upload-line" /> 업로드
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prompt area */}
            <div className="flex-shrink-0 border-t border-white/5 px-3 md:px-6 py-2.5 md:py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
                  <span className="text-xs font-semibold text-zinc-300">이미지 프롬프트</span>
                  {selectedStyle && (
                    <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-semibold">{styleLabel}</span>
                  )}
                  {current.optimized && (
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                      <i className="ri-sparkling-2-line text-[8px]" /> AI 최적화됨
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowOptimizePanel(!showOptimizePanel)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  >
                    <i className="ri-magic-line text-xs" /> AI 최적화
                  </button>
                  <div className="w-px h-3 bg-zinc-700" />
                  <button onClick={handleAutoPrompt} className="text-xs text-zinc-400 hover:text-zinc-300 cursor-pointer flex items-center gap-1 whitespace-nowrap">
                    <i className="ri-refresh-line text-xs" /> 자동
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={current.prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="이미지 프롬프트를 입력하세요..."
                  className="flex-1 bg-zinc-900/60 border border-white/5 rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
                <button
                  onClick={() => handleGenerateCut(current.id)}
                  disabled={generatingCutId === current.id}
                  className="flex items-center gap-1 md:gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-bold text-sm px-3 md:px-4 py-2 md:py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  {generatingCutId === current.id ? <><i className="ri-loader-4-line animate-spin" /> 생성 중</> : <><i className="ri-image-add-line" /> 생성</>}
                </button>
              </div>
            </div>
          </div>

          {/* Optimize panel — desktop: side panel, mobile: bottom sheet */}
          {showOptimizePanel && (
            <>
              {/* Desktop side panel */}
              <div className="hidden md:flex w-[280px] flex-shrink-0 flex-col overflow-hidden border-l border-white/5">
                <PromptOptimizePanel
                  cutId={current.id}
                  styleId={selectedStyle}
                  keywords={selectedKeywords}
                  onApply={handleApplyOptimized}
                  onClose={() => setShowOptimizePanel(false)}
                />
              </div>
              {/* Mobile bottom sheet */}
              <div className="md:hidden fixed inset-0 z-50">
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowOptimizePanel(false)}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-[#0d0d0f] border-t border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col">
                  <PromptOptimizePanel
                    cutId={current.id}
                    styleId={selectedStyle}
                    keywords={selectedKeywords}
                    onApply={handleApplyOptimized}
                    onClose={() => setShowOptimizePanel(false)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#0f0f11] px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium cursor-pointer transition-colors whitespace-nowrap">
          <i className="ri-arrow-left-line" />
          이전
        </button>
        <div className="flex items-center gap-2 md:gap-3">
          {/* 갤러리 저장 현황 */}
          {savedUrlsRef.current.size > 0 && user?.id && (
            <a
              href="/ai-create"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/15 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-image-line text-xs" />
              갤러리 {savedUrlsRef.current.size}개 저장됨
              <i className="ri-external-link-line text-[10px]" />
            </a>
          )}
          <span className="hidden sm:block text-xs text-zinc-500">
            {generatedCount === 0
              ? '이미지를 1개 이상 생성해주세요'
              : <span className="text-emerald-400 font-semibold">{generatedCount}/{cuts.length}컷 생성됨</span>
            }
          </span>
          {optimizedCount > 0 && (
            <span className="hidden sm:block text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
              {optimizedCount}개 AI 최적화
            </span>
          )}
          <button
            onClick={() => {
              if (generatedCount === 0) return;
              onNext(cuts.filter((c) => c.image !== null).map((c) => c.image as string), cuts);
            }}
            disabled={generatedCount === 0}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm px-4 md:px-6 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            다음
            <i className="ri-arrow-right-line" />
          </button>
        </div>
      </div>
    </div>
  );
}
