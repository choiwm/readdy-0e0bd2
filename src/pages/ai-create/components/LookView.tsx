import { useState, useRef, useCallback } from 'react';
import type { AppliedLook } from '@/utils/characterPrompt';
import RangeSlider from './RangeSlider';
import GenerationProgress from './GenerationProgress';
import type { ProgressStep } from './GenerationProgress';
import { pollImageResult } from '@/pages/ai-ad/utils/falPolling';
import type { GalleryItem } from '@/mocks/galleryItems';
import PageHeader from '@/components/feature/PageHeader';
import { supabase } from '@/lib/supabase';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────────────
type GenerationStep = 'idle' | 'analyzing' | 'applying' | 'refining' | 'done';

interface LookPreset {
  id: string;
  label: string;
  category: string;
  description: string;
  color: string;
  img: string;
}

interface GeneratedResult {
  id: string;
  lookId: string;
  lookLabel: string;
  img: string;
  generatedAt: string;
}

// ── Look Presets ───────────────────────────────────────────────────────────
const LOOK_PRESETS: LookPreset[] = [
  {
    id: 'cinematic',
    label: '시네마틱',
    category: '분위기',
    description: '영화 같은 드라마틱한 색감과 조명',
    color: 'amber',
    img: 'https://readdy.ai/api/search-image?query=cinematic%20dramatic%20film%20look%20color%20grading%2C%20warm%20orange%20teal%20contrast%2C%20movie%20still%20quality%2C%20professional%20cinematography%2C%20dark%20moody%20atmosphere%2C%20shallow%20depth%20of%20field%2C%20anamorphic%20lens%20flare&width=120&height=80&seq=look_cin&orientation=landscape',
  },
  {
    id: 'vintage',
    label: '빈티지',
    category: '분위기',
    description: '레트로 필름 감성의 따뜻한 색조',
    color: 'orange',
    img: 'https://readdy.ai/api/search-image?query=vintage%20retro%20film%20photography%20look%2C%20faded%20colors%2C%20warm%20yellow%20tones%2C%20grain%20texture%2C%20nostalgic%201970s%20aesthetic%2C%20soft%20vignette%2C%20analog%20film%20style&width=120&height=80&seq=look_vin&orientation=landscape',
  },
  {
    id: 'neon',
    label: '네온',
    category: '분위기',
    description: '사이버펑크 네온 빛 효과',
    color: 'violet',
    img: 'https://readdy.ai/api/search-image?query=neon%20cyberpunk%20color%20grading%2C%20vivid%20pink%20purple%20blue%20neon%20lights%2C%20dark%20background%2C%20futuristic%20aesthetic%2C%20glowing%20light%20effects%2C%20high%20contrast%2C%20urban%20night%20scene&width=120&height=80&seq=look_neo&orientation=landscape',
  },
  {
    id: 'minimal',
    label: '미니멀',
    category: '스타일',
    description: '깔끔하고 밝은 화이트 톤',
    color: 'zinc',
    img: 'https://readdy.ai/api/search-image?query=minimal%20clean%20white%20aesthetic%20photography%2C%20bright%20airy%20light%2C%20soft%20shadows%2C%20neutral%20tones%2C%20Scandinavian%20style%2C%20clean%20background%2C%20high%20key%20lighting%2C%20simple%20elegant%20composition&width=120&height=80&seq=look_min&orientation=landscape',
  },
  {
    id: 'dark',
    label: '다크',
    category: '스타일',
    description: '강렬하고 어두운 무드',
    color: 'zinc',
    img: 'https://readdy.ai/api/search-image?query=dark%20moody%20photography%20look%2C%20deep%20shadows%2C%20low%20key%20lighting%2C%20dramatic%20contrast%2C%20black%20background%2C%20mysterious%20atmosphere%2C%20noir%20style%2C%20high%20contrast%20black%20and%20white%20tones&width=120&height=80&seq=look_drk&orientation=landscape',
  },
  {
    id: 'pastel',
    label: '파스텔',
    category: '스타일',
    description: '부드럽고 사랑스러운 파스텔 톤',
    color: 'rose',
    img: 'https://readdy.ai/api/search-image?query=soft%20pastel%20color%20photography%2C%20light%20pink%20lavender%20mint%20tones%2C%20dreamy%20aesthetic%2C%20soft%20light%2C%20gentle%20shadows%2C%20romantic%20atmosphere%2C%20kawaii%20style%2C%20delicate%20colors&width=120&height=80&seq=look_pas&orientation=landscape',
  },
  {
    id: 'golden',
    label: '골든아워',
    category: '조명',
    description: '황금빛 일몰 자연광 효과',
    color: 'yellow',
    img: 'https://readdy.ai/api/search-image?query=golden%20hour%20photography%2C%20warm%20orange%20golden%20sunlight%2C%20sunset%20backlight%2C%20lens%20flare%2C%20warm%20skin%20tones%2C%20beautiful%20natural%20light%2C%20outdoor%20portrait%2C%20glowing%20atmosphere&width=120&height=80&seq=look_gld&orientation=landscape',
  },
  {
    id: 'studio',
    label: '스튜디오',
    category: '조명',
    description: '전문 스튜디오 조명 효과',
    color: 'sky',
    img: 'https://readdy.ai/api/search-image?query=professional%20studio%20photography%20lighting%2C%20clean%20white%20background%2C%20perfect%20even%20lighting%2C%20commercial%20product%20photography%20style%2C%20sharp%20details%2C%20neutral%20color%20balance%2C%20high%20resolution&width=120&height=80&seq=look_stu&orientation=landscape',
  },
];

