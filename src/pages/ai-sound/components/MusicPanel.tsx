import { useState, useRef, useCallback, useEffect } from 'react';
import { Voice } from '@/mocks/voiceLibrary';
import { AudioHistoryItem } from '@/mocks/audioHistory';
import { SoundCostKey } from '@/pages/ai-sound/hooks/useSoundCredits';
import PageHeader from '@/components/feature/PageHeader';
import SidebarCredits from '@/pages/ai-sound/components/SidebarCredits';
import SidebarUpgrade from '@/pages/ai-sound/components/SidebarUpgrade';
import { dispatchSfxAdded } from '@/hooks/useSfxStore';
import { ErrorBanner, useApiError } from '@/components/base/ErrorBanner';
import { uploadAudioToStorage } from '@/hooks/useAudioHistory';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ── 장르 / 태그 데이터 ─────────────────────────────────────────────────────
const musicGenres = [
  { icon: 'ri-moon-line',       label: '새벽녘',     tags: 'lo-fi, chill, slow, piano, vinyl noise' },
  { icon: 'ri-magic-line',      label: '판타지',     tags: 'orchestral, epic, fantasy, strings, brass' },
  { icon: 'ri-flashlight-line', label: 'EDM',        tags: 'electronic, dance, bass drop, synth, 128 BPM' },
  { icon: 'ri-cloud-line',      label: '앰비언트',   tags: 'ambient, atmospheric, pad, meditative, slow' },
  { icon: 'ri-music-2-line',    label: '오케스트라', tags: 'orchestral, cinematic, full orchestra, dramatic' },
  { icon: 'ri-goblet-line',     label: '재즈',       tags: 'jazz, swing, saxophone, double bass, brush drums' },
  { icon: 'ri-mic-line',        label: '힙합',       tags: 'hip hop, boom bap, bass, sample, 90 BPM' },
  { icon: 'ri-headphone-line',  label: 'K-POP',      tags: 'k-pop, synth pop, catchy hook, bright, 130 BPM' },
];

const tagSuggestions: Record<string, { prompt: string; tags: string }> = {
  '새벽녘':    { prompt: '새벽 4시, 도시의 불빛이 꺼지기 시작하는 시간, 느린 피아노와 희미한 바이올린, 잔잔한 빗소리, 로파이 힙합 비트', tags: 'lo-fi, chill, piano, rain, slow, vinyl noise' },
  '판타지':    { prompt: '웅장한 오케스트라, 마법 세계를 탐험하는 영웅, 현악기와 금관악기의 서사적 조화, 드라마틱한 빌드업', tags: 'orchestral, epic, fantasy, strings, brass, cinematic' },
  'EDM':       { prompt: '강렬한 베이스 드롭, 빠른 신스 리드, 에너지 넘치는 빌드업과 브레이크다운, 클럽 분위기', tags: 'EDM, electronic, dance, bass drop, synth lead, 128 BPM' },
  '앰비언트':  { prompt: '우주 공간의 적막함, 부드러운 패드 사운드, 서서히 변화하는 텍스처, 명상적인 분위기, 드론 사운드', tags: 'ambient, atmospheric, space, pad, meditative, drone' },
  '오케스트라':{ prompt: '풀 오케스트라 편성, 웅장한 심포니, 현악기와 관악기의 조화, 클래식 음악 스타일', tags: 'orchestral, symphony, classical, strings, woodwinds, dramatic' },
  '재즈':      { prompt: '스윙 리듬의 더블 베이스, 즉흥적인 색소폰 솔로, 브러시 드럼, 따뜻한 재즈 클럽 분위기', tags: 'jazz, swing, saxophone, double bass, brush drums, warm' },
  '힙합':      { prompt: '붐붐 드럼 패턴, 샘플링된 소울 보컬, 무거운 베이스라인, 90년대 힙합 바이브, 그루비한 리듬', tags: 'hip hop, boom bap, bass, soul sample, 90 BPM, groovy' },
  'K-POP':     { prompt: '트렌디한 팝 비트, 중독성 있는 훅, 신스팝 요소, 밝고 에너지 넘치는 분위기, 댄스 팝', tags: 'k-pop, synth pop, catchy, bright, energetic, dance pop, 130 BPM' },
  '피아노 솔로':{ prompt: '솔로 피아노 연주, 감성적인 멜로디, 클래식과 현대의 경계, 조용하고 내성적인 분위기', tags: 'piano solo, emotional, classical, introspective, quiet' },
  '어쿠스틱':  { prompt: '통기타 핑거피킹, 자연스러운 룸 어쿠스틱, 따뜻하고 친밀한 분위기, 싱어송라이터 스타일', tags: 'acoustic guitar, fingerpicking, warm, intimate, singer-songwriter' },
  '신스웨이브': { prompt: '80년대 신스웨이브, 레트로 신스 사운드, 드라이빙 베이스라인, 네온 분위기, 레트로퓨처리즘', tags: 'synthwave, retro, 80s, synth, driving bass, neon, retrowave' },
  '시네마틱':  { prompt: '영화 음악 스타일, 감동적인 스트링, 서사적인 구성, 감정을 고조시키는 빌드업', tags: 'cinematic, film score, strings, epic, emotional, build-up' },
};

