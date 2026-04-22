import { useState, useRef, useCallback, useEffect } from 'react';
import { Voice } from '@/mocks/voiceLibrary';

interface VoiceCardProps {
  voice: Voice;
  onSelect: (v: Voice) => void;
  starred: boolean;
  onToggleStar: (id: number) => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

export default function VoiceCard({ voice, onSelect, starred, onToggleStar }: VoiceCardProps) {
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [starBurst, setStarBurst] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [pressed, setPressed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const particleIdRef = useRef(0);

  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
  }, []);

  const handlePlayToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (playing) {
      stopAudio();
      return;
    }

    // sampleUrl 없으면 조용히 무시 (버튼 자체가 disabled 처리됨)
    if (!voice.sampleUrl) return;

    setLoadingAudio(true);
    setAudioError(false);

    // 기존 오디오 정리
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    const audio = new Audio(voice.sampleUrl);
    audioRef.current = audio;

    audio.addEventListener('canplay', () => {
      setLoadingAudio(false);
      setPlaying(true);
      audio.play().catch(() => {
        setPlaying(false);
        setLoadingAudio(false);
        setAudioError(true);
        setTimeout(() => setAudioError(false), 2000);
      });
    });

    audio.addEventListener('timeupdate', () => {
      const dur = audio.duration || 1;
      setProgress((audio.currentTime / dur) * 100);
    });

    audio.addEventListener('ended', () => {
      setPlaying(false);
      setProgress(0);
      audioRef.current = null;
    });

    audio.addEventListener('error', () => {
      setLoadingAudio(false);
      setPlaying(false);
      setAudioError(true);
      setTimeout(() => setAudioError(false), 2000);
      audioRef.current = null;
    });

