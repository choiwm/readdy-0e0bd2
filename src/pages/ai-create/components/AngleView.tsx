import { useState, useRef, useCallback, useEffect } from 'react';
import type { AppliedAngle } from '@/utils/characterPrompt';
import { ANGLE_PRESETS } from '@/pages/ai-create/data/presets';
import RangeSlider from './RangeSlider';
import GenerationProgress from './GenerationProgress';
import type { ProgressStep } from './GenerationProgress';
import type { GalleryItem } from '@/mocks/galleryItems';
import { supabase } from '@/lib/supabase';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────────────────
type GenerationStep = 'idle' | 'analyzing' | 'transforming' | 'rendering' | 'done';

interface GeneratedResult {
  id: string;
  pan: number;
  tilt: number;
  zoom: number;
  presetLabel: string | null;
  img: string;
  sourceImg: string | null;
  generatedAt: string;
}

// ── Angle Generation Progress steps ───────────────────────────────────────
const ANGLE_PROGRESS_STEPS: ProgressStep[] = [
  { id: 'analyzing',    label: '이미지 분석', icon: 'ri-scan-2-line' },
  { id: 'transforming', label: '각도 변환',   icon: 'ri-refresh-line' },
  { id: 'rendering',    label: '렌더링',      icon: 'ri-image-edit-line' },
  { id: 'done',         label: '완료',        icon: 'ri-checkbox-circle-line' },
];

// ── 3D Sphere Canvas ───────────────────────────────────────────────────────
interface SphereProps {
  pan: number;
  tilt: number;
  zoom: number;
  onDrag: (dx: number, dy: number) => void;
  onZoom: (delta: number) => void;
}