const quickTags = Object.keys(tagSuggestions);

// ── 생성된 클립 타입 ───────────────────────────────────────────────────────
interface MusicClip {
  id: string;
  title: string;
  audioUrl: string;
  imageUrl: string;
  duration: number;
  tags: string;
}

// ── 오디오 플레이어 컴포넌트 ──────────────────────────────────────────────
function MusicClipPlayer({ clip, index }: { clip: MusicClip; index: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(clip.duration);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || clip.duration);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [clip.duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(clip.audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clip.title.replace(/\s+/g, '_')}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(clip.audioUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const colors = ['from-indigo-500 to-violet-500', 'from-emerald-500 to-teal-500'];
  const colorClass = colors[index % colors.length];

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-white/8 overflow-hidden">
      <audio ref={audioRef} src={clip.audioUrl} preload="metadata" />

      {/* 커버 + 정보 */}
      <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4">
        {/* 커버 이미지 or 플레이스홀더 */}
        <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-800">
          {clip.imageUrl ? (
            <img src={clip.imageUrl} alt={clip.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
              <i className="ri-music-2-line text-white text-xl md:text-2xl" />
            </div>
          )}
          {/* 재생 오버레이 */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/90 flex items-center justify-center">
              <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-zinc-900 text-xs md:text-sm ${isPlaying ? '' : 'ml-0.5'}`} />
            </div>
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-xs md:text-sm font-bold text-white truncate">{clip.title}</p>
              {clip.tags && (
                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{clip.tags}</p>
              )}
            </div>
            {/* GoAPI 배지 */}
            <span className="flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400">
              GoAPI
            </span>
          </div>

          {/* 진행 바 */}
          <div className="flex items-center gap-1.5 md:gap-2 mt-2">
            <span className="text-[10px] text-zinc-600 tabular-nums w-7 md:w-8 flex-shrink-0">{fmt(currentTime)}</span>
            <div className="flex-1 relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full bg-gradient-to-r ${colorClass} rounded-full transition-all`}
                style={{ width: `${progress}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[10px] text-zinc-600 tabular-nums w-7 md:w-8 flex-shrink-0 text-right">{fmt(duration)}</span>
          </div>
        </div>
      </div>

      {/* 하단 액션 바 */}
      <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 pb-3">
        <button
          onClick={togglePlay}
          className={`flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            isPlaying
              ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
              : 'bg-zinc-800/60 border border-transparent text-zinc-400 hover:text-white hover:border-white/10'
          }`}
        >
          <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-xs`} />
          {isPlaying ? '일시정지' : '재생'}
        </button>

        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800/60 border border-white/5 text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          {isDownloading ? (
            <div className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" />
          ) : (
            <i className="ri-download-2-line text-xs" />
          )}
          <span className="hidden sm:inline">다운로드</span>
        </button>

        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-zinc-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">실제 생성됨</span>
        </div>
      </div>
    </div>
  );
}

// ── 생성 진행 상태 컴포넌트 ───────────────────────────────────────────────
function MusicGeneratingCard({ prompt, onCancel }: { prompt: string; onCancel: () => void }) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    { label: '프롬프트 분석 중...', icon: 'ri-search-eye-line' },
    { label: 'Suno AI 모델 초기화...', icon: 'ri-cpu-line' },
    { label: '멜로디 & 화음 생성 중...', icon: 'ri-music-2-line' },
    { label: '믹싱 & 마스터링 중...', icon: 'ri-equalizer-line' },
    { label: '최종 렌더링 중...', icon: 'ri-export-line' },
  ];

  useEffect(() => {
    let prog = 0;
    let stepIdx = 0;
    const progInterval = setInterval(() => {
      prog = Math.min(prog + 0.4, 92);
      setProgress(prog);
    }, 200);
    const stepInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setStep(stepIdx);
    }, 12000 / steps.length);
    return () => { clearInterval(progInterval); clearInterval(stepInterval); };
  }, [steps.length]);

  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-indigo-500/20 p-4 md:p-5">
      {/* 파형 애니메이션 */}
      <div className="flex items-center justify-center gap-1 mb-3 md:mb-4 h-8 md:h-10">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-indigo-500 to-violet-400"
            style={{
              height: `${16 + Math.sin(i * 0.8) * 10}px`,
              animation: `pulse ${0.6 + (i % 4) * 0.15}s ease-in-out infinite alternate`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>

      <div className="text-center mb-3 md:mb-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <i className={`${steps[step].icon} text-indigo-400 text-sm animate-pulse`} />
          <p className="text-xs md:text-sm font-bold text-white">{steps[step].label}</p>
        </div>
        <p className="text-[11px] text-zinc-500 line-clamp-1">&ldquo;{prompt}&rdquo;</p>
      </div>

      {/* 진행 바 */}
      <div className="mb-2.5 md:mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-zinc-600">GoAPI Suno 생성 중</span>
          <span className="text-[10px] text-indigo-400 font-bold tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 단계 도트 */}
      <div className="flex items-center justify-center gap-2 mb-3 md:mb-4">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full transition-all ${
              i < step ? 'bg-indigo-400' : i === step ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-700'
            }`} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="hidden sm:inline">GoAPI Suno AI 실시간 작곡 중</span>
          <span className="sm:hidden">작곡 중...</span>
        </div>
        <button
          onClick={onCancel}
          className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
        >
          <i className="ri-close-circle-line text-xs" /> 취소
        </button>
      </div>
    </div>
  );
}

// ── 사이드바 콘텐츠 ───────────────────────────────────────────────────────
interface MusicSidebarContentProps {
  credits: number;
  maxCredits: number;
}

export function MusicSidebarContent({ credits, maxCredits }: MusicSidebarContentProps) {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 md:space-y-6">
      <SidebarCredits credits={credits} maxCredits={maxCredits} />

      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 mb-2.5 md:mb-3">음악 장르</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {musicGenres.map((genre) => (
            <button
              key={genre.label}
              onClick={() => setActiveGenre(activeGenre === genre.label ? null : genre.label)}
              className={`flex items-center gap-2 px-2.5 md:px-3 py-2 md:py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                activeGenre === genre.label
                  ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-400'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <i className={`${genre.icon} text-sm flex-shrink-0`} />
              <span className="truncate">{genre.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 md:p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">프로팁</span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          BPM, 악기, 분위기를 함께 입력하면 더 정확한 음악이 생성됩니다. 예: &quot;120 BPM, 피아노, 몽환적인&quot;
        </p>
      </div>

      <SidebarUpgrade />
    </div>
  );
}

// ── 메인 MusicPanel ───────────────────────────────────────────────────────
interface MusicPanelProps {
  onGenerateStart: (id: string, title: string, text: string, voice: Voice, type?: import('@/mocks/audioHistory').AudioType) => void;
  onGenerateComplete: (id: string, audioUrl?: string, storageUrl?: string, durationSec?: number) => void;
  onGenerateCancel: (id: string) => void;
  recentItems: AudioHistoryItem[];
  credits: number;
  onDeductCredits: (key: SoundCostKey) => boolean;
}

export default function MusicPanel({
  onGenerateStart, onGenerateComplete, onGenerateCancel, recentItems, credits, onDeductCredits,
}: MusicPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [trackDuration, setTrackDuration] = useState(90);
  const [hasVocal, setHasVocal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenId, setCurrentGenId] = useState<string | null>(null);
  const [generatedClips, setGeneratedClips] = useState<MusicClip[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<{ prompt: string; tags: string; hasVocal: boolean; duration: number } | null>(null);
  const notifIdRef = useRef<string | null>(null);

  const { error, setApiError, clearError } = useApiError();
  const { sendGenerationInProgress, completeGenerationNotif, failGenerationNotif } = useNotifications();
  const { profile, isLoggedIn } = useAuth();

  // DB 히스토리 + 세션 내 생성 클립 프롬프트 합산
  const musicHistory = recentItems.filter((i) => i.type === 'music' && i.status === 'completed').slice(0, 8);
  // 히스토리 버튼은 DB 히스토리 또는 세션 내 생성 클립이 있을 때 표시
  const hasHistory = musicHistory.length > 0 || generatedClips.length > 0;

  const formatTrackTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleTagClick = (tag: string) => {
    const suggestion = tagSuggestions[tag];
    if (suggestion) {
      setPrompt(suggestion.prompt);
      setActiveTags([tag]);
    }
  };

  const handleGenreClick = (genre: typeof musicGenres[0]) => {
    const suggestion = tagSuggestions[genre.label];
    if (suggestion) {
      setPrompt(suggestion.prompt);
      setActiveTags([genre.label]);
    }
  };

  const handleGenerate = useCallback(async (retryPayload?: typeof lastRequestRef.current) => {
    const usePrompt = retryPayload?.prompt ?? prompt;
    if (!usePrompt.trim()) return;

    // retry 포함 항상 크레딧 차감 (실패 시 환불은 별도 처리)
    if (!onDeductCredits('music')) {
      return;
    }

    setIsGenerating(true);
    clearError();

    const newId = `music-${Date.now()}`;
    setCurrentGenId(newId);

    // 생성 시작 알림 (진행 중)
    notifIdRef.current = null;
    sendGenerationInProgress({
      generation_type: 'music',
      model_name: 'Suno AI',
      client_job_id: newId,
    }).then((nid) => { notifIdRef.current = nid; });

    const musicVoice: Voice = {
      id: 'music-composer',
      name: 'AI Composer',
      avatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=music-composer',
      lang: 'UNIVERSAL',
      gender: 'NEUTRAL',
      type: 'GENERAL',
      tags: ['MUSIC'],
      desc: 'AI Music Composer',
      accent: '',
    };
    onGenerateStart(newId, usePrompt.slice(0, 30) + '...', usePrompt, musicVoice, 'music');

    abortRef.current = new AbortController();

    const tagsStr = retryPayload?.tags ?? (
      activeTags.map((t) => tagSuggestions[t]?.tags ?? t).join(', ') || usePrompt.slice(0, 120)
    );
    const useHasVocal = retryPayload?.hasVocal ?? hasVocal;
    const useDuration = retryPayload?.duration ?? trackDuration;

    const payload = { prompt: usePrompt, tags: tagsStr, hasVocal: useHasVocal, duration: useDuration };
    lastRequestRef.current = payload;

    // 취소 신호 처리를 위한 abort 감지
    const abortSignal = abortRef.current.signal;

    try {
      // supabase.functions.invoke 사용 — Authorization 헤더 자동 포함
      // fal.ai 공식 문서: Authorization: Key {FAL_KEY} 는 Edge Function 내부에서 처리
      const invokePromise = supabase.functions.invoke('generate-music', {
        body: {
          prompt: usePrompt,
          tags: tagsStr,
          title: usePrompt.slice(0, 40),
          make_instrumental: !useHasVocal,
          duration: useDuration,
          user_id: isLoggedIn && profile ? profile.id : undefined,
        },
      });

      // AbortController 신호 연동
      const abortPromise = new Promise<never>((_, reject) => {
        abortSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });

      const { data, error: invokeError } = (await Promise.race([invokePromise, abortPromise])) as {
        data: { success?: boolean; error?: string; clips?: MusicClip[] } | null;
        error: { message?: string } | null;
      };

      if (invokeError) {
        throw new Error(invokeError.message ?? '서버 오류');
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success && data.clips && data.clips.length > 0) {
        const clips: MusicClip[] = data.clips;
        setGeneratedClips((prev) => [...clips, ...prev]);

        // 첫 번째 클립 URL을 대표로 사용
        const firstClip = clips[0];
        let firstStorageUrl: string | undefined;

        // 각 클립을 Supabase Storage에 영구 저장
        await Promise.all(clips.map(async (clip) => {
          const musicSfxId = `music-${clip.id}-${Date.now()}`;
          const fileName = `music-${musicSfxId}.mp3`;
          const storageUrl = await uploadAudioToStorage(clip.audioUrl, fileName);

          const finalUrl = storageUrl ?? clip.audioUrl;
          if (clip.id === firstClip.id) firstStorageUrl = storageUrl ?? undefined;

          // 저장된 URL로 클립 업데이트
          if (storageUrl) {
            setGeneratedClips((prev) =>
              prev.map((c) => c.id === clip.id ? { ...c, audioUrl: storageUrl } : c)
            );
          }

          dispatchSfxAdded({
            id: musicSfxId,
            prompt: clip.title || usePrompt.slice(0, 80),
            audioUrl: finalUrl,
            storageUrl: storageUrl ?? undefined,
            duration: clip.duration,
            createdAt: new Date().toISOString(),
            promptInfluence: 1,
            type: 'music',
            title: clip.title,
            tags: clip.tags,
          });
        }));

        onGenerateComplete(newId, firstClip.audioUrl, firstStorageUrl, firstClip.duration);

        // 생성 완료 알림 업데이트
        completeGenerationNotif({
          generation_type: 'music',
          model_name: 'Suno AI',
          credits_used: 6,
          action_url: '/ai-sound',
          notification_id: notifIdRef.current,
        });
      } else {
        onGenerateComplete(newId);
        completeGenerationNotif({
          generation_type: 'music',
          model_name: 'Suno AI',
          action_url: '/ai-sound',
          notification_id: notifIdRef.current,
        });
      }

      setIsGenerating(false);
      setCurrentGenId(null);
      notifIdRef.current = null;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('aborted') || msg.includes('abort')) {
        // 취소 시 진행 중 알림 제거
        if (notifIdRef.current) {
          failGenerationNotif({
            generation_type: 'music',
            model_name: 'Suno AI',
            error_message: '사용자가 취소했습니다.',
            notification_id: notifIdRef.current,
          });
          notifIdRef.current = null;
        }
        return;
      }

      console.error('Music 생성 오류:', msg);
      // 실패 알림 업데이트
      failGenerationNotif({
        generation_type: 'music',
        model_name: 'Suno AI',
        error_message: msg,
        notification_id: notifIdRef.current,
      });
      notifIdRef.current = null;

      setIsGenerating(false);
      setCurrentGenId(null);
      setApiError(err, msg);
      onGenerateCancel(newId);
    }
  }, [prompt, activeTags, hasVocal, trackDuration, onDeductCredits, onGenerateStart, onGenerateComplete, onGenerateCancel, clearError, setApiError, sendGenerationInProgress, completeGenerationNotif, failGenerationNotif, isLoggedIn, profile]);

  const handleRetry = useCallback(() => {
    if (lastRequestRef.current) {
      clearError();
      handleGenerate(lastRequestRef.current);
    }
  }, [clearError, handleGenerate]);

  const handleCancel = () => {
    abortRef.current?.abort();
    if (currentGenId) onGenerateCancel(currentGenId);
    setIsGenerating(false);
    setCurrentGenId(null);
  };

  const canGenerate = prompt.trim().length > 0 && !isGenerating && credits >= 6;

  return (
    <div className="flex flex-col h-full">
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
        title="AI Composer"
        subtitle="Music Generation · GoAPI Suno"
        statusLabel={`${credits} credits`}
        actions={
          <div className="flex items-center gap-2">
            {/* GoAPI 연동 배지 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <div className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider hidden sm:inline">Suno AI</span>
            </div>

            {hasHistory && (
              <div className="relative">
                <button
                  onClick={() => setHistoryOpen(!historyOpen)}
                  className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    historyOpen
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                      : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-indigo-500/30 hover:text-indigo-400'
                  }`}
                >
                  <i className="ri-history-line text-sm" />
                  <span className="hidden sm:inline">이전 작곡</span>
                  <span className="px-1.5 py-px rounded-md bg-zinc-800 text-zinc-500 text-[9px] font-black">
                    {musicHistory.length + generatedClips.length}
                  </span>
                </button>
                {historyOpen && (
                  <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">이전 작곡 프롬프트</span>
                      <button onClick={() => setHistoryOpen(false)} className="text-zinc-600 hover:text-white cursor-pointer transition-colors">
                        <i className="ri-close-line text-sm" />
                      </button>
                    </div>
                    <div className="max-h-56 md:max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                      {/* 세션 내 생성 클립 프롬프트 */}
                      {generatedClips.map((clip) => (
                        <button
                          key={clip.id}
                          onClick={() => { setPrompt(clip.title); setHistoryOpen(false); }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-bold">세션</span>
                            <span className="text-[9px] text-zinc-600">{clip.tags}</span>
                          </div>
                          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">{clip.title}</p>
                        </button>
                      ))}
                      {/* DB 히스토리 */}
                      {musicHistory.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => { setPrompt(item.text); setHistoryOpen(false); }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
                        >
                          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">{item.text}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-4 md:space-y-5 mt-3 md:mt-4">

        {/* ── 생성된 클립 목록 ── */}
        {generatedClips.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">생성된 트랙</p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold">
                {generatedClips.length}개
              </span>
            </div>
            {generatedClips.map((clip, i) => (
              <MusicClipPlayer key={clip.id} clip={clip} index={i} />
            ))}
            <div className="h-px bg-white/5" />
          </div>
        )}

        {/* ── 생성 중 카드 ── */}
        {isGenerating && (
          <MusicGeneratingCard prompt={prompt} onCancel={handleCancel} />
        )}

        {/* ── 프롬프트 입력 ── */}
        <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-3 md:p-5">
          <div className="flex items-center justify-between mb-2.5 md:mb-3">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">음악 프롬프트</p>
            <span className={`text-[10px] tabular-nums ${prompt.length > 450 ? 'text-amber-400' : 'text-zinc-600'}`}>
              {prompt.length}/500
            </span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 500))}
            placeholder="음악 스타일, 분위기, 악기, BPM 등을 자유롭게 설명하세요...&#10;예: 로파이 힙합 비트, 우울한 피아노, 느린 템포, 은은한 바이닐 노이즈"
            className="w-full bg-transparent text-zinc-300 text-xs md:text-sm leading-relaxed resize-none outline-none placeholder-zinc-600 min-h-[80px] md:min-h-[100px]"
          />

          {/* 빠른 태그 */}
          <div className="flex flex-wrap gap-1 md:gap-1.5 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/5">
            {quickTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg text-[10px] md:text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                  activeTags.includes(tag)
                    ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-400'
                    : 'bg-zinc-800/60 border border-transparent text-zinc-400 hover:border-indigo-500/20 hover:text-indigo-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* ── 장르 빠른 선택 ── */}
        <div>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5 md:mb-3">장르 빠른 선택</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 md:gap-2">
            {musicGenres.map((genre) => {
              const isActive = activeTags.includes(genre.label);
              return (
                <button
                  key={genre.label}
                  onClick={() => handleGenreClick(genre)}
                  className={`flex flex-col items-center gap-1 md:gap-1.5 py-2 md:py-3 px-2 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                      : 'bg-zinc-900/60 border-transparent text-zinc-500 hover:border-white/10 hover:text-zinc-300'
                  }`}
                >
                  <i className={`${genre.icon} text-sm md:text-base`} />
                  <span className="text-[10px] font-bold text-center leading-tight">{genre.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 설정 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {/* 곡 길이 */}
          <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-3 md:p-4">
            <div className="flex items-center justify-between mb-2.5 md:mb-3">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">곡 길이</p>
              <span className="text-sm font-bold text-indigo-400 font-mono">{formatTrackTime(trackDuration)}</span>
            </div>
            <input
              type="range" min={15} max={240} step={15} value={trackDuration}
              onChange={(e) => setTrackDuration(parseInt(e.target.value))}
              className="w-full h-1 cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px] text-zinc-700">00:15</span>
              <span className="text-[9px] text-zinc-700">04:00</span>
            </div>
          </div>

          {/* 보컬 포함 */}
          <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-3 md:p-4 flex flex-col justify-between">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5 md:mb-3">보컬 포함</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 font-bold">{hasVocal ? 'ON' : 'OFF'}</span>
                <button
                  onClick={() => setHasVocal(!hasVocal)}
                  className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 ${hasVocal ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${hasVocal ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                {hasVocal ? 'AI 보컬 포함 트랙' : '인스트루멘탈'}
              </p>
            </div>
          </div>
        </div>

        {/* ── API 키 안내 배너 ── */}
        <div className="p-3 md:p-4 rounded-xl bg-zinc-900/40 border border-white/5">
          <div className="flex items-start gap-2.5 md:gap-3">
            <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-information-line text-indigo-400 text-sm" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-zinc-300 mb-1">GoAPI Suno 연동 안내</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Supabase Secrets에 <code className="bg-zinc-800 px-1 py-0.5 rounded text-indigo-300 text-[9px]">GOAPI_KEY</code>를 설정하면 실제 AI 음악이 생성됩니다. 생성된 트랙은 바로 재생 및 다운로드 가능합니다.
              </p>
            </div>
          </div>
        </div>

        {/* ── 생성 버튼 ── */}
        <div className="flex items-center gap-2 md:gap-3 pb-2">
          {isGenerating && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 font-bold text-xs md:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-stop-circle-line text-sm" />
              <span className="hidden sm:block">취소</span>
            </button>
          )}
          <button
            onClick={() => handleGenerate()}
            disabled={!canGenerate}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 md:py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs md:text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="hidden sm:block">GoAPI Suno 작곡 중...</span>
                <span className="sm:hidden">작곡 중...</span>
              </>
            ) : (
              <>
                <i className="ri-sparkling-2-line" />
                <span className="hidden sm:block">전체 트랙 작곡</span>
                <span className="sm:hidden">작곡</span>
                <span className="flex items-center gap-0.5 bg-white/20 px-2 py-0.5 rounded-md text-xs font-black">
                  <i className="ri-copper-diamond-line text-xs" /> 6
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
