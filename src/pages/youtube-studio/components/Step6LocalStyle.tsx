import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectMeta, VoiceData } from '@/pages/youtube-studio/page';
import { AutomationProject } from '@/mocks/automationProjects';
import {
  SplitModal,
  ProjectBackupModal,
  PremiereExportModal,
  SaveToGalleryModal,
  RenderModal,
  CompletionToast,
  UnsavedExitDialog,
  SubtitleSegment,
  TOTAL_DURATION,
} from './Step6Modals';
import { Step4ImageData } from './Step4Image';
import SlideshowPreview from './SlideshowPreview';
import SubtitlePreviewBadge from './SubtitlePreviewBadge';
import {
  INITIAL_SUBTITLE_SEGMENTS,
  buildSubtitleSegmentsFromCuts,
  OTHER_TRACKS,
  SUBTITLE_TEMPLATES,
  FONT_OPTIONS,
  FONT_SIZES,
  DEFAULT_STYLE,
  type Step5CutData,
  type SubtitleStyle,
} from './step6-local-data';

export type { Step4ImageData, Step5CutData };

// ─── Props ────────────────────────────────────────────────────────────────────
interface Step6LocalStyleProps {
  onBack: () => void;
  projectMeta?: ProjectMeta;
  onSaveToGallery?: (thumbnailUrl: string, title: string, duration: number) => AutomationProject;
  step4Images?: Step4ImageData[];
  step5Cuts?: Step5CutData[];
  voiceData?: VoiceData | null;
  step2Script?: string;
}