function GlobeSphere({ pan, tilt, zoom, onDrag, onZoom }: SphereProps) {
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const W = 480;
  const H = 480;
  const cx = W / 2;
  const cy = H / 2;

  const baseR = 160;
  const scale = 1 + zoom * 0.005;
  const rx = baseR * scale;
  const ry = baseR * scale;

  const panRad  = (pan  * Math.PI) / 180;
  const tiltRad = (tilt * Math.PI) / 180;

  const dotX = cx + rx * Math.sin(panRad) * Math.cos(tiltRad);
  const dotY = cy - ry * Math.sin(tiltRad);

  const camOffX = cx + (rx - 28) * Math.sin(panRad) * Math.cos(tiltRad);
  const camOffY = cy - (ry - 28) * Math.sin(tiltRad);

  const eqRx = rx;
  const eqRy = ry * 0.28;

  const merRx = rx * Math.abs(Math.cos(panRad)) + rx * 0.08;
  const merRy = ry;

  const latR = rx * Math.cos(tiltRad);
  const latCy = cy - ry * Math.sin(tiltRad);

  const cross = 10;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    onZoom(-e.deltaY * 0.1);
  }, [onZoom]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      onDrag(dx * 0.6, -dy * 0.6);
    };
    const onUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onDrag]);

  return (
    <div className="relative flex items-center justify-center select-none">
      <svg
        width={W}
        height={H}
        className="cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      >
        <circle cx={cx} cy={cy} r={rx} fill="none" stroke="#2a2a2e" strokeWidth="1.2" />
        <ellipse cx={cx} cy={cy} rx={eqRx} ry={eqRy} fill="none" stroke="#2a2a2e" strokeWidth="1" strokeDasharray="4 4" />
        <ellipse cx={cx} cy={cy} rx={merRx * 0.18} ry={merRy} fill="none" stroke="#2a2a2e" strokeWidth="1" strokeDasharray="4 4" />
        {Math.abs(tilt) > 5 && (
          <ellipse cx={cx} cy={latCy} rx={latR} ry={latR * 0.28} fill="none" stroke="#3a3a42" strokeWidth="0.8" strokeDasharray="3 5" />
        )}
        <ellipse cx={cx} cy={cy - ry * 0.5} rx={rx * 0.87} ry={ry * 0.87 * 0.28} fill="none" stroke="#222226" strokeWidth="0.8" strokeDasharray="3 6" />
        <ellipse cx={cx} cy={cy + ry * 0.5} rx={rx * 0.87} ry={ry * 0.87 * 0.28} fill="none" stroke="#222226" strokeWidth="0.8" strokeDasharray="3 6" />
        <line x1={cx - cross} y1={cy} x2={cx + cross} y2={cy} stroke="#3f3f46" strokeWidth="0.8" />
        <line x1={cx} y1={cy - cross} x2={cx} y2={cy + cross} stroke="#3f3f46" strokeWidth="0.8" />
        <circle cx={cx} cy={cy} r={2.5} fill="#3f3f46" />
        <line x1={cx} y1={cy - ry - 8} x2={cx} y2={cy - ry - 2} stroke="#3f3f46" strokeWidth="1" />
        <line x1={cx} y1={cy + ry + 2} x2={cx} y2={cy + ry + 8} stroke="#3f3f46" strokeWidth="1" />
        <line x1={cx - rx - 8} y1={cy} x2={cx - rx - 2} y2={cy} stroke="#3f3f46" strokeWidth="1" />
        <line x1={cx + rx + 2} y1={cy} x2={cx + rx + 8} y2={cy} stroke="#3f3f46" strokeWidth="1" />
        <line x1={cx} y1={cy} x2={dotX} y2={dotY} stroke="#6366f1" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
        <circle cx={dotX} cy={dotY} r={14} fill="#7c3aed" opacity="0.15" />
        <circle cx={dotX} cy={dotY} r={7}  fill="#8b5cf6" opacity="0.5" />
        <circle cx={dotX} cy={dotY} r={4}  fill="#a78bfa" />
        <g transform={`translate(${camOffX - 16}, ${camOffY - 12})`}>
          <rect x="2" y="6" width="28" height="18" rx="3" fill="#18181b" stroke="#d4d4d8" strokeWidth="1.4" />
          <circle cx="16" cy="15" r="6" fill="#18181b" stroke="#d4d4d8" strokeWidth="1.4" />
          <circle cx="16" cy="15" r="3.5" fill="#27272a" />
          <circle cx="16" cy="15" r="1.5" fill="#3f3f46" />
          <rect x="10" y="2" width="12" height="5" rx="1.5" fill="#18181b" stroke="#d4d4d8" strokeWidth="1.2" />
          <circle cx="26" cy="9" r="2" fill="#8b5cf6" />
        </g>
      </svg>
      <p className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-[#4a9a6a] tracking-wide pointer-events-none">
        Drag to orbit · Scroll to zoom
      </p>
    </div>
  );
}

// ── Main AngleView ─────────────────────────────────────────────────────────
interface AngleViewProps {
  onApplyAngle?: (angle: AppliedAngle) => void;
  appliedAngle?: AppliedAngle | null;
  sharedDraft?: { pan: number; tilt: number; zoom: number } | null;
  onDraftChange?: (draft: { pan: number; tilt: number; zoom: number }) => void;
  onSaveToGallery?: (item: Omit<GalleryItem, 'id' | 'createdAt'>) => Promise<GalleryItem | null>;
}

const ANGLE_CREDIT_COST = 1;

