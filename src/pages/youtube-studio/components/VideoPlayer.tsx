import { useState, useRef, useEffect, useCallback } from 'react';

interface VideoPlayerProps {
  posterSrc: string;
  cutId: number;
  onClose?: () => void;
  isFullscreenModal?: boolean;
  audioBlobUrl?: string;
  audioDuration?: number;
  isTimelinePlaying?: boolean;
  timelineActiveCutId?: number | null;
}

export default function VideoPlayer({ posterSrc, cutId, onClose, isFullscreenModal = false, audioBlobUrl, audioDuration, isTimelinePlaying = false, timelineActiveCutId }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [_isFullscreen, setIsFullscreen] = useState(isFullscreenModal);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  // 이미지 전환 fade 상태
  const [displayedSrc, setDisplayedSrc] = useState(posterSrc);
  const [fadeIn, setFadeIn] = useState(true);

  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // posterSrc 변경 시 fade 전환
  useEffect(() => {
    if (posterSrc === displayedSrc) return;
    // fade out
    setFadeIn(false);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setDisplayedSrc(posterSrc);
      setFadeIn(true);
    }, 180);
    return () => { if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posterSrc]);

  // duration: 실제 오디오가 있으면 그 길이, 없으면 5.9s 기본값
  const duration = audioDuration ?? 5.9;

  // 실제 오디오 연동
  useEffect(() => {
    if (!audioBlobUrl) return;
    const el = new Audio(audioBlobUrl);
    el.volume = isMuted ? 0 : volume;
    el.playbackRate = playbackRate;
    audioElRef.current = el;
    return () => { el.pause(); audioElRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlobUrl]);

  // 볼륨/속도 동기화
  useEffect(() => {
    if (audioElRef.current) {
      audioElRef.current.volume = isMuted ? 0 : volume;
      audioElRef.current.playbackRate = playbackRate;
    }
  }, [volume, isMuted, playbackRate]);

  // 재생 진행
  useEffect(() => {
    if (isPlaying) {
      // 실제 오디오 재생
      if (audioElRef.current) {
        audioElRef.current.play().catch(() => {});
      }
      animFrameRef.current = setInterval(() => {
        if (audioElRef.current && !audioElRef.current.paused) {
          const t = audioElRef.current.currentTime;
          setCurrentTime(t);
          if (t >= duration) { setIsPlaying(false); }
        } else {
          setCurrentTime((prev) => {
            const next = prev + 0.1 * playbackRate;
            if (next >= duration) { setIsPlaying(false); return duration; }
            return next;
          });
        }
      }, 100);
    } else {
      if (audioElRef.current) audioElRef.current.pause();
      if (animFrameRef.current) clearInterval(animFrameRef.current);
    }
    return () => { if (animFrameRef.current) clearInterval(animFrameRef.current); };
  }, [isPlaying, duration, playbackRate]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), 2800);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); };
  }, [isPlaying, resetHideTimer]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * duration;
    setCurrentTime(t);
    if (audioElRef.current) audioElRef.current.currentTime = t;
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
    setHoverX(e.clientX - rect.left);
    if (isDragging) {
      setCurrentTime(ratio * duration);
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setIsSeeking(true);
    handleProgressClick(e);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsSeeking(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const togglePlay = () => {
    if (currentTime >= duration) {
      setCurrentTime(0);
    }
    setIsPlaying((p) => !p);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v === 0) setIsMuted(true);
    else setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted((m) => !m);
  };

  const handleFullscreen = () => {
    if (isFullscreenModal) {
      onClose?.();
    } else {
      setIsFullscreen(true);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveVolume = isMuted ? 0 : volume;

  const volumeIcon = () => {
    if (isMuted || effectiveVolume === 0) return 'ri-volume-mute-line';
    if (effectiveVolume < 0.4) return 'ri-volume-down-line';
    return 'ri-volume-up-line';
  };

  const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      ref={containerRef}
      className={`relative bg-black overflow-hidden select-none ${isFullscreenModal ? 'w-full h-full' : 'w-full rounded-2xl'}`}
      onMouseMove={resetHideTimer}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.player-controls')) return;
        togglePlay();
      }}
    >
      {/* Poster / simulated video frame */}
      <div className="relative w-full" style={{ paddingBottom: isFullscreenModal ? '0' : '56.25%', height: isFullscreenModal ? '100%' : undefined }}>
        <img
          src={displayedSrc}
          alt="video frame"
          className={`${isFullscreenModal ? 'w-full h-full' : 'absolute inset-0 w-full h-full'} object-cover object-top transition-opacity duration-200`}
          style={{ opacity: fadeIn ? 1 : 0 }}
          draggable={false}
        />

        {/* 타임라인 재생 중 컷 전환 표시 */}
        {isTimelinePlaying && timelineActiveCutId !== null && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white text-[10px] font-bold">Cut {timelineActiveCutId}</span>
              <span className="text-zinc-400 text-[10px]">나레이션 재생 중</span>
            </div>
          </div>
        )}

        {/* Simulated scanline / playback overlay */}
        {isPlaying && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
              style={{ width: '3px', left: `${progress}%`, transform: 'translateX(-50%)' }}
            />
          </div>
        )}

        {/* Seeking indicator */}
        {isSeeking && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-2 pointer-events-none z-20">
            <span className="text-white text-sm font-mono font-bold">{formatTime(currentTime)}</span>
          </div>
        )}

        {/* Big play/pause center indicator (flash) */}
        {!isPlaying && currentTime < duration && currentTime === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <i className="ri-play-fill text-white text-4xl ml-1" />
            </div>
          </div>
        )}

        {/* End overlay */}
        {currentTime >= duration && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center z-10 pointer-events-none">
            <i className="ri-refresh-line text-white text-4xl mb-2" />
            <span className="text-white text-sm font-semibold">다시 재생</span>
          </div>
        )}
      </div>

      {/* Controls overlay */}
      <div
        className={`player-controls absolute bottom-0 left-0 right-0 transition-all duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-3 pt-10">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="relative h-1.5 rounded-full bg-white/20 cursor-pointer mb-3 group"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={() => { setHoverTime(null); }}
          >
            {/* Buffered */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-white/20"
              style={{ width: `${Math.min(progress + 20, 100)}%` }}
            />
            {/* Played */}
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-indigo-400 transition-all"
              style={{ width: `${progress}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg border-2 border-indigo-400 transition-transform group-hover:scale-125"
              style={{ left: `${progress}%`, transform: `translateX(-50%) translateY(-50%)` }}
            />
            {/* Hover time tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute -top-8 bg-black/80 backdrop-blur-sm text-white text-[10px] font-mono px-2 py-1 rounded-md pointer-events-none whitespace-nowrap"
                style={{ left: `${hoverX}px`, transform: 'translateX(-50%)' }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Bottom controls row */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center text-white hover:text-indigo-300 transition-colors cursor-pointer"
            >
              {isPlaying
                ? <i className="ri-pause-fill text-xl" />
                : <i className="ri-play-fill text-xl ml-0.5" />
              }
            </button>

            {/* Skip back 5s */}
            <button
              onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
              className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <i className="ri-skip-back-mini-line text-lg" />
            </button>

            {/* Skip forward 5s */}
            <button
              onClick={() => setCurrentTime(Math.min(duration, currentTime + 5))}
              className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <i className="ri-skip-forward-mini-line text-lg" />
            </button>

            {/* Volume */}
            <div
              className="relative flex items-center gap-1.5"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={toggleMute}
                className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <i className={`${volumeIcon()} text-lg`} />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${showVolumeSlider ? 'w-20 opacity-100' : 'w-0 opacity-0'}`}
              >
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 accent-indigo-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Time display */}
            <div className="flex items-center gap-1 ml-1">
              <span className="text-white text-xs font-mono">{formatTime(currentTime)}</span>
              <span className="text-zinc-500 text-xs">/</span>
              <span className="text-zinc-400 text-xs font-mono">{formatTime(duration)}</span>
            </div>

            <div className="flex-1" />

            {/* Cut label */}
            <div className="bg-white/10 rounded-md px-2 py-0.5">
              <span className="text-zinc-300 text-[10px] font-semibold">Cut {cutId}</span>
            </div>

            {/* Playback speed */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu((p) => !p)}
                className="text-zinc-300 hover:text-white text-xs font-semibold px-2 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                {playbackRate}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden shadow-xl z-30">
                  {speedOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setPlaybackRate(s); setShowSpeedMenu(false); }}
                      className={`w-full px-4 py-1.5 text-xs font-semibold text-left transition-colors cursor-pointer ${playbackRate === s ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP / Download */}
            <button className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer">
              <i className="ri-download-line text-base" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <i className={`${isFullscreenModal ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} text-base`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
