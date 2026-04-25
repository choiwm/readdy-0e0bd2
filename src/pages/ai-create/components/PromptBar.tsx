import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { logDev } from '@/lib/logger';
import type { AppliedCharacter } from '../page';
import { buildCharacterPrompt, buildAnglePrompt, buildLookPrompt, getCharacterAppearanceTags, type AppliedAngle, type AppliedLook } from '@/utils/characterPrompt';
import { LOOK_OPTIONS } from '@/pages/ai-create/data/presets';
import RangeSlider from './RangeSlider';
import InsufficientCreditsModal from '@/components/base/InsufficientCreditsModal';
import { useCredits } from '@/hooks/useCredits';

// ── 실제 GoAPI 모델 정의 ──────────────────────────────────────────────────
interface ModelDef {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  desc: string;
  time: string;
  cost: number;
}

const MODEL_DEFS: ModelDef[] = [
  {
    id: 'Flux Realism',
    label: 'Flux Realism',
    badge: 'Fast',
    badgeColor: 'bg-emerald-500/15 text-emerald-400',
    desc: '빠른 사실적 이미지 생성 (schnell)',
    time: '~5초',
    cost: 1,
  },
  {
    id: 'Flux Pro',
    label: 'Flux Pro',
    badge: 'Balanced',
    badgeColor: 'bg-amber-500/15 text-amber-400',
    desc: '품질과 속도의 균형',
    time: '~30초',
    cost: 3,
  },
  {
    id: 'Flux Pro Ultra',
    label: 'Flux Pro Ultra',
    badge: 'Best Quality',
    badgeColor: 'bg-rose-500/15 text-rose-400',
    desc: '최고 품질 · 세밀한 디테일',
    time: '~45초',
    cost: 5,
  },
];

const _models = MODEL_DEFS.map((m) => m.id);
const ratios = ['1K · 16:9 · PNG', '4K · 1:1 · PNG', '2K · 9:16 · PNG'];
// AVATAR / MODIFY 탭은 백엔드 미구현 — 노출하면 클릭 시 "곧 출시됩니다"
// 토스트만 떠서 사용자가 혼란스러워해요. 구현 완료 시점에 다시 추가합니다.
// 관련 dead code (TYPE_MULTIPLIERS.AVATAR, "준비 중" 배너 등) 는 일단 유지 —
// 다음 PR 에서 한 번에 정리.
const tabs: string[] = ['IMAGE', 'VIDEO'];

// ── 크레딧 비용 테이블 ─────────────────────────────────────────────────────
const MODEL_COSTS: Record<string, number> = Object.fromEntries(MODEL_DEFS.map((m) => [m.id, m.cost]));

const TYPE_MULTIPLIERS: Record<string, number> = {
  IMAGE:  1,
  VIDEO:  5,
  AVATAR: 2,
  MODIFY: 1,
};

// ── 크레딧 비용 계산 헬퍼 ─────────────────────────────────────────────────
function getCost(model: string, type: string): number {
  return (MODEL_COSTS[model] ?? 1) * (TYPE_MULTIPLIERS[type] ?? 1);
}

interface PromptBarProps {
  onGenerate?: (prompt: string, model: string, type: string, ratio?: string, creditCost?: number) => void;
  appliedCharacter?: AppliedCharacter | null;
  characterApplyCounter?: number;
  onClearCharacter?: () => void;
  appliedAngle?: AppliedAngle | null;
  onClearAngle?: () => void;
  appliedLook?: AppliedLook | null;
  onClearLook?: () => void;
  onApplyLook?: (look: AppliedLook) => void;
  refImage?: { url: string; name: string } | null;
  onClearRefImage?: () => void;
  onSetRefImage?: (url: string, name: string) => void;
  initialPrompt?: string;
  initialType?: string;
}

