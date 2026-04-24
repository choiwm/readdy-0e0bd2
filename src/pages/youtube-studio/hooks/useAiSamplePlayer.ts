import { useState, useRef, useEffect, useCallback } from 'react';
import type { VoiceProfile } from '../components/step3-voice-data';

interface SampleRecorder {
  sampleLoadingId: string | null;
  generateSampleAudio: (
    voiceId: string,
    voiceName: string,
    sampleText: string,
    speed: number,
    userId?: string | null
  ) => Promise<{ blobUrl: string; duration: number } | null>;
}

export function useAiSamplePlayer(
  recorder: SampleRecorder,
  userId: string | null | undefined
) {
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

  const playBlobUrl = useCallback((id: string, blobUrl: string, dur: number) => {
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

  const toggle = useCallback(async (
    id: string,
    voice: VoiceProfile,
    speed: number,
  ) => {
    if (playingId === id) {
      stop();
      return;
    }
    if (recorder.sampleLoadingId === id) return;

    const result = await recorder.generateSampleAudio(
      id,
      voice.name,
      voice.sampleText,
      speed,
      userId
    );
    if (result) {
      playBlobUrl(id, result.blobUrl, result.duration);
    }
  }, [playingId, stop, recorder, userId, playBlobUrl]);

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
