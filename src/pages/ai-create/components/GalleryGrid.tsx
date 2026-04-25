import { useState, useCallback, useEffect, useRef } from 'react';
import { useGallery } from '@/hooks/useGallery';
import { useAuth } from '@/hooks/useAuth';
import { GalleryItem, GalleryItemSource } from '@/mocks/galleryItems';
import RangeSlider from './RangeSlider';
import EmptyState from '@/components/base/EmptyState';
import PageHeader from '@/components/feature/PageHeader';
import { ExpirableMedia } from '@/components/base/ExpirableMedia';

// ── Image Detail Modal ─────────────────────────────────────────────────────
interface ImageDetailModalProps {
  item: GalleryItem;
  items: GalleryItem[];
  likedIds: Set<string>;
  downloadingId: string | null;
  onClose: () => void;
  onNavigate: (item: GalleryItem) => void;
  onDownload: (item: GalleryItem, e?: React.MouseEvent) => void;
  onToggleLike: (id: string, e?: React.MouseEvent) => void;
  onShare: (item: GalleryItem) => void;
  onEdit: (item: GalleryItem) => void;
  onDelete: (item: GalleryItem) => void;
}

function ImageDetailModal({
  item, items, likedIds, downloadingId,
  onClose, onNavigate, onDownload, onToggleLike, onShare, onEdit, onDelete,
}: ImageDetailModalProps) {
  const [promptCopied, setPromptCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(items[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(items[currentIndex + 1]);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, hasPrev, hasNext, items, currentIndex, onNavigate]);

  useEffect(() => {
    setImgLoaded(false);
    setPromptCopied(false);
  }, [item.id]);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(item.prompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  };

  const isLiked = likedIds.has(item.id);
  const modelBadge = (() => {
    const m = item.model.toLowerCase();
    if (m.includes('ultra')) return { bg: 'bg-rose-500/15 border-rose-500/25 text-rose-400', icon: 'ri-vip-crown-line' };
    if (m.includes('pro')) return { bg: 'bg-amber-500/15 border-amber-500/25 text-amber-400', icon: 'ri-sparkling-2-line' };
    return { bg: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400', icon: 'ri-flashlight-line' };
  })();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-3 z-10 pointer-events-none">
        <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 bg-black/40 px-2.5 py-1 rounded-full border border-white/5">
          <kbd className="text-zinc-500 font-mono">←</kbd>
          <kbd className="text-zinc-500 font-mono">→</kbd>
          <span>이전/다음</span>
          <span className="mx-1 text-zinc-700">·</span>
          <kbd className="text-zinc-500 font-mono">ESC</kbd>
          <span>닫기</span>
        </span>
      </div>
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(items[currentIndex - 1]); }}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 border border-white/10 text-white transition-all cursor-pointer"
        >
          <i className="ri-arrow-left-s-line text-lg md:text-xl" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(items[currentIndex + 1]); }}
          className="absolute right-2 md:right-[316px] top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 border border-white/10 text-white transition-all cursor-pointer"
        >
          <i className="ri-arrow-right-s-line text-lg md:text-xl" />
        </button>
      )}
      <div
        className="relative z-10 flex flex-col md:flex-row w-full max-w-5xl bg-[#0f0f11] border border-white/8 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex-1 bg-zinc-950 flex items-center justify-center relative overflow-hidden min-w-0 min-h-[200px] md:min-h-0">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
            </div>
          )}
          <ExpirableMedia
            key={item.id}
            type={item.type === 'video' ? 'video' : 'image'}
            src={item.url}
            alt={item.prompt}
            controls={item.type === 'video'}
            loop={item.type === 'video'}
            playsInline={item.type === 'video'}
            onLoad={() => setImgLoaded(true)}
            onLoadedData={() => setImgLoaded(true)}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border backdrop-blur-sm ${item.type === 'video' ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300' : 'bg-black/50 border-white/10 text-zinc-300'}`}>
              <i className={item.type === 'video' ? 'ri-video-line' : 'ri-image-line'} />
              {item.type === 'video' ? `VIDEO · ${item.duration}` : 'IMAGE'}
            </span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-black/50 border border-white/10 text-zinc-400 backdrop-blur-sm hidden sm:inline">{item.ratio}</span>
          </div>
          <button onClick={onClose} className="md:hidden absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white cursor-pointer z-10">
            <i className="ri-close-line text-sm" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
            {items.slice(0, 20).map((_, idx) => (
              <button key={idx} onClick={(e) => { e.stopPropagation(); onNavigate(items[idx]); }}
                className={`rounded-full transition-all cursor-pointer ${idx === currentIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/25 hover:bg-white/50'}`}
              />
            ))}
          </div>
        </div>
        <div className="w-full md:w-[300px] flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-white/5 bg-[#111114]" style={{ maxHeight: '50vh', minHeight: 0 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${item.type === 'video' ? 'bg-amber-500/15' : 'bg-indigo-500/15'}`}>
                <i className={`text-xs ${item.type === 'video' ? 'ri-video-line text-amber-400' : 'ri-image-line text-indigo-400'}`} />
              </div>
              <span className="text-xs font-bold text-white">{item.type === 'video' ? '영상 상세' : '이미지 상세'}</span>
            </div>
            <button onClick={onClose} className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-all">
              <i className="ri-close-line text-sm" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">프롬프트</p>
                <button onClick={handleCopyPrompt}
                  className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${promptCopied ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-white/5'}`}
                >
                  <i className={promptCopied ? 'ri-check-line text-[9px]' : 'ri-clipboard-line text-[9px]'} />
                  {promptCopied ? '복사됨!' : '복사'}
                </button>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed line-clamp-3">{item.prompt}</p>
            </div>
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-2">모델</p>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${modelBadge.bg}`}>
                <div className="w-6 h-6 rounded-lg bg-black/30 flex items-center justify-center flex-shrink-0">
                  <i className={`${modelBadge.icon} text-sm`} />
                </div>
                <p className="text-xs font-bold truncate flex-1 min-w-0">{item.model}</p>
              </div>
            </div>
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mb-2">정보</p>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-1.5 md:gap-2">
                {[
                  { icon: 'ri-aspect-ratio-line', label: '해상도', value: item.ratio },
                  { icon: 'ri-file-image-line', label: '타입', value: item.type.toUpperCase() },
                  { icon: 'ri-calendar-line', label: '생성일', value: new Date(item.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) },
                  { icon: 'ri-time-line', label: '시간', value: new Date(item.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) },
                ].map((info) => (
                  <div key={info.label} className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><i className={`${info.icon} text-zinc-600`} />{info.label}</span>
                    <span className="text-[11px] text-zinc-300 font-medium">{info.value}</span>
                  </div>
                ))}
                {(() => {
                  const src = SOURCE_OPTIONS.find((o) => o.value === (item.source ?? 'ai-create'));
                  return src ? (
                    <div className="flex items-center justify-between col-span-2 md:col-span-1">
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1.5"><i className="ri-map-pin-line text-zinc-600" />출처</span>
                      <span className={`text-[11px] font-bold flex items-center gap-1 ${src.color}`}><i className={`${src.icon} text-[10px]`} />{src.label}</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
          <div className="p-3 border-t border-white/5 flex-shrink-0 space-y-2">
            <button onClick={() => onDownload(item)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              {downloadingId === item.id ? <><i className="ri-loader-4-line animate-spin text-sm" />다운로드 중...</> : <><i className="ri-download-2-line text-sm" />다운로드</>}
            </button>
            <div className={`grid gap-1.5 ${item.type === 'video' ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <button onClick={() => onToggleLike(item.id)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${isLiked ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'bg-zinc-800/80 hover:bg-zinc-700 border border-white/5 text-zinc-400'}`}
              >
                <i className={`${isLiked ? 'ri-heart-fill' : 'ri-heart-line'} text-sm`} />좋아요
              </button>
              <button onClick={() => { onShare(item); onClose(); }}
                className="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold bg-zinc-800/80 hover:bg-zinc-700 border border-white/5 text-zinc-400 transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-share-line text-sm" />공유
              </button>
              {item.type !== 'video' && (
                <button onClick={() => { onEdit(item); onClose(); }}
                  className="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold bg-zinc-800/80 hover:bg-zinc-700 border border-white/5 text-zinc-400 transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-magic-line text-sm" />편집
                </button>
              )}
            </div>
            <button onClick={() => { onDelete(item); onClose(); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/30 text-red-400/70 hover:text-red-400 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-delete-bin-line text-xs" />이미지 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Image Edit Modal ───────────────────────────────────────────────────────
const EDIT_PRESETS = [
  { id: 'brightness', label: '밝기 조정', icon: 'ri-sun-line', desc: '이미지를 더 밝게 또는 어둡게' },
  { id: 'contrast', label: '대비 강화', icon: 'ri-contrast-2-line', desc: '명암 대비를 강하게' },
  { id: 'style_anime', label: '애니 스타일', icon: 'ri-video-line', desc: '애니메이션 스타일로 변환' },
  { id: 'style_oil', label: '유화 스타일', icon: 'ri-brush-line', desc: '유화 그림 스타일로 변환' },
  { id: 'bg_remove', label: '배경 제거', icon: 'ri-scissors-cut-line', desc: '배경을 투명하게 제거' },
  { id: 'upscale', label: '해상도 향상', icon: 'ri-zoom-in-line', desc: '이미지 해상도를 4배 향상' },
  { id: 'color_vivid', label: '색감 강화', icon: 'ri-palette-line', desc: '색상을 더 선명하고 생동감 있게' },
  { id: 'face_enhance', label: '얼굴 보정', icon: 'ri-user-smile-line', desc: '얼굴 디테일을 자동 보정' },
];

const EDGE_FN_URL = 'https://kkeijdddandmvsaukpcn.supabase.co/functions/v1/generate-image';

function ImageEditModal({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [strength, setStrength] = useState(70);
  const preset = EDIT_PRESETS.find((p) => p.id === selectedPreset);

  const buildEditPrompt = () => {
    const basePrompt = item.prompt;
    if (customPrompt.trim()) return `${basePrompt}, ${customPrompt.trim()}`;
    if (!preset) return basePrompt;
    const presetPrompts: Record<string, string> = {
      brightness: `${basePrompt}, bright lighting, high exposure, luminous`,
      contrast: `${basePrompt}, high contrast, dramatic lighting, deep shadows`,
      style_anime: `anime style illustration, ${basePrompt}, cel shading, vibrant colors`,
      style_oil: `oil painting style, ${basePrompt}, thick brushstrokes, artistic texture`,
      bg_remove: `${basePrompt}, transparent background, isolated subject, clean cutout`,
      upscale: `${basePrompt}, ultra high resolution, 8K, sharp details, enhanced quality`,
      color_vivid: `${basePrompt}, vivid colors, high saturation, vibrant, colorful`,
      face_enhance: `${basePrompt}, perfect face, detailed facial features, skin retouching, beauty enhancement`,
    };
    return presetPrompts[preset.id] ?? basePrompt;
  };

  const handleEdit = async () => {
    if (!selectedPreset && !customPrompt.trim()) return;
    setIsProcessing(true);
    setEditError(null);
    try {
      const res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildEditPrompt(), model: item.model || 'Flux Realism', type: 'IMAGE', ratio: item.ratio || '1K · 16:9 · PNG' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `서버 오류 (${res.status})`);
      setResultUrl(data.imageUrl);
      setIsDone(true);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '편집에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-[720px] max-h-[85vh] bg-[#111114] border border-white/10 rounded-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-white">이미지 편집</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">AI로 이미지를 변환하거나 스타일을 바꿔보세요</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-all">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="w-56 flex-shrink-0 border-r border-white/5 flex flex-col">
            <div className="p-3 flex-shrink-0">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">원본</p>
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-900">
                <img src={item.url} alt="source" className="w-full h-full object-cover object-top" />
              </div>
            </div>
            {isDone && resultUrl && (
              <div className="p-3 flex-shrink-0 border-t border-white/5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">편집 결과</p>
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-900 relative">
                  <img src={resultUrl} alt="result" className="w-full h-full object-cover object-top" />
                  <div className="absolute top-1 right-1">
                    <div className="bg-emerald-500/90 rounded-full px-2 py-0.5">
                      <span className="text-[9px] text-white font-bold">완료</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-3">편집 유형 선택</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {EDIT_PRESETS.map((p) => (
                  <button key={p.id} onClick={() => setSelectedPreset(selectedPreset === p.id ? null : p.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${selectedPreset === p.id ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/5 bg-zinc-900/60 hover:border-white/15 hover:bg-zinc-800/60'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedPreset === p.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      <i className={`${p.icon} text-sm`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${selectedPreset === p.id ? 'text-indigo-300' : 'text-zinc-300'}`}>{p.label}</p>
                      <p className="text-[9px] text-zinc-600 truncate">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              {selectedPreset && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">강도</p>
                    <span className="text-xs text-indigo-400 font-bold">{strength}%</span>
                  </div>
                  <RangeSlider value={strength} min={10} max={100} onChange={setStrength} gradient="from-indigo-500 to-violet-500" thumbColor="border-indigo-400" height="h-5" thumbSize="w-4 h-4" />
                </div>
              )}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2">직접 입력 (선택)</p>
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="원하는 편집 내용을 직접 입력하세요... (예: 배경을 우주로 바꿔줘)"
                  className="w-full bg-zinc-900/60 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-zinc-300 placeholder-zinc-600 resize-none outline-none focus:border-indigo-500/40 transition-colors"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/5 flex-shrink-0 flex flex-col gap-2">
              {editError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-300 leading-relaxed">{editError}</p>
                </div>
              )}
              <div className="flex gap-2">
                {isDone && resultUrl ? (
                  <>
                    <button onClick={() => { setIsDone(false); setResultUrl(null); setSelectedPreset(null); setCustomPrompt(''); setEditError(null); }}
                      className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-refresh-line mr-1" />다시 편집
                    </button>
                    <button onClick={async () => {
                      try {
                        const response = await fetch(resultUrl);
                        const blob = await response.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = objectUrl;
                        link.download = `edited_${item.id}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                      } catch { window.open(resultUrl, '_blank', 'noopener,noreferrer'); }
                    }}
                      className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                    >
                      <i className="ri-download-2-line" />편집본 다운로드
                    </button>
                  </>
                ) : (
                  <button onClick={handleEdit} disabled={(!selectedPreset && !customPrompt.trim()) || isProcessing}
                    className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${(!selectedPreset && !customPrompt.trim()) || isProcessing ? 'bg-zinc-700 cursor-not-allowed opacity-60' : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 cursor-pointer'}`}
                  >
                    {isProcessing ? <><i className="ri-loader-4-line animate-spin" />fal.ai 편집 중... ({preset?.label ?? '커스텀'})</> : <><i className="ri-magic-line" />AI 편집 시작 {selectedPreset ? `— ${preset?.label}` : ''}</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ────────────────────────────────────────────────────────────
function ShareModal({ item, onClose }: { item: GalleryItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = item.url;
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const shareOptions = [
    { label: 'Twitter / X', icon: 'ri-twitter-x-line', color: 'text-zinc-300', bg: 'bg-zinc-800 hover:bg-zinc-700', url: `https://twitter.com/intent/tweet?text=AI로 생성한 이미지를 확인해보세요!&url=${encodeURIComponent(item.url)}` },
    { label: 'Instagram', icon: 'ri-instagram-line', color: 'text-rose-400', bg: 'bg-rose-500/10 hover:bg-rose-500/20', url: 'https://www.instagram.com/' },
    { label: 'Discord', icon: 'ri-discord-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10 hover:bg-indigo-500/20', url: 'https://discord.com/' },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-[360px] bg-[#111114] border border-white/10 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">이미지 공유</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-all">
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="w-full h-32 rounded-xl overflow-hidden mb-4 bg-zinc-900">
          <img src={item.url} alt="share preview" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {shareOptions.map((opt) => (
            <button key={opt.label} onClick={() => window.open(opt.url, '_blank', 'noopener,noreferrer')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${opt.bg} border border-white/5 transition-all cursor-pointer`}
            >
              <div className="w-8 h-8 flex items-center justify-center"><i className={`${opt.icon} ${opt.color} text-lg`} /></div>
              <span className="text-sm font-medium text-zinc-300">{opt.label}에 공유</span>
              <i className="ri-external-link-line text-zinc-600 ml-auto text-sm" />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900 border border-white/5">
          <p className="flex-1 text-xs text-zinc-500 truncate">{shareUrl.slice(0, 50)}...</p>
          <button onClick={handleCopy}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'}`}
          >
            {copied ? <><i className="ri-check-line mr-1" />복사됨</> : <><i className="ri-link text-xs mr-1" />링크 복사</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── View Mode Toggle ───────────────────────────────────────────────────────
function ViewModeToggle({ viewMode, onViewModeChange }: { viewMode: 'grid' | 'list'; onViewModeChange: (m: 'grid' | 'list') => void }) {
  return (
    <div className="flex items-center bg-zinc-900 border border-zinc-800/60 rounded-xl p-1 gap-0.5 flex-shrink-0">
      <button onClick={() => onViewModeChange('grid')}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <i className="ri-layout-grid-2-line text-sm" />
      </button>
      <button onClick={() => onViewModeChange('list')}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'}`}
      >
        <i className="ri-list-check-2 text-sm" />
      </button>
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────────
function GridSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="break-inside-avoid rounded-xl overflow-hidden bg-zinc-900/60 border border-zinc-800/40 animate-pulse"
          style={{ height: `${140 + (i % 3) * 60}px` }}
        >
          <div className="w-full h-full bg-zinc-800/60" />
        </div>
      ))}
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border border-white/5 rounded-xl p-3 animate-pulse">
          <div className="w-16 h-16 rounded-lg bg-zinc-800/60 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-zinc-800/60 rounded-full w-3/4" />
            <div className="h-2.5 bg-zinc-800/40 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
}

// ── Load More Sentinel ─────────────────────────────────────────────────────
function LoadMoreSentinel({ onVisible, loadingMore, hasMore }: {
  onVisible: () => void;
  loadingMore: boolean;
  hasMore: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onVisible();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible, hasMore]);

  if (!hasMore && !loadingMore) return null;

  return (
    <div ref={sentinelRef} className="flex items-center justify-center py-8">
      {loadingMore && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-xs text-zinc-500">더 불러오는 중...</span>
        </div>
      )}
    </div>
  );
}

// ── Types & Constants ──────────────────────────────────────────────────────
type FilterType = 'ALL' | 'IMAGE' | 'VIDEO';
type SortType = 'newest' | 'oldest' | 'liked';
type ViewMode = 'grid' | 'list';

const SOURCE_OPTIONS: { value: GalleryItemSource | 'ALL'; label: string; icon: string; color: string }[] = [
  { value: 'ALL', label: '전체', icon: 'ri-apps-line', color: 'text-zinc-400' },
  { value: 'ai-create', label: 'AI Create', icon: 'ri-sparkling-2-line', color: 'text-indigo-400' },
  { value: 'ai-ad', label: 'AI Ad', icon: 'ri-advertisement-line', color: 'text-rose-400' },
  { value: 'ai-automation', label: 'AI Automation', icon: 'ri-robot-line', color: 'text-amber-400' },
  { value: 'youtube-studio', label: 'YouTube Studio', icon: 'ri-youtube-line', color: 'text-red-400' },
];

interface GalleryGridProps {
  onSelectItem?: (item: GalleryItem) => void;
  generatedItems?: GalleryItem[];
  onItemAdded?: (addFn: (item: Omit<GalleryItem, 'id' | 'createdAt'>) => Promise<GalleryItem | null>) => void;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function GalleryGrid({ onSelectItem, generatedItems = [], onItemAdded }: GalleryGridProps) {
  const { user, loading: authLoading } = useAuth();
  const galleryUserId = authLoading ? undefined : (user?.id ?? null);

  const {
    items: dbItems,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore,
    loadMoreItems,
    filter,
    setFilter,
    sort,
    setSort,
    sourceFilter,
    setSourceFilter,
    addItem,
    toggleLike: dbToggleLike,
    deleteItem: dbDeleteItem,
    refresh,
  } = useGallery(galleryUserId);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [shareItem, setShareItem] = useState<GalleryItem | null>(null);
  const [editItem, setEditItem] = useState<GalleryItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<GalleryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevGeneratedCountRef = useRef(0);

  // addItem 함수를 부모에게 전달
  useEffect(() => {
    onItemAdded?.(addItem);
  }, [addItem, onItemAdded]);

  // 새 아이템 생성 시 → 맨 위로 스크롤 + NEW 배지
  useEffect(() => {
    if (generatedItems.length > prevGeneratedCountRef.current) {
      const addedItems = generatedItems.slice(0, generatedItems.length - prevGeneratedCountRef.current);
      const addedIds = new Set(addedItems.map((i) => i.id));
      setNewItemIds((prev) => new Set([...prev, ...addedIds]));
      setFilter('ALL');
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      setTimeout(() => {
        setNewItemIds((prev) => {
          const next = new Set(prev);
          addedIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 3000);
      prevGeneratedCountRef.current = generatedItems.length;
      setTimeout(() => refresh(), 500);
    }
  }, [generatedItems, setFilter, refresh]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleDownload = useCallback(async (item: GalleryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDownloadingId(item.id);
    const ext = item.type === 'video' ? 'mp4' : 'png';
    const filename = `gallery_${item.id}_${item.model.replace(/\s/g, '_')}.${ext}`;
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
    setTimeout(() => { setDownloadingId(null); showToast('다운로드가 시작되었습니다'); }, 600);
  }, [showToast]);

  const handleShare = useCallback((item: GalleryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShareItem(item);
  }, []);

  const toggleLike = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const item = dbItems.find((i) => i.id === id);
    if (item) dbToggleLike(id, item.liked);
  }, [dbItems, dbToggleLike]);

  const handleDeleteRequest = useCallback((item: GalleryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteConfirmItem(item);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmItem) return;
    const id = deleteConfirmItem.id;
    setDeletingId(id);
    setDeleteConfirmItem(null);
    if (detailItem?.id === id) setDetailItem(null);
    try {
      await dbDeleteItem(id);
      showToast('이미지가 삭제되었습니다');
    } catch {
      showToast('삭제에 실패했습니다');
    } finally {
      setDeletingId(null);
    }
  }, [deleteConfirmItem, dbDeleteItem, detailItem, showToast]);

  const handleItemClick = (item: GalleryItem) => {
    setDetailItem(item);
    onSelectItem?.(item);
  };

  const handleFilterChange = (f: FilterType) => {
    setFilter(f);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  };

  const handleSourceFilterChange = (s: GalleryItemSource | 'ALL') => {
    setSourceFilter(s);
    scrollContainerRef.current?.scrollTo({ top: 0 });
  };

  const sortLabels: Record<SortType, string> = { newest: '최신순', oldest: '오래된순', liked: '좋아요순' };
  const imageCount = dbItems.filter((i) => i.type === 'image').length;
  const videoCount = dbItems.filter((i) => i.type === 'video').length;
  const likedItems = new Set(dbItems.filter((i) => i.liked).map((i) => i.id));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <PageHeader
        icon="ri-image-line"
        title="내 갤러리"
        badgeColor="indigo"
        badge={String(totalCount)}
        actions={
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {/* Filter tabs */}
            <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800/60 rounded-lg p-0.5 flex-shrink-0">
              {(['ALL', 'IMAGE', 'VIDEO'] as FilterType[]).map((f) => (
                <button key={f} onClick={() => handleFilterChange(f)}
                  className={`px-1.5 md:px-2.5 py-1.5 text-[10px] md:text-xs font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${filter === f ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {f === 'ALL' ? `전체 ${totalCount}` : f === 'IMAGE' ? `이미지 ${imageCount}` : `영상 ${videoCount}`}
                </button>
              ))}
            </div>

            {/* Source filter */}
            <div className="relative flex-shrink-0">
              <button onClick={() => { setShowSourceMenu(!showSourceMenu); setShowSortMenu(false); }}
                className={`flex items-center gap-1 border text-xs font-medium px-2 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${sourceFilter !== 'ALL' ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300' : 'bg-zinc-900 border-zinc-800/60 text-zinc-400 hover:text-white'}`}
              >
                <i className={`text-xs ${SOURCE_OPTIONS.find((o) => o.value === sourceFilter)?.icon ?? 'ri-apps-line'}`} />
                <span className="hidden sm:inline">{sourceFilter === 'ALL' ? '출처' : SOURCE_OPTIONS.find((o) => o.value === sourceFilter)?.label}</span>
                <i className="ri-arrow-down-s-line text-xs" />
              </button>
              {showSourceMenu && (
                <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-700/60 rounded-xl overflow-hidden z-50 min-w-[160px]">
                  {SOURCE_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => { handleSourceFilterChange(opt.value); setShowSourceMenu(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer whitespace-nowrap ${sourceFilter === opt.value ? 'text-indigo-300 bg-indigo-500/15' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                    >
                      <i className={`${opt.icon} ${opt.color} text-sm`} />{opt.label}
                      {sourceFilter === opt.value && <i className="ri-check-line ml-auto text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <div className="relative flex-shrink-0">
              <button onClick={() => { setShowSortMenu(!showSortMenu); setShowSourceMenu(false); }}
                className="flex items-center gap-1 bg-zinc-900 border border-zinc-800/60 text-zinc-400 hover:text-white text-xs font-medium px-2 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-sort-desc text-xs" />
                <span className="hidden sm:inline">{sortLabels[sort]}</span>
                <i className="ri-arrow-down-s-line text-xs" />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-700/60 rounded-xl overflow-hidden z-50 min-w-[120px]">
                  {(Object.entries(sortLabels) as [SortType, string][]).map(([key, label]) => (
                    <button key={key} onClick={() => { setSort(key); setShowSortMenu(false); scrollContainerRef.current?.scrollTo({ top: 0 }); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer whitespace-nowrap ${sort === key ? 'text-indigo-300 bg-indigo-500/15' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Download all */}
            <button
              onClick={() => {
                const completed = dbItems.filter((i) => i.url);
                if (completed.length === 0) return;
                completed.forEach((item, idx) => {
                  setTimeout(async () => {
                    const ext = item.type === 'video' ? 'mp4' : 'png';
                    try {
                      const response = await fetch(item.url);
                      const blob = await response.blob();
                      const objectUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = objectUrl;
                      link.download = `gallery_${item.id}.${ext}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
                    } catch { window.open(item.url, '_blank', 'noopener,noreferrer'); }
                  }, idx * 400);
                });
                showToast(`${completed.length}개 이미지 다운로드 시작`);
              }}
              className="flex items-center gap-1 bg-zinc-900 border border-zinc-800/60 text-zinc-400 hover:text-white text-xs font-medium px-2 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <i className="ri-download-2-line text-xs" />
              <span className="hidden sm:inline">전체 다운로드</span>
            </button>

            {/* View mode toggle */}
            <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        }
      />

      {/* Scroll container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 md:p-6">
        {/* Error */}
        {error && (
          <EmptyState icon="ri-error-warning-line" title={error} theme="rose" size="md"
            actions={[{ label: '다시 시도', onClick: refresh, icon: 'ri-refresh-line' }]}
          />
        )}

        {/* Initial loading */}
        {!error && loading && (
          viewMode === 'grid' ? (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-2 md:gap-3 space-y-2 md:space-y-3">
              <GridSkeleton />
            </div>
          ) : (
            <div className="flex flex-col gap-2"><ListSkeleton /></div>
          )
        )}

        {/* Empty state */}
        {!error && !loading && dbItems.length === 0 && (
          <EmptyState icon="ri-image-line" title="아직 생성된 이미지가 없어요" description="생성 탭에서 이미지를 만들어보세요" size="md" />
        )}

        {/* Grid view */}
        {!loading && viewMode === 'grid' && dbItems.length > 0 && (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2 md:gap-3 space-y-2 md:space-y-3">
            {dbItems.map((item) => (
              <div key={item.id}
                className="break-inside-avoid relative group cursor-pointer rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800/60 hover:border-indigo-500/40 transition-all duration-200"
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleItemClick(item)}
              >
                {item.type === 'video' ? (
                  <div className="w-full aspect-video bg-zinc-900 flex items-center justify-center relative">
                    <ExpirableMedia type="video" src={item.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <i className="ri-play-fill text-white text-lg ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <ExpirableMedia type="image" src={item.url} alt={item.prompt} className="w-full object-cover" />
                )}

                {/* NEW badge */}
                {newItemIds.has(item.id) && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500/90 backdrop-blur-sm text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse z-10">
                    <i className="ri-sparkling-2-fill text-[9px]" />NEW
                  </div>
                )}

                {/* Video badge */}
                {item.type === 'video' && !newItemIds.has(item.id) && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <i className="ri-video-line text-indigo-400" />{item.duration}
                  </div>
                )}

                {/* Source badge */}
                {item.source && item.source !== 'ai-create' && !newItemIds.has(item.id) && (
                  <div className="absolute top-2 right-2 z-10">
                    {(() => {
                      const src = SOURCE_OPTIONS.find((o) => o.value === item.source);
                      return src ? (
                        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                          <i className={`${src.icon} ${src.color} text-[9px]`} />
                          <span className={`text-[8px] font-bold ${src.color} hidden sm:inline`}>{src.label}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Hover overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-200 ${hoveredId === item.id ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button onClick={(e) => toggleLike(item.id, e)}
                      className={`w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full backdrop-blur-sm transition-all cursor-pointer ${likedItems.has(item.id) ? 'bg-indigo-500/30 text-indigo-400' : 'bg-black/40 text-white hover:bg-black/60'}`}
                    >
                      <i className={likedItems.has(item.id) ? 'ri-heart-fill text-xs md:text-sm' : 'ri-heart-line text-xs md:text-sm'} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setEditItem(item); }}
                      className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-indigo-500/60 transition-all cursor-pointer"
                    >
                      <i className="ri-magic-line text-xs md:text-sm" />
                    </button>
                    <button onClick={(e) => handleDeleteRequest(item, e)}
                      className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-red-500/70 transition-all cursor-pointer"
                    >
                      {deletingId === item.id ? <i className="ri-loader-4-line text-xs md:text-sm animate-spin" /> : <i className="ri-delete-bin-line text-xs md:text-sm" />}
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
                    <p className="text-white text-[10px] md:text-xs font-medium line-clamp-2 mb-1.5 md:mb-2 leading-relaxed">{item.prompt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] md:text-[10px] text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded-full font-medium hidden sm:inline">{item.model}</span>
                        <span className="text-[9px] md:text-[10px] text-zinc-400">{item.ratio}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => handleDownload(item, e)}
                          className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                        >
                          {downloadingId === item.id ? <i className="ri-loader-4-line text-[10px] animate-spin" /> : <i className="ri-download-2-line text-[10px]" />}
                        </button>
                        <button onClick={(e) => handleShare(item, e)}
                          className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                        >
                          <i className="ri-share-line text-[10px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List view */}
        {!loading && viewMode === 'list' && dbItems.length > 0 && (
          <div className="flex flex-col gap-2">
            {dbItems.map((item) => (
              <div key={item.id} onClick={() => handleItemClick(item)}
                className={`flex items-center gap-3 md:gap-4 border rounded-xl p-2.5 md:p-3 cursor-pointer group transition-all ${newItemIds.has(item.id) ? 'bg-emerald-500/5 border-emerald-500/25 hover:border-emerald-500/40' : 'bg-zinc-900/60 border-white/5 hover:border-indigo-500/20'}`}
              >
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800 relative">
                  {item.type === 'video' ? (
                    <>
                      <ExpirableMedia type="video" src={item.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <i className="ri-play-fill text-white text-sm" />
                      </div>
                    </>
                  ) : (
                    <ExpirableMedia type="image" src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                  )}
                  {newItemIds.has(item.id) && (
                    <div className="absolute inset-0 flex items-end justify-center pb-1">
                      <span className="text-[8px] font-black bg-emerald-500/90 text-white px-1.5 py-0.5 rounded-full">NEW</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {newItemIds.has(item.id) && (
                      <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap">
                        <i className="ri-sparkling-2-fill text-[8px]" />NEW
                      </span>
                    )}
                    {item.type === 'video' && (
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap flex-shrink-0">
                        <i className="ri-video-line text-[8px]" />VIDEO
                      </span>
                    )}
                    <p className="text-xs md:text-sm text-zinc-200 font-medium truncate">{item.prompt}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] md:text-[10px] text-indigo-400 bg-indigo-500/20 px-1.5 py-0.5 rounded-full font-medium">{item.model}</span>
                    <span className="text-[9px] md:text-[10px] text-zinc-500">{item.ratio}</span>
                    {item.source && item.source !== 'ai-create' && (() => {
                      const src = SOURCE_OPTIONS.find((o) => o.value === item.source);
                      return src ? (
                        <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 ${src.color} flex items-center gap-0.5 whitespace-nowrap`}>
                          <i className={`${src.icon} text-[8px]`} />{src.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => toggleLike(item.id, e)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${likedItems.has(item.id) ? 'text-indigo-400 bg-indigo-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-700'}`}
                  >
                    <i className={likedItems.has(item.id) ? 'ri-heart-fill text-sm' : 'ri-heart-line text-sm'} />
                  </button>
                  <button onClick={(e) => handleDownload(item, e)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700 transition-all cursor-pointer"
                  >
                    {downloadingId === item.id ? <i className="ri-loader-4-line text-sm animate-spin" /> : <i className="ri-download-2-line text-sm" />}
                  </button>
                  <button onClick={(e) => handleDeleteRequest(item, e)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    {deletingId === item.id ? <i className="ri-loader-4-line text-sm animate-spin" /> : <i className="ri-delete-bin-line text-sm" />}
                  </button>
                </div>
                <span className="text-[10px] text-zinc-600 flex-shrink-0 hidden sm:block">
                  {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── 무한 스크롤 센티넬 ── */}
        <LoadMoreSentinel
          onVisible={loadMoreItems}
          loadingMore={loadingMore}
          hasMore={hasMore}
        />

        {/* 모두 로드됨 표시 */}
        {!loading && !hasMore && dbItems.length > 0 && (
          <div className="flex items-center justify-center py-6 gap-3">
            <div className="h-px flex-1 bg-zinc-800/60" />
            <span className="text-[10px] text-zinc-600 whitespace-nowrap">
              총 {totalCount}개 · 모두 불러왔어요
            </span>
            <div className="h-px flex-1 bg-zinc-800/60" />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {shareItem && <ShareModal item={shareItem} onClose={() => setShareItem(null)} />}
      {editItem && <ImageEditModal item={editItem} onClose={() => setEditItem(null)} />}

      {detailItem && (
        <ImageDetailModal
          item={detailItem}
          items={dbItems}
          likedIds={likedItems}
          downloadingId={downloadingId}
          onClose={() => setDetailItem(null)}
          onNavigate={(item) => setDetailItem(item)}
          onDownload={handleDownload}
          onToggleLike={toggleLike}
          onShare={(item) => { setShareItem(item); setDetailItem(null); }}
          onEdit={(item) => { setEditItem(item); setDetailItem(null); }}
          onDelete={(item) => { handleDeleteRequest(item); setDetailItem(null); }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onClick={() => setDeleteConfirmItem(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[340px] bg-[#111114] border border-white/10 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-full h-28 rounded-xl overflow-hidden mb-4 bg-zinc-900">
              <img src={deleteConfirmItem.url} alt="delete preview" className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-delete-bin-line text-red-400 text-base" />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-1">이미지를 삭제할까요?</p>
                <p className="text-xs text-zinc-500 leading-relaxed">삭제하면 Supabase DB에서도 영구적으로 제거됩니다.<br />이 작업은 되돌릴 수 없어요.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 bg-red-500/90 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
              >
                <i className="ri-delete-bin-line" />삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-500/90 backdrop-blur-sm text-white text-sm font-bold rounded-xl shadow-lg whitespace-nowrap">
          <i className="ri-checkbox-circle-fill text-base" />
          {toast}
        </div>
      )}
    </div>
  );
}