    // 로드 시작
    audio.load();
  }, [playing, voice.sampleUrl, stopAudio]);

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar(voice.id as number);
    setStarBurst(true);
    setTimeout(() => setStarBurst(false), 400);
    if (!starred) {
      const colors = ['#facc15', '#fbbf24', '#fde68a', '#f59e0b', '#fff'];
      const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
        id: particleIdRef.current++,
        x: 0,
        y: 0,
        angle: (360 / 8) * i,
        distance: 22 + Math.random() * 14,
        size: 3 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 600);
    }
  }, [starred, onToggleStar, voice.id]);

  const handleCardClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 200);
    onSelect(voice);
  };

  return (
    <div
      className={`group relative rounded-2xl bg-zinc-900/40 border transition-all duration-150 flex flex-col cursor-pointer
        p-3 gap-2.5
        sm:p-4 sm:gap-3
        md:p-5 md:gap-4
        ${pressed
          ? 'scale-[0.98] border-indigo-500/40 bg-zinc-900/90'
          : 'border-white/[0.06] hover:border-indigo-500/25 hover:bg-zinc-900/80'
        }
      `}
      onClick={handleCardClick}
    >
      {/* ── 상단: 아바타 + 이름/언어 + 컨트롤 ── */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 아바타 */}
        <div className="relative flex-shrink-0 w-9 h-9 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full overflow-hidden bg-zinc-800 shadow-xl">
          <img src={voice.avatar} alt={voice.name} className="w-full h-full object-cover" loading="lazy" />
          {playing && (
            <div className="absolute inset-0 rounded-full border-2 border-indigo-400/60 animate-ping pointer-events-none" />
          )}
        </div>

        {/* 이름 + 언어 + 웨이브폼 */}
        <div className="flex-1 min-w-0">
          <span className="font-bold text-white text-sm sm:text-sm md:text-base truncate block leading-tight">{voice.name}</span>
          <div className="text-[9px] sm:text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">{voice.lang}</div>
          {/* 재생 중 진행 바 */}
          {playing && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="flex items-center gap-[2px] h-3">
                {[2, 4, 3, 5, 3, 4, 2, 5, 3, 4].map((h, i) => (
                  <div
                    key={i}
                    className="w-[2px] rounded-full bg-indigo-400 animate-pulse"
                    style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
              <div className="flex-1 h-0.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          {audioError && (
            <p className="text-[9px] text-red-400 mt-0.5">샘플 로드 실패</p>
          )}
        </div>

        {/* 재생 버튼 */}
        <button
          onClick={handlePlayToggle}
          disabled={!voice.sampleUrl}
          className={`
            flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-150
            w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10
            ${!voice.sampleUrl
              ? 'bg-zinc-800/40 text-zinc-600 border border-white/5 cursor-not-allowed'
              : playing
              ? 'bg-indigo-500 text-white cursor-pointer'
              : 'bg-white/8 hover:bg-indigo-500/20 text-zinc-400 hover:text-indigo-300 border border-white/10 hover:border-indigo-500/30 cursor-pointer'
            }
          `}
          aria-label={playing ? '정지' : '미리듣기'}
          title={voice.sampleUrl ? (playing ? '정지' : '미리듣기') : '샘플 없음'}
        >
          {loadingAudio ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : !voice.sampleUrl ? (
            <i className="ri-volume-mute-line text-xs" />
          ) : (
            <i className={`${playing ? 'ri-pause-fill' : 'ri-play-fill'} text-xs sm:text-sm md:text-base`} />
          )}
        </button>

        {/* 별 버튼 */}
        <button
          onClick={handleStarClick}
          className="relative flex-shrink-0 flex items-center justify-center cursor-pointer rounded-full hover:bg-white/5 transition-colors
            w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10"
          style={{
            transform: starBurst ? 'scale(1.5)' : 'scale(1)',
            transition: starBurst
              ? 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)'
              : 'transform 0.2s ease-out',
          }}
          aria-label={starred ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          <i
            className={`text-xs sm:text-sm md:text-base ${starred ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-zinc-600 hover:text-yellow-400'}`}
            style={{ transition: 'color 0.15s ease' }}
          />
          {/* 파티클 */}
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.distance;
            const ty = Math.sin(rad) * p.distance;
            return (
              <span
                key={p.id}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  left: '50%',
                  top: '50%',
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  ['--ptx' as string]: `${tx}px`,
                  ['--pty' as string]: `${ty}px`,
                  animation: 'starParticle 0.55s ease-out forwards',
                }}
              />
            );
          })}
        </button>
      </div>

      {/* ── 설명 ── */}
      <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed line-clamp-1 sm:line-clamp-2">{voice.desc}</p>

      {/* ── 태그 ── */}
      <div className="flex flex-wrap gap-1 sm:gap-1.5">
        {voice.tags.map((tag, idx) => (
          <span
            key={tag}
            className={`px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[9px] text-indigo-400 font-medium whitespace-nowrap${idx >= 2 ? ' hidden sm:inline-flex' : ''}`}
          >
            {tag}
          </span>
        ))}
        {voice.tags.length > 2 && (
          <span className="sm:hidden px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] text-zinc-500 font-medium">
            +{voice.tags.length - 2}
          </span>
        )}
      </div>

      {/* ── 하단: 메타 뱃지 + Use Voice 버튼 ── */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        {/* 메타 뱃지 */}
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] text-zinc-400 font-bold uppercase whitespace-nowrap flex-shrink-0">
            {voice.type}
          </span>
          <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-md bg-zinc-950 border border-white/5 text-[9px] text-zinc-500 capitalize whitespace-nowrap">
            {voice.gender}
          </span>
          {voice.accent && (
            <span className="hidden md:inline-flex px-1.5 py-0.5 rounded-md bg-zinc-950 border border-white/5 text-[9px] text-zinc-500 whitespace-nowrap">
              {voice.accent}
            </span>
          )}
          {/* 샘플 있음 표시 */}
          {voice.sampleUrl && (
            <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] text-emerald-400 font-bold whitespace-nowrap">
              <i className="ri-headphone-line text-[9px]" /> 샘플
            </span>
          )}
        </div>

        {/* Use Voice 버튼 */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(voice); }}
          className="flex-shrink-0 flex items-center gap-1 sm:gap-1.5
            px-2 py-1 sm:px-3 sm:py-1.5
            rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400
            hover:bg-indigo-500/25 hover:border-indigo-500/50
            text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-mic-line text-[10px] sm:text-xs" />
          <span className="hidden sm:inline">Use Voice</span>
          <span className="sm:hidden">Use</span>
        </button>
      </div>
    </div>
  );
}