// ── Look 프롬프트 매핑 ─────────────────────────────────────────────────────
const LOOK_PROMPT_MAP: Record<string, string> = {
  cinematic: 'cinematic color grading, warm orange teal contrast, dramatic film lighting, shallow depth of field, anamorphic lens flare, movie still quality, professional cinematography',
  vintage:   'vintage retro film look, faded warm tones, grain texture, nostalgic analog aesthetic, soft vignette, 1970s film style, warm yellow tones',
  neon:      'neon cyberpunk color grading, vivid pink purple blue neon lights, dark background, futuristic glowing effects, high contrast, urban night scene',
  minimal:   'minimal clean white aesthetic, bright airy high-key lighting, soft shadows, neutral tones, Scandinavian style, simple elegant composition',
  dark:      'dark moody low-key lighting, deep shadows, dramatic contrast, mysterious noir atmosphere, black background, intense dramatic look',
  pastel:    'soft pastel color palette, light pink lavender mint tones, dreamy romantic atmosphere, gentle soft light, kawaii delicate aesthetic',
  golden:    'golden hour warm sunlight, orange golden backlight, lens flare, warm glowing skin tones, beautiful natural outdoor light, sunset atmosphere',
  studio:    'professional studio lighting, clean neutral background, perfect even illumination, commercial photography quality, sharp crisp details',
};

// ── Look Generation Progress steps ────────────────────────────────────────
const LOOK_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'analyzing', label: '이미지 분석', icon: 'ri-scan-2-line' },
  { id: 'applying',  label: '룩 적용',     icon: 'ri-palette-line' },
  { id: 'refining',  label: '세부 조정',   icon: 'ri-magic-line' },
  { id: 'done',      label: '완료',        icon: 'ri-checkbox-circle-line' },
];

const LOOK_CREDIT_COST = 1;

// ── Main LookView ──────────────────────────────────────────────────────────
interface LookViewProps {
  onApplyLook?: (look: AppliedLook) => void;
  appliedLook?: AppliedLook | null;
  onSaveToGallery?: (item: Omit<GalleryItem, 'id' | 'createdAt'>) => Promise<GalleryItem | null>;
}

