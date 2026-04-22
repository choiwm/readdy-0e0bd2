import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Voice } from '@/mocks/voiceLibrary';
import { AudioHistoryItem } from '@/mocks/audioHistory';
import { SoundCostKey } from '@/pages/ai-sound/hooks/useSoundCredits';
import PageHeader from '@/components/feature/PageHeader';
import SidebarCredits from '@/pages/ai-sound/components/SidebarCredits';
import SidebarUpgrade from '@/pages/ai-sound/components/SidebarUpgrade';
import { supabase } from '@/lib/supabase';
import { dispatchSfxAdded } from '@/hooks/useSfxStore';
import { ErrorBanner, useApiError } from '@/components/base/ErrorBanner';
import { uploadAudioToStorage } from '@/hooks/useAudioHistory';

// ─── 카테고리 & 태그 ───────────────────────────────────────────────
const sfxCategories = [
  {
    icon: 'ri-cpu-line',
    label: '사이버매틱 이펙트',
    prompts: [
      'Futuristic AI data stream processing sound with neural network activation beeps',
      'Cyberpunk holographic interface activation with electric hum and digital glitch',
      'Sci-fi robot arm mechanical movement with servo motors and hydraulic hiss',
    ],
  },
  {
    icon: 'ri-computer-line',
    label: 'UI & 시스템',
    prompts: [
      'Clean modern UI button click with subtle digital confirmation tone',
      'System notification chime, soft and pleasant with reverb tail',
      'Error alert sound, sharp and attention-grabbing with descending tone',
    ],
  },
  {
    icon: 'ri-leaf-line',
    label: '자연 & 환경',
    prompts: [
      'Heavy rain on a tin roof with distant thunder rumbling and wind',
      'Forest ambience with birds chirping, leaves rustling in gentle breeze',
      'Ocean waves crashing on rocky shore with seagulls and sea spray',
    ],
  },
  {
    icon: 'ri-ghost-line',
    label: '공포 & 초자연',
    prompts: [
      'Eerie haunted house creak with distant ghostly whisper and wind howl',
      'Horror jump scare sting with deep bass drop and high-pitched screech',
      'Supernatural portal opening with crackling energy and dimensional rift',
    ],
  },
];

const sfxTags = [
  { label: '🤖 AI 이펙트', prompt: 'Futuristic AI processing sound, data stream flowing, neural network activation beeps and digital hum' },
  { label: '⚙️ 기계', prompt: 'Heavy industrial machinery operating, metal gears meshing, pistons rhythmically pumping with steam hiss' },
  { label: '🎧 ASMR', prompt: 'Soft rain sounds with gentle page turning, whispered voices, rustling paper and crackling fireplace' },
  { label: '🚀 SF', prompt: 'Spaceship engine ignition with warp drive charging, laser fire energy burst and hull vibration' },
  { label: '🌿 자연', prompt: 'Peaceful forest with birds singing, wind through leaves, babbling brook and distant waterfall' },
  { label: '👻 공포', prompt: 'Dark horror atmosphere with creaking floorboards, distant screams, eerie silence broken by sudden noise' },
  { label: '🌆 도시', prompt: 'Busy city street ambience with traffic, crowd chatter, distant sirens and construction noise' },
  { label: '⚡ 에너지', prompt: 'High voltage electricity crackling, lightning strike with thunder, power surge and electrical discharge' },
  { label: '🎮 게임', prompt: 'Retro video game power-up sound with 8-bit chiptune beeps, coin collect and level complete fanfare' },
  { label: '🌊 물', prompt: 'Deep underwater ambience with bubbles rising, whale song in distance and ocean current flow' },
  { label: '💥 폭발', prompt: 'Cinematic explosion with deep bass rumble, debris flying, shockwave and distant echo' },
  { label: '🎬 시네마틱', prompt: 'Epic cinematic impact boom with orchestral swell, dramatic tension build and powerful climax' },
];

// ─── 생성된 SFX 아이템 타입 ────────────────────────────────────────
interface GeneratedSfx {
  id: string;
  prompt: string;
  audioUrl: string;
  duration: number | null;
  createdAt: Date;
  promptInfluence: number;
}

