import { useState, useRef, useEffect, useCallback } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { pollFalVideoResult } from '@/pages/ai-ad/utils/falPolling';
import VideoPlayer from './VideoPlayer';
import NarrationTimeline from './NarrationTimeline';
import ImageTimeline from './ImageTimeline';
import { VoiceData } from '../page';
import SfxPickerModal from '@/components/feature/SfxPickerModal';
import { useSfxStore, useSfxStoreListener, SfxItem } from '@/hooks/useSfxStore';
import { supabase } from '@/lib/supabase';
import { Step4ImageData } from './Step4Image';
import {
  initialCuts,
  libraryVideos,
  durationColor,
  parseVideoError,
  type VideoCut,
} from './step5-video-data';

export type { VideoCut };

type ModalType = 'library' | 'share' | null;

interface Step5VideoProps {
  onNext: (hasVideo: boolean, cuts?: VideoCut[]) => void;
  onBack: () => void;
  voiceData?: VoiceData | null;
  initialCuts?: VideoCut[];
  step4Images?: Step4ImageData[];
}

export default function Step5Video({ onNext, onBack, voiceData, initialCuts: initialCutsProp, step4Images = [] }: Step5VideoProps) {
  const { user } = useAuth();
  const [cuts, setCuts] = useState<VideoCut[]>(initialCutsProp ?? initialCuts);

  // initialCutsProp이 외부에서 변경될 때 state 재초기화 (편집 프로젝트 전환 시)
  // undefined → 기본값, 빈 배열 → 기본값, 데이터 있음 → 해당 데이터로 초기화
  useEffect(() => {
    if (initialCutsProp !== undefined) {
      setCuts(initialCutsProp.length > 0 ? initialCutsProp : initialCuts);
    }
  }, [initialCutsProp]);

  // ── Step4 이미지가 업데이트되면 cuts의 thumb 자동 동기화 ──────────────
  useEffect(() => {
    if (step4Images.length === 0) return;
    setCuts((prev) => prev.map((cut) => {
      const s4 = step4Images.find((img) => img.id === cut.id);
      if (s4?.image && s4.image !== cut.thumb) {
        return { ...cut, thumb: s4.image };
      }
      return cut;
    }));
  }, [step4Images]);
  const [selectedCut, setSelectedCut] = useState(1);
  const [timelineActiveCutId, setTimelineActiveCutId] = useState<number | null>(null);
  const [videoModel, setVideoModel] = useState('kling-v1');
  const [videoMode, setVideoMode] = useState<'std' | 'pro'>('std');
  const [videoDuration, setVideoDuration] = useState<5 | 10>(5);
  const [modelOpen, setModelOpen] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generateAllProgress, setGenerateAllProgress] = useState(0);
  const [generateAllDoneCount, setGenerateAllDoneCount] = useState(0);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<{ message: string; isInsufficientCredits: boolean; required?: number; available?: number } | null>(null);
  const videoNotifIdRef = useRef<string | null>(null);
  const { sendGenerationInProgress, completeGenerationNotif, failGenerationNotif } = useNotifications();
  const [fullscreenCutId, setFullscreenCutId] = useState<number | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [showMobileCutList, setShowMobileCutList] = useState(false);
  const [showImageTimeline, setShowImageTimeline] = useState(true);

  // ── 배경음 상태 ──────────────────────────────────────────────────────
  const { items: sfxItems, addBlobSfx, updateStorageUrl } = useSfxStore();
  const [selectedBgm, setSelectedBgm] = useState<SfxItem | null>(null);
  const [showSfxPicker, setShowSfxPicker] = useState(false);
  const [showBgmPanel, setShowBgmPanel] = useState(false);
  const [bgmTab, setBgmTab] = useState<'all' | 'sfx' | 'music'>('all');
  const [bgmVolume, setBgmVolume] = useState(0.25);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmPanelRef = useRef<HTMLDivElement>(null);

  // Share state
  const [shareLink] = useState('https://studio.ai/share/v/abc123xyz');
  const [shareCopied, setShareCopied] = useState(false);
  const [shareTab, setShareTab] = useState<'link' | 'embed' | 'export'>('link');
  const [libraryTab, setLibraryTab] = useState<'stock' | 'ai' | 'upload'>('stock');
  const [privacyMode, setPrivacyMode] = useState<'public' | 'unlisted' | 'private'>('public');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<string | null>(null);
  const [exportDownloading, setExportDownloading] = useState(false);

  useSfxStoreListener(useCallback((sfx) => { addBlobSfx(sfx); }, [addBlobSfx]));

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, storageUrl } = (e as CustomEvent<{ id: string; storageUrl: string }>).detail;
      updateStorageUrl(id, storageUrl);
      setSelectedBgm((prev) => {
        if (prev && prev.id === id) return { ...prev, storageUrl, audioUrl: storageUrl };
        return prev;
      });
    };
    window.addEventListener('sfx:storage-updated', handler);
    return () => window.removeEventListener('sfx:storage-updated', handler);
  }, [updateStorageUrl]);

  useEffect(() => {
    if (!showBgmPanel) return;
    const handler = (e: MouseEvent) => {
      if (bgmPanelRef.current && !bgmPanelRef.current.contains(e.target as Node)) {
        setShowBgmPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBgmPanel]);

  const toggleBgm = useCallback(() => {
    if (!selectedBgm) return;
    if (bgmPlaying) {
      bgmAudioRef.current?.pause();
      setBgmPlaying(false);
    } else {
      if (!bgmAudioRef.current) {
        bgmAudioRef.current = new Audio(selectedBgm.audioUrl);
        bgmAudioRef.current.loop = true;
        bgmAudioRef.current.volume = bgmVolume;
      }
      bgmAudioRef.current.play().catch(() => {});
      setBgmPlaying(true);
    }
  }, [selectedBgm, bgmPlaying, bgmVolume]);

  useEffect(() => { if (bgmAudioRef.current) bgmAudioRef.current.volume = bgmVolume; }, [bgmVolume]);
  useEffect(() => {
    bgmAudioRef.current?.pause();
    bgmAudioRef.current = null;
    setBgmPlaying(false);
  }, [selectedBgm]);
  useEffect(() => () => { bgmAudioRef.current?.pause(); }, []);

  const current = cuts.find((c) => c.id === selectedCut)!;
  const displayCut = timelineActiveCutId !== null
    ? (cuts.find((c) => c.id === timelineActiveCutId) ?? current)
    : current;
  const videoCount = cuts.filter((c) => c.hasVideo).length;

  const getThumb = (cutId: number, fallback: string) => {
    const s4 = step4Images.find((i) => i.id === cutId);
    return s4?.image ?? fallback;
  };
  const step4ImageCount = step4Images.filter((i) => i.image).length;

  // 현재 컷에 Step4 이미지가 있는지 확인
  const currentS4 = step4Images.find((i) => i.id === selectedCut);
  const hasStep4Image = Boolean(currentS4?.image);

  const handlePromptChange = (val: string) => {
    setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, videoPrompt: val } : c));
  };

  // ── 단일 컷 영상 생성 (fal.ai Kling) ─────────────────────────────────
  const handleGenerateCut = useCallback(async (id: number) => {
    const cut = cuts.find((c) => c.id === id);
    if (!cut) return;

    setGeneratingId(id);
    setGenerateError(null);

    videoNotifIdRef.current = null;
    sendGenerationInProgress({
      generation_type: 'video',
      model_name: `Kling ${videoModel.replace('kling-', '')}`,
    }).then((nid) => { videoNotifIdRef.current = nid; });

    const s4 = step4Images.find((img) => img.id === id);
    const basePrompt = cut.videoPrompt.trim() || `cinematic video scene: ${cut.text.replace(/\n/g, ' ')}`;
    const finalPrompt = s4?.prompt
      ? `${basePrompt}, visual style reference: ${s4.prompt.slice(0, 100)}`
      : basePrompt;

    // Step4 이미지가 있으면 image-to-video 모드로 전환
    const imageUrl = s4?.image ?? null;

    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: finalPrompt,
          ratio: '16:9',
          duration: videoDuration,
          model: videoModel,
          mode: videoMode,
          user_id: user?.id ?? undefined,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      });

      if (error) {
        const detail = data?.error || data?.detail || error.message;
        throw new Error(detail);
      }

      // generate-video 가 큐로 빠지면 pending 응답을 돌려줘요. 이전엔 성공/실패
      // 두 분기로만 처리해서 큐 응답이 항상 실패로 떨어졌어요. Step4Image 가
      // PR #40 에서 같은 패턴으로 고친 건데 Step5Video 가 빠져 있었어요.
      let finalVideoUrl: string | null = null;
      if (data?.success && data?.videoUrl) {
        finalVideoUrl = data.videoUrl as string;
      } else if (data?.pending && data?.request_id) {
        finalVideoUrl = await pollFalVideoResult(
          data.model as string,
          data.request_id as string,
          data.status_url as string | undefined,
          data.response_url as string | undefined,
          data.save_opts as Record<string, unknown> | undefined,
        );
      }
      if (!finalVideoUrl) {
        throw new Error(data?.error || '영상 생성에 실패했습니다.');
      }

      setCuts((prev) => prev.map((c) =>
        c.id === id
          ? { ...c, thumb: s4?.image ?? c.thumb, hasVideo: true, videoUrl: finalVideoUrl }
          : c
      ));
      completeGenerationNotif({
        generation_type: 'video',
        model_name: `Kling ${videoModel.replace('kling-', '')}`,
        action_url: '/youtube-studio',
        notification_id: videoNotifIdRef.current,
      });
      videoNotifIdRef.current = null;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const parsed = parseVideoError(raw);
      setGenerateError(parsed);
      setTimeout(() => setGenerateError(null), 10000);
      failGenerationNotif({
        generation_type: 'video',
        model_name: `Kling ${videoModel.replace('kling-', '')}`,
        error_message: parsed.message,
        notification_id: videoNotifIdRef.current,
      });
      videoNotifIdRef.current = null;
    } finally {
      setGeneratingId(null);
    }
  }, [cuts, step4Images, videoModel, videoMode, videoDuration, user, sendGenerationInProgress, completeGenerationNotif, failGenerationNotif]);

  // ── 전체 컷 순차 생성 ─────────────────────────────────────────────────
  const handleGenerateAll = useCallback(async () => {
    setIsGeneratingAll(true);
    setGenerateError(null);
    setGenerateAllProgress(0);
    setGenerateAllDoneCount(0);

    let allGenNotifId: string | null = null;
    sendGenerationInProgress({
      generation_type: 'video',
      model_name: `Kling ${videoModel.replace('kling-', '')} (전체 ${cuts.length}컷)`,
    }).then((nid) => { allGenNotifId = nid; });

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      setGeneratingId(cut.id);

      const s4 = step4Images.find((img) => img.id === cut.id);
      const basePrompt = cut.videoPrompt.trim() || `cinematic video scene: ${cut.text.replace(/\n/g, ' ')}`;
      const finalPrompt = s4?.prompt
        ? `${basePrompt}, visual style reference: ${s4.prompt.slice(0, 100)}`
        : basePrompt;

      // Step4 이미지가 있으면 image-to-video 모드로 전환
      const imageUrl = s4?.image ?? null;

      try {
        const { data, error } = await supabase.functions.invoke('generate-video', {
          body: {
            prompt: finalPrompt,
            ratio: '16:9',
            duration: videoDuration,
            model: videoModel,
            mode: videoMode,
            user_id: user?.id ?? undefined,
            ...(imageUrl ? { image_url: imageUrl } : {}),
          },
        });

        if (error) {
          const detail = data?.error || data?.detail || error.message;
          throw new Error(detail);
        }

        let bulkVideoUrl: string | null = null;
        if (data?.success && data?.videoUrl) {
          bulkVideoUrl = data.videoUrl as string;
        } else if (data?.pending && data?.request_id) {
          bulkVideoUrl = await pollFalVideoResult(
            data.model as string,
            data.request_id as string,
            data.status_url as string | undefined,
            data.response_url as string | undefined,
            data.save_opts as Record<string, unknown> | undefined,
          );
        }
        if (bulkVideoUrl) {
          setCuts((prev) => prev.map((c) =>
            c.id === cut.id
              ? { ...c, thumb: s4?.image ?? c.thumb, hasVideo: true, videoUrl: bulkVideoUrl }
              : c
          ));
        } else if (data?.error) {
          throw new Error(data.error);
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const parsed = parseVideoError(raw);
        // 크레딧 부족 또는 API 키 오류 → 즉시 중단
        if (parsed.isInsufficientCredits || raw.includes('FAL_KEY') || raw.includes('401') || raw.includes('Unauthorized')) {
          setGenerateError(parsed);
          setGeneratingId(null);
          setIsGeneratingAll(false);
          failGenerationNotif({
            generation_type: 'video',
            model_name: `Kling ${videoModel.replace('kling-', '')} (전체)`,
            error_message: parsed.message,
            notification_id: allGenNotifId,
          });
          return;
        }
        console.error(`Cut ${cut.id} 영상 생성 실패:`, raw);
        setGenerateError({ message: `Cut ${cut.id}: ${parsed.message}`, isInsufficientCredits: false });
        setTimeout(() => setGenerateError(null), 6000);
      } finally {
        setGeneratingId(null);
        const doneCount = i + 1;
        setGenerateAllDoneCount(doneCount);
        setGenerateAllProgress(Math.round((doneCount / cuts.length) * 100));
      }
    }

    completeGenerationNotif({
      generation_type: 'video',
      model_name: `Kling ${videoModel.replace('kling-', '')} (${cuts.length}컷)`,
      action_url: '/youtube-studio',
      notification_id: allGenNotifId,
    });

    setIsGeneratingAll(false);
  }, [cuts, step4Images, videoModel, videoMode, videoDuration, user, sendGenerationInProgress, completeGenerationNotif, failGenerationNotif]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).catch(() => {});
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const fullscreenCut = fullscreenCutId !== null ? cuts.find((c) => c.id === fullscreenCutId) : null;

  const creditCostPerCut = ({ 'kling-v1': 50, 'kling-v1-5': 80, 'kling-v2': 100 } as Record<string, number>)[videoModel] ?? 50;

  return (
    <div className="flex flex-col h-full" onClick={() => setModelOpen(false)}>

      {/* ── Fullscreen Player Modal ── */}
      {fullscreenCut && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3 bg-black/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-zinc-400 text-xs font-semibold">Cut {fullscreenCut.id}</span>
              <span className="text-zinc-600 text-xs">|</span>
              <span className="text-zinc-400 text-xs line-clamp-1 max-w-[200px] md:max-w-[400px]">
                {fullscreenCut.text.split('\n')[0]}
              </span>
            </div>
            <button
              onClick={() => setFullscreenCutId(null)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <VideoPlayer
              posterSrc={fullscreenCut.thumb}
              cutId={fullscreenCut.id}
              isFullscreenModal={true}
              onClose={() => setFullscreenCutId(null)}
            />
          </div>
          <div className="flex-shrink-0 px-4 md:px-8 py-4 bg-black/80">
            <p className="text-white/80 text-sm text-center leading-relaxed whitespace-pre-line">{fullscreenCut.text}</p>
          </div>
        </div>
      )}

      {/* ── Library Modal ── */}
      {activeModal === 'library' && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-zinc-900/60 border border-white/5 rounded-2xl overflow-hidden w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">영상 라이브러리</p>
                <p className="text-zinc-500 text-xs mt-0.5">Cut {selectedCut}에 적용할 영상 클립을 선택하세요</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-4 md:p-5">
              <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 rounded-xl p-1 mb-4 w-fit">
                {([
                  { id: 'stock' as const, label: '스톡 영상' },
                  { id: 'ai' as const, label: 'AI 생성' },
                  { id: 'upload' as const, label: '내 업로드' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLibraryTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${libraryTab === tab.id ? 'bg-indigo-500/20 border border-indigo-500/25 text-white' : 'text-zinc-400 hover:text-white'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 bg-zinc-800 border border-white/5 rounded-xl px-3 py-2 mb-4">
                <i className="ri-search-line text-zinc-500 text-sm" />
                <input
                  type="text"
                  placeholder="영상 검색..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto">
                {libraryVideos.map((vid) => (
                  <button
                    key={vid.id}
                    onClick={() => {
                      setCuts((prev) => prev.map((c) =>
                        c.id === selectedCut
                          ? { ...c, thumb: vid.url.replace('160', '640').replace('90', '360'), hasVideo: true }
                          : c
                      ));
                      setActiveModal(null);
                    }}
                    className="relative rounded-xl overflow-hidden cursor-pointer group ring-1 ring-white/5 hover:ring-indigo-500 transition-all"
                  >
                    <img src={vid.url} alt={vid.label} className="w-full h-[60px] object-cover object-top" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="ri-play-fill text-white text-xs ml-px" />
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center">
                        <i className="ri-add-line text-white text-sm" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pb-1.5 pt-4 px-1.5">
                      <p className="text-[9px] text-white font-semibold truncate">{vid.label}</p>
                    </div>
                    <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[8px] font-bold px-1 py-0.5 rounded">5s</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 md:px-5 pb-5">
              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Modal ── */}
      {activeModal === 'share' && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-zinc-900/60 border border-white/5 rounded-2xl overflow-hidden w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">공유하기</p>
                <p className="text-zinc-500 text-xs mt-0.5">영상을 공유하거나 내보내세요</p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex items-center gap-1 mx-5 md:mx-6 mt-4 bg-zinc-900/60 border border-white/5 rounded-xl p-1">
              {[
                { id: 'link' as const, label: '링크 공유', icon: 'ri-link-m' },
                { id: 'embed' as const, label: '임베드', icon: 'ri-code-line' },
                { id: 'export' as const, label: '내보내기', icon: 'ri-download-line' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setShareTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                    shareTab === t.id ? 'bg-indigo-500/20 border border-indigo-500/25 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <i className={`${t.icon} text-xs`} />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-5 md:p-6 space-y-4">
              {shareTab === 'link' && (
                <>
                  <div className="relative rounded-xl overflow-hidden">
                    <img src={current.thumb} alt="preview" className="w-full h-[140px] object-cover object-top" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                        <i className="ri-play-fill text-white text-xl ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-3">
                      <p className="text-white text-xs font-semibold">AI 기술 해설 영상</p>
                      <p className="text-zinc-400 text-[10px]">0:38 · {videoCount}/{cuts.length} 컷 생성됨</p>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="flex items-center gap-3 bg-zinc-800/60 rounded-xl p-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${privacyMode === 'public' ? 'bg-emerald-500/15' : privacyMode === 'unlisted' ? 'bg-amber-500/15' : 'bg-zinc-700'}`}>
                        <i className={`text-sm ${privacyMode === 'public' ? 'ri-global-line text-emerald-400' : privacyMode === 'unlisted' ? 'ri-link-m text-amber-400' : 'ri-lock-line text-zinc-400'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-xs font-semibold">{privacyMode === 'public' ? '공개 링크' : privacyMode === 'unlisted' ? '링크 공유만' : '비공개'}</p>
                        <p className="text-zinc-500 text-[10px]">{privacyMode === 'public' ? '링크가 있는 누구나 볼 수 있습니다' : privacyMode === 'unlisted' ? '링크를 아는 사람만 볼 수 있습니다' : '본인만 볼 수 있습니다'}</p>
                      </div>
                      <button onClick={() => setShowPrivacyMenu((v) => !v)} className="text-[10px] text-zinc-400 hover:text-white cursor-pointer whitespace-nowrap">변경</button>
                    </div>
                    {showPrivacyMenu && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded-xl overflow-hidden z-20">
                        {([
                          { id: 'public' as const, label: '공개', icon: 'ri-global-line', desc: '누구나 볼 수 있음' },
                          { id: 'unlisted' as const, label: '링크 공유만', icon: 'ri-link-m', desc: '링크를 아는 사람만' },
                          { id: 'private' as const, label: '비공개', icon: 'ri-lock-line', desc: '본인만 볼 수 있음' },
                        ] as const).map((opt) => (
                          <button key={opt.id} onClick={() => { setPrivacyMode(opt.id); setShowPrivacyMenu(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs cursor-pointer transition-colors ${privacyMode === opt.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                            <i className={`${opt.icon} text-sm`} />
                            <div className="text-left">
                              <p className="font-semibold">{opt.label}</p>
                              <p className="text-[10px] text-zinc-500">{opt.desc}</p>
                            </div>
                            {privacyMode === opt.id && <i className="ri-check-line ml-auto text-indigo-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-800 border border-white/5 rounded-xl px-3 py-2.5">
                    <i className="ri-link-m text-zinc-500 text-sm flex-shrink-0" />
                    <span className="flex-1 text-xs text-zinc-300 truncate font-mono">{shareLink}</span>
                    <button
                      onClick={handleCopyLink}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                        shareCopied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500 hover:bg-indigo-400 text-white'
                      }`}
                    >
                      {shareCopied ? <><i className="ri-check-line text-xs" /> 복사됨</> : <><i className="ri-file-copy-line text-xs" /> 복사</>}
                    </button>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-2.5">소셜 미디어에 공유</p>
                    <div className="flex items-center gap-2">
                      {[
                        { icon: 'ri-youtube-line', label: 'YouTube', color: 'hover:bg-red-500/20 hover:text-red-400', url: 'https://www.youtube.com/upload' },
                        { icon: 'ri-twitter-x-line', label: 'X', color: 'hover:bg-zinc-600/50 hover:text-white', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}` },
                        { icon: 'ri-instagram-line', label: 'Instagram', color: 'hover:bg-pink-500/20 hover:text-pink-400', url: 'https://www.instagram.com/' },
                        { icon: 'ri-facebook-circle-line', label: 'Facebook', color: 'hover:bg-sky-500/20 hover:text-sky-400', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}` },
                      ].map((s) => (
                        <a key={s.label} href={s.url} target="_blank" rel="nofollow noreferrer"
                          className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl bg-zinc-800 border border-white/5 text-zinc-400 cursor-pointer transition-all ${s.color}`}>
                          <i className={`${s.icon} text-base`} />
                          <span className="text-[9px] font-semibold">{s.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {shareTab === 'embed' && (
                <>
                  <div className="bg-zinc-800 rounded-xl p-3">
                    <p className="text-[10px] text-zinc-500 mb-2 font-semibold">임베드 코드</p>
                    <pre className="text-[10px] text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-all">
{`<iframe
  src="${shareLink}/embed"
  width="640" height="360"
  frameborder="0"
  allowfullscreen>
</iframe>`}
                    </pre>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(`<iframe src="${shareLink}/embed" width="640" height="360" frameborder="0" allowfullscreen></iframe>`).catch(() => {}); }}
                    className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <i className="ri-file-copy-line" /> 코드 복사
                  </button>
                </>
              )}
              {shareTab === 'export' && (
                <>
                  <div className="space-y-2">
                    {[
                      { format: 'MP4', quality: '1080p', size: '~45MB', icon: 'ri-film-line', color: 'text-indigo-400' },
                      { format: 'MP4', quality: '720p', size: '~22MB', icon: 'ri-film-line', color: 'text-emerald-400' },
                      { format: 'GIF', quality: '480p', size: '~8MB', icon: 'ri-image-2-line', color: 'text-amber-400' },
                      { format: 'WebM', quality: '1080p', size: '~30MB', icon: 'ri-video-line', color: 'text-violet-400' },
                    ].map((fmt) => {
                      const key = `${fmt.format}-${fmt.quality}`;
                      const isSelected = selectedExportFormat === key;
                      return (
                        <button key={key} onClick={() => {
                          setSelectedExportFormat(key);
                          setExportDownloading(true);
                          setTimeout(() => {
                            const blob = new Blob([`DEMO ${fmt.format} ${fmt.quality} export`], { type: 'video/mp4' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `ai_video_${fmt.quality}.${fmt.format.toLowerCase()}`;
                            a.click(); URL.revokeObjectURL(url);
                            setExportDownloading(false);
                          }, 1200);
                        }}
                          className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-all group ${isSelected ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-zinc-800 hover:bg-zinc-700 border-white/5 hover:border-white/10'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-500/20' : 'bg-zinc-700 group-hover:bg-zinc-600'}`}>
                            {exportDownloading && isSelected ? <i className="ri-loader-4-line animate-spin text-indigo-400 text-sm" /> : <i className={`${fmt.icon} ${fmt.color} text-sm`} />}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-white text-xs font-semibold">{fmt.format} · {fmt.quality}</p>
                            <p className="text-zinc-500 text-[10px]">예상 크기: {fmt.size}</p>
                          </div>
                          <i className={`${exportDownloading && isSelected ? 'ri-loader-4-line animate-spin text-indigo-400' : 'ri-download-line text-zinc-500 group-hover:text-white'} text-sm transition-colors`} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5">
                    <i className="ri-information-line text-amber-400 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      {videoCount < cuts.length ? `${cuts.length - videoCount}개 컷이 아직 생성되지 않았습니다.` : '모든 컷이 생성되었습니다. 내보내기 준비 완료!'}
                    </p>
                  </div>
                </>
              )}
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
              <span className="text-sm font-bold text-white">컷 목록 ({videoCount}/{cuts.length})</span>
              <button onClick={() => setShowMobileCutList(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cuts.map((cut) => {
                const dur = (cut.end - cut.start).toFixed(1);
                const isSelected = selectedCut === cut.id;
                const isGen = generatingId === cut.id;
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
                      <span className="text-[9px] text-zinc-600">{cut.start.toFixed(1)}s – {cut.end.toFixed(1)}s</span>
                      <span className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full ml-auto ${durationColor(Number(dur))}`}>{dur}s</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-[60px] h-[38px] flex-shrink-0 rounded-lg overflow-hidden">
                        <img src={cut.thumb} alt="" className="w-full h-full object-cover object-top" />
                        {cut.hasVideo && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <i className="ri-play-fill text-white text-xs" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2 flex-1">{cut.text}</p>
                      {cut.hasVideo && (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <i className="ri-check-line text-emerald-400 text-[8px]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top toolbar */}
      <div className="flex-shrink-0 border-b border-white/5 bg-[#0f0f11] px-2 md:px-6 py-2 md:py-3 flex items-center gap-1.5 md:gap-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setShowMobileCutList(true)}
          className="md:hidden flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-2.5 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-film-line text-xs" />
          컷 {selectedCut}/{cuts.length}
          {videoCount > 0 && <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">{videoCount}생성</span>}
        </button>

        {/* Model selector */}
        <div className="relative hidden md:block flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setModelOpen(!modelOpen)}
            className="flex items-center gap-2 bg-zinc-800 border border-white/10 hover:border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap"
          >
            <i className="ri-film-line text-indigo-400 text-xs" />
            {videoModel === 'kling-v1' ? 'Kling v1' : videoModel === 'kling-v1-5' ? 'Kling v1.5' : 'Kling v2'}
            <span className="text-[9px] text-zinc-500 bg-zinc-700 px-1.5 py-0.5 rounded-full">{videoMode.toUpperCase()}</span>
            <i className={`ri-arrow-down-s-line text-zinc-500 text-xs transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelOpen && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden min-w-[240px]">
              <div className="px-3 py-2 border-b border-white/5">
                <p className="text-[10px] text-zinc-500 font-semibold">fal.ai Kling 모델</p>
              </div>
              {[
                { id: 'kling-v1', label: 'Kling v1', desc: '빠른 생성 · 표준 품질', credits: 50 },
                { id: 'kling-v1-5', label: 'Kling v1.5', desc: '균형 잡힌 품질', credits: 80 },
                { id: 'kling-v2', label: 'Kling v2', desc: '최고 품질 · 느린 생성', credits: 100 },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setVideoModel(m.id); setModelOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${videoModel === m.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}
                >
                  <i className="ri-film-line text-xs flex-shrink-0" />
                  <div className="text-left flex-1">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-[10px] text-zinc-500">{m.desc}</div>
                  </div>
                  <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{m.credits} CR/컷</span>
                  {videoModel === m.id && <i className="ri-check-line text-indigo-400" />}
                </button>
              ))}
              <div className="px-3 py-2 border-t border-white/5 flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">모드:</span>
                {(['std', 'pro'] as const).map((m) => (
                  <button key={m} onClick={() => setVideoMode(m)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap ${videoMode === m ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {m.toUpperCase()}
                  </button>
                ))}
                <div className="w-px h-3 bg-zinc-700 mx-1" />
                <span className="text-[10px] text-zinc-500">길이:</span>
                {([5, 10] as const).map((d) => (
                  <button key={d} onClick={() => setVideoDuration(d)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap ${videoDuration === d ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-400 text-xs px-3 py-2 rounded-lg flex-shrink-0">
          <i className="ri-aspect-ratio-line text-xs" />
          16:9 · {videoDuration}s
        </div>

        {!isGeneratingAll && (
          <div className="hidden md:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0">
            <i className="ri-coin-line text-xs" />
            {creditCostPerCut * cuts.length} CR
            <span className="text-[9px] text-amber-400/70 font-normal">({creditCostPerCut}/컷)</span>
          </div>
        )}

        <div className="flex-1 min-w-0" />

        {step4Images.length > 0 && (
          <>
            {/* Step4 이미지 연동 현황 배지 */}
            <div className="hidden md:flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0">
              <i className="ri-image-line text-xs" />
              이미지 {step4ImageCount}개 연동
              <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-500/20">img2video</span>
            </div>
            <button
              onClick={() => setShowImageTimeline((v) => !v)}
              className={`hidden md:flex items-center gap-1.5 border text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${
                showImageTimeline
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-zinc-800 border-white/10 text-zinc-300 hover:border-white/20'
              }`}
            >
              <i className="ri-film-line text-xs" />
              이미지 타임라인
              {showImageTimeline && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-500/20">ON</span>}
            </button>
          </>
        )}

        <button
          onClick={() => setActiveModal('library')}
          className="hidden md:flex items-center gap-1.5 bg-zinc-800 border border-white/10 hover:border-white/20 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-folder-video-line text-xs" />
          라이브러리
        </button>

        {/* 배경음 버튼 */}
        <div className="relative flex-shrink-0" ref={bgmPanelRef}>
          <button
            onClick={() => setShowBgmPanel((v) => !v)}
            className={`flex items-center gap-1 md:gap-1.5 border text-xs font-semibold px-2 md:px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
              selectedBgm
                ? selectedBgm.type === 'music'
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : showBgmPanel
                ? 'bg-zinc-700 border-white/20 text-white'
                : 'bg-zinc-800 border-white/10 hover:border-emerald-500/30 hover:text-emerald-300 text-zinc-300'
            }`}
          >
            <i className={`${bgmPlaying ? 'ri-music-2-line' : 'ri-music-line'} text-xs`} />
            <span className="hidden sm:inline">{selectedBgm ? '배경음 ON' : '배경음'}</span>
            {selectedBgm && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleBgm(); }}
                className={`ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:opacity-80 transition-all ${selectedBgm.type === 'music' ? 'bg-indigo-500/30' : 'bg-emerald-500/30'}`}
              >
                <i className={`${bgmPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-[8px] ${selectedBgm.type === 'music' ? 'text-indigo-300' : 'text-emerald-300'}`} />
              </button>
            )}
            <i className={`ri-arrow-down-s-line text-[10px] transition-transform ${showBgmPanel ? 'rotate-180' : ''}`} />
          </button>

          {showBgmPanel && (
            <div className="absolute top-full right-0 mt-1.5 w-[280px] md:w-[300px] bg-[#111113] border border-white/10 rounded-2xl overflow-hidden z-40 shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <i className="ri-music-2-line text-emerald-400 text-sm" />
                  <span className="text-xs font-bold text-white">배경음 선택</span>
                  {sfxItems.length > 0 && <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full">{sfxItems.length}</span>}
                </div>
                <button
                  onClick={() => { setShowBgmPanel(false); setShowSfxPicker(true); }}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors whitespace-nowrap"
                >
                  전체 보기
                </button>
              </div>

              {sfxItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <i className="ri-music-2-line text-zinc-600 text-2xl" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-zinc-500 mb-1">생성된 배경음이 없어요</p>
                    <p className="text-[10px] text-zinc-600">AI Sound에서 먼저 생성해주세요</p>
                  </div>
                  <button onClick={() => setShowBgmPanel(false)} className="text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors">
                    AI Sound로 이동 →
                  </button>
                </div>
              ) : (
                <>
                  <div className="px-3 pt-3 pb-2">
                    <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 rounded-xl p-1">
                      {([
                        { id: 'all' as const, label: '전체' },
                        { id: 'sfx' as const, label: 'SFX' },
                        { id: 'music' as const, label: 'Music' },
                      ] as const).map((tab) => {
                        const count = tab.id === 'all' ? sfxItems.length : sfxItems.filter((i) => tab.id === 'sfx' ? (!i.type || i.type === 'sfx') : i.type === 'music').length;
                        return (
                          <button key={tab.id} onClick={() => setBgmTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${bgmTab === tab.id ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            {tab.label}
                            {count > 0 && <span className={`text-[8px] px-1 rounded-full ${bgmTab === tab.id ? 'bg-white/15 text-white' : 'bg-zinc-800 text-zinc-600'}`}>{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-3 pb-3 space-y-1.5 max-h-[220px] overflow-y-auto">
                    {selectedBgm && (
                      <button onClick={() => { setSelectedBgm(null); setShowBgmPanel(false); }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-dashed border-red-500/20 hover:border-red-500/40 text-zinc-600 hover:text-red-400 text-[10px] transition-all cursor-pointer">
                        <i className="ri-close-circle-line text-xs" /> 배경음 제거
                      </button>
                    )}
                    {sfxItems.filter((i) => bgmTab === 'all' || (bgmTab === 'sfx' ? (!i.type || i.type === 'sfx') : i.type === 'music')).map((item) => {
                      const isSelected = selectedBgm?.id === item.id;
                      const isMusic = item.type === 'music';
                      return (
                        <button key={item.id} onClick={() => { setSelectedBgm(isSelected ? null : item); if (!isSelected) setShowBgmPanel(false); }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all cursor-pointer text-left ${isSelected ? isMusic ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/60 border-white/5 hover:border-white/15 hover:bg-zinc-900'}`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? isMusic ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-zinc-800 border border-white/5'}`}>
                            {isSelected ? <i className={`ri-checkbox-circle-fill text-sm ${isMusic ? 'text-indigo-400' : 'text-emerald-400'}`} /> : <i className={`${isMusic ? 'ri-music-2-line' : 'ri-sound-module-line'} text-zinc-500 text-xs`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            {item.title && <p className="text-[10px] font-bold text-zinc-300 truncate">{item.title}</p>}
                            <p className="text-[10px] text-zinc-500 truncate">{item.prompt}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {item.storageUrl && <i className="ri-cloud-fill text-emerald-500/50 text-[9px]" title="Storage 저장됨" />}
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${isMusic ? 'bg-indigo-500/15 text-indigo-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{isMusic ? 'Music' : 'SFX'}</span>
                          </div>
                        </button>
                      );
                    })}
                    {sfxItems.filter((i) => bgmTab === 'all' || (bgmTab === 'sfx' ? (!i.type || i.type === 'sfx') : i.type === 'music')).length === 0 && (
                      <div className="text-center py-4 text-[10px] text-zinc-600">
                        {bgmTab === 'sfx' ? 'SFX가 없어요' : bgmTab === 'music' ? '음악이 없어요' : ''}
                      </div>
                    )}
                  </div>
                  {selectedBgm && (
                    <div className="px-3 pb-3 border-t border-white/5 pt-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={toggleBgm}
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${bgmPlaying ? selectedBgm.type === 'music' ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-emerald-500 hover:bg-emerald-400' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
                          <i className={`${bgmPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-[9px] ${!bgmPlaying ? 'ml-px' : ''}`} />
                        </button>
                        <i className="ri-volume-down-line text-zinc-600 text-xs" />
                        <input type="range" min={0} max={1} step={0.05} value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                          className={`flex-1 h-1 cursor-pointer ${selectedBgm.type === 'music' ? 'accent-indigo-500' : 'accent-emerald-500'}`} />
                        <i className="ri-volume-up-line text-zinc-600 text-xs" />
                        <span className="text-[9px] text-zinc-600 font-mono w-6 text-right">{Math.round(bgmVolume * 100)}%</span>
                      </div>
                      {bgmPlaying && (
                        <div className="flex items-center gap-px mt-2">
                          {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className={`flex-1 rounded-full animate-pulse ${selectedBgm.type === 'music' ? 'bg-indigo-400' : 'bg-emerald-400'}`}
                              style={{ height: `${3 + Math.sin(i * 0.9) * 3}px`, animationDelay: `${i * 0.06}s` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => setActiveModal('share')}
          className="flex items-center gap-1 md:gap-1.5 bg-zinc-800 border border-white/10 hover:border-emerald-500/40 hover:text-emerald-300 text-zinc-300 text-xs font-semibold px-2 md:px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-share-line text-xs" />
          <span className="hidden sm:inline">공유</span>
        </button>

        {videoCount > 0 && (
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex-shrink-0">
            <i className="ri-film-line text-emerald-400 text-xs" />
            <span className="text-emerald-400 text-xs font-semibold">{videoCount}/{cuts.length} 완료</span>
          </div>
        )}

        <button
          onClick={handleGenerateAll}
          disabled={isGeneratingAll}
          className="flex items-center gap-1 md:gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 text-white font-bold text-xs md:text-sm px-2.5 md:px-5 py-2 rounded-xl cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
        >
          {isGeneratingAll ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              <span className="hidden sm:inline">
                {generatingId ? `Cut ${generatingId} 생성 중...` : '생성 중...'}
              </span>
              <span className="sm:hidden">생성 중</span>
              <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                {generateAllDoneCount}/{cuts.length}
              </span>
            </>
          ) : (
            <>
              <i className="ri-play-fill text-xs ml-0.5" />
              전체 생성
              <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-2 py-0.5 text-xs">
                <i className="ri-sparkling-2-line text-xs" />{cuts.length}
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
                fal.ai Kling 영상 생성 중
                {generatingId && <span className="text-zinc-500 font-normal ml-1">— Cut {generatingId} 처리 중 (최대 5분)</span>}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-semibold">
                <span className="text-white">{generateAllDoneCount}</span>
                <span className="text-zinc-600">/{cuts.length}</span>
                <span className="text-zinc-600 ml-1">컷 완료</span>
              </span>
              <span className="text-xs font-bold text-indigo-400">{generateAllProgress}%</span>
            </div>
          </div>
          <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${generateAllProgress}%` }}
            />
            {cuts.map((_, idx) => {
              const pos = ((idx + 1) / cuts.length) * 100;
              return <div key={idx} className="absolute top-0 bottom-0 w-px bg-black/40" style={{ left: `${pos}%` }} />;
            })}
          </div>
          <div className="flex items-center gap-1 mt-2">
            {cuts.map((cut) => {
              const isDone = generateAllDoneCount >= cut.id;
              const isCurrent = generatingId === cut.id;
              return (
                <div key={cut.id} className="flex flex-col items-center gap-0.5 flex-1">
                  <div className={`w-full h-1 rounded-full transition-all duration-300 ${isDone ? 'bg-emerald-500' : isCurrent ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-700'}`} />
                  <span className={`text-[8px] font-semibold ${isDone ? 'text-emerald-400' : isCurrent ? 'text-indigo-400' : 'text-zinc-700'}`}>
                    {isDone ? <i className="ri-check-line" /> : isCurrent ? <i className="ri-loader-4-line animate-spin" /> : cut.id}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Cut list (desktop only) */}
        <div className="hidden md:block w-[260px] flex-shrink-0 border-r border-white/5 overflow-y-auto bg-[#0d0d0f]">
          <div className="sticky top-0 bg-[#0d0d0f] border-b border-white/5 px-3 py-2 flex items-center gap-2 z-10">
            <span className="text-xs text-zinc-400 font-semibold">{videoCount}/{cuts.length} 영상</span>
            {step4ImageCount > 0 && (
              <>
                <div className="w-px h-3 bg-zinc-700" />
                <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1">
                  <i className="ri-image-line text-[10px]" />{step4ImageCount}개 이미지
                </span>
              </>
            )}
          </div>
          {cuts.map((cut) => {
            const dur = (cut.end - cut.start).toFixed(1);
            const isSelected = selectedCut === cut.id;
            const isGen = generatingId === cut.id;
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
                  <span className="text-[9px] text-zinc-600">{cut.start.toFixed(1)}s – {cut.end.toFixed(1)}s</span>
                  <span className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full ml-auto ${durationColor(Number(dur))}`}>{dur}s</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-2 whitespace-pre-line line-clamp-3">{cut.text}</p>
                <div className="flex items-center gap-2">
                  <div className="relative w-[60px] h-[38px] flex-shrink-0 rounded-lg overflow-hidden group">
                    <img src={getThumb(cut.id, cut.thumb)} alt="" className="w-full h-full object-cover object-top" />
                    {step4Images.find((i) => i.id === cut.id)?.image && !cut.hasVideo && (
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-indigo-500/80 flex items-center justify-center">
                        <i className="ri-image-fill text-white text-[6px]" />
                      </div>
                    )}
                    {isGen ? (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full border border-indigo-400 border-t-transparent animate-spin" />
                      </div>
                    ) : cut.hasVideo ? (
                      <div
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setFullscreenCutId(cut.id); }}
                      >
                        <i className="ri-play-fill text-white text-sm" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <i className="ri-film-line text-zinc-400 text-xs" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] text-zinc-600 truncate block">{cut.thumbPrompt}</span>
                    {step4Images.find((i) => i.id === cut.id)?.image ? (
                      <span className="text-[8px] text-indigo-400 font-bold flex items-center gap-0.5">
                        <i className="ri-image-fill text-[8px]" /> img2video
                      </span>
                    ) : (
                      <span className="text-[8px] text-zinc-600">text2video</span>
                    )}
                  </div>
                  {cut.hasVideo && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <i className="ri-check-line text-emerald-400 text-[8px]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — Preview + prompt */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0f0f11]">
          {/* Error banner */}
          {generateError && (
            <div className={`flex-shrink-0 flex items-start gap-2 px-4 py-2.5 border-b ${
              generateError.isInsufficientCredits
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <i className={`text-sm flex-shrink-0 mt-0.5 ${generateError.isInsufficientCredits ? 'ri-coin-line text-amber-400' : 'ri-error-warning-line text-red-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${generateError.isInsufficientCredits ? 'text-amber-300' : 'text-red-300'}`}>
                  {generateError.isInsufficientCredits ? '크레딧 부족' : '영상 생성 오류'}
                </p>
                <p className={`text-[11px] mt-0.5 leading-relaxed ${generateError.isInsufficientCredits ? 'text-amber-200/70' : 'text-red-200/70'}`}>
                  {generateError.message}
                </p>
                {generateError.isInsufficientCredits && generateError.required && (
                  <p className="text-[10px] text-amber-400/70 mt-0.5">
                    필요: {generateError.required} CR · 보유: {generateError.available ?? 0} CR
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {!generateError.isInsufficientCredits && (
                  <button
                    onClick={() => { setGenerateError(null); handleGenerateCut(selectedCut); }}
                    className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-refresh-line text-[11px]" /> 재시도
                  </button>
                )}
                <button
                  onClick={() => setGenerateError(null)}
                  className={`cursor-pointer transition-colors ${generateError.isInsufficientCredits ? 'text-amber-400 hover:text-amber-300' : 'text-red-400 hover:text-red-300'}`}
                >
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
            </div>
          )}

          {/* Video preview area */}
          <div className="flex-1 flex items-center justify-center p-2 md:p-6">
            <div className="relative w-full max-w-[600px]">
              {current.hasVideo ? (
                <div className="relative">
                  <VideoPlayer
                    posterSrc={displayCut.thumb}
                    cutId={displayCut.id}
                    onClose={() => setFullscreenCutId(null)}
                    audioBlobUrl={voiceData?.cutAudios[`c${current.id}`]?.blobUrl}
                    audioDuration={voiceData?.cutAudios[`c${current.id}`]?.duration}
                    isTimelinePlaying={timelineActiveCutId !== null}
                    timelineActiveCutId={timelineActiveCutId}
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                    <button
                      onClick={() => setActiveModal('library')}
                      className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center cursor-pointer transition-colors"
                      title="라이브러리"
                    >
                      <i className="ri-folder-video-line text-white text-sm" />
                    </button>
                    <button
                      onClick={() => handleGenerateCut(current.id)}
                      className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-refresh-line text-xs" /> 재생성
                    </button>
                  </div>
                  <button
                    onClick={() => setFullscreenCutId(current.id)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 flex items-center justify-center cursor-pointer transition-colors z-10"
                    title="전체화면"
                  >
                    <i className="ri-fullscreen-line text-white text-sm" />
                  </button>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden">
                  <img
                    src={current.thumb}
                    alt="Preview"
                    className="w-full h-[160px] md:h-[315px] object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                  {generatingId === current.id ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                      <div className="relative mb-4">
                        <div className="w-14 h-14 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <i className="ri-sparkling-2-line text-indigo-400 text-lg" />
                        </div>
                      </div>
                      <p className="text-white text-sm font-semibold mb-1">fal.ai Kling 영상 생성 중...</p>
                      <p className="text-zinc-500 text-xs mb-3">최대 5분 소요될 수 있어요</p>
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
                          <i className="ri-film-line text-white/60 text-2xl" />
                        </div>
                        <p className="text-white/60 text-sm">영상이 아직 생성되지 않았어요</p>
                        {hasStep4Image && (
                          <div className="flex items-center gap-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs px-3 py-1.5 rounded-full">
                            <i className="ri-image-line text-xs" />
                            Step4 이미지 기반으로 생성됩니다
                          </div>
                        )}
                        <button
                          onClick={() => handleGenerateCut(current.id)}
                          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <i className={hasStep4Image ? 'ri-image-2-line' : 'ri-sparkling-2-line'} />
                          {hasStep4Image ? '이미지로 영상 생성' : '영상 생성'}
                          <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                            <i className="ri-coin-line text-xs" />{creditCostPerCut} CR
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                    <button
                      onClick={() => setActiveModal('library')}
                      className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-folder-video-line text-xs" /> 라이브러리
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${current.hasVideo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-white/5'}`}>
                  <i className={`${current.hasVideo ? 'ri-checkbox-circle-fill' : 'ri-time-line'} text-xs`} />
                  {current.hasVideo ? '생성 완료' : '대기 중'}
                </div>
                <span className="text-xs text-zinc-600">{current.start.toFixed(1)}s – {current.end.toFixed(1)}s</span>
                {current.hasVideo && (
                  <button
                    onClick={() => setFullscreenCutId(current.id)}
                    className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-white cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-fullscreen-line text-xs" /> 전체화면
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Prompt area */}
          <div className="flex-shrink-0 border-t border-white/5 px-3 md:px-6 py-2.5 md:py-4">
            <p className="text-xs text-zinc-400 font-semibold mb-2">영상 프롬프트</p>
            <textarea
              value={current.videoPrompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="영상 프롬프트를 입력하세요..."
              className="w-full bg-zinc-900/60 border border-white/5 rounded-xl p-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors resize-none leading-relaxed"
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* ── Image Timeline ── */}
      {step4Images.length > 0 && showImageTimeline && (
        <ImageTimeline
          step4Images={step4Images}
          cuts={cuts}
          selectedCut={selectedCut}
          onSelectCut={setSelectedCut}
          generatingId={generatingId}
          onGenerateCut={handleGenerateCut}
        />
      )}

      {/* ── Narration Timeline ── */}
      {voiceData && (
        <NarrationTimeline
          cuts={cuts}
          voiceData={voiceData}
          selectedCut={selectedCut}
          onSelectCut={setSelectedCut}
          onActiveCutChange={setTimelineActiveCutId}
        />
      )}

      {/* Bottom nav */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#0f0f11] px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-arrow-left-line" />
          이전
        </button>

        {selectedBgm && (
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 border rounded-xl ${selectedBgm.type === 'music' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
            <i className={`ri-music-2-line text-xs ${selectedBgm.type === 'music' ? 'text-indigo-400' : 'text-emerald-400'}`} />
            <span className={`text-[10px] font-medium max-w-[80px] truncate ${selectedBgm.type === 'music' ? 'text-indigo-300' : 'text-emerald-300'}`}>
              {(selectedBgm.title ?? selectedBgm.prompt).slice(0, 20)}
            </span>
            <input type="range" min={0} max={1} step={0.05} value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
              className={`w-12 h-1 cursor-pointer ${selectedBgm.type === 'music' ? 'accent-indigo-500' : 'accent-emerald-500'}`} />
            <button onClick={toggleBgm}
              className={`w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-all ${selectedBgm.type === 'music' ? 'bg-indigo-500/30 hover:bg-indigo-500/50' : 'bg-emerald-500/30 hover:bg-emerald-500/50'}`}>
              <i className={`${bgmPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-[9px] ${selectedBgm.type === 'music' ? 'text-indigo-300' : 'text-emerald-300'}`} />
            </button>
            <button onClick={() => setSelectedBgm(null)} className="text-zinc-600 hover:text-red-400 cursor-pointer transition-colors">
              <i className="ri-close-line text-xs" />
            </button>
          </div>
        )}

        <button
          onClick={() => onNext(cuts.some((c) => c.hasVideo), cuts)}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-4 md:px-6 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          다음
          <i className="ri-arrow-right-line" />
        </button>
      </div>

      {showSfxPicker && (
        <SfxPickerModal
          title="영상 배경음 선택"
          selectedId={selectedBgm?.id ?? null}
          onSelect={(sfx) => {
            setSelectedBgm(sfx.id ? sfx : null);
            setShowSfxPicker(false);
          }}
          onClose={() => setShowSfxPicker(false)}
        />
      )}
    </div>
  );
}
