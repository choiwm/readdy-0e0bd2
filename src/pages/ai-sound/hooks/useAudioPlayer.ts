import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioPlayerState {
  playingId: string | null;
  progress: Record<string, number>;
}

export function useAudioPlayer() {
  const [state, setState] = useState<AudioPlayerState>({ playingId: null, progress: {} });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const play = useCallback((id: string, durationSec: number, _type: string, audioUrl?: string) => {
    stopAll();

    if (!audioUrl) {
      // audioUrl 없으면 재생 불가 — 상태 변경 없이 조용히 무시
      // (HistoryPanel에서 audioUrl 없는 항목은 재생 버튼 비활성화로 처리)
      return;
    }

    setState((prev) => ({ ...prev, playingId: id, progress: { ...prev.progress, [id]: 0 } } ));

    // 실제 오디오 재생
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      const dur = audio.duration || durationSec;
      const pct = dur > 0 ? Math.min((audio.currentTime / dur) * 100, 100) : 0;
      setState((prev) => ({ ...prev, progress: { ...prev.progress, [id]: pct } }));
    });

    audio.addEventListener('ended', () => {
      setState((prev) => ({ ...prev, playingId: null, progress: { ...prev.progress, [id]: 0 } }));
      audioRef.current = null;
    });

    audio.addEventListener('error', () => {
      setState((prev) => ({ ...prev, playingId: null }));
      audioRef.current = null;
    });

    audio.play().catch(() => {
      setState((prev) => ({ ...prev, playingId: null }));
      audioRef.current = null;
    });
  }, [stopAll]);

  const stop = useCallback((id?: string) => {
    stopAll();
    setState((prev) => ({
      ...prev,
      playingId: null,
      progress: id ? { ...prev.progress, [id]: 0 } : prev.progress,
    }));
  }, [stopAll]);

  const toggle = useCallback((id: string, durationSec: number, type: string, audioUrl?: string) => {
    if (state.playingId === id) {
      stop(id);
    } else {
      play(id, durationSec, type, audioUrl);
    }
  }, [state.playingId, play, stop]);

  useEffect(() => () => stopAll(), [stopAll]);

  return {
    playingId: state.playingId,
    progress: state.progress,
    play,
    stop,
    toggle,
    isPlaying: (id: string) => state.playingId === id,
  };
}