// ─── 오디오 플레이어 컴포넌트 ──────────────────────────────────────
interface SfxPlayerProps {
  item: GeneratedSfx;
  onRemove: (id: string) => void;
}

function SfxPlayer({ item, onRemove }: SfxPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(item.duration ?? 0);
  const [isLooping, setIsLooping] = useState(false);

  // 파형 높이값을 id 기반으로 고정 생성 (렌더마다 달라지지 않도록)
  const waveHeights = useMemo(() => {
    const seed = item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Array.from({ length: 48 }, (_, i) => {
      const pseudo = Math.sin(seed * 0.1 + i * 0.7) * 15 + Math.sin(i * 1.3 + seed * 0.05) * 10;
      return Math.max(4, 20 + pseudo);
    });
  }, [item.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setTotalDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const toggleLoop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = !isLooping;
    setIsLooping(!isLooping);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = item.audioUrl;
    a.download = `sfx-${item.id}.mp3`;
    a.click();
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="rounded-2xl bg-zinc-900/80 border border-white/8 p-3 md:p-4 group">
      <audio ref={audioRef} src={item.audioUrl} loop={isLooping} preload="metadata" />

      {/* 프롬프트 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
            <i className="ri-sound-module-line text-emerald-400 text-xs" />
          </div>
          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">{item.prompt}</p>
        </div>
        {/* 모바일: 항상 표시 / 데스크탑: hover 시 표시 */}
        <button
          onClick={() => onRemove(item.id)}
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 cursor-pointer flex-shrink-0"
        >
          <i className="ri-close-line text-sm" />
        </button>
      </div>

      {/* 파형 시각화 (고정 높이값 사용) */}
      <div className="flex items-center gap-px h-8 mb-3 px-1">
        {waveHeights.map((h, i) => {
          const filled = (i / 48) * 100 <= progress;
          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${filled ? 'bg-emerald-400' : 'bg-zinc-700'}`}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>

      {/* 시크바 */}
      <input
        type="range"
        min={0}
        max={totalDuration || 1}
        step={0.01}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-1 cursor-pointer accent-emerald-500 mb-3"
      />

      {/* 컨트롤 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
          >
            <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-sm`} />
          </button>
          <span className="text-[10px] text-zinc-500 font-mono">
            {fmt(currentTime)} / {fmt(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLoop}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
              isLooping
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-800 border border-white/5 text-zinc-500 hover:text-zinc-300'
            }`}
            title="루프"
          >
            <i className="ri-repeat-line text-xs" />
          </button>
          <button
            onClick={handleDownload}
            className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/5 text-zinc-500 hover:text-zinc-300 flex items-center justify-center transition-all cursor-pointer"
            title="다운로드"
          >
            <i className="ri-download-line text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 사이드바 컨텐츠 ───────────────────────────────────────────────
interface EffectsSidebarContentProps {
  credits: number;
  maxCredits: number;
}

export function EffectsSidebarContent({ credits, maxCredits }: EffectsSidebarContentProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 md:space-y-6">
      <SidebarCredits credits={credits} maxCredits={maxCredits} />

      <div className="space-y-1.5 md:space-y-2">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 mb-2.5 md:mb-3">사운드 카테고리</h4>
        {sfxCategories.map((cat) => (
          <button
            key={cat.label}
            onClick={() => setActiveCategory(activeCategory === cat.label ? null : cat.label)}
            className={`w-full flex items-center gap-2.5 md:gap-3 px-3 py-2 md:py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
              activeCategory === cat.label
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <i className={`${cat.icon} text-sm flex-shrink-0`} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* ElevenLabs 배지 */}
      <div className="p-3 rounded-xl bg-zinc-800/60 border border-white/5 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-orange-500/15 border border-orange-500/25 flex items-center justify-center flex-shrink-0">
          <i className="ri-sound-module-line text-orange-400 text-xs" />
        </div>
        <div>
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Powered by</p>
          <p className="text-[10px] font-bold text-zinc-300">ElevenLabs SFX</p>
        </div>
      </div>

      {/* 프로팁 카드 */}
      <div className="p-3 md:p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">프로팁</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          프롬프트에 &apos;3D Audio&apos; 또는 &apos;Spatial&apos;을 포함하면 공간감 있는 사운드를 극대화합니다.
        </p>
      </div>

      <SidebarUpgrade />
    </div>
  );
}

// ─── 메인 패널 ─────────────────────────────────────────────────────
interface EffectsPanelProps {
  onGenerateStart: (id: string, title: string, text: string, voice: Voice, type?: import('@/mocks/audioHistory').AudioType) => void;
  onGenerateComplete: (id: string, audioUrl?: string, storageUrl?: string, durationSec?: number) => void;
  onGenerateCancel: (id: string) => void;
  recentItems: AudioHistoryItem[];
  credits: number;
  onDeductCredits: (key: SoundCostKey) => boolean;
}

export default function EffectsPanel({
  onGenerateStart, onGenerateComplete, onGenerateCancel, recentItems, credits, onDeductCredits,
}: EffectsPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5.0);
  const [promptInfluence, setPromptInfluence] = useState(0.3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenId, setCurrentGenId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generatedSfxList, setGeneratedSfxList] = useState<GeneratedSfx[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRequestRef = useRef<{ prompt: string; duration: number; promptInfluence: number } | null>(null);

  const { error, setApiError, clearError } = useApiError();

  const sfxHistory = recentItems.filter((i) => i.type === 'effect' && i.status === 'completed').slice(0, 8);

  // 진행 애니메이션
  const startProgressAnimation = useCallback(() => {
    const steps = [
      { pct: 15, label: '프롬프트 분석 중...' },
      { pct: 35, label: '사운드 합성 초기화...' },
      { pct: 60, label: '오디오 레이어 생성 중...' },
      { pct: 80, label: '믹싱 & 마스터링...' },
      { pct: 92, label: '최종 렌더링...' },
    ];
    let stepIdx = 0;
    setProgress(5);
    setProgressLabel('요청 전송 중...');
    progressTimerRef.current = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].pct);
        setProgressLabel(steps[stepIdx].label);
        stepIdx++;
      }
    }, 1200);
  }, []);

  const stopProgressAnimation = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const handleGenerate = useCallback(async (retryPayload?: typeof lastRequestRef.current) => {
    const usePrompt = retryPayload?.prompt ?? prompt;
    if (!usePrompt.trim()) return;

    if (!retryPayload && !onDeductCredits('sfx')) {
      return;
    }

    setIsGenerating(true);
    clearError();
    const newId = `sfx-${Date.now()}`;
    setCurrentGenId(newId);

    const useDuration = retryPayload?.duration ?? duration;
    const useInfluence = retryPayload?.promptInfluence ?? promptInfluence;
    lastRequestRef.current = { prompt: usePrompt, duration: useDuration, promptInfluence: useInfluence };

    const fakeVoice: Voice = {
      id: 'sfx-engine', name: 'SFX Engine',
      avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=sfx',
      lang: 'UNIVERSAL', gender: 'NEUTRAL', type: 'GENERAL', tags: ['SFX'], desc: 'Sound Effects Generator', accent: '',
    };
    onGenerateStart(newId, usePrompt.slice(0, 30) + '...', usePrompt, fakeVoice, 'effect');
    startProgressAnimation();

    abortRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-sfx`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: usePrompt.trim(),
          duration_seconds: useDuration > 0 ? useDuration : undefined,
          prompt_influence: useInfluence,
        }),
        signal: abortRef.current.signal,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `서버 오류 (${res.status})`);
      }

      stopProgressAnimation();
      setProgress(100);
      setProgressLabel('완료!');

      let audioUrl = '';

      if (data.audioBase64) {
        const mimeType = data.mimeType ?? 'audio/mpeg';
        const byteChars = atob(data.audioBase64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: mimeType });
        audioUrl = URL.createObjectURL(blob);
      } else if (data.audioUrl) {
        audioUrl = data.audioUrl;
      } else {
        throw new Error('오디오 데이터를 받지 못했습니다.');
      }

      const newSfx: GeneratedSfx = {
        id: newId,
        prompt: usePrompt.trim(),
        audioUrl,
        duration: data.duration ?? useDuration,
        createdAt: new Date(),
        promptInfluence: useInfluence,
      };

      setGeneratedSfxList((prev) => [newSfx, ...prev]);

      // Supabase Storage 영구 저장
      const fileName = `sfx-${newId}-${Date.now()}.mp3`;
      const storageUrl = await uploadAudioToStorage(audioUrl, fileName);

      dispatchSfxAdded({
        id: newId,
        prompt: usePrompt.trim(),
        audioUrl: storageUrl ?? audioUrl,
        storageUrl: storageUrl ?? undefined,
        duration: data.duration ?? useDuration,
        createdAt: new Date().toISOString(),
        promptInfluence: useInfluence,
        type: 'sfx',
      });

      // storageUrl로 로컬 목록 업데이트
      if (storageUrl) {
        setGeneratedSfxList((prev) =>
          prev.map((s) => s.id === newId ? { ...s, audioUrl: storageUrl } : s)
        );
      }

      onGenerateComplete(newId, audioUrl, storageUrl ?? undefined, data.duration ?? useDuration);
      setPrompt('');
      setActiveTag(null);

    } catch (err: unknown) {
      stopProgressAnimation();
      if (err instanceof Error && err.name === 'AbortError') {
        // 취소됨
      } else {
        setApiError(err);
        onGenerateCancel(newId);
      }
    } finally {
      setIsGenerating(false);
      setCurrentGenId(null);
      abortRef.current = null;
      setTimeout(() => {
        setProgress(0);
        setProgressLabel('');
      }, 1500);
    }
  }, [prompt, duration, promptInfluence, onDeductCredits, onGenerateStart, onGenerateComplete, onGenerateCancel, clearError, setApiError, startProgressAnimation, stopProgressAnimation]);

  const handleRetry = useCallback(() => {
    if (lastRequestRef.current) {
      clearError();
      handleGenerate(lastRequestRef.current);
    }
  }, [clearError, handleGenerate]);

  const handleCancel = () => {
    abortRef.current?.abort();
    stopProgressAnimation();
    if (currentGenId) onGenerateCancel(currentGenId);
    setIsGenerating(false);
    setCurrentGenId(null);
    setProgress(0);
    setProgressLabel('');
  };

  const handleTagClick = (tag: typeof sfxTags[0]) => {
    setActiveTag(tag.label);
    setPrompt(tag.prompt);
  };

  const handleCategoryPrompt = (_catLabel: string, promptText: string) => {
    setPrompt(promptText);
    setActiveTag(null);
  };

  const handleRemoveSfx = (id: string) => {
    setGeneratedSfxList((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      {/* 에러 배너 */}
      {error && (
        <div className="mx-3 md:mx-6 mt-3">
          <ErrorBanner
            error={error}
            onRetry={error.retryable ? handleRetry : undefined}
            onDismiss={clearError}
            variant="inline"
          />
        </div>
      )}

      <PageHeader
        title="Sound Effects"
        subtitle="ElevenLabs Neural SFX"
        statusLabel={`${credits} credits`}
        actions={sfxHistory.length > 0 ? (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                historyOpen
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-emerald-500/30 hover:text-emerald-400'
              }`}
            >
              <i className="ri-history-line text-sm" />
              <span className="hidden sm:inline">이전 프롬프트</span>
              <span className="px-1.5 py-px rounded-md bg-zinc-800 text-zinc-500 text-[9px] font-black">{sfxHistory.length}</span>
            </button>
            {historyOpen && (
              <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">이전 SFX 프롬프트</span>
                  <button onClick={() => setHistoryOpen(false)} className="text-zinc-600 hover:text-white cursor-pointer transition-colors">
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                  {sfxHistory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setPrompt(item.text); setHistoryOpen(false); }}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <i className="ri-sound-module-line text-emerald-400 text-[9px]" />
                        </div>
                        <span className="text-[9px] text-zinc-600 ml-auto flex-shrink-0">{item.duration}s</span>
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">{item.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : undefined}
      />

      {/* 생성된 SFX 목록 */}
      {generatedSfxList.length > 0 && (
        <div className="mx-3 md:mx-6 mt-4 md:mt-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">생성된 효과음 ({generatedSfxList.length})</p>
            <button
              onClick={() => setGeneratedSfxList([])}
              className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
            >
              전체 삭제
            </button>
          </div>
          {generatedSfxList.map((sfx) => (
            <SfxPlayer key={sfx.id} item={sfx} onRemove={handleRemoveSfx} />
          ))}
        </div>
      )}

      {/* 프롬프트 입력 */}
      <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-3 md:p-6 mb-4 md:mb-5 mt-4 md:mt-5 mx-3 md:mx-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">사운드 컨셉 프롬프트</p>
          <span className="text-[10px] text-zinc-600">{prompt.length}/500</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
          placeholder="원하는 소리를 영어로 설명하세요 (예: Heavy rain on a tin roof with distant thunder and wind)"
          className="w-full bg-transparent text-zinc-300 text-xs md:text-sm leading-relaxed resize-none outline-none placeholder-zinc-600 min-h-[80px] md:min-h-[90px]"
        />

        {/* 빠른 태그 */}
        <div className="flex flex-wrap gap-1.5 md:gap-2 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/5">
          {sfxTags.map((tag) => (
            <button
              key={tag.label}
              onClick={() => handleTagClick(tag)}
              className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTag === tag.label
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-800/60 border border-transparent text-zinc-400 hover:border-emerald-500/20 hover:text-emerald-300'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* 카테고리 예시 프롬프트 */}
      <div className="mx-3 md:mx-6 mb-4 md:mb-5">
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2.5 md:mb-3">카테고리별 예시</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
          {sfxCategories.map((cat) => (
            <div key={cat.label} className="rounded-xl bg-zinc-900/60 border border-white/5 p-2.5 md:p-3">
              <div className="flex items-center gap-2 mb-1.5 md:mb-2">
                <i className={`${cat.icon} text-zinc-400 text-xs`} />
                <span className="text-[10px] font-bold text-zinc-400">{cat.label}</span>
              </div>
              <div className="flex flex-col gap-1">
                {cat.prompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCategoryPrompt(cat.label, p)}
                    className="text-left text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer line-clamp-1 leading-relaxed"
                  >
                    · {p.slice(0, 50)}...
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 설정 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-5 md:mb-6 mx-3 md:mx-6">
        <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">재생 시간</p>
            <span className="text-xs font-bold text-emerald-400">{duration.toFixed(1)}s</span>
          </div>
          <input
            type="range" min={0.5} max={30} step={0.5} value={duration}
            onChange={(e) => setDuration(parseFloat(e.target.value))}
            className="w-full h-1 cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-zinc-700">0.5s</span>
            <span className="text-[10px] text-zinc-700">30s</span>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">프롬프트 강도</p>
            <span className="text-xs font-bold text-emerald-400">{(promptInfluence * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05} value={promptInfluence}
            onChange={(e) => setPromptInfluence(parseFloat(e.target.value))}
            className="w-full h-1 cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-zinc-700">자유</span>
            <span className="text-[10px] text-zinc-700">정확</span>
          </div>
        </div>
      </div>

      {/* 진행 바 */}
      {isGenerating && (
        <div className="mx-3 md:mx-6 mb-4 md:mb-5">
          <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-px">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-emerald-400 animate-pulse"
                      style={{
                        height: `${12 + Math.sin(i * 1.2) * 8}px`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-zinc-400 font-medium">{progressLabel}</span>
              </div>
              <span className="text-xs font-bold text-emerald-400">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 생성 버튼 */}
      <div className="flex items-center justify-center gap-3 pb-8">
        {isGenerating && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-stop-circle-line text-sm" />
            <span className="hidden sm:block">취소</span>
          </button>
        )}
        <button
          onClick={() => handleGenerate()}
          disabled={!prompt.trim() || isGenerating || credits < 2}
          className="flex items-center gap-2 px-6 md:px-10 py-2.5 md:py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap"
        >
          {isGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="hidden sm:block">생성 중...</span>
              <span className="sm:hidden">생성 중</span>
            </>
          ) : (
            <>
              <i className="ri-sparkling-2-line" /> SFX 생성
              <span className="ml-1 flex items-center gap-0.5 bg-white/20 px-2 py-0.5 rounded-md text-xs font-black">
                <i className="ri-copper-diamond-line text-xs" /> 2
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
