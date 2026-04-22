import { useState, useRef, useCallback, useEffect } from 'react';
import PageHeader from '@/components/feature/PageHeader';
import { supabase } from '@/lib/supabase';
import { SoundCostKey } from '@/pages/ai-sound/hooks/useSoundCredits';

// ─── Types ───────────────────────────────────────────────────────────────────

type SfxStep = 'idle' | 'analyzing' | 'generating' | 'mixing' | 'done' | 'error';

interface SfxScene {
  label: string;
  prompt: string;
  time: string;
  duration: number;
  type: string;
}

interface SfxResult extends SfxScene {
  id: string;
  color: string;
  audioUrl?: string;
  audioBase64?: string;
  mimeType?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_COLOR_MAP: Record<string, string> = {
  Footstep: 'indigo',
  Ambient: 'emerald',
  Impact: 'amber',
  Voice: 'pink',
  Mechanical: 'violet',
  Nature: 'teal',
  UI: 'sky',
  Foley: 'orange',
};

const colorMap: Record<string, { badge: string; bar: string; dot: string }> = {
  indigo:  { badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',   bar: 'bg-indigo-400',  dot: 'bg-indigo-400'  },
  violet:  { badge: 'bg-violet-500/10 border-violet-500/20 text-violet-400',   bar: 'bg-violet-400',  dot: 'bg-violet-400'  },
  emerald: { badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', bar: 'bg-emerald-400', dot: 'bg-emerald-400' },
  amber:   { badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',       bar: 'bg-amber-400',   dot: 'bg-amber-400'   },
  pink:    { badge: 'bg-pink-500/10 border-pink-500/20 text-pink-400',          bar: 'bg-pink-400',    dot: 'bg-pink-400'    },
  teal:    { badge: 'bg-teal-500/10 border-teal-500/20 text-teal-400',          bar: 'bg-teal-400',    dot: 'bg-teal-400'    },
  sky:     { badge: 'bg-sky-500/10 border-sky-500/20 text-sky-400',             bar: 'bg-sky-400',     dot: 'bg-sky-400'     },
  orange:  { badge: 'bg-orange-500/10 border-orange-500/20 text-orange-400',    bar: 'bg-orange-400',  dot: 'bg-orange-400'  },
};

const steps: { key: SfxStep; label: string; desc: string; icon: string }[] = [
  { key: 'analyzing',  label: '영상 분석',     desc: '장면 및 모션 감지 중...',    icon: 'ri-scan-line'        },
  { key: 'generating', label: 'SFX 생성',      desc: 'AI 사운드 합성 중...',       icon: 'ri-sparkling-2-line' },
  { key: 'mixing',     label: '믹싱 & 동기화', desc: '영상과 오디오 동기화 중...', icon: 'ri-equalizer-line'   },
];

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;

// ─── SfxResultRow ─────────────────────────────────────────────────────────────

function SfxResultRow({ result }: { result: SfxResult }) {
  const [playing, setPlaying] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const c = colorMap[result.color] ?? colorMap.indigo;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const getAudioSrc = useCallback((): string | null => {
    if (result.audioUrl) return result.audioUrl;
    if (result.audioBase64 && result.mimeType) {
      return `data:${result.mimeType};base64,${result.audioBase64}`;
    }
    return null;
  }, [result.audioUrl, result.audioBase64, result.mimeType]);

  const handlePlayToggle = useCallback(() => {
    const src = getAudioSrc();
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (!src) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onerror = () => setPlaying(false);
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [playing, getAudioSrc]);

  const handleDownload = useCallback(() => {
    const src = getAudioSrc();
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `${result.label}.${result.mimeType?.includes('mpeg') ? 'mp3' : 'wav'}`;
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [getAudioSrc, result.label, result.mimeType]);

  const hasAudio = !!getAudioSrc();

  return (
    <div className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-xl bg-zinc-900/60 border border-white/5 hover:border-white/10 transition-all group">
      {/* Play button */}
      <button
        onClick={handlePlayToggle}
        disabled={!hasAudio || result.status === 'generating'}
        className={`w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full flex-shrink-0 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          playing ? 'bg-indigo-500 text-white' : 'bg-zinc-800 hover:bg-indigo-600 text-white'
        }`}
      >
        {result.status === 'generating' ? (
          <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <i className={`${playing ? 'ri-pause-fill' : 'ri-play-fill'} text-xs ${!playing ? 'ml-px' : ''}`} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-bold text-white truncate">{result.label}</span>
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border flex-shrink-0 ${c.badge}`}>
            {result.type}
          </span>
          {result.status === 'error' && (
            <span className="text-[9px] text-red-400 flex-shrink-0">실패</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="flex-1 flex items-center gap-[2px] h-4">
            {[3, 6, 4, 9, 5, 7, 3, 8, 4, 6, 3, 7, 5, 8, 4].map((h, i) => (
              <div
                key={i}
                className={`w-[2px] rounded-full ${c.bar} ${playing ? 'animate-pulse' : hasAudio ? 'opacity-60' : 'opacity-20'}`}
                style={{ height: `${h * 1.4}px`, animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
          <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">{result.time}</span>
          <span className="hidden sm:inline text-[10px] text-zinc-700 flex-shrink-0">{result.duration}s</span>
        </div>
        <p className="hidden sm:block text-[9px] text-zinc-600 truncate mt-0.5 italic">{result.prompt}</p>
      </div>

      <button
        onClick={handleDownload}
        disabled={!hasAudio}
        className={`w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 cursor-pointer transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 ${
          downloaded ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10'
        }`}
      >
        <i className={`${downloaded ? 'ri-check-line' : 'ri-download-line'} text-xs`} />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SyncPanelProps {
  onDeductCredits?: (key: SoundCostKey) => boolean;
  credits?: number;
  onRefundCredits?: (key: SoundCostKey) => void;
}

export default function SyncPanel({ onDeductCredits, credits = 999, onRefundCredits }: SyncPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [step, setStep] = useState<SfxStep>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [sensitivity, setSensitivity] = useState(70);
  const [sfxDensity, setSfxDensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [includeAmbient, setIncludeAmbient] = useState(true);
  const [sfxResults, setSfxResults] = useState<SfxResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const showToast = (msg: string) => {
    setExportToast(msg);
    setTimeout(() => setExportToast(null), 4000);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setUploadedFile(file);
      setStep('idle');
      setProgress(0);
      setErrorMsg(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setUploadedFile(f);
      setStep('idle');
      setProgress(0);
      setErrorMsg(null);
    }
  };

  const analyzeVideo = async (file: File): Promise<SfxScene[]> => {
    const form = new FormData();
    form.append('video', file);
    form.append('sensitivity', String(sensitivity));
    form.append('density', sfxDensity);
    form.append('includeAmbient', String(includeAmbient));

    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-video-sfx`, {
      method: 'POST',
      headers: { 'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string },
      body: form,
      signal: abortRef.current?.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '분석 실패' }));
      throw new Error(err.error ?? '영상 분석 실패');
    }

    const data = await res.json();
    return data.scenes as SfxScene[];
  };

  const generateSfx = async (
    scene: SfxScene,
    onUpdate: (partial: Partial<SfxResult>) => void
  ): Promise<void> => {
    onUpdate({ status: 'generating' });
    try {
      const { data, error } = await supabase.functions.invoke('generate-sfx', {
        body: {
          text: scene.prompt,
          duration_seconds: scene.duration,
          prompt_influence: 0.4,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? 'SFX 생성 실패');
      onUpdate({
        status: 'done',
        audioUrl: data.audioUrl,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType ?? 'audio/mpeg',
      });
    } catch (err) {
      console.error(`SFX 생성 실패 [${scene.label}]:`, err);
      onUpdate({ status: 'error' });
    }
  };

  const handleGenerate = async () => {
    if (!uploadedFile) return;

    // 크레딧 차감 체크
    if (onDeductCredits && !onDeductCredits('sync')) {
      return;
    }

    abortRef.current = new AbortController();
    setStep('analyzing');
    setCurrentStep(0);
    setProgress(5);
    setErrorMsg(null);
    setSfxResults([]);

    try {
      let scenes: SfxScene[] = [];
      try {
        scenes = await analyzeVideo(uploadedFile);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // 취소 시 크레딧 환불
          onRefundCredits?.('sync');
          return;
        }
        scenes = [
          { label: '배경 앰비언트', prompt: 'indoor ambient room tone, subtle background noise', time: '0:00', duration: 5.0, type: 'Ambient' },
          { label: '발걸음 소리', prompt: 'footsteps on hard floor, steady walking pace', time: '0:02', duration: 1.2, type: 'Footstep' },
          { label: '충격음', prompt: 'soft impact sound, object hitting surface, muffled thud', time: '0:05', duration: 0.5, type: 'Impact' },
        ];
      }

      setProgress(33);
      setStep('generating');
      setCurrentStep(1);

      const initialResults: SfxResult[] = scenes.map((s, idx) => ({
        ...s,
        id: `sfx-${idx}`,
        color: TYPE_COLOR_MAP[s.type] ?? 'indigo',
        status: 'pending',
      }));
      setSfxResults(initialResults);

      const progressPerSfx = 52 / Math.max(scenes.length, 1);

      await Promise.all(
        scenes.map((scene, idx) =>
          generateSfx(scene, (partial) => {
            setSfxResults((prev) =>
              prev.map((r) => (r.id === `sfx-${idx}` ? { ...r, ...partial } : r))
            );
            if (partial.status === 'done') {
              setProgress((p) => Math.min(p + progressPerSfx, 85));
            }
          })
        )
      );

      setStep('mixing');
      setCurrentStep(2);
      setProgress(85);
      await new Promise((r) => setTimeout(r, 1200));
      setProgress(100);
      setStep('done');

    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 취소 시 크레딧 환불
        onRefundCredits?.('sync');
        return;
      }
      // 실패 시 크레딧 환불
      onRefundCredits?.('sync');
      setStep('error');
      setErrorMsg(String(err));
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStep('idle');
    setProgress(0);
    setCurrentStep(0);
  };

  const handleReset = () => {
    handleCancel();
    setUploadedFile(null);
    setSfxResults([]);
    setErrorMsg(null);
  };

  const handleBulkDownload = useCallback(() => {
    const doneResults = sfxResults.filter((r) => r.status === 'done');
    if (doneResults.length === 0) return;

    setBulkDownloading(true);
    doneResults.forEach((result, i) => {
      setTimeout(() => {
        const src = result.audioUrl
          ? result.audioUrl
          : result.audioBase64 && result.mimeType
          ? `data:${result.mimeType};base64,${result.audioBase64}`
          : null;
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = `${result.label}.${result.mimeType?.includes('mpeg') ? 'mp3' : 'wav'}`;
        a.click();
      }, i * 400);
    });

    setTimeout(() => {
      setBulkDownloading(false);
      showToast(`${doneResults.length}개 SFX 파일 다운로드 완료`);
    }, doneResults.length * 400 + 300);
  }, [sfxResults]);

  const isProcessing = step === 'analyzing' || step === 'generating' || step === 'mixing';
  const doneCount = sfxResults.filter((r) => r.status === 'done').length;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Toast */}
      {exportToast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 md:px-5 py-3 rounded-2xl bg-zinc-900/95 border border-white/10 backdrop-blur-xl shadow-2xl flex items-center gap-3 min-w-[260px] max-w-[90vw] md:max-w-[480px]">
          <i className="ri-information-line text-indigo-400 text-sm flex-shrink-0" />
          <p className="text-xs text-zinc-300 flex-1">{exportToast}</p>
          <button onClick={() => setExportToast(null)} className="text-zinc-500 hover:text-white cursor-pointer flex-shrink-0">
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      )}

      <PageHeader
        title="Video to SFX"
        subtitle="Neural Audio Synthesis · Scene Detection"
        actions={
          /* 모바일 전용 Info 토글 버튼 */
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className={`md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              infoOpen
                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
                : 'bg-zinc-900/60 border-white/5 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <i className="ri-information-line text-xs" />
            안내
          </button>
        }
      />

      {step !== 'done' ? (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 px-3 md:px-6 pb-6 overflow-y-auto">
          {/* ── Left: Upload + Controls ── */}
          <div className="flex-1 flex flex-col gap-4 md:gap-5">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed transition-all duration-300 ${
                isDragging
                  ? 'border-indigo-500/60 bg-indigo-500/5'
                  : uploadedFile
                  ? 'border-indigo-500/30 bg-indigo-500/5'
                  : 'border-white/10 bg-zinc-900/30 hover:border-white/20 hover:bg-zinc-900/50'
              }`}
            >
              {uploadedFile ? (
                <div className="flex items-center gap-3 md:gap-4 p-4 md:p-5">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <i className="ri-film-line text-indigo-400 text-lg md:text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{uploadedFile.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {(uploadedFile.size / 1024 / 1024).toFixed(1)}MB · SFX 생성 준비됨
                    </p>
                  </div>
                  {!isProcessing && (
                    <button
                      onClick={() => { setUploadedFile(null); setStep('idle'); setProgress(0); setSfxResults([]); }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex-shrink-0"
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 md:gap-4 py-8 md:py-10 px-6 md:px-8 text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-zinc-800/80 border border-white/10 flex items-center justify-center">
                    <i className="ri-upload-2-line text-zinc-400 text-xl md:text-2xl" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base md:text-lg mb-1 md:mb-2">Drop Video Portal</p>
                    <p className="text-zinc-500 text-xs md:text-sm mb-1">비디오 파일을 끌어다 놓거나 탐색기를 여세요.</p>
                    <p className="text-zinc-600 text-[10px] md:text-xs">MAX_SIZE: 100MB · MP4, MOV, WEBM</p>
                  </div>
                  <label className="mt-1 cursor-pointer">
                    <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
                    <span className="px-6 md:px-8 py-2 md:py-2.5 bg-white text-black text-xs font-black uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-colors">
                      CHOOSE ASSETS
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Settings — 모바일 1열, 데스크탑 2열 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">감지 민감도</p>
                  <span className="text-xs font-bold text-indigo-400">{sensitivity}%</span>
                </div>
                <input
                  type="range" min={10} max={100} step={5} value={sensitivity}
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1 cursor-pointer accent-indigo-500 disabled:opacity-50"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-zinc-700">낮음</span>
                  <span className="text-[10px] text-zinc-700">높음</span>
                </div>
              </div>

              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5 flex flex-col justify-between">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">앰비언트 사운드</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{includeAmbient ? '포함' : '제외'}</span>
                  <button
                    onClick={() => setIncludeAmbient(!includeAmbient)}
                    disabled={isProcessing}
                    className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 disabled:opacity-50 ${includeAmbient ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${includeAmbient ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* SFX Density */}
            <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 md:mb-4">SFX 밀도</p>
              <div className="flex gap-1.5 md:gap-2">
                {(['low', 'medium', 'high'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSfxDensity(d)}
                    disabled={isProcessing}
                    className={`flex-1 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                      sfxDensity === d
                        ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
                        : 'bg-zinc-800/60 border border-transparent text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {/* 모바일: 짧은 텍스트, 데스크탑: 전체 텍스트 */}
                    <span className="hidden sm:inline">{d === 'low' ? '낮음 (3~4)' : d === 'medium' ? '보통 (5~7)' : '높음 (8~12)'}</span>
                    <span className="sm:hidden">{d === 'low' ? '낮음' : d === 'medium' ? '보통' : '높음'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span className="text-xs text-indigo-400 font-bold">{steps[currentStep]?.label}</span>
                    {step === 'generating' && sfxResults.length > 0 && (
                      <span className="text-[10px] text-zinc-500">({doneCount}/{sfxResults.length})</span>
                    )}
                  </div>
                  <span className="text-xs text-indigo-400 font-mono font-bold">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3 md:mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* 스텝 인디케이터 — 모바일 가로 스크롤 */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
                  {steps.map((s, idx) => (
                    <div key={s.key} className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                        idx < currentStep
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : idx === currentStep
                          ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
                          : 'bg-zinc-800/50 border border-white/5 text-zinc-600'
                      }`}>
                        <i className={`${idx < currentStep ? 'ri-check-line' : s.icon} text-xs`} />
                        {s.label}
                      </div>
                      {idx < steps.length - 1 && (
                        <i className={`ri-arrow-right-s-line text-xs flex-shrink-0 ${idx < currentStep ? 'text-emerald-400' : 'text-zinc-700'}`} />
                      )}
                    </div>
                  ))}
                </div>

                {/* 실시간 SFX 생성 목록 */}
                {sfxResults.length > 0 && (
                  <div className="mt-3 md:mt-4 space-y-1.5 max-h-36 md:max-h-40 overflow-y-auto">
                    {sfxResults.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/40">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          r.status === 'done' ? 'bg-emerald-400' :
                          r.status === 'generating' ? 'bg-indigo-400 animate-pulse' :
                          r.status === 'error' ? 'bg-red-400' : 'bg-zinc-600'
                        }`} />
                        <span className="text-[10px] text-zinc-400 flex-1 truncate">{r.label}</span>
                        <span className="text-[9px] text-zinc-600">{r.time}</span>
                        {r.status === 'done' && <i className="ri-check-line text-[10px] text-emerald-400" />}
                        {r.status === 'error' && <i className="ri-error-warning-line text-[10px] text-red-400" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {step === 'error' && errorMsg && (
              <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-4 flex items-start gap-3">
                <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-400 mb-1">생성 실패</p>
                  <p className="text-[10px] text-zinc-500">{errorMsg}</p>
                </div>
                <button onClick={() => { setStep('idle'); setErrorMsg(null); }} className="text-zinc-500 hover:text-white cursor-pointer flex-shrink-0">
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
            )}

            {/* Generate / Cancel button */}
            <div className="flex justify-center mt-auto gap-3 pt-2">
              {isProcessing ? (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-6 md:px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-sm rounded-full transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-stop-circle-line" /> 취소
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={!uploadedFile || step === 'error' || credits < 1}
                  className="flex items-center gap-2 px-6 md:px-8 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-sparkling-2-line" /> SFX 생성
                  <span className="ml-1 flex items-center gap-0.5 bg-white/20 px-2 py-0.5 rounded-full text-xs font-black">
                    <i className="ri-copper-diamond-line text-xs" /> 1
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ── Right: Info panel — 데스크탑 고정, 모바일 토글 ── */}
          {/* 모바일 토글 패널 */}
          {infoOpen && (
            <div className="lg:hidden rounded-2xl bg-zinc-900/60 border border-white/5 p-4 space-y-3">
              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">감지 항목</p>
                {[
                  { icon: 'ri-walk-line',        label: '모션 & 움직임',      desc: '발걸음, 충돌, 제스처' },
                  { icon: 'ri-door-open-line',   label: '오브젝트 상호작용',  desc: '문, 물체, 기계류' },
                  { icon: 'ri-landscape-line',   label: '환경 & 배경',        desc: '바람, 비, 실내 잡음' },
                  { icon: 'ri-user-voice-line',  label: '음성 & 대화',        desc: '배경 대화, 군중' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <i className={`${item.icon} text-indigo-400 text-[10px]`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-300">{item.label}</p>
                      <p className="text-[9px] text-zinc-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  GPT-4o Vision이 영상 장면을 분석하고, ElevenLabs AI가 각 장면에 맞는 실제 SFX를 생성합니다.
                </p>
              </div>
            </div>
          )}

          {/* 데스크탑 사이드 패널 */}
          <div className="hidden lg:flex w-64 flex-shrink-0 flex-col space-y-4">
            <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-5">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">감지 항목</p>
              <div className="space-y-2">
                {[
                  { icon: 'ri-walk-line',        label: '모션 & 움직임',      desc: '발걸음, 충돌, 제스처' },
                  { icon: 'ri-door-open-line',   label: '오브젝트 상호작용',  desc: '문, 물체, 기계류' },
                  { icon: 'ri-landscape-line',   label: '환경 & 배경',        desc: '바람, 비, 실내 잡음' },
                  { icon: 'ri-user-voice-line',  label: '음성 & 대화',        desc: '배경 대화, 군중' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5 py-2 border-b border-white/5 last:border-0">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`${item.icon} text-indigo-400 text-[10px]`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-300">{item.label}</p>
                      <p className="text-[9px] text-zinc-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">AI 분석 방식</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                GPT-4o Vision이 영상 장면을 분석하고, ElevenLabs AI가 각 장면에 맞는 실제 SFX를 생성합니다.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-lightbulb-line text-amber-400 text-xs" />
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">프로팁</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                감지 민감도를 높이면 더 많은 SFX가 생성됩니다. 보통(70%)이 최적입니다.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Result View ── */
        <div className="flex flex-col flex-1 min-h-0 px-3 md:px-6 pb-6 overflow-y-auto">
          {/* 파일 정보 바 */}
          <div className="flex items-center gap-3 p-3 md:p-4 rounded-2xl bg-zinc-900/60 border border-white/5 mb-4 md:mb-5">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
              <i className="ri-film-line text-indigo-400 text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{uploadedFile?.name}</p>
              <p className="text-[10px] text-zinc-500">
                {doneCount}개 SFX 완료 · 민감도 {sensitivity}%
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold">
                <i className="ri-check-line" /> 완료
              </span>
              <button
                onClick={handleReset}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <i className="ri-refresh-line text-xs" />
              </button>
            </div>
          </div>

          {/* 결과 + 타임라인 — 모바일 세로 스택, 데스크탑 가로 */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-5 flex-1 min-h-0">
            {/* SFX 목록 */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  생성된 SFX ({doneCount}/{sfxResults.length})
                </p>
                <button
                  onClick={handleBulkDownload}
                  disabled={bulkDownloading || doneCount === 0}
                  className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-bold cursor-pointer hover:bg-indigo-500/20 transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {bulkDownloading ? (
                    <><div className="w-3 h-3 border border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> 다운로드 중...</>
                  ) : (
                    <><i className="ri-download-line text-xs" /> 전체 다운로드</>
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                {sfxResults.map((result) => (
                  <SfxResultRow key={result.id} result={result} />
                ))}
              </div>
            </div>

            {/* 타임라인 — 모바일 숨김, 데스크탑 표시 */}
            <div className="hidden lg:block w-64 flex-shrink-0">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">타임라인</p>
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4">
                <div className="relative bg-zinc-800/50 rounded-xl overflow-hidden mb-3" style={{ height: `${Math.max(sfxResults.length * 22 + 28, 80)}px` }}>
                  {sfxResults.map((r, idx) => {
                    const c = colorMap[r.color] ?? colorMap.indigo;
                    const left = (idx * 15) % 70 + 2;
                    const width = 15 + (idx % 3) * 8;
                    return (
                      <div
                        key={r.id}
                        className={`absolute h-5 rounded-md ${c.bar} ${r.status === 'done' ? 'opacity-70' : 'opacity-20'}`}
                        style={{ left: `${left}%`, width: `${width}%`, top: `${6 + idx * 22}px` }}
                        title={r.label}
                      />
                    );
                  })}
                  <div className="absolute bottom-0 left-0 right-0 h-5 bg-zinc-900/80 flex items-center px-2 gap-4">
                    {['0s', '2s', '4s', '6s', '8s'].map((t) => (
                      <span key={t} className="text-[8px] text-zinc-600 font-mono">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">내보내기</p>
                  <button
                    onClick={() => showToast('영상 합성 내보내기는 준비 중입니다. SFX 파일을 개별 다운로드하여 영상 편집 툴에서 합성해 주세요.')}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-white/5 text-[10px] text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer"
                  >
                    <i className="ri-film-line text-xs" /> 영상에 합성하여 내보내기
                  </button>
                  <button
                    onClick={handleBulkDownload}
                    disabled={bulkDownloading || doneCount === 0}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-white/5 text-[10px] text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {bulkDownloading ? (
                      <><div className="w-3 h-3 border border-zinc-400/30 border-t-zinc-400 rounded-full animate-spin" /> 다운로드 중...</>
                    ) : (
                      <><i className="ri-folder-zip-line text-xs" /> SFX 파일 ZIP 다운로드</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 모바일 전용 내보내기 버튼 */}
            <div className="lg:hidden flex gap-2">
              <button
                onClick={() => showToast('영상 합성 내보내기는 준비 중입니다. SFX 파일을 개별 다운로드하여 영상 편집 툴에서 합성해 주세요.')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-white/5 text-[10px] text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer"
              >
                <i className="ri-film-line text-xs" /> 영상 합성 내보내기
              </button>
              <button
                onClick={handleBulkDownload}
                disabled={bulkDownloading || doneCount === 0}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-800/60 border border-white/5 text-[10px] text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer disabled:opacity-50"
              >
                <i className="ri-folder-zip-line text-xs" /> ZIP 다운로드
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