export default function AngleView({ onApplyAngle, appliedAngle, sharedDraft, onDraftChange, onSaveToGallery }: AngleViewProps) {
  const { deduct, refund, credits, canAfford } = useCredits();
  const { profile } = useAuth();

  const [pan,  setPan]  = useState(sharedDraft?.pan  ?? 0);
  const [tilt, setTilt] = useState(sharedDraft?.tilt ?? 0);
  const [zoom, setZoom] = useState(sharedDraft?.zoom ?? 0);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [genStep, setGenStep] = useState<GenerationStep>('idle');
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [modalResult, setModalResult] = useState<GeneratedResult | null>(null);
  const [applyToast, setApplyToast] = useState(false);
  const [preserveSource, setPreserveSource] = useState(true);
  const [saveToast, setSaveToast] = useState<{ type: 'both' | 'result' | 'error' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalCopied, setModalCopied] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── sharedDraft 외부 변경 동기화 ──────────────────────────────────────
  useEffect(() => {
    if (!sharedDraft) return;
    setPan(sharedDraft.pan);
    setTilt(sharedDraft.tilt);
    setZoom(sharedDraft.zoom);
    const matched = ANGLE_PRESETS.find(
      (p) => p.pan === sharedDraft.pan && p.tilt === sharedDraft.tilt,
    );
    setActivePreset(matched?.id ?? null);
  }, [sharedDraft]);

  const showSaveToast = useCallback((type: 'both' | 'result' | 'error') => {
    setSaveToast({ type });
    setTimeout(() => setSaveToast(null), 2800);
  }, []);

  const handleApplyToGenerate = useCallback(() => {
    if (!onApplyAngle) return;
    const presetLabel = activePreset
      ? ANGLE_PRESETS.find((p) => p.id === activePreset)?.label ?? null
      : null;
    const angle: AppliedAngle = {
      presetId: activePreset,
      label: presetLabel ?? `PAN ${Math.round(pan)}° TILT ${Math.round(tilt)}°`,
      pan: Math.round(pan),
      tilt: Math.round(tilt),
      zoom: Math.round(zoom),
    };
    onApplyAngle(angle);
    setApplyToast(true);
    setTimeout(() => setApplyToast(false), 2200);
  }, [onApplyAngle, activePreset, pan, tilt, zoom]);

  const handleDrag = useCallback((dx: number, dy: number) => {
    setPan((p) => {
      const next = Math.max(-180, Math.min(180, p + dx));
      onDraftChange?.({ pan: next, tilt, zoom });
      return next;
    });
    setTilt((t) => {
      const next = Math.max(-90, Math.min(90, t + dy));
      onDraftChange?.({ pan, tilt: next, zoom });
      return next;
    });
    setActivePreset(null);
  }, [onDraftChange, pan, tilt, zoom]);

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const next = Math.max(-50, Math.min(50, z + delta));
      onDraftChange?.({ pan, tilt, zoom: next });
      return next;
    });
  }, [onDraftChange, pan, tilt]);

  const applyPreset = (preset: typeof ANGLE_PRESETS[0]) => {
    setPan(preset.pan);
    setTilt(preset.tilt);
    setActivePreset(preset.id);
    onDraftChange?.({ pan: preset.pan, tilt: preset.tilt, zoom });
  };

  const resetAll = () => {
    setPan(0); setTilt(0); setZoom(0); setActivePreset(null);
    onDraftChange?.({ pan: 0, tilt: 0, zoom: 0 });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceImage(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  // ── 앵글 프롬프트 빌드 ────────────────────────────────────────────────
  const buildAnglePrompt = useCallback((): string => {
    const presetLabel = activePreset
      ? ANGLE_PRESETS.find((p) => p.id === activePreset)?.label ?? null
      : null;

    const panDeg = Math.round(pan);
    const tiltDeg = Math.round(tilt);
    const zoomVal = Math.round(zoom);

    let angleDesc = '';
    if (presetLabel) {
      const presetPromptMap: Record<string, string> = {
        front:   'front-facing view, direct eye contact, symmetrical composition',
        back:    'rear view, shot from behind, over-the-shoulder perspective',
        left45:  'three-quarter left angle, 45-degree left side view',
        right45: 'three-quarter right angle, 45-degree right side view',
        leftup:  'upper-left elevated angle, 45-degree left high angle shot',
        rightup: 'upper-right elevated angle, 45-degree right high angle shot',
        top:     "bird's eye view, top-down overhead shot, aerial perspective",
        bottom:  "low angle shot, worm's eye view, looking up from below",
      };
      angleDesc = presetPromptMap[activePreset ?? ''] ?? presetLabel;
    } else {
      if (Math.abs(panDeg) < 15) angleDesc = 'front-facing view';
      else if (panDeg > 150 || panDeg < -150) angleDesc = 'rear view, back-facing angle';
      else if (panDeg > 0) angleDesc = `${panDeg}-degree right side angle`;
      else angleDesc = `${Math.abs(panDeg)}-degree left side angle`;

      if (tiltDeg > 60) angleDesc += ", bird's eye view, top-down perspective";
      else if (tiltDeg > 20) angleDesc += ', elevated high angle shot, looking down';
      else if (tiltDeg < -60) angleDesc += ", worm's eye view, extreme low angle";
      else if (tiltDeg < -20) angleDesc += ', low angle shot, looking up';
    }

    const zoomDesc = zoomVal > 20 ? ', close-up zoom, telephoto lens' : zoomVal < -20 ? ', wide angle lens, zoomed out' : '';

    return `professional portrait photography, Korean person, ${angleDesc}${zoomDesc}, studio lighting, clean neutral background, high resolution, photorealistic, 8k quality`;
  }, [pan, tilt, zoom, activePreset]);

  // ── 실제 fal.ai 생성 ──────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (genStep !== 'idle' && genStep !== 'done') return;
    setGenError(null);

    // 크레딧 확인
    if (!canAfford(ANGLE_CREDIT_COST)) {
      setGenError(`크레딧이 부족합니다. 필요: ${ANGLE_CREDIT_COST} CR, 보유: ${credits} CR`);
      return;
    }

    // 크레딧 선차감
    const deducted = deduct(ANGLE_CREDIT_COST);
    if (!deducted) {
      setGenError('크레딧 차감에 실패했습니다.');
      return;
    }

    setGenStep('analyzing');

    const prompt = buildAnglePrompt();
    const presetLabel = activePreset
      ? ANGLE_PRESETS.find((p) => p.id === activePreset)?.label ?? null
      : null;

    try {
      // analyzing → transforming 단계 표시
      await new Promise((r) => setTimeout(r, 800));
      setGenStep('transforming');

      const sessionId = localStorage.getItem('ai_platform_session_id') ?? undefined;

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt,
          model: 'Flux Realism',
          ratio: '1:1',
          aspectRatio: '1:1',
          user_id: profile?.id ?? undefined,
          session_id: profile?.id ? undefined : sessionId,
        },
      });

      setGenStep('rendering');
      await new Promise((r) => setTimeout(r, 400));

      if (error || !data?.imageUrl) {
        throw new Error(data?.error ?? error?.message ?? '이미지 생성에 실패했습니다.');
      }

      setGenStep('done');

      const newResult: GeneratedResult = {
        id: `res_${Date.now()}`,
        pan: Math.round(pan),
        tilt: Math.round(tilt),
        zoom: Math.round(zoom),
        presetLabel,
        img: data.imageUrl,
        sourceImg: sourceImage,
        generatedAt: new Date().toISOString(),
      };
      setResults((prev) => [newResult, ...prev]);
      setSelectedResultId(newResult.id);
      setModalResult(newResult);

      // 갤러리에 저장
      if (onSaveToGallery) {
        try {
          const angleLabel = presetLabel ?? `PAN ${Math.round(pan)}° TILT ${Math.round(tilt)}°`;
          await onSaveToGallery({
            type: 'image',
            url: newResult.img,
            prompt: `ANGLE: ${angleLabel}${Math.round(zoom) !== 0 ? ` ZOOM ${Math.round(zoom)}` : ''}`,
            model: 'Angle AI',
            ratio: '1:1',
            liked: false,
          });
          if (preserveSource && sourceImage) {
            await onSaveToGallery({
              type: 'image',
              url: sourceImage,
              prompt: `[원본] ANGLE 소스 이미지 — ${angleLabel} 적용 전`,
              model: 'Angle AI · 원본',
              ratio: '1:1',
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
      refund(ANGLE_CREDIT_COST);
    }
  }, [genStep, canAfford, deduct, refund, credits, buildAnglePrompt, activePreset, pan, tilt, zoom, sourceImage, preserveSource, onSaveToGallery, showSaveToast, profile]);

  // fetch → blob → objectURL 방식으로 실제 다운로드
  const handleDownload = useCallback(async (result: GeneratedResult) => {
    try {
      const response = await fetch(result.img);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `angle_pan${result.pan}_tilt${result.tilt}_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(result.img, '_blank');
    }
  }, []);

  const handleCopy = useCallback((imgUrl: string, resultId: string) => {
    navigator.clipboard.writeText(imgUrl).then(() => {
      setCopiedId(resultId);
      setTimeout(() => setCopiedId(null), 1800);
    });
  }, []);

  const handleModalCopy = useCallback((imgUrl: string) => {
    navigator.clipboard.writeText(imgUrl).then(() => {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 1800);
    });
  }, []);

  const isGenerating = genStep !== 'idle' && genStep !== 'done';

  const isCurrentlyApplied = appliedAngle !== null && appliedAngle !== undefined
    && appliedAngle.pan === Math.round(pan)
    && appliedAngle.tilt === Math.round(tilt)
    && appliedAngle.zoom === Math.round(zoom);

  const gridCols = results.length === 1 ? 'grid-cols-1 max-w-[200px]' : results.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="flex h-full overflow-hidden bg-[#0a0a0b]">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* Apply toast */}
      {applyToast && (
        <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-sm whitespace-nowrap">
          <i className="ri-check-double-line" />
          앵글이 생성 탭에 적용되었습니다
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

      {/* ── Center: Globe + Results ── */}
      <div className="flex-1 flex flex-col items-center justify-start relative overflow-y-auto">
        <div className="w-full flex flex-col items-center pt-3 md:pt-4 pb-6 px-3 md:px-6">
          <div className="self-start flex items-center justify-between w-full mb-3 md:mb-4">
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-zinc-300 tracking-wide">카메라 앵글</p>
              {appliedAngle && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                  <i className="ri-check-line text-emerald-400 text-[10px]" />
                  <span className="text-[10px] font-bold text-emerald-400">
                    {appliedAngle.label} 적용 중
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowMobileControls(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-bold cursor-pointer"
            >
              <i className="ri-settings-3-line text-sm" />
              설정
            </button>
          </div>

          {/* Globe container */}
          <div
            className="relative rounded-2xl overflow-hidden flex items-center justify-center w-full"
            style={{
              maxWidth: 480,
              aspectRatio: '1 / 1',
              background: 'radial-gradient(ellipse at center, #111116 0%, #0a0a0b 70%)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <GlobeSphere pan={pan} tilt={tilt} zoom={zoom} onDrag={handleDrag} onZoom={handleZoom} />
            </div>
          </div>

          {/* Angle readout badges */}
          <div className="flex items-center gap-2 md:gap-3 mt-3 md:mt-4">
            {[
              { label: 'PAN',  value: Math.round(pan),  unit: '°' },
              { label: 'TILT', value: Math.round(tilt), unit: '°' },
              { label: 'ZOOM', value: Math.round(zoom), unit: '' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center px-3 md:px-5 py-1.5 md:py-2 rounded-xl bg-zinc-900/80 border border-white/5">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">{item.label}</span>
                <span className="text-sm md:text-base font-black text-white mt-0.5">{item.value}{item.unit}</span>
              </div>
            ))}
            <button
              onClick={resetAll}
              className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-zinc-900/80 border border-white/5 text-zinc-400 hover:text-white hover:border-zinc-600 transition-all cursor-pointer text-xs font-bold whitespace-nowrap"
            >
              <i className="ri-refresh-line mr-1" />초기화
            </button>
          </div>

          {/* Apply to Generate tab button */}
          {onApplyAngle && (
            <button
              onClick={handleApplyToGenerate}
              className={`mt-3 md:mt-4 flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                isCurrentlyApplied
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:border-indigo-500/50'
              }`}
            >
              {isCurrentlyApplied ? (
                <>
                  <i className="ri-check-double-line text-sm" />
                  생성 탭에 적용됨
                </>
              ) : (
                <>
                  <i className="ri-send-plane-fill text-sm" />
                  생성 탭에 적용
                  <span className="text-[10px] opacity-60 ml-0.5 hidden sm:inline">
                    {activePreset
                      ? ANGLE_PRESETS.find((p) => p.id === activePreset)?.label
                      : `PAN ${Math.round(pan)}° TILT ${Math.round(tilt)}°`}
                  </span>
                </>
              )}
            </button>
          )}

          {/* Error message */}
          {genError && (
            <div className="w-full max-w-sm mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25">
              <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{genError}</p>
            </div>
          )}

          {/* Generation progress */}
          {isGenerating && (
            <div className="w-full max-w-sm mt-4 md:mt-6 p-4 rounded-2xl bg-zinc-900/60 border border-white/5">
              <p className="text-xs font-bold text-white mb-4 flex items-center gap-2">
                <i className="ri-loader-4-line animate-spin text-indigo-400" />
                fal.ai로 앵글 변환 생성 중...
              </p>
              <GenerationProgress
                steps={ANGLE_PROGRESS_STEPS}
                currentStep={genStep}
                activeColor="bg-indigo-500/20 text-indigo-400"
                activeBarColor="bg-indigo-500"
              />
            </div>
          )}

          {/* Results grid */}
          {results.length > 0 && (
            <div className="w-full mt-4 md:mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-zinc-300">
                  생성 결과 <span className="text-zinc-500 font-normal">({results.length}개)</span>
                </p>
                <button
                  onClick={() => {
                    setGenStep('idle');
                    setResults([]);
                    setSelectedResultId(null);
                    setModalResult(null);
                  }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors whitespace-nowrap"
                >
                  결과 초기화
                </button>
              </div>
              <div className={`grid gap-2 md:gap-3 ${gridCols}`}>
                {results.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => { setSelectedResultId(result.id); setModalResult(result); }}
                    className={`relative group cursor-pointer rounded-xl overflow-hidden border transition-all ${
                      selectedResultId === result.id
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                        : 'border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="w-full aspect-square bg-zinc-900">
                      <img src={result.img} alt="result" className="w-full h-full object-cover object-top" />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(result); }}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-all"
                        title="다운로드"
                      >
                        <i className="ri-download-2-line text-sm" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(result.img, result.id); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white cursor-pointer transition-all ${
                          copiedId === result.id ? 'bg-emerald-500/50' : 'bg-white/20 hover:bg-white/30'
                        }`}
                        title="링크 복사"
                      >
                        <i className={`text-sm ${copiedId === result.id ? 'ri-check-line' : 'ri-share-line'}`} />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-[9px] text-zinc-300 font-bold">
                        {result.presetLabel ?? `PAN ${result.pan}° TILT ${result.tilt}°`}
                        {result.zoom !== 0 && ` · ZOOM ${result.zoom}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Controls ── */}
      <div className="hidden md:flex w-[220px] flex-shrink-0 border-l border-white/5 flex-col overflow-y-auto bg-[#0d0d0f]">

        {/* Sliders */}
        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">앵글 조정</p>
          <div className="flex flex-col gap-4">
            {[
              {
                label: 'Pan',
                value: pan,
                min: -180, max: 180,
                onChange: (v: number) => { setPan(v); setActivePreset(null); onDraftChange?.({ pan: v, tilt, zoom }); },
              },
              {
                label: 'Tilt',
                value: tilt,
                min: -90, max: 90,
                onChange: (v: number) => { setTilt(v); setActivePreset(null); onDraftChange?.({ pan, tilt: v, zoom }); },
              },
              {
                label: 'Zoom',
                value: zoom,
                min: -50, max: 50,
                onChange: (v: number) => { setZoom(v); onDraftChange?.({ pan, tilt, zoom: v }); },
              },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-300 font-semibold">{s.label}</span>
                  <span className="text-xs text-indigo-400 font-black tabular-nums w-10 text-right">
                    {Math.round(s.value)}{s.label !== 'Zoom' ? '°' : ''}
                  </span>
                </div>
                <RangeSlider
                  value={s.value}
                  min={s.min}
                  max={s.max}
                  onChange={s.onChange}
                  gradient="from-indigo-500 to-violet-500"
                  thumbColor="border-indigo-400"
                  height="h-5"
                  thumbSize="w-4 h-4"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">앵글 프리셋</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ANGLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap border ${
                  activePreset === preset.id
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Source image upload */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">소스 이미지</p>
            {sourceImage ? (
              <button
                onClick={() => setPreserveSource((v) => !v)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold transition-all cursor-pointer border ${
                  preserveSource
                    ? 'bg-teal-500/15 border-teal-500/30 text-teal-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <i className={`text-[10px] ${preserveSource ? 'ri-archive-2-fill' : 'ri-archive-2-line'}`} />
                원본 보존 {preserveSource ? 'ON' : 'OFF'}
              </button>
            ) : (
              <span className="text-[9px] text-zinc-500 font-bold bg-zinc-800 px-1.5 py-0.5 rounded-full">선택사항</span>
            )}
          </div>
          {sourceImage ? (
            <div className="relative group rounded-xl overflow-hidden border border-white/10">
              <div className="w-full aspect-square">
                <img src={sourceImage} alt="source" className="w-full h-full object-cover object-top" />
              </div>
              {preserveSource && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 backdrop-blur-sm">
                  <i className="ri-archive-2-fill text-teal-400 text-[8px]" />
                  <span className="text-[8px] font-bold text-teal-400">원본 보존</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer transition-all"
                >
                  <i className="ri-refresh-line text-xs" />
                </button>
                <button
                  onClick={() => setSourceImage(null)}
                  className="w-7 h-7 rounded-full bg-red-500/30 hover:bg-red-500/50 flex items-center justify-center text-red-400 cursor-pointer transition-all"
                >
                  <i className="ri-delete-bin-line text-xs" />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                  <i className="ri-check-line" />소스 이미지 준비됨
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 px-3 py-4 rounded-xl border border-dashed border-zinc-700 hover:border-indigo-500/50 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <i className="ri-image-add-line text-xl" />
              </div>
              <span className="text-xs font-medium">이미지 업로드</span>
              <span className="text-[10px] text-zinc-600">PNG · JPG · WEBP</span>
            </button>
          )}
        </div>

        {/* Generate button */}
        <div className="p-4 mt-auto">
          {/* 크레딧 표시 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-600">보유 크레딧</span>
            <span className="text-[10px] font-bold text-indigo-400">{credits} CR</span>
          </div>
          {genStep === 'done' && results.length > 0 && (
            <button
              onClick={() => handleDownload(results[0])}
              className="w-full py-2.5 mb-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="ri-download-2-line text-sm" />
              최신 결과 다운로드
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !canAfford(ANGLE_CREDIT_COST)}
            className={`w-full py-3 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              isGenerating || !canAfford(ANGLE_CREDIT_COST)
                ? 'bg-zinc-700 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 cursor-pointer'
            }`}
          >
            {isGenerating ? (
              <>
                <i className="ri-loader-4-line animate-spin text-sm" />
                생성 중...
              </>
            ) : (
              <>
                <i className="ri-sparkling-2-fill text-sm" />
                앵글 생성
                <span className="flex items-center gap-0.5 bg-white/15 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                  <i className="ri-copper-diamond-line text-[10px]" /> {ANGLE_CREDIT_COST}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 모바일 컨트롤 하단 시트 ── */}
      {showMobileControls && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setShowMobileControls(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative z-10 w-full bg-[#111114] border-t border-white/10 rounded-t-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '75vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
              <span className="text-xs font-bold text-white">앵글 설정</span>
              <button onClick={() => setShowMobileControls(false)} className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-white cursor-pointer"><i className="ri-close-line text-sm" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">앵글 조정</p>
                <div className="flex flex-col gap-4">
                  {[
                    { label: 'Pan', value: pan, min: -180, max: 180, onChange: (v: number) => { setPan(v); setActivePreset(null); onDraftChange?.({ pan: v, tilt, zoom }); } },
                    { label: 'Tilt', value: tilt, min: -90, max: 90, onChange: (v: number) => { setTilt(v); setActivePreset(null); onDraftChange?.({ pan, tilt: v, zoom }); } },
                    { label: 'Zoom', value: zoom, min: -50, max: 50, onChange: (v: number) => { setZoom(v); onDraftChange?.({ pan, tilt, zoom: v }); } },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-300 font-semibold">{s.label}</span>
                        <span className="text-xs text-indigo-400 font-black tabular-nums">{Math.round(s.value)}{s.label !== 'Zoom' ? '°' : ''}</span>
                      </div>
                      <RangeSlider value={s.value} min={s.min} max={s.max} onChange={s.onChange} gradient="from-indigo-500 to-violet-500" thumbColor="border-indigo-400" height="h-5" thumbSize="w-4 h-4" />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">앵글 프리셋</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ANGLE_PRESETS.map((preset) => (
                    <button key={preset.id} onClick={() => applyPreset(preset)} className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap border ${activePreset === preset.id ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">소스 이미지 <span className="text-zinc-600 font-normal normal-case">(선택사항)</span></p>
                {sourceImage ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"><img src={sourceImage} alt="source" className="w-full h-full object-cover object-top" /></div>
                    <div className="flex-1 min-w-0"><p className="text-xs text-emerald-400 font-bold">소스 이미지 준비됨</p></div>
                    <button onClick={() => setSourceImage(null)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center cursor-pointer flex-shrink-0"><i className="ri-delete-bin-line text-xs" /></button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 text-xs cursor-pointer">
                    <i className="ri-image-add-line" />이미지 업로드 (PNG · JPG · WEBP)
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-white/5 flex-shrink-0 flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canAfford(ANGLE_CREDIT_COST)}
                className={`flex-1 py-3 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${isGenerating || !canAfford(ANGLE_CREDIT_COST) ? 'bg-zinc-700 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-indigo-500 to-violet-500 cursor-pointer'}`}
              >
                {isGenerating ? <><i className="ri-loader-4-line animate-spin text-sm" />생성 중...</> : <><i className="ri-sparkling-2-fill text-sm" />앵글 생성 ({ANGLE_CREDIT_COST}CR)</>}
              </button>
              <button onClick={() => setShowMobileControls(false)} className="px-4 py-3 bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl cursor-pointer whitespace-nowrap">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Result Detail Modal */}
      {modalResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-3 md:px-0"
          onClick={() => setModalResult(null)}
        >
          <div
            className="bg-[#111114] border border-white/10 rounded-2xl overflow-hidden w-full md:w-[560px] max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div>
                <p className="text-sm font-bold text-white">앵글 변환 결과</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {modalResult.presetLabel ?? `PAN ${modalResult.pan}° · TILT ${modalResult.tilt}°`}
                  {modalResult.zoom !== 0 && ` · ZOOM ${modalResult.zoom}`}
                </p>
              </div>
              <button
                onClick={() => setModalResult(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
              >
                <i className="ri-close-line" />
              </button>
            </div>

            {modalResult.sourceImg ? (
              <div className="flex border-b border-white/5 max-h-[50vh]">
                <div className="flex-1 flex flex-col items-center p-3 border-r border-white/5 overflow-hidden">
                  <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mb-2 flex-shrink-0">원본</p>
                  <div className="flex-1 w-full rounded-lg overflow-hidden bg-zinc-900">
                    <img src={modalResult.sourceImg} alt="original" className="w-full h-full object-cover object-top" />
                  </div>
                </div>
                <div className="flex-1 flex flex-col items-center p-3 overflow-hidden">
                  <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mb-2 flex-shrink-0">결과</p>
                  <div className="flex-1 w-full rounded-lg overflow-hidden bg-zinc-900">
                    <img src={modalResult.img} alt="result" className="w-full h-full object-cover object-top" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden bg-zinc-950 flex items-center justify-center p-4">
                <img src={modalResult.img} alt="result" className="max-w-full max-h-[50vh] object-contain rounded-xl" />
              </div>
            )}

            <div className="p-4 border-t border-white/5 flex gap-2">
              <button
                onClick={() => handleDownload(modalResult)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-download-2-line" />다운로드
              </button>
              <button
                onClick={() => handleModalCopy(modalResult.img)}
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
                onClick={() => setModalResult(null)}
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
