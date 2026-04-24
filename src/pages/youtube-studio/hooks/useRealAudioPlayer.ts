import { useState, useRef, useEffect, useCallback } from 'react';

export function useRealAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setPlayingId(null);
  }, []);

  const play = useCallback((id: string, blobUrl: string, dur: number) => {
    stop();
    const audio = new Audio(blobUrl);
    audioRef.current = audio;
    setDuration((prev) => ({ ...prev, [id]: dur }));
    setElapsed((prev) => ({ ...prev, [id]: 0 }));
    setPlayingId(id);

    audio.play().catch(() => setPlayingId(null));

    timerRef.current = setInterval(() => {
      if (audio.ended || audio.paused) {
        clearInterval(timerRef.current!);
        setPlayingId(null);
        return;
      }
      setElapsed((prev) => ({ ...prev, [id]: audio.currentTime }));
    }, 80);

    audio.onended = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlayingId(null);
    };
  }, [stop]);

  const toggle = useCallback((id: string, blobUrl: string, dur: number) => {
    if (playingId === id) {
      stop();
    } else {
      play(id, blobUrl, dur);
    }
  }, [playingId, play, stop]);

  const seekTo = useCallback((id: string, pct: number) => {
    const dur = duration[id] ?? 0;
    const t = dur * pct;
    if (audioRef.current && playingId === id) {
      audioRef.current.currentTime = t;
    }
    setElapsed((prev) => ({ ...prev, [id]: t }));
  }, [duration, playingId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { playingId, elapsed, duration, toggle, stop, seekTo };
}