type PanelType = 'template' | 'text' | 'background' | null;
type ModalType = 'split' | 'premiere' | 'render' | null;

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Step6LocalStyle({ onBack, projectMeta, onSaveToGallery, step4Images = [], step5Cuts = [], voiceData: _voiceData, step2Script: _step2Script }: Step6LocalStyleProps) {
  const navigate = useNavigate();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [subtitlePos, setSubtitlePos] = useState(85);
  const [thumbnailTitle, setThumbnailTitle] = useState(
    projectMeta?.keywords?.length ? projectMeta.keywords.join(' ') : 'AI는 이미 당신의 일상이다'
  );
  const [zoom, setZoom] = useState(50);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [renderMode, setRenderMode] = useState<'local' | 'server'>('local');
  // step5Cuts가 있으면 컷 텍스트 기반으로 자막 초기화, 없으면 더미 데이터
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>(() =>
    step5Cuts.length > 0 ? buildSubtitleSegmentsFromCuts(step5Cuts) : INITIAL_SUBTITLE_SEGMENTS
  );
  const [selectedSegId, setSelectedSegId] = useState<string | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditText, setInlineEditText] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('전체');

  // step5Cuts가 나중에 업데이트되면 자막 세그먼트 재초기화
  useEffect(() => {
    if (step5Cuts.length > 0) {
      setSubtitleSegments(buildSubtitleSegmentsFromCuts(step5Cuts));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step5Cuts.length]);

  // ── Gallery / save state ──────────────────────────────────────────────────
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const [savedTitle, setSavedTitle] = useState('');
  const [renderDone, setRenderDone] = useState(false); // 렌더링 완료 여부 추적
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 중복 onBack 방지용

  // ── Unsaved exit dialog ───────────────────────────────────────────────────
  const [exitDialogTarget, setExitDialogTarget] = useState<'back' | 'dashboard' | null>(null);

  // ── Thumbnail ─────────────────────────────────────────────────────────────
  const [thumbGenerating, setThumbGenerating] = useState(false);
  const [thumbGenerated, setThumbGenerated] = useState(false);
  const [thumbUrl, setThumbUrl] = useState(
    'https://readdy.ai/api/search-image?query=inside%20car%20person%20using%20AI%20navigation%20dashboard%20morning%20commute%20smart%20technology%20cinematic&width=280&height=158&seq=thumb_prev&orientation=landscape'
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Timeline drag ─────────────────────────────────────────────────────────
  const [draggingSegId, setDraggingSegId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActivePanel(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (inlineEditId && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineEditId]);

  useEffect(() => {
    if (!draggingSegId) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const dx = e.clientX - dragStartX;
      const dt = (dx / rect.width) * TOTAL_DURATION;
      const seg = subtitleSegments.find((s) => s.id === draggingSegId);
      if (!seg) return;
      const dur = seg.endTime - seg.startTime;
      const newStart = Math.max(0, Math.min(TOTAL_DURATION - dur, dragStartTime + dt));
      setSubtitleSegments((prev) =>
        prev.map((s) => s.id === draggingSegId ? { ...s, startTime: newStart, endTime: newStart + dur } : s)
      );
    };
    const handleMouseUp = () => setDraggingSegId(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingSegId, dragStartX, dragStartTime, subtitleSegments]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleSegMouseDown = (e: React.MouseEvent, seg: SubtitleSegment) => {
    e.preventDefault();
    setDraggingSegId(seg.id);
    setDragStartX(e.clientX);
    setDragStartTime(seg.startTime);
    setSelectedSegId(seg.id);
  };

  const applyTemplate = (tpl: typeof SUBTITLE_TEMPLATES[0]) => {
    const p = tpl.preview;
    const bgMatch = typeof p.bg === 'string' && p.bg.startsWith('rgba') ? p.bg.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/) : null;
    const bgHex = bgMatch ? '#' + [bgMatch[1], bgMatch[2], bgMatch[3]].map((n) => parseInt(n).toString(16).padStart(2, '0')).join('') : '#000000';
    const bgOpacity = bgMatch ? Math.round(parseFloat(bgMatch[4]) * 100) : 0;
    setStyle((prev) => ({
      ...prev,
      templateId: tpl.id,
      fontSize: p.fontSize,
      fontWeight: p.fontWeight,
      color: p.text,
      shadow: p.shadow ?? false,
      bgColor: bgHex,
      bgOpacity,
      bgBlur: p.blur ?? false,
      bgBorderRadius: typeof p.borderRadius === 'number' ? p.borderRadius : 8,
      borderEnabled: p.border ?? false,
      borderColor: (p as { borderColor?: string }).borderColor ?? '#ffffff',
      paddingX: parseInt(String(p.padding).split(' ')[1]) || 14,
      paddingY: parseInt(String(p.padding).split(' ')[0]) || 6,
    }));
    setActivePanel(null);
  };

  const getSubtitleInlineStyle = useCallback((): React.CSSProperties => {
    const tpl = SUBTITLE_TEMPLATES.find((t) => t.id === style.templateId);
    const isGradient = tpl?.id === 'gradient';
    const isOutline = tpl?.id === 'outline';
    return {
      fontFamily: style.font,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight as React.CSSProperties['fontWeight'],
      color: style.color,
      opacity: style.opacity / 100,
      background: isGradient
        ? 'linear-gradient(90deg,rgba(99,102,241,0.85),rgba(168,85,247,0.85))'
        : style.bgOpacity > 0
          ? `rgba(${parseInt(style.bgColor.slice(1, 3), 16)},${parseInt(style.bgColor.slice(3, 5), 16)},${parseInt(style.bgColor.slice(5, 7), 16)},${style.bgOpacity / 100})`
          : 'transparent',
      backdropFilter: style.bgBlur ? 'blur(8px)' : undefined,
      borderRadius: style.bgBorderRadius,
      border: style.borderEnabled ? `1.5px solid ${style.borderColor}` : undefined,
      padding: `${style.paddingY}px ${style.paddingX}px`,
      textShadow: style.shadow
        ? `0 2px 8px ${style.shadowColor}88, 0 1px 2px ${style.shadowColor}`
        : isOutline ? '0 0 3px #000, 0 0 3px #000, 0 0 3px #000' : undefined,
      WebkitTextStroke: isOutline ? '1.5px #000' : undefined,
    };
  }, [style]);

  const handleGenerateThumbnail = () => {
    setThumbGenerating(true);
    setThumbGenerated(false);
    setTimeout(() => {
      const _titleEncoded = encodeURIComponent(`YouTube thumbnail ${thumbnailTitle} AI technology dramatic cinematic bold text overlay dark background high contrast`);
      const prompts = [
        `https://readdy.ai/api/search-image?query=$%7BtitleEncoded%7D&width=280&height=158&seq=thumb_gen1&orientation=landscape`,
        'https://readdy.ai/api/search-image?query=AI%20technology%20futuristic%20thumbnail%20YouTube%20bold%20dramatic%20lighting%20neon%20glow%20dark%20background&width=280&height=158&seq=thumb_gen2&orientation=landscape',
      ];
      setThumbUrl(prompts[Math.floor(Math.random() * prompts.length)]);
      setThumbGenerating(false);
      setThumbGenerated(true);
    }, 2200);
  };

  const togglePanel = (panel: PanelType) => setActivePanel((prev) => (prev === panel ? null : panel));

  const startInlineEdit = (seg: SubtitleSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    setInlineEditId(seg.id);
    setInlineEditText(seg.text);
    setSelectedSegId(seg.id);
  };

  const commitInlineEdit = () => {
    if (!inlineEditId) return;
    setSubtitleSegments((prev) =>
      prev.map((s) => (s.id === inlineEditId ? { ...s, text: inlineEditText.trim() || s.text } : s))
    );
    setInlineEditId(null);
  };

  // ── Exit guard: 저장 없이 나가려 할 때 다이얼로그 표시 ──
  // renderDone 여부와 관계없이 savedTitle이 없으면 저장 유도
  const handleExitAttempt = (target: 'back' | 'dashboard') => {
    if (!savedTitle) {
      // 저장 안 된 상태 → 저장 모달 표시 (렌더링 완료 여부 무관)
      setExitDialogTarget(target);
    } else {
      if (target === 'back') onBack();
      else {
        if (onBack) onBack();
        else navigate('/ai-automation');
      }
    }
  };

  const confirmExit = () => {
    const target = exitDialogTarget;
    setExitDialogTarget(null);
    if (target === 'back') {
      onBack();
    } else {
      // 'dashboard' → 갤러리로 이동
      onBack();
    }
  };

  const cancelExit = () => setExitDialogTarget(null);

  const saveFirstThenExit = () => {
    setExitDialogTarget(null);
    setShowSaveModal(true);
  };

  // ── Gallery save handler ──────────────────────────────────────────────────
  const handleGallerySave = (title: string) => {
    onSaveToGallery?.(thumbUrl, title, TOTAL_DURATION);
    setSavedTitle(title);
    setShowSaveModal(false);
    setShowCompletionToast(true);
    // 3초 후 갤러리로 돌아가기 (중복 호출 방지: exitTimerRef로 관리)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      onBack();
    }, 3000);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const currentTemplate = SUBTITLE_TEMPLATES.find((t) => t.id === style.templateId);
  const categories = ['전체', ...Array.from(new Set(SUBTITLE_TEMPLATES.map((t) => t.category)))];
  const filteredTemplates = templateCategory === '전체' ? SUBTITLE_TEMPLATES : SUBTITLE_TEMPLATES.filter((t) => t.category === templateCategory);

  return (
    <>
      {/* ── Modals ── */}
      {activeModal === 'split' && (
        <SplitModal
          segments={subtitleSegments}
          onClose={() => setActiveModal(null)}
          onApply={(segs) => { setSubtitleSegments(segs); setActiveModal(null); }}
        />
      )}
      {activeModal === 'premiere' && <PremiereExportModal onClose={() => setActiveModal(null)} />}
      {activeModal === 'render' && (
        <RenderModal
          mode={renderMode}
          onClose={() => setActiveModal(null)}
          onRenderComplete={(quality, format) => {
            setRenderDone(true);
            setActiveModal(null);
            setShowSaveModal(true);
            // suppress unused var warning
            void quality; void format;
          }}
        />
      )}
      {showSaveModal && (
        <SaveToGalleryModal
          onClose={() => setShowSaveModal(false)}
          onSave={handleGallerySave}
          thumbnailUrl={thumbUrl}
          defaultTitle={thumbnailTitle}
          duration={TOTAL_DURATION}
          onBackup={() => { setShowSaveModal(false); setShowBackupModal(true); }}
        />
      )}
      {showBackupModal && (
        <ProjectBackupModal
          onClose={() => setShowBackupModal(false)}
          title={thumbnailTitle}
          topic={projectMeta?.keywords?.join(', ') ?? thumbnailTitle}
          duration={TOTAL_DURATION}
          thumbnailUrl={thumbUrl}
        />
      )}
      {showCompletionToast && (
        <CompletionToast
          title={savedTitle}
          onClose={() => {
            setShowCompletionToast(false);
            // 타이머가 아직 실행 중이면 취소하고 즉시 이동 (중복 방지)
            if (exitTimerRef.current) {
              clearTimeout(exitTimerRef.current);
              exitTimerRef.current = null;
            }
            onBack();
          }}
        />
      )}

      {/* ── Unsaved Exit Dialog ── */}
      {exitDialogTarget && (
        <UnsavedExitDialog
          onConfirm={confirmExit}
          onCancel={cancelExit}
          onSaveFirst={saveFirstThenExit}
        />
      )}

      {/* ── Main Layout ── */}
      <div className="flex flex-col h-full overflow-y-auto" ref={panelRef}>
        <div className="flex-1 px-3 md:px-6 py-2.5 md:py-4">
          <div className="max-w-4xl mx-auto space-y-3 md:space-y-4">

            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">비디오 렌더링</h2>
              <p className="text-zinc-500 text-xs hidden sm:block">자막 스타일을 설정하고 브라우저에서 직접 비디오를 생성합니다</p>
              {renderDone && !savedTitle && (
                <span className="flex items-center gap-1 text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                  <i className="ri-error-warning-line text-[10px]" /> 저장 전
                </span>
              )}
              {savedTitle && (
                <span className="flex items-center gap-1 text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                  <i className="ri-checkbox-circle-line text-[10px]" /> 갤러리 저장됨
                </span>
              )}
            </div>

            {/* Video preview — Slideshow */}
            <SlideshowPreview
              images={step4Images}
              step5Cuts={step5Cuts}
              subtitleSegments={subtitleSegments}
              subtitleEnabled={subtitleEnabled}
              subtitlePos={subtitlePos}
              getSubtitleInlineStyle={getSubtitleInlineStyle}
              currentTemplate={currentTemplate}
            />

            {/* Subtitle controls bar */}
            <div className="relative">
              <div className="flex items-center gap-1 md:gap-3 bg-zinc-900/60 border border-white/5 rounded-xl px-2 md:px-4 py-2 md:py-3 overflow-x-auto scrollbar-none">
                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <i className="ri-closed-captioning-line text-zinc-400 text-sm" />
                  <span className="text-xs text-zinc-400 whitespace-nowrap hidden sm:block">자막</span>
                  <button onClick={() => setSubtitleEnabled(!subtitleEnabled)} className={`relative w-9 h-5 rounded-full transition-all cursor-pointer flex-shrink-0 ${subtitleEnabled ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${subtitleEnabled ? 'left-4' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />
                <button onClick={() => togglePanel('template')} className={`flex items-center gap-1 md:gap-1.5 text-xs cursor-pointer whitespace-nowrap px-2 py-1.5 rounded-lg transition-all flex-shrink-0 ${activePanel === 'template' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                  <i className="ri-layout-line text-xs" /><span>템플릿</span>
                  {currentTemplate && <span className="hidden md:block bg-zinc-700 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-full">{currentTemplate.name}</span>}
                </button>
                <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />
                <button onClick={() => togglePanel('text')} className={`flex items-center gap-1 md:gap-1.5 text-xs cursor-pointer whitespace-nowrap px-2 py-1.5 rounded-lg transition-all flex-shrink-0 ${activePanel === 'text' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                  <i className="ri-font-size text-xs" /><span>글자</span>
                  <div className="w-3 h-3 rounded-sm border border-zinc-600 ml-0.5 flex-shrink-0" style={{ background: style.color }} />
                </button>
                <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />
                <button onClick={() => togglePanel('background')} className={`flex items-center gap-1 md:gap-1.5 text-xs cursor-pointer whitespace-nowrap px-2 py-1.5 rounded-lg transition-all flex-shrink-0 ${activePanel === 'background' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>
                  <i className="ri-contrast-2-line text-xs" /><span>배경</span>
                </button>
                <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />
                <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                  <i className="ri-drag-move-line text-zinc-400 text-xs" />
                  <span className="text-xs text-zinc-400 whitespace-nowrap hidden sm:block">위치</span>
                  <input type="range" min={0} max={100} value={subtitlePos} onChange={(e) => setSubtitlePos(Number(e.target.value))} className="w-12 md:w-16 accent-amber-500 cursor-pointer" />
                  <span className="text-xs text-zinc-400 whitespace-nowrap">{subtitlePos}%</span>
                </div>
              </div>

              {/* Template Panel */}
              {activePanel === 'template' && (
                <>
                  <div className="hidden md:block absolute top-full left-0 mt-2 z-40 w-full bg-zinc-900 border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                      <div><h3 className="text-sm font-bold text-white">자막 템플릿</h3><p className="text-xs text-zinc-500 mt-0.5">원하는 스타일을 선택하세요</p></div>
                      <button onClick={() => setActivePanel(null)} className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg hover:bg-white/5"><i className="ri-close-line text-sm" /></button>
                    </div>
                    <div className="flex items-center gap-1 px-5 py-3 border-b border-white/5 overflow-x-auto">
                      {categories.map((cat) => (
                        <button key={cat} onClick={() => setTemplateCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${templateCategory === cat ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'}`}>{cat}</button>
                      ))}
                    </div>
                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-3">
                        {filteredTemplates.map((tpl) => (
                          <button key={tpl.id} onClick={() => applyTemplate(tpl)} className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${style.templateId === tpl.id ? 'border-amber-500' : 'border-white/5 hover:border-white/20'}`}>
                            <div className="h-16 md:h-20 bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                              <img src="https://readdy.ai/api/search-image?query=city%20street%20cinematic%20dark%20background%20minimal&width=240&height=80&seq=tpl_bg&orientation=landscape" alt="" className="absolute inset-0 w-full h-full object-cover object-top opacity-60" />
                              <div className="relative z-10 px-2"><SubtitlePreviewBadge tpl={tpl} /></div>
                            </div>
                            <div className="px-3 py-2 text-left bg-zinc-800/80">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-zinc-200">{tpl.name}</span>
                                {style.templateId === tpl.id && <i className="ri-check-line text-amber-400/70 text-xs" />}
                              </div>
                              <p className="text-[10px] text-zinc-500 mt-0.5">{tpl.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="px-5 pb-4">
                      <div className="bg-zinc-800 rounded-xl p-3 flex items-center justify-center h-14 relative overflow-hidden">
                        <img src="https://readdy.ai/api/search-image?query=city%20street%20cinematic%20dark%20background%20minimal&width=600&height=56&seq=tpl_prev_bg&orientation=landscape" alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                        <div className="relative z-10"><span style={getSubtitleInlineStyle()}>현재 적용된 자막 스타일 미리보기</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivePanel(null)} />
                    <div className="absolute bottom-0 left-0 right-0 bg-[#141416] border-t border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                        <h3 className="text-sm font-bold text-white">자막 템플릿</h3>
                        <button onClick={() => setActivePanel(null)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg"><i className="ri-close-line text-sm" /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-2 gap-3">
                          {filteredTemplates.map((tpl) => (
                            <button key={tpl.id} onClick={() => applyTemplate(tpl)} className={`relative group rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${style.templateId === tpl.id ? 'border-amber-500' : 'border-white/5 hover:border-white/20'}`}>
                              <div className="h-14 bg-zinc-800 flex items-center justify-center relative overflow-hidden">
                                <img src="https://readdy.ai/api/search-image?query=city%20street%20cinematic%20dark%20background%20minimal&width=240&height=56&seq=tpl_bg_m&orientation=landscape" alt="" className="absolute inset-0 w-full h-full object-cover object-top opacity-60" />
                                <div className="relative z-10 px-2"><SubtitlePreviewBadge tpl={tpl} small /></div>
                              </div>
                              <div className="px-2 py-1.5 text-left bg-zinc-800/80">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-zinc-200">{tpl.name}</span>
                                  {style.templateId === tpl.id && <i className="ri-check-line text-amber-400 text-xs" />}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Text Panel */}
              {activePanel === 'text' && (
                <>
                  <div className="hidden md:block absolute top-full left-0 mt-2 z-40 w-full bg-zinc-900 border border-white/5 rounded-2xl shadow-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div><h3 className="text-sm font-bold text-white">글자 설정</h3><p className="text-xs text-zinc-500 mt-0.5">폰트, 크기, 색상, 효과를 조절하세요</p></div>
                      <button onClick={() => setActivePanel(null)} className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg hover:bg-white/5"><i className="ri-close-line text-sm" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-zinc-400 font-semibold mb-2 block">폰트</label>
                          <div className="grid grid-cols-1 gap-1">
                            {FONT_OPTIONS.map((f) => (
                              <button key={f} onClick={() => setStyle((s) => ({ ...s, font: f }))} className={`text-left px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${style.font === f ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`} style={{ fontFamily: f }}>{f}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-zinc-400 font-semibold mb-2 block">크기</label>
                          <div className="flex gap-2 flex-wrap">
                            {FONT_SIZES.map((s) => (
                              <button key={s} onClick={() => setStyle((prev) => ({ ...prev, fontSize: s }))} className={`flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${style.fontSize === s ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{s}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 font-semibold mb-2 block">색상</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {['#ffffff', '#ffe600', '#ff4d4d', '#4dffb4', '#4db8ff', '#ff4dff'].map((c) => (
                              <button key={c} onClick={() => setStyle((s) => ({ ...s, color: c }))} className={`w-7 h-7 rounded-full cursor-pointer transition-all border-2 ${style.color === c ? 'border-white scale-110' : 'border-zinc-700'}`} style={{ background: c }} />
                            ))}
                            <input type="color" value={style.color} onChange={(e) => setStyle((s) => ({ ...s, color: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-zinc-400 font-semibold">불투명도</label>
                            <span className="text-xs text-zinc-300 font-bold">{style.opacity}%</span>
                          </div>
                          <input type="range" min={20} max={100} value={style.opacity} onChange={(e) => setStyle((s) => ({ ...s, opacity: Number(e.target.value) }))} className="w-full accent-indigo-500 cursor-pointer" />
                        </div>
                        <div className="bg-zinc-800/60 rounded-xl p-3">
                          <label className="text-[10px] text-zinc-500 mb-2 block">미리보기</label>
                          <div className="h-12 bg-zinc-700/50 rounded-lg flex items-center justify-center">
                            <span style={getSubtitleInlineStyle()}>샘플 자막 텍스트</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivePanel(null)} />
                    <div className="absolute bottom-0 left-0 right-0 bg-[#141416] border-t border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                        <h3 className="text-sm font-bold text-white">글자 설정</h3>
                        <button onClick={() => setActivePanel(null)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg"><i className="ri-close-line text-sm" /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div>
                          <label className="text-xs text-zinc-400 font-semibold mb-2 block">색상</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {['#ffffff', '#ffe600', '#ff4d4d', '#4dffb4', '#4db8ff', '#ff4dff'].map((c) => (
                              <button key={c} onClick={() => setStyle((s) => ({ ...s, color: c }))} className={`w-8 h-8 rounded-full cursor-pointer transition-all border-2 ${style.color === c ? 'border-white scale-110' : 'border-zinc-700'}`} style={{ background: c }} />
                            ))}
                            <input type="color" value={style.color} onChange={(e) => setStyle((s) => ({ ...s, color: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-zinc-400 font-semibold">불투명도</label>
                            <span className="text-xs text-zinc-300 font-bold">{style.opacity}%</span>
                          </div>
                          <input type="range" min={20} max={100} value={style.opacity} onChange={(e) => setStyle((s) => ({ ...s, opacity: Number(e.target.value) }))} className="w-full accent-indigo-500 cursor-pointer" />
                        </div>
                        <div className="bg-zinc-800/60 rounded-xl p-3">
                          <label className="text-[10px] text-zinc-500 mb-2 block">미리보기</label>
                          <div className="h-12 bg-zinc-700/50 rounded-lg flex items-center justify-center">
                            <span style={getSubtitleInlineStyle()}>샘플 자막 텍스트</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Background Panel */}
              {activePanel === 'background' && (
                <>
                  <div className="hidden md:block absolute top-full left-0 mt-2 z-40 w-full bg-zinc-900 border border-white/5 rounded-2xl shadow-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div><h3 className="text-sm font-bold text-white">배경 설정</h3><p className="text-xs text-zinc-500 mt-0.5">자막 배경 색상, 투명도, 효과를 조절하세요</p></div>
                      <button onClick={() => setActivePanel(null)} className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg hover:bg-white/5"><i className="ri-close-line text-sm" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-zinc-400 font-semibold mb-2 block">배경 색상</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {['#000000', '#1a1a2e', '#0d1117', '#1e293b', '#ffffff', '#ffe600'].map((c) => (
                              <button key={c} onClick={() => setStyle((s) => ({ ...s, bgColor: c }))} className={`w-8 h-8 rounded-lg cursor-pointer transition-all border-2 ${style.bgColor === c ? 'border-white scale-110' : 'border-zinc-700 hover:scale-105'}`} style={{ background: c }} />
                            ))}
                            <input type="color" value={style.bgColor} onChange={(e) => setStyle((s) => ({ ...s, bgColor: e.target.value }))} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-zinc-400 font-semibold">배경 투명도</label>
                            <span className="text-xs text-zinc-300 font-bold">{style.bgOpacity}%</span>
                          </div>
                          <input type="range" min={0} max={100} value={style.bgOpacity} onChange={(e) => setStyle((s) => ({ ...s, bgOpacity: Number(e.target.value) }))} className="w-full accent-emerald-500 cursor-pointer" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 font-semibold mb-2 block">패딩</label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-zinc-600 mb-1 block">좌우 {style.paddingX}px</label>
                              <input type="range" min={4} max={40} value={style.paddingX} onChange={(e) => setStyle((s) => ({ ...s, paddingX: Number(e.target.value) }))} className="w-full accent-emerald-500 cursor-pointer" />
                            </div>
                            <div>
                              <label className="text-[10px] text-zinc-600 mb-1 block">상하 {style.paddingY}px</label>
                              <input type="range" min={2} max={24} value={style.paddingY} onChange={(e) => setStyle((s) => ({ ...s, paddingY: Number(e.target.value) }))} className="w-full accent-emerald-500 cursor-pointer" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-zinc-400 font-semibold">모서리 둥글기</label>
                            <span className="text-xs text-zinc-300 font-bold">{style.bgBorderRadius}px</span>
                          </div>
                          <input type="range" min={0} max={40} value={style.bgBorderRadius} onChange={(e) => setStyle((s) => ({ ...s, bgBorderRadius: Number(e.target.value) }))} className="w-full accent-emerald-500 cursor-pointer" />
                        </div>
                        <div className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-3 py-3">
                          <label className="text-xs text-zinc-300 font-semibold">블러 효과</label>
                          <button onClick={() => setStyle((s) => ({ ...s, bgBlur: !s.bgBlur }))} className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${style.bgBlur ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${style.bgBlur ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        </div>
                        <div className="bg-zinc-800/60 rounded-xl p-3">
                          <label className="text-[10px] text-zinc-500 mb-2 block">미리보기</label>
                          <div className="h-14 bg-zinc-700/50 rounded-lg flex items-center justify-center">
                            <span style={getSubtitleInlineStyle()}>샘플 자막 텍스트</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="md:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActivePanel(null)} />
                    <div className="absolute bottom-0 left-0 right-0 bg-[#141416] border-t border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
                        <h3 className="text-sm font-bold text-white">배경 설정</h3>
                        <button onClick={() => setActivePanel(null)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg"><i className="ri-close-line text-sm" /></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div>
                          <label className="text-xs text-zinc-400 font-semibold mb-2 block">배경 색상</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {['#000000', '#1a1a2e', '#0d1117', '#1e293b', '#ffffff', '#ffe600'].map((c) => (
                              <button key={c} onClick={() => setStyle((s) => ({ ...s, bgColor: c }))} className={`w-9 h-9 rounded-lg cursor-pointer transition-all border-2 ${style.bgColor === c ? 'border-white scale-110' : 'border-zinc-700'}`} style={{ background: c }} />
                            ))}
                            <input type="color" value={style.bgColor} onChange={(e) => setStyle((s) => ({ ...s, bgColor: e.target.value }))} className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-zinc-400 font-semibold">배경 투명도</label>
                            <span className="text-xs text-zinc-300 font-bold">{style.bgOpacity}%</span>
                          </div>
                          <input type="range" min={0} max={100} value={style.bgOpacity} onChange={(e) => setStyle((s) => ({ ...s, bgOpacity: Number(e.target.value) }))} className="w-full accent-emerald-500 cursor-pointer" />
                        </div>
                        <div className="bg-zinc-800/60 rounded-xl p-3">
                          <label className="text-[10px] text-zinc-500 mb-2 block">미리보기</label>
                          <div className="h-12 bg-zinc-700/50 rounded-lg flex items-center justify-center">
                            <span style={getSubtitleInlineStyle()}>샘플 자막 텍스트</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-zinc-900/60 border border-white/5 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-white/5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-400 font-semibold">자막 타임라인</span>
                  <button onClick={() => setActiveModal('split')} className="flex items-center gap-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-[10px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                    <i className="ri-scissors-cut-line text-[10px]" /> 자막 쪼개기
                  </button>
                  <span className="hidden sm:block text-[10px] text-zinc-600">{subtitleSegments.length}개 · 드래그로 이동</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="ri-zoom-out-line text-zinc-500 text-xs cursor-pointer hover:text-zinc-300" onClick={() => setZoom((z) => Math.max(25, z - 10))} />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <i className="ri-zoom-in-line text-zinc-500 text-xs cursor-pointer hover:text-zinc-300" onClick={() => setZoom((z) => Math.min(200, z + 10))} />
                  <span className="text-xs text-zinc-500 hidden sm:block">{zoom}%</span>
                </div>
              </div>
              <div className="overflow-x-auto scrollbar-none">
                <div className="p-2 md:p-3 space-y-1.5" style={{ minWidth: `${Math.max(480, zoom * 6)}px` }}>
                  <div className="flex items-center pl-14 md:pl-16 mb-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((t) => (
                      <div key={t} className="flex-1 text-[9px] text-zinc-600 text-center">{t}</div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-14 flex-shrink-0 flex items-center gap-1">
                      <span className="text-[9px] text-zinc-600 font-semibold">T1</span>
                      <span className="text-[9px] text-zinc-600 hidden sm:block">Subtitles</span>
                    </div>
                    <div ref={timelineRef} className="flex-1 h-8 relative bg-zinc-800/40 rounded overflow-hidden select-none">
                      {subtitleSegments.map((seg) => (
                        <div
                          key={seg.id}
                          onMouseDown={(e) => { if (inlineEditId !== seg.id) handleSegMouseDown(e, seg); }}
                          onDoubleClick={(e) => startInlineEdit(seg, e)}
                          title={`드래그: 이동 | 더블클릭: 편집 | ${seg.startTime.toFixed(1)}s → ${seg.endTime.toFixed(1)}s`}
                          className={`absolute h-full flex items-center px-1.5 border-r border-black/30 transition-colors group ${draggingSegId === seg.id ? 'bg-amber-400 cursor-grabbing z-10' : selectedSegId === seg.id ? 'bg-amber-500 cursor-grab' : 'bg-orange-500/75 hover:bg-orange-500/90 cursor-grab'}`}
                          style={{ left: `${(seg.startTime / TOTAL_DURATION) * 100}%`, width: `${((seg.endTime - seg.startTime) / TOTAL_DURATION) * 100}%` }}
                        >
                          {inlineEditId === seg.id ? (
                            <input ref={inlineInputRef} value={inlineEditText} onChange={(e) => setInlineEditText(e.target.value)}
                              onBlur={commitInlineEdit}
                              onKeyDown={(e) => { if (e.key === 'Enter') commitInlineEdit(); if (e.key === 'Escape') setInlineEditId(null); e.stopPropagation(); }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-transparent text-black text-[9px] font-bold focus:outline-none" />
                          ) : (
                            <>
                              <span className={`truncate text-[9px] font-semibold ${selectedSegId === seg.id || draggingSegId === seg.id ? 'text-black' : 'text-white'}`}>{seg.text}</span>
                              {selectedSegId === seg.id && <i className="ri-edit-line text-black/60 text-[9px] ml-auto flex-shrink-0" />}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {OTHER_TRACKS.map((track) => (
                    <div key={track.id} className="flex items-center gap-2">
                      <div className="w-14 flex-shrink-0 flex items-center gap-1">
                        <span className="text-[9px] text-zinc-600 font-semibold">{track.id}</span>
                        <span className="text-[9px] text-zinc-600 hidden sm:block">{track.label}</span>
                      </div>
                      <div className="flex-1 h-7 flex gap-0.5 overflow-hidden">
                        {track.segments.map((seg, i) => (
                          <div key={i} style={{ width: `${seg.w}%` }} className={`h-full rounded flex items-center px-2 flex-shrink-0 ${(seg as { empty?: boolean }).empty ? 'bg-zinc-800 border border-dashed border-zinc-700 text-zinc-600 text-[9px] justify-center cursor-pointer hover:bg-zinc-700' : `${track.color} text-white text-[9px] cursor-default`}`}>
                            <span className="truncate">{seg.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selectedSegId && !inlineEditId && (
                <div className="px-3 md:px-4 py-2 border-t border-white/5 flex items-center gap-2 bg-amber-500/5">
                  <i className="ri-information-line text-amber-400/70 text-xs" />
                  <span className="text-[10px] text-amber-400/70">
                    선택됨: &quot;{subtitleSegments.find((s) => s.id === selectedSegId)?.text.slice(0, 20)}...&quot; — 더블클릭하여 편집
                  </span>
                </div>
              )}
            </div>

            {/* Bottom section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Thumbnail */}
              <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <i className="ri-image-line text-zinc-500 text-sm" />
                  <span className="text-sm font-semibold text-zinc-300">AI 썸네일</span>
                </div>
                <div className="relative rounded-xl overflow-hidden mb-3">
                  <img src={thumbUrl} alt="Thumbnail" className="w-full h-[100px] sm:h-[110px] md:h-[120px] object-cover object-top" />
                  {thumbGenerating && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                      <p className="text-white text-xs font-semibold">AI 생성 중...</p>
                    </div>
                  )}
                  {thumbGenerated && !thumbGenerating && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/80 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <i className="ri-sparkling-2-line text-[10px]" /> AI 생성됨
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                    <p className="text-white text-xs font-bold line-clamp-1">{thumbnailTitle}</p>
                  </div>
                </div>
                <button onClick={() => setThumbnailTitle('AI가 바꾸는 당신의 미래')} className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                  <i className="ri-sparkling-2-line" /> AI 썸네일 생성 <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]"><i className="ri-sparkling-2-line text-[10px]" />3</span>
                </button>
                {thumbGenerated && !thumbGenerating && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={handleGenerateThumbnail} className="flex-1 flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                      <i className="ri-refresh-line text-xs" /> 재생성
                    </button>
                    <button onClick={async () => {
                      const filename = `thumbnail_${Date.now()}.jpg`;
                      try {
                        const res = await fetch(thumbUrl, { mode: 'cors' });
                        const blob = await res.blob();
                        const objUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = objUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(objUrl);
                      } catch {
                        const a = document.createElement('a');
                        a.href = thumbUrl;
                        a.download = filename;
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }} className="flex-1 flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                      <i className="ri-download-line text-xs" /> 다운로드
                    </button>
                  </div>
                )}
              </div>

              {/* Render */}
              <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <i className="ri-film-line text-zinc-400 text-sm" />
                  <span className="text-sm font-semibold text-zinc-300">영상 프로덕션 &amp; 렌더링</span>
                </div>
                <div className="bg-zinc-800/60 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-zinc-500">컴퓨터 리소스</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">고성능</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-zinc-500">CPU Cores</span>
                        <span className="text-[9px] text-white font-bold">16</span>
                      </div>
                      <div className="h-1 bg-zinc-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full w-4/5" /></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-zinc-500">RAM Size</span>
                        <span className="text-[9px] text-white font-bold">8GB+</span>
                      </div>
                      <div className="h-1 bg-zinc-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full w-3/4" /></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate">ANGLE (NVIDIA GeForce RTX 3070)</p>
                </div>
                <div className="space-y-2">
                  <button onClick={() => setActiveModal('premiere')} className="w-full flex items-center justify-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                    <i className="ri-download-line" /> 프리미어 프로 내보내기
                  </button>
                  <button onClick={() => { setRenderMode('local'); setActiveModal('render'); }} className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                    <i className="ri-computer-line" /> 로컬 렌더링 (무료)
                  </button>
                  <button onClick={() => { setRenderMode('server'); setActiveModal('render'); }} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-all whitespace-nowrap">
                    <i className="ri-server-line" /> 서버 초고속 렌더링
                    <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]"><i className="ri-sparkling-2-line text-[10px]" />7</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex-shrink-0 border-t border-white/5 bg-[#0f0f11] px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <button
            onClick={() => handleExitAttempt('back')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-arrow-left-line" /> 이전
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBackupModal(true)}
              className="flex items-center gap-2 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-400 font-bold text-sm px-3 md:px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-archive-drawer-line" />
              <span className="hidden sm:inline">프로젝트 백업</span>
            </button>
            <button
              onClick={() => handleExitAttempt('dashboard')}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm px-4 md:px-6 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-home-line" /> 갤러리로
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