// ── Look 퀵 드롭다운 ───────────────────────────────────────────────────────────
function LookQuickDropdown({
  appliedLook,
  onApplyLook,
  onClearLook,
  onClose,
}: {
  appliedLook?: AppliedLook | null;
  onApplyLook?: (look: AppliedLook) => void;
  onClearLook?: () => void;
  onClose: () => void;
}) {
  const [intensity, setIntensity] = useState(appliedLook?.intensity ?? 80);

  const handleSelect = (opt: typeof LOOK_OPTIONS[0]) => {
    onApplyLook?.({
      id: opt.id,
      label: opt.label,
      category: '분위기',
      intensity,
    });
    onClose();
  };

  return (
    <div className="absolute top-full left-0 mt-1.5 z-50 w-[calc(100vw-2rem)] sm:w-[280px]">
      <div className="bg-[#111114] border border-zinc-700/60 rounded-2xl p-3 shadow-2xl">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <i className="ri-eye-line text-indigo-400 text-sm" />
            <span className="text-xs font-bold text-white">룩 스타일 선택</span>
          </div>
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 cursor-pointer transition-colors"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>

        {appliedLook && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-2.5">
            <i className="ri-check-line text-indigo-400 text-[10px]" />
            <span className="text-[11px] font-bold text-indigo-300 flex-1">{appliedLook.label} 적용 중</span>
            <span className="text-[9px] text-indigo-500/60">{appliedLook.intensity}%</span>
            <button
              onClick={() => { onClearLook?.(); onClose(); }}
              className="w-4 h-4 flex items-center justify-center rounded text-indigo-500/50 hover:text-red-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-[9px]" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {LOOK_OPTIONS.map((opt) => {
            const isActive = appliedLook?.id === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-indigo-500/40 bg-indigo-500/10'
                    : 'border-zinc-800/60 bg-zinc-900/60 hover:border-zinc-700/60 hover:bg-zinc-800/60'
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center ${isActive ? 'text-indigo-400' : opt.color}`}>
                  <i className={`${opt.icon} text-sm`} />
                </div>
                <span className={`text-[9px] font-bold leading-tight text-center ${isActive ? 'text-indigo-300' : 'text-zinc-400'}`}>
                  {opt.label}
                </span>
                {isActive && <div className="w-1 h-1 rounded-full bg-indigo-400" />}
              </button>
            );
          })}
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">강도</span>
            <span className="text-[10px] text-indigo-400 font-black">{intensity}%</span>
          </div>
          <RangeSlider
            value={intensity}
            min={0}
            max={100}
            onChange={setIntensity}
            gradient="from-indigo-500 to-violet-500"
            thumbColor="border-indigo-400"
            height="h-4"
            thumbSize="w-3 h-3"
          />
        </div>

        <p className="text-[9px] text-zinc-600 text-center">
          <i className="ri-information-line mr-0.5" />
          사이드바 LOOK 탭에서 더 많은 옵션을 확인하세요
        </p>
      </div>
    </div>
  );
}

// ── 캐릭터 외모 태그 칩 ────────────────────────────────────────────────────
function AppearanceTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-300 font-medium whitespace-nowrap">
      {label}
    </span>
  );
}

// ── REF 이미지 업로드 팝업 ─────────────────────────────────────────────────
function RefImagePopup({
  onSelect,
  onClose,
}: {
  onSelect: (url: string, name: string) => void;
  onClose: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPreview({ url, name: file.name });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleConfirm = () => {
    if (preview) {
      onSelect(preview.url, preview.name);
      onClose();
    }
  };

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div className="bg-[#111114] border border-zinc-700/60 rounded-2xl p-3 md:p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <i className="ri-image-add-line text-emerald-400 text-xs" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">REF 이미지 첨부</p>
              <p className="text-[10px] text-zinc-500 hidden sm:block">참조 이미지를 업로드하면 AI가 스타일을 반영합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>

        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 py-5 md:py-8 ${
              isDragOver
                ? 'border-emerald-500/60 bg-emerald-500/8'
                : 'border-zinc-700/50 bg-zinc-900/40 hover:border-zinc-600/60 hover:bg-zinc-900/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-colors ${
              isDragOver ? 'bg-emerald-500/20' : 'bg-zinc-800'
            }`}>
              <i className={`ri-upload-cloud-2-line text-xl md:text-2xl ${isDragOver ? 'text-emerald-400' : 'text-zinc-500'}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-zinc-300">
                {isDragOver ? '여기에 놓으세요!' : '이미지를 드래그하거나 클릭하세요'}
              </p>
              <p className="text-[11px] text-zinc-600 mt-0.5">PNG · JPG · WEBP · GIF 지원</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-zinc-700/50 relative group">
            <img src={preview.url} alt={preview.name} className="w-full h-32 md:h-40 object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={(e) => { e.stopPropagation(); setPreview(null); }}
                className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-delete-bin-line mr-1" />다시 선택
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-[11px] text-zinc-300 truncate">{preview.name}</p>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60">
          <i className="ri-lightbulb-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            참조 이미지의 <strong className="text-zinc-400">색감, 구도, 스타일</strong>을 AI가 학습해 생성에 반영합니다.
          </p>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!preview}
          className={`mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
            preview
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          <i className="ri-check-line" />
          {preview ? 'REF 이미지로 적용' : '이미지를 먼저 선택하세요'}
        </button>
      </div>
    </div>
  );
}

// ── 프롬프트 미리보기 패널 ─────────────────────────────────────────────────
function PromptPreviewPanel({
  character,
  userScene,
  finalPrompt,
  onClose,
}: {
  character: AppliedCharacter;
  userScene: string;
  finalPrompt: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(finalPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const appearanceTags = getCharacterAppearanceTags(character.id);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
      <div className="bg-[#111114] border border-zinc-700/60 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-indigo-500/40 flex-shrink-0">
              <img src={character.img} alt={character.name} className="w-full h-full object-cover object-top" />
            </div>
            <span className="text-xs font-bold text-white">{character.name}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              character.gender === '여자' ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'
            }`}>{character.gender}</span>
            <span className="text-[10px] text-zinc-500">외모 자동 반영 프롬프트</span>
          </div>
          <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer">
            <i className="ri-close-line text-xs" />
          </button>
        </div>

        {appearanceTags.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-zinc-500 mb-1.5 font-medium">
              <i className="ri-user-fill mr-1 text-violet-400/70" />외모 키워드 (자동 삽입)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {appearanceTags.map((tag, i) => <AppearanceTag key={i} label={tag} />)}
            </div>
          </div>
        )}

        <div className="space-y-2 mb-3">
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800/60 p-3">
            <p className="text-[10px] text-zinc-500 mb-1 font-medium flex items-center gap-1">
              <i className="ri-edit-2-line text-indigo-400" />내가 입력한 장면
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {userScene.trim() || <span className="text-zinc-600 italic">장면 묘사 없음 — 캐릭터 기본 포트레이트로 생성됩니다</span>}
            </p>
          </div>

          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <div className="h-px w-8 bg-zinc-800" />
              <i className="ri-sparkling-2-fill text-indigo-400 text-xs" />
              <span>AI가 캐릭터 외모 + 장면을 조합</span>
              <div className="h-px w-8 bg-zinc-800" />
            </div>
          </div>

          <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-3">
            <p className="text-[10px] text-indigo-400 mb-1.5 font-medium flex items-center gap-1">
              <i className="ri-sparkling-2-fill" />실제 생성에 사용될 최종 프롬프트
            </p>
            <p className="text-[11px] text-zinc-300 leading-relaxed line-clamp-4">{finalPrompt}</p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50'
          }`}
        >
          {copied ? <><i className="ri-check-line" />복사됨!</> : <><i className="ri-clipboard-line" />최종 프롬프트 복사</>}
        </button>
      </div>
    </div>
  );
}

// CreditToast 제거됨 — InsufficientCreditsModal로 대체

export default function PromptBar({
  onGenerate,
  appliedCharacter,
  characterApplyCounter = 0,
  appliedAngle,
  onClearAngle,
  appliedLook,
  onClearLook,
  onApplyLook,
  refImage,
  onClearRefImage,
  onSetRefImage,
  initialPrompt,
  initialType,
}: PromptBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('IMAGE');
  const [userScene, setUserScene] = useState('');

  // ── 홈에서 넘어온 프롬프트 자동 주입 ──────────────────────────────────
  useEffect(() => {
    if (initialPrompt) {
      setUserScene(initialPrompt);
      setIsOpen(true);
      if (initialType && tabs.includes(initialType)) {
        setActiveTab(initialType);
      }
    }
  }, [initialPrompt, initialType]);
  const [selectedModel, setSelectedModel] = useState('Flux Realism');
  const [selectedRatio, setSelectedRatio] = useState('1K · 16:9 · PNG');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showRatioDropdown, setShowRatioDropdown] = useState(false);
  const [showLookDropdown, setShowLookDropdown] = useState(false);
  const [mainRef, setMainRef] = useState<'MAIN' | 'REF'>('MAIN');
  const [showPreview, setShowPreview] = useState(false);
  const [showRefPopup, setShowRefPopup] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showComingSoonToast, setShowComingSoonToast] = useState(false);
  const prevCounterRef = useRef<number>(0);

  const { credits, deduct: _deduct, canAfford: _canAfford, maxCredits: _maxCredits, isLoggedIn } = useCredits();
  // [DEBUG] 크레딧 강제 우회: 크레딧 0이어도 항상 생성 가능하게 테스트
  const _debugCredits = Math.max(credits, 999);

  // 현재 선택된 모델 + 타입의 생성 비용
  const currentCost = useMemo(() => getCost(selectedModel, activeTab), [selectedModel, activeTab]);
  // 비로그인 게스트: 200 기준, 로그인: 실제 잔액 기준
  const displayMax = isLoggedIn ? Math.max(credits, 5000) : 200;
  const creditPercent = Math.round((credits / displayMax) * 100);

  // 크레딧 색상 — 잔여량에 따라 변화
  const creditColor = credits > 100 ? 'text-emerald-400' : credits > 20 ? 'text-amber-400' : 'text-red-400';
  const creditBg = credits > 100 ? 'bg-emerald-500/10 border-emerald-500/20' : credits > 20 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
  // [DEBUG] 크레딧 체크 완전 우회 - 항상 true로 강제
  const canGenerate = true;

  // 캐릭터 적용 시 프롬프트 바 자동 열기
  useEffect(() => {
    if (characterApplyCounter > 0 && characterApplyCounter !== prevCounterRef.current) {
      prevCounterRef.current = characterApplyCounter;
      setIsOpen(true);
      setShowPreview(true);
      setUserScene((prev) => prev.replace(/^\[Character:[^\]]*\][^,]*,\s*/i, '').trim());
    }
  }, [characterApplyCounter]);

  // refImage 외부 변경 시 REF 탭 자동 활성화
  useEffect(() => {
    if (refImage) {
      setMainRef('REF');
      setIsOpen(true);
    }
  }, [refImage]);

  // 최종 프롬프트 계산
  const finalPrompt = useMemo(() => {
    const charPrompt = appliedCharacter
      ? buildCharacterPrompt(appliedCharacter.id, appliedCharacter.name, appliedCharacter.gender, appliedCharacter.tags, userScene)
      : userScene.trim();

    const parts: string[] = [];
    if (charPrompt) parts.push(charPrompt);
    if (appliedAngle) parts.push(buildAnglePrompt(appliedAngle));
    if (appliedLook) parts.push(buildLookPrompt(appliedLook));
    if (refImage) parts.push('reference image style applied');
    if (parts.length === 0) parts.push('portrait photography, photorealistic, high quality, 8k');

    return parts.join(', ');
  }, [appliedCharacter, appliedAngle, appliedLook, userScene, refImage]);

  const appearanceTags = useMemo(
    () => (appliedCharacter ? getCharacterAppearanceTags(appliedCharacter.id) : []),
    [appliedCharacter],
  );

  const handleGenerate = () => {
    // AVATAR / MODIFY 탭은 아직 준비 중
    if (activeTab === 'AVATAR' || activeTab === 'MODIFY') {
      setShowComingSoonToast(true);
      setTimeout(() => setShowComingSoonToast(false), 3000);
      return;
    }
    // [DEBUG] 크레딧 체크 완전 제거 - Edge Function이 처리
    logDev('[PromptBar] handleGenerate 호출:', { model: selectedModel, type: activeTab, ratio: selectedRatio, promptLen: finalPrompt.length });
    if (onGenerate) onGenerate(finalPrompt || '상상하는 장면을 묘사해보세요...', selectedModel, activeTab, selectedRatio, currentCost);
    setShowPreview(false);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(finalPrompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1800);
    });
  };

  const handleRefTabClick = () => {
    setShowModelDropdown(false);
    setShowRatioDropdown(false);
    setShowLookDropdown(false);
    setShowPreview(false);
    if (mainRef === 'REF') {
      setShowRefPopup((v) => !v);
    } else {
      setMainRef('REF');
      setShowRefPopup(true);
    }
  };

  const handleMainTabClick = () => {
    setMainRef('MAIN');
    setShowRefPopup(false);
  };

  const handleRefImageSelect = (url: string, name: string) => {
    onSetRefImage?.(url, name);
    setShowRefPopup(false);
  };

  const placeholderText = appliedCharacter
    ? `${appliedCharacter.name} 캐릭터로 생성할 장면을 묘사해보세요...`
    : '상상하는 장면을 묘사해보세요... · @ 캐릭터 멘션';

  // ── 생성 버튼 텍스트 ──────────────────────────────────────────────────────
  const generateBtnLabel = (activeTab === 'AVATAR' || activeTab === 'MODIFY')
    ? '준비 중'
    : !canGenerate
    ? '크레딧 부족'
    : activeTab === 'VIDEO'
    ? `영상 생성 (${currentCost}CR)`
    : `생성 (${currentCost}CR)`;

  return (
    <div className="relative">
      {/* 준비 중 토스트 */}
      {showComingSoonToast && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 flex items-center gap-2 px-4 py-2.5 bg-zinc-800/95 border border-white/10 rounded-xl text-zinc-300 text-xs font-bold whitespace-nowrap shadow-xl backdrop-blur-sm">
          <i className="ri-time-line text-violet-400" />
          {activeTab === 'AVATAR' ? 'AVATAR' : 'MODIFY'} 기능은 곧 출시됩니다!
        </div>
      )}

      {/* 크레딧 부족 모달 */}
      <InsufficientCreditsModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        required={currentCost}
        current={credits}
        featureName={`AI ${activeTab} 생성`}
      />

      {/* Collapsed state */}
      {!isOpen && (
        <div className="bg-[#18181b]/90 border border-zinc-700/50 rounded-xl backdrop-blur-sm overflow-hidden">
          {/* 적용된 칩 행 — 캐릭터/앵글/룩/REF 중 하나라도 있을 때만 표시 */}
          {(appliedCharacter || appliedAngle || appliedLook || refImage) && (
            <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 flex-wrap">
              {appliedCharacter && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/12 border border-indigo-500/25 flex-shrink-0 group">
                  <div className="w-4 h-4 rounded-full overflow-hidden border border-indigo-500/40 flex-shrink-0">
                    <img src={appliedCharacter.img} alt={appliedCharacter.name} className="w-full h-full object-cover object-top" />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-300 whitespace-nowrap max-w-[60px] truncate">
                    {appliedCharacter.name}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); /* onClearCharacter 없으므로 패스 */ }}
                    className="w-3 h-3 flex items-center justify-center rounded-full text-indigo-500/40 hover:text-red-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <i className="ri-close-line text-[8px]" />
                  </button>
                </div>
              )}
              {appliedAngle && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/12 border border-amber-500/25 flex-shrink-0 group">
                  <i className="ri-camera-3-line text-amber-400 text-[9px]" />
                  <span className="text-[10px] font-bold text-amber-300 whitespace-nowrap max-w-[60px] truncate">
                    {appliedAngle.label}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onClearAngle?.(); }}
                    className="w-3 h-3 flex items-center justify-center rounded-full text-amber-500/40 hover:text-red-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <i className="ri-close-line text-[8px]" />
                  </button>
                </div>
              )}
              {appliedLook && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/12 border border-orange-500/25 flex-shrink-0 group">
                  <i className="ri-eye-line text-orange-400 text-[9px]" />
                  <span className="text-[10px] font-bold text-orange-300 whitespace-nowrap max-w-[60px] truncate">
                    {appliedLook.label}
                  </span>
                  <span className="text-[8px] text-orange-500/60 font-normal">{appliedLook.intensity}%</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onClearLook?.(); }}
                    className="w-3 h-3 flex items-center justify-center rounded-full text-orange-500/40 hover:text-red-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <i className="ri-close-line text-[8px]" />
                  </button>
                </div>
              )}
              {refImage && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/25 flex-shrink-0 group">
                  <div className="w-4 h-4 rounded overflow-hidden border border-emerald-500/40 flex-shrink-0">
                    <img src={refImage.url} alt="ref" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-300 whitespace-nowrap">REF</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onClearRefImage?.(); }}
                    className="w-3 h-3 flex items-center justify-center rounded-full text-emerald-500/40 hover:text-red-400 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <i className="ri-close-line text-[8px]" />
                  </button>
                </div>
              )}
              {/* 적용 개수 요약 뱃지 */}
              <span className="text-[9px] text-zinc-600 ml-auto flex-shrink-0">
                {[appliedCharacter, appliedAngle, appliedLook, refImage].filter(Boolean).length}개 적용
              </span>
            </div>
          )}

          {/* 입력 행 */}
          <div className="flex items-center gap-2 px-3 py-2">
            {!(appliedCharacter || appliedAngle || appliedLook || refImage) && (
              <i className="ri-sparkling-2-line text-indigo-400/70 text-sm flex-shrink-0" />
            )}
            <input
              type="text"
              value={userScene}
              onChange={(e) => setUserScene(e.target.value)}
              placeholder={appliedCharacter ? `${appliedCharacter.name}으로 생성할 장면...` : '장면을 묘사해보세요...'}
              className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 outline-none min-w-0"
              onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
            />
            {/* 크레딧 표시 */}
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${creditBg} ${creditColor}`}>
              <i className="ri-sparkling-2-line text-[9px]" />
              {credits} CR
            </div>
            <button
              onClick={() => setIsOpen(true)}
              className="w-7 h-7 flex items-center justify-center bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/30 rounded-lg transition-all cursor-pointer flex-shrink-0"
              title="옵션 열기"
            >
              <i className="ri-add-line text-indigo-400 text-sm" />
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`font-bold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 flex-shrink-0 ${
                canGenerate
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <i className="ri-sparkling-2-line text-xs" />
              <span className="hidden sm:inline">생성</span>
              <span className="sm:hidden">GO</span>
            </button>
          </div>
        </div>
      )}

      {/* Expanded state */}
      {isOpen && (
        <div className="bg-[#18181b]/90 border border-zinc-700/50 rounded-2xl p-3 backdrop-blur-sm relative">
          {showRefPopup && (
            <RefImagePopup
              onSelect={handleRefImageSelect}
              onClose={() => setShowRefPopup(false)}
            />
          )}

          {showPreview && appliedCharacter && !showRefPopup && (
            <PromptPreviewPanel
              character={appliedCharacter}
              userScene={userScene}
              finalPrompt={finalPrompt}
              onClose={() => setShowPreview(false)}
            />
          )}

          {/* Top bar — 모바일 가로 스크롤 */}
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto scrollbar-none pb-0.5">
            {/* Model selector */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowModelDropdown(!showModelDropdown); setShowRatioDropdown(false); }}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-sparkling-2-line text-indigo-400" />
                <span className="hidden sm:inline">{selectedModel}</span>
                <span className="sm:hidden text-[10px]">{selectedModel.replace('Flux ', '')}</span>
                {(() => {
                  const def = MODEL_DEFS.find((m) => m.id === selectedModel);
                  return def ? (
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full hidden sm:inline ${def.badgeColor}`}>
                      {def.badge}
                    </span>
                  ) : null;
                })()}
                <i className="ri-arrow-down-s-line text-zinc-400" />
              </button>
              {showModelDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-[#111114] border border-zinc-700/60 rounded-2xl overflow-hidden z-50 w-[calc(100vw-2rem)] sm:w-[280px] shadow-2xl">
                  <div className="px-3 pt-3 pb-1.5">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">AI 모델 선택</p>
                  </div>
                  {MODEL_DEFS.map((def) => {
                    const isSelected = selectedModel === def.id;
                    return (
                      <button
                        key={def.id}
                        onClick={() => { setSelectedModel(def.id); setShowModelDropdown(false); }}
                        className={`w-full text-left px-3 py-2.5 transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected ? 'bg-indigo-500/10' : 'hover:bg-zinc-800/60'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected ? 'bg-indigo-500/20' : 'bg-zinc-800'
                        }`}>
                          <i className={`ri-sparkling-2-line text-sm ${isSelected ? 'text-indigo-400' : 'text-zinc-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-xs font-bold ${isSelected ? 'text-indigo-300' : 'text-zinc-200'}`}>
                              {def.label}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${def.badgeColor}`}>
                              {def.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 truncate">{def.desc}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-zinc-600">
                              <i className="ri-time-line mr-0.5" />{def.time}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              def.cost === 1 ? 'bg-emerald-500/15 text-emerald-400' :
                              def.cost <= 3 ? 'bg-amber-500/15 text-amber-400' :
                              'bg-rose-500/15 text-rose-400'
                            }`}>
                              {def.cost}크레딧
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <i className="ri-check-line text-indigo-400 text-sm flex-shrink-0 mt-1" />
                        )}
                      </button>
                    );
                  })}
                  <div className="px-3 py-2 border-t border-white/5">
                    <p className="text-[9px] text-zinc-600 text-center">
                      <i className="ri-information-line mr-0.5" />
                      {activeTab === 'VIDEO' ? 'VIDEO 탭: Kling AI v1 영상 생성 (최대 5분 소요)' : '모든 모델은 fal.ai Flux 기반 실제 AI 생성'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Ratio selector */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowRatioDropdown(!showRatioDropdown); setShowModelDropdown(false); }}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-aspect-ratio-line text-zinc-400" />
                <span className="hidden sm:inline">{selectedRatio}</span>
                <span className="sm:hidden text-[10px]">{selectedRatio.split(' · ')[1]}</span>
                <i className="ri-arrow-down-s-line text-zinc-400" />
              </button>
              {showRatioDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-zinc-900 border border-zinc-700/60 rounded-xl overflow-hidden z-50 min-w-[160px]">
                  {ratios.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setSelectedRatio(r); setShowRatioDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap ${
                        selectedRatio === r ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Look quick selector */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => {
                  setShowLookDropdown((v) => !v);
                  setShowModelDropdown(false);
                  setShowRatioDropdown(false);
                  setShowRefPopup(false);
                  setShowPreview(false);
                }}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  appliedLook
                    ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-transparent'
                }`}
              >
                <i className={`ri-eye-line ${appliedLook ? 'text-indigo-400' : 'text-zinc-400'}`} />
                <span className="hidden sm:inline">{appliedLook ? appliedLook.label : 'Look'}</span>
                <span className="sm:hidden text-[10px]">Look</span>
                {appliedLook && <span className="text-[9px] text-indigo-500/70 hidden sm:inline">{appliedLook.intensity}%</span>}
                <i className="ri-arrow-down-s-line text-zinc-400" />
              </button>
              {showLookDropdown && (
                <LookQuickDropdown
                  appliedLook={appliedLook}
                  onApplyLook={onApplyLook}
                  onClearLook={onClearLook}
                  onClose={() => setShowLookDropdown(false)}
                />
              )}
            </div>

            {/* Tabs — 모바일 텍스트 축약 */}
            <div className="ml-auto flex items-center gap-0.5 bg-zinc-800/80 rounded-lg p-0.5 flex-shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-1.5 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none ${
                    activeTab === tab ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab}
                  {tab === 'VIDEO' && (
                    <span className="ml-1 text-[8px] text-amber-400/70 hidden sm:inline">×{TYPE_MULTIPLIERS.VIDEO}</span>
                  )}
                  {tab === 'AVATAR' && (
                    <span className="ml-1 text-[8px] text-violet-400/70 hidden sm:inline">×{TYPE_MULTIPLIERS.AVATAR}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Ref tabs */}
          <div className="flex items-center gap-2 mb-2 overflow-x-auto scrollbar-none">
            <button
              onClick={handleMainTabClick}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                mainRef === 'MAIN'
                  ? 'border-indigo-500/50 text-indigo-400 bg-indigo-500/10'
                  : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              MAIN
              <div className="w-4 h-4 flex items-center justify-center border border-zinc-700/50 rounded">
                <i className="ri-image-line text-[10px]" />
              </div>
            </button>

            <button
              onClick={handleRefTabClick}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
                mainRef === 'REF'
                  ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                  : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              REF
              {refImage ? (
                <div className="w-4 h-4 rounded overflow-hidden border border-emerald-500/40 flex-shrink-0">
                  <img src={refImage.url} alt="ref" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-4 h-4 flex items-center justify-center border border-zinc-700/50 rounded">
                  <i className="ri-image-add-line text-[10px]" />
                </div>
              )}
              {refImage && <i className="ri-check-line text-emerald-400 text-[9px]" />}
            </button>

            {refImage && mainRef === 'REF' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/8 border border-emerald-500/15 flex-shrink-0">
                <span className="text-[10px] text-emerald-400 font-medium truncate max-w-[80px] sm:max-w-[120px]">{refImage.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onClearRefImage?.(); setMainRef('MAIN'); }}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded text-emerald-500/50 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0"
                >
                  <i className="ri-close-line text-[9px]" />
                </button>
              </div>
            )}
          </div>

          {/* VIDEO 탭 안내 배너 */}
          {activeTab === 'VIDEO' && (
            <div className="flex items-center gap-2 mb-2 px-2.5 py-2 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <i className="ri-video-line text-amber-400 text-sm flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-amber-300">Kling AI 영상 생성</p>
                <p className="text-[9px] text-amber-500/70">fal.ai Kling v1 · 5초 영상 · 최대 5분 소요</p>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 whitespace-nowrap flex-shrink-0">
                {currentCost} CR
              </span>
            </div>
          )}

          {/* AVATAR 탭 준비 중 배너 */}
          {activeTab === 'AVATAR' && (
            <div className="flex items-center gap-2 mb-2 px-2.5 py-2 rounded-xl bg-violet-500/8 border border-violet-500/20">
              <i className="ri-user-3-line text-violet-400 text-sm flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-violet-300">AVATAR 기능 준비 중</p>
                <p className="text-[9px] text-violet-500/70">AI 아바타 생성 기능이 곧 출시됩니다</p>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 whitespace-nowrap flex-shrink-0">
                Coming Soon
              </span>
            </div>
          )}

          {/* MODIFY 탭 준비 중 배너 */}
          {activeTab === 'MODIFY' && (
            <div className="flex items-center gap-2 mb-2 px-2.5 py-2 rounded-xl bg-teal-500/8 border border-teal-500/20">
              <i className="ri-edit-2-line text-teal-400 text-sm flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-teal-300">MODIFY 기능 준비 중</p>
                <p className="text-[9px] text-teal-500/70">이미지 수정 기능이 곧 출시됩니다</p>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/25 whitespace-nowrap flex-shrink-0">
                Coming Soon
              </span>
            </div>
          )}

          {/* Textarea area */}
          <div className="relative">
            {(appliedCharacter || appliedAngle || appliedLook) && (
              <div className="mb-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {appliedCharacter && appearanceTags.length > 0 && (
                    <>
                      <span className="text-[10px] text-zinc-600 flex items-center gap-1 flex-shrink-0">
                        <i className="ri-magic-line text-violet-400/70" />외모:
                      </span>
                      {appearanceTags.slice(0, 3).map((tag, i) => <AppearanceTag key={i} label={tag} />)}
                    </>
                  )}
                  {appliedAngle && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-medium whitespace-nowrap">
                      <i className="ri-camera-3-line text-[9px]" />{appliedAngle.label}
                    </span>
                  )}
                  {appliedLook && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-300 font-medium whitespace-nowrap">
                      <i className="ri-palette-line text-[9px]" />{appliedLook.label}
                    </span>
                  )}
                  {appliedCharacter && (
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ml-auto ${
                        showPreview
                          ? 'border-violet-500/40 text-violet-400 bg-violet-500/10'
                          : 'border-white/10 text-zinc-600 hover:text-violet-400 hover:border-violet-500/30'
                      }`}
                    >
                      <i className="ri-eye-line text-[9px]" />
                      미리보기
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-2">
              <i className="ri-sparkling-2-line text-indigo-400/60 mt-1.5 text-sm flex-shrink-0" />
              <textarea
                value={userScene}
                onChange={(e) => setUserScene(e.target.value)}
                placeholder={placeholderText}
                className="flex-1 bg-transparent text-sm text-zinc-300 placeholder-zinc-600 resize-none outline-none min-h-[44px] leading-relaxed"
                rows={2}
              />
              <button
                onClick={handleCopyPrompt}
                className={`w-5 h-5 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 mt-1 ${
                  promptCopied ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-400'
                }`}
                title="최종 프롬프트 복사"
              >
                <i className={`text-xs ${promptCopied ? 'ri-check-line' : 'ri-clipboard-line'}`} />
              </button>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-zinc-800/60 gap-2">
              <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                {/* 크레딧 게이지 */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold flex-shrink-0 ${creditBg} ${creditColor}`}>
                  <i className="ri-sparkling-2-line text-[9px]" />
                  <span>{credits}</span>
                  <span className="text-zinc-600 font-normal hidden sm:inline">CR</span>
                  {/* 미니 게이지 바 — 로그인 시 숨김 (잔액 무제한 아님) */}
                  {!isLoggedIn && (
                    <div className="w-8 sm:w-12 h-1 rounded-full bg-zinc-800 overflow-hidden ml-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          credits > 100 ? 'bg-emerald-500' : credits > 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${creditPercent}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 이번 생성 비용 */}
                <div className="flex items-center gap-1 text-[10px] text-zinc-600 flex-shrink-0">
                  <i className="ri-arrow-right-s-line" />
                  <span className={canGenerate ? 'text-zinc-500' : 'text-red-400 font-bold'}>
                    {currentCost}크
                  </span>
                </div>

                {(appliedCharacter || appliedAngle || appliedLook || refImage) && (
                  <span className="text-[10px] text-emerald-400/70 flex items-center gap-1 hidden md:flex flex-shrink-0">
                    <i className="ri-check-double-line" />
                    {[
                      appliedCharacter && '캐릭터',
                      appliedAngle && '앵글',
                      appliedLook && '룩',
                      refImage && 'REF',
                    ].filter(Boolean).join(' · ')} 반영됨
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 rounded-lg transition-all cursor-pointer"
                  title="접기"
                >
                  <i className="ri-subtract-line text-zinc-400 text-sm" />
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`font-bold text-xs sm:text-sm px-3 sm:px-4 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    canGenerate
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <i className={`${canGenerate ? 'ri-sparkling-2-line' : 'ri-error-warning-line'}`} />
                  <span className="hidden sm:inline">{generateBtnLabel}</span>
                  <span className="sm:hidden">{!canGenerate ? '부족' : '생성'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