export default function LookView({ onApplyLook, appliedLook, onSaveToGallery }: LookViewProps) {
  const { deduct, refund, credits, canAfford } = useCredits();
  const { profile } = useAuth();

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedLook, setSelectedLook] = useState<LookPreset | null>(null);
  const [intensity, setIntensity] = useState(80);
  const [genStep, setGenStep] = useState<GenerationStep>('idle');
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<GeneratedResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [applyToast, setApplyToast] = useState(false);
  const [preserveSource, setPreserveSource] = useState(true);
  const [saveToast, setSaveToast] = useState<{ type: 'both' | 'result' | 'error' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalCopied, setModalCopied] = useState(false);
  const [showMobileLookPanel, setShowMobileLookPanel] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleApplyToGenerate = useCallback(() => {
    if (!selectedLook || !onApplyLook) return;
    onApplyLook({
      id: selectedLook.id,
      label: selectedLook.label,
      category: selectedLook.category,
      intensity,
    });
    setApplyToast(true);
    setTimeout(() => setApplyToast(false), 2200);
  }, [selectedLook, intensity, onApplyLook]);

  const isCurrentlyApplied = appliedLook !== null && appliedLook !== undefined
    && appliedLook.id === selectedLook?.id
    && appliedLook.intensity === intensity;

  const categories = ['전체', '분위기', '스타일', '조명'];
  const filteredLooks = activeCategory === '전체'
    ? LOOK_PRESETS
    : LOOK_PRESETS.filter((l) => l.category === activeCategory);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSourceImage(URL.createObjectURL(file));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSourceImage(URL.createObjectURL(file));
  };

  const showSaveToast = (type: 'both' | 'result' | 'error') => {
    setSaveToast({ type });
    setTimeout(() => setSaveToast(null), 2800);
  };

  // ── 룩 프롬프트 빌드 ──────────────────────────────────────────────────
  const buildLookPrompt = useCallback((look: LookPreset, intensityVal: number): string => {
    const lookDesc = LOOK_PROMPT_MAP[look.id] ?? look.label;
    const intensityDesc = intensityVal >= 80
      ? `strong ${look.label.toLowerCase()} effect, highly stylized`
      : intensityVal <= 30
      ? `subtle ${look.label.toLowerCase()} effect, natural look`
      : `${look.label.toLowerCase()} effect`;

    return `professional portrait photography, Korean person, ${lookDesc}, ${intensityDesc}, high quality, photorealistic, 8k resolution, studio lighting`;
  }, []);

  // ── 실제 fal.ai 생성 ──────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!selectedLook) return;
    if (genStep !== 'idle' && genStep !== 'done') return;
    setGenError(null);

    // 크레딧 확인
    if (!canAfford(LOOK_CREDIT_COST)) {
      setGenError(`크레딧이 부족합니다. 필요: ${LOOK_CREDIT_COST} CR, 보유: ${credits} CR`);
      return;
    }

    // 크레딧 선차감
    const deducted = deduct(LOOK_CREDIT_COST);
    if (!deducted) {
      setGenError('크레딧 차감에 실패했습니다.');
      return;
    }

    setSelectedResult(null);
    setGenStep('analyzing');

    const prompt = buildLookPrompt(selectedLook, intensity);

    try {
      await new Promise((r) => setTimeout(r, 700));
      setGenStep('applying');

      const sessionId = localStorage.getItem('ai_platform_session_id') ?? undefined;

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt,
          model: 'Flux Realism',
          ratio: '3:4',
          aspectRatio: '3:4',
          user_id: profile?.id ?? undefined,
          session_id: profile?.id ? undefined : sessionId,
        },
      });

      setGenStep('refining');
      await new Promise((r) => setTimeout(r, 400));

      // pending 응답 폴링 (PR #40 / Cycle 28 패턴)
      let finalImageUrl: string | null = null;
      if (data?.imageUrl) {
        finalImageUrl = data.imageUrl as string;
      } else if (data?.pending && data?.request_id) {
        finalImageUrl = await pollImageResult(
          data.model as string,
          data.request_id as string,
          data.status_url as string | undefined,
          data.response_url as string | undefined,
          data.save_opts as Record<string, unknown> | undefined,
        );
      }
      if (error || !finalImageUrl) {
        throw new Error(data?.error ?? error?.message ?? '이미지 생성에 실패했습니다.');
      }

      setGenStep('done');

      const newResult: GeneratedResult = {
        id: `lres_${Date.now()}`,
        lookId: selectedLook.id,
        lookLabel: selectedLook.label,
        img: finalImageUrl,
        generatedAt: new Date().toISOString(),
      };
      setResults((prev) => [newResult, ...prev]);

      // 갤러리 저장
      if (onSaveToGallery) {
        try {
          await onSaveToGallery({
            type: 'image',
            url: newResult.img,
            prompt: `LOOK: ${selectedLook.label} (강도 ${intensity}%)`,
            model: 'Look AI',
            ratio: '3:4',
            liked: false,
          });

          if (preserveSource && sourceImage) {
            await onSaveToGallery({
              type: 'image',
              url: sourceImage,
              prompt: `[원본] LOOK 소스 이미지 — ${selectedLook.label} 적용 전`,
              model: 'Look AI · 원본',
              ratio: '3:4',
              liked: false,
            });
            showSaveToast('both');
          } else {
            showSaveToast('result');
          }
        } catch {
          showSaveToast('error');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setGenError(msg);
      setGenStep('idle');
      // 실패 시 크레딧 환불
      refund(LOOK_CREDIT_COST);
    }
  }, [selectedLook, genStep, canAfford, deduct, refund, credits, buildLookPrompt, intensity, sourceImage, preserveSource, onSaveToGallery, profile]);

  const handleDownload = async (result: GeneratedResult) => {
    try {
      const response = await fetch(result.img);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `look_${result.lookLabel}_${result.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      window.open(result.img, '_blank');
    }
  };

  const handleCopyShare = (resultId: string, imgUrl: string) => {
    navigator.clipboard.writeText(imgUrl).then(() => {
      setCopiedId(resultId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleModalCopyShare = (imgUrl: string) => {
    navigator.clipboard.writeText(imgUrl).then(() => {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
    });
  };

  const isGenerating = genStep !== 'idle' && genStep !== 'done';

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-[#0a0a0b]">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* Apply toast */}
      {applyToast && (
        <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-sm whitespace-nowrap">
          <i className="ri-check-double-line" />
          룩이 생성 탭에 적용되었습니다
        </div>
      )}

      {/* Gallery save toast */}
      {saveToast && (
        <div className={`fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-sm border transition-all whitespace-nowrap ${
          saveToast.type === 'error'
            ? 'bg-red-500/20 border-red-500/40 text-red-400'
            : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
        }`}>
          <i className={saveToast.type === 'error' ? 'ri-error-warning-line' : 'ri-gallery-line'} />
          {saveToast.type === 'both' && '결과 + 원본 이미지 갤러리에 저장됨'}
          {saveToast.type === 'result' && '결과 이미지 갤러리에 저장됨'}
          {saveToast.type === 'error' && '갤러리 저장 실패 (결과는 로컬 유지)'}
        </div>
      )}

      {/* ── Left: Source + Result ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <PageHeader
          icon="ri-eye-line"
          title="LOOK 적용"
          badgeColor="orange"
          appliedLabel={appliedLook ? `${appliedLook.label} 적용 중` : undefined}
          appliedColor="amber"
          actions={
            <button
              onClick={() => setShowMobileLookPanel(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <i className="ri-palette-line text-sm" />
              {selectedLook ? selectedLook.label : '룩 선택'}
            </button>
          }
        />

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Source image area */}
          <div className="flex-1 flex flex-col items-center justify-start p-3 md:p-6 md:border-r border-white/5 overflow-y-auto">
            <div className="self-start flex items-center justify-between w-full mb-3 md:mb-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">소스 이미지</p>
              {sourceImage && (
                <button
                  onClick={() => setPreserveSource((v) => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                    preserveSource
                      ? 'bg-teal-500/15 border-teal-500/30 text-teal-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <i className={`text-[11px] ${preserveSource ? 'ri-archive-2-fill' : 'ri-archive-2-line'}`} />
                  원본 보존 {preserveSource ? 'ON' : 'OFF'}
                </button>
              )}
            </div>

            {sourceImage ? (
              <div className="relative w-full max-w-[200px] md:max-w-xs group">
                <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-white/10">
                  <img src={sourceImage} alt="Source" className="w-full h-full object-cover object-top" />
                </div>
                {preserveSource && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 backdrop-blur-sm">
                    <i className="ri-archive-2-fill text-teal-400 text-[9px]" />
                    <span className="text-[9px] font-bold text-teal-400">원본 보존</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-refresh-line mr-1" />교체
                  </button>
                  <button
                    onClick={() => setSourceImage(null)}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line mr-1" />제거
                  </button>
                </div>
                <p className="text-center text-[10px] text-zinc-600 mt-2">소스 이미지</p>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                className={`w-full max-w-xs flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all py-10 md:py-16 px-6 ${
                  isDragOver ? 'border-amber-500/60 bg-amber-500/5' : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-zinc-800/80 border border-white/5">
                  <i className="ri-image-add-line text-xl md:text-2xl text-zinc-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-400 font-medium">이미지를 드래그하거나</p>
                  <p className="text-sm text-zinc-400">아래 버튼으로 선택하세요</p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-upload-cloud-line" />업로드
                </button>
              </div>
            )}

            {/* Error message */}
            {genError && (
              <div className="w-full max-w-xs mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
                <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{genError}</p>
              </div>
            )}

            {/* Generation progress */}
            {isGenerating && (
              <div className="w-full max-w-xs mt-4 md:mt-6 p-4 rounded-2xl bg-zinc-900/60 border border-white/5">
                <p className="text-xs font-bold text-white mb-4 flex items-center gap-2">
                  <i className="ri-loader-4-line animate-spin text-amber-400" />
                  fal.ai로 룩 적용 생성 중...
                </p>
                <GenerationProgress
                  steps={LOOK_PROGRESS_STEPS}
                  currentStep={genStep}
                  activeColor="bg-amber-500/20 text-amber-400"
                  activeBarColor="bg-amber-500"
                />
              </div>
            )}

            {sourceImage && preserveSource && !isGenerating && (
              <div className="w-full max-w-xs mt-3 md:mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-teal-500/8 border border-teal-500/20">
                <i className="ri-information-line text-teal-400 text-xs mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-teal-400/80 leading-relaxed">
                  생성 완료 시 <strong className="text-teal-400">소스 원본</strong>과 <strong className="text-teal-400">결과 이미지</strong> 모두 갤러리에 저장됩니다
                </p>
              </div>
            )}
          </div>

          {/* Result area */}
          <div className="flex-1 flex flex-col items-center justify-start p-3 md:p-6 overflow-y-auto border-t md:border-t-0 border-white/5">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3 md:mb-4 self-start">
              생성 결과 {results.length > 0 && <span className="text-zinc-600">({results.length}개)</span>}
            </p>

            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 md:py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                  <i className="ri-magic-line text-xl md:text-2xl text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500">룩을 선택하고 생성하면</p>
                <p className="text-sm text-zinc-500">결과가 여기에 표시됩니다</p>
              </div>
            ) : (
              <div className={`w-full grid gap-2 md:gap-3 ${
                results.length === 1 ? 'grid-cols-1 max-w-[200px] mx-auto' :
                'grid-cols-2'
              }`}>
                {results.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => setSelectedResult(result)}
                    className={`relative group cursor-pointer rounded-xl overflow-hidden border transition-all ${
                      selectedResult?.id === result.id
                        ? 'border-amber-500 ring-1 ring-amber-500/50'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="w-full aspect-[3/4] bg-zinc-900">
                      <img src={result.img} alt="result" className="w-full h-full object-cover object-top" />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(result); }}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-all"
                      >
                        <i className="ri-download-2-line text-sm" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyShare(result.id, result.img); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                          copiedId === result.id
                            ? 'bg-emerald-500/40 text-emerald-300'
                            : 'bg-white/20 hover:bg-white/30 text-white'
                        }`}
                      >
                        <i className={`text-sm ${copiedId === result.id ? 'ri-check-line' : 'ri-share-line'}`} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[9px] text-zinc-300 font-bold">{result.lookLabel}</p>
                      <p className="text-[8px] text-zinc-500">{new Date(result.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Look Selector + Controls ── */}
      <div className="hidden md:flex w-[240px] flex-shrink-0 border-l border-white/5 flex-col overflow-hidden bg-[#0d0d0f]">

        <PageHeader
          icon="ri-palette-line"
          title="룩 선택"
          badgeColor="orange"
          compact
        />

        {/* Category filter */}
        <div className="p-3 border-b border-white/5">
          <div className="flex flex-wrap gap-1 mb-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
            {filteredLooks.map((look) => {
              const isSelected = selectedLook?.id === look.id;
              return (
                <button
                  key={look.id}
                  onClick={() => setSelectedLook(look)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'border-amber-500/60 bg-amber-500/12 ring-1 ring-amber-500/20'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-800/60'
                  }`}
                >
                  <div className={`w-14 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 transition-all ${isSelected ? 'ring-1 ring-amber-500/40' : ''}`}>
                    <img src={look.img} alt={look.label} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-zinc-200'}`}>
                        {look.label}
                      </p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        look.category === '분위기' ? 'bg-violet-500/15 text-violet-400' :
                        look.category === '스타일' ? 'bg-zinc-700 text-zinc-400' :
                        'bg-yellow-500/15 text-yellow-500'
                      }`}>{look.category}</span>
                    </div>
                    <p className="text-[9px] text-zinc-500 truncate mt-0.5">{look.description}</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                      <i className="ri-check-line text-amber-400 text-[10px]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intensity slider */}
        {selectedLook && (
          <div className="px-4 pt-3 pb-3 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">강도</p>
              <span className="text-xs text-amber-400 font-black">{intensity}%</span>
            </div>
            <RangeSlider
              value={intensity}
              min={0}
              max={100}
              onChange={setIntensity}
              gradient="from-amber-500 to-orange-500"
              thumbColor="border-amber-400"
              height="h-5"
              thumbSize="w-4 h-4"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-zinc-600">약하게</span>
              <span className="text-[9px] text-zinc-600">강하게</span>
            </div>
          </div>
        )}

        {/* Generate button */}
        <div className="p-4 mt-auto flex flex-col gap-2">
          {/* 크레딧 표시 */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-600">보유 크레딧</span>
            <span className="text-[10px] font-bold text-amber-400">{credits} CR</span>
          </div>

          {onApplyLook && selectedLook && (
            <button
              onClick={handleApplyToGenerate}
              className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap border ${
                isCurrentlyApplied
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              {isCurrentlyApplied ? (
                <><i className="ri-check-double-line text-sm" />생성 탭에 적용됨</>
              ) : (
                <><i className="ri-send-plane-fill text-sm" />생성 탭에 적용</>
              )}
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={!selectedLook || isGenerating || !canAfford(LOOK_CREDIT_COST)}
            className={`w-full py-3 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              !selectedLook || isGenerating || !canAfford(LOOK_CREDIT_COST)
                ? 'bg-zinc-700 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 cursor-pointer'
            }`}
          >
            {isGenerating ? (
              <>
                <i className="ri-loader-4-line animate-spin text-sm" />
                생성 중...
              </>
            ) : selectedLook ? (
              <>
                <i className="ri-sparkling-2-fill text-sm" />
                {selectedLook.label} 적용
                <span className="flex items-center gap-0.5 bg-white/15 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                  <i className="ri-copper-diamond-line text-[10px]" /> {LOOK_CREDIT_COST}
                </span>
              </>
            ) : (
              <>
                <i className="ri-palette-line text-sm" />
                룩을 선택하세요
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 모바일 룩 선택 하단 시트 ── */}
      {showMobileLookPanel && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setShowMobileLookPanel(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full bg-[#111114] border-t border-white/10 rounded-t-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
              <span className="text-xs font-bold text-white">룩 선택</span>
              <button onClick={() => setShowMobileLookPanel(false)} className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-white cursor-pointer"><i className="ri-close-line text-sm" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${activeCategory === cat ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300 border border-transparent'}`}>{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {filteredLooks.map((look) => (
                  <button
                    key={look.id}
                    onClick={() => { setSelectedLook(look); setShowMobileLookPanel(false); }}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer text-left ${selectedLook?.id === look.id ? 'border-amber-500/50 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'}`}
                  >
                    <div className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                      <img src={look.img} alt={look.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold truncate ${selectedLook?.id === look.id ? 'text-amber-400' : 'text-zinc-200'}`}>{look.label}</p>
                      <p className="text-[9px] text-zinc-600 truncate">{look.category}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-white/5 flex-shrink-0 p-4 space-y-3">
              {selectedLook && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">강도</p>
                    <span className="text-xs text-amber-400 font-black">{intensity}%</span>
                  </div>
                  <RangeSlider value={intensity} min={0} max={100} onChange={setIntensity} gradient="from-amber-500 to-orange-500" thumbColor="border-amber-400" height="h-5" thumbSize="w-4 h-4" />
                </div>
              )}
              <div className="flex gap-2">
                {onApplyLook && selectedLook && (
                  <button onClick={() => { handleApplyToGenerate(); setShowMobileLookPanel(false); }} className={`flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 border transition-all ${isCurrentlyApplied ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'}`}>
                    <i className={isCurrentlyApplied ? 'ri-check-double-line' : 'ri-send-plane-fill'} />
                    {isCurrentlyApplied ? '적용됨' : '생성 탭에 적용'}
                  </button>
                )}
                <button onClick={() => { handleGenerate(); setShowMobileLookPanel(false); }} disabled={!selectedLook || isGenerating || !canAfford(LOOK_CREDIT_COST)} className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${!selectedLook || isGenerating || !canAfford(LOOK_CREDIT_COST) ? 'bg-zinc-700 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-amber-500 to-orange-500 cursor-pointer'}`}>
                  {isGenerating ? <><i className="ri-loader-4-line animate-spin" />생성 중...</> : <><i className="ri-sparkling-2-fill" />{selectedLook ? `${selectedLook.label} 생성` : '룩 선택 후 생성'}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result Detail Modal */}
      {selectedResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3 md:px-0"
          onClick={() => setSelectedResult(null)}
        >
          <div
            className="bg-[#111114] border border-white/10 rounded-2xl overflow-hidden w-full md:w-[560px] max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div>
                <p className="text-sm font-bold text-white">룩 적용 결과</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{selectedResult.lookLabel} · 강도 {intensity}%</p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            {sourceImage && (
              <div className="flex border-b border-white/5">
                <div className="flex-1 flex flex-col items-center p-3 border-r border-white/5">
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-2">원본</p>
                  <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-zinc-900">
                    <img src={sourceImage} alt="original" className="w-full h-full object-cover object-top" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center p-3">
                  <p className="text-[9px] text-amber-500 font-bold uppercase tracking-widest mb-2">결과</p>
                  <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-zinc-900">
                    <img src={selectedResult.img} alt="result" className="w-full h-full object-cover object-top" />
                  </div>
                </div>
              </div>
            )}
            {!sourceImage && (
              <div className="flex-1 overflow-hidden bg-zinc-950 flex items-center justify-center p-4">
                <img src={selectedResult.img} alt="result" className="max-w-full max-h-[50vh] object-contain rounded-xl" />
              </div>
            )}
            <div className="p-4 border-t border-white/5 flex gap-2">
              <button
                onClick={() => handleDownload(selectedResult)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-download-2-line" />다운로드
              </button>
              <button
                onClick={() => handleModalCopyShare(selectedResult.img)}
                className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  modalCopied
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                }`}
              >
                <i className={modalCopied ? 'ri-check-line' : 'ri-share-line'} />
                {modalCopied ? '복사됨!' : '공유'}
              </button>
              <button
                onClick={() => setSelectedResult(null)}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
