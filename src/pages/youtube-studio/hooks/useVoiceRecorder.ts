import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface GeneratedAudio {
  cutId: string;
  blobUrl: string;
  duration: number;
  text: string;
}

interface VoiceProfile {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  pitchOffset: number;
  rateOffset: number;
}

// ── TTS API 호출 결과 ──────────────────────────────────────────────────────
interface TtsResult {
  blobUrl: string;
  duration: number;
}

// ── 실제 TTS Edge Function 호출 ────────────────────────────────────────────
async function callTtsEdgeFunction(
  text: string,
  voiceName: string,
  speed: number,
  userId?: string | null
): Promise<TtsResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const body: Record<string, unknown> = {
    text,
    voiceName,
    model: 'flash',
    speed: Math.max(0.5, Math.min(2.0, speed)),
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
  };
  if (userId) body.user_id = userId;

  const res = await supabase.functions.invoke('generate-tts', {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (res.error) {
    throw new Error(res.error.message ?? 'TTS 생성 실패');
  }

  const data = res.data as {
    success?: boolean;
    audioUrl?: string;
    audioBase64?: string;
    mimeType?: string;
    duration?: number;
    charCount?: number;
    error?: string;
    insufficient_credits?: boolean;
    required?: number;
    available?: number;
  };

  if (data?.insufficient_credits) {
    const err = new Error(`크레딧이 부족합니다. 필요: ${data.required} CR, 보유: ${data.available} CR`);
    (err as Error & { code: string }).code = 'INSUFFICIENT_CREDITS';
    throw err;
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  const charCount = data?.charCount ?? text.length;
  const estimatedDuration = data?.duration ?? Math.max(2, charCount / (speed * 4.5));

  // audioUrl 방식 (fal.ai)
  if (data?.audioUrl) {
    const audioRes = await fetch(data.audioUrl);
    if (!audioRes.ok) throw new Error('오디오 파일 다운로드 실패');
    const blob = await audioRes.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { blobUrl, duration: estimatedDuration };
  }

  // audioBase64 방식 (ElevenLabs)
  if (data?.audioBase64) {
    const mimeType = data.mimeType ?? 'audio/mpeg';
    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    return { blobUrl, duration: estimatedDuration };
  }

  throw new Error('TTS 응답에서 오디오 데이터를 찾을 수 없습니다.');
}

// ── 폴백: AudioContext 합성 (API 실패 시) ─────────────────────────────────
function generateFallbackAudio(
  text: string,
  voice: VoiceProfile,
  speed: number,
  pitch: number
): Promise<TtsResult> {
  return new Promise((resolve) => {
    const sampleRate = 44100;
    const estimatedDuration = Math.max(2, text.length / (speed * 4.5));
    const numSamples = Math.floor(sampleRate * estimatedDuration);

    const audioCtx = new AudioContext({ sampleRate });
    const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    const basePitch = voice.gender === 'FEMALE' ? 220 : 130;
    const pitchHz = basePitch * Math.pow(2, (voice.pitchOffset + pitch * 0.1) / 12);
    const words = text.split(/\s+/);
    const samplesPerWord = numSamples / Math.max(words.length, 1);

    for (let i = 0; i < numSamples; i++) {
      const wordIdx = Math.floor(i / samplesPerWord);
      const wordProgress = (i % samplesPerWord) / samplesPerWord;
      let envelope = 0;
      if (wordProgress < 0.1) envelope = wordProgress / 0.1;
      else if (wordProgress < 0.7) envelope = 1.0;
      else if (wordProgress < 0.85) envelope = 1.0 - (wordProgress - 0.7) / 0.15 * 0.3;
      else envelope = 0.7 - (wordProgress - 0.85) / 0.15 * 0.7;
      if (wordProgress > 0.88) envelope *= 0.1;
      const freqVariation = 1 + 0.05 * Math.sin(wordIdx * 1.7);
      const freq = pitchHz * freqVariation * speed;
      const t = i / sampleRate;
      const fundamental = Math.sin(2 * Math.PI * freq * t);
      const harmonic2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
      const harmonic3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
      const harmonic4 = 0.12 * Math.sin(2 * Math.PI * freq * 4 * t);
      const noise = (Math.random() - 0.5) * 0.04;
      const formant1 = 0.3 * Math.sin(2 * Math.PI * 800 * t);
      const formant2 = 0.15 * Math.sin(2 * Math.PI * 1200 * t);
      data[i] = envelope * 0.35 * (fundamental + harmonic2 + harmonic3 + harmonic4 + noise + formant1 + formant2);
    }

    const wavBuffer = encodeWAV(buffer, sampleRate);
    audioCtx.close();
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    resolve({ blobUrl: URL.createObjectURL(blob), duration: estimatedDuration });
  });
}

export function useVoiceRecorder() {
  const [generatedAudios, setGeneratedAudios] = useState<Record<string, GeneratedAudio>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [isInsufficientCredits, setIsInsufficientCredits] = useState(false);
  // 샘플 미리듣기 캐시: voiceId → { blobUrl, duration }
  const sampleCacheRef = useRef<Record<string, { blobUrl: string; duration: number }>>({});
  const [sampleLoadingId, setSampleLoadingId] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── 샘플 미리듣기 생성 (실제 TTS, 캐싱) ──────────────────────────────
  const generateSampleAudio = useCallback(
    async (
      voiceId: string,
      voiceName: string,
      sampleText: string,
      speed: number,
      userId?: string | null
    ): Promise<{ blobUrl: string; duration: number } | null> => {
      // 캐시 확인 (같은 voiceId면 재사용)
      const cacheKey = `${voiceId}_${speed.toFixed(1)}`;
      if (sampleCacheRef.current[cacheKey]) {
        return sampleCacheRef.current[cacheKey];
      }

      setSampleLoadingId(voiceId);
      setSampleError(null);

      try {
        const result = await callTtsEdgeFunction(sampleText, voiceName, speed, userId);
        sampleCacheRef.current[cacheKey] = result;
        return result;
      } catch (err) {
        const e = err as Error & { code?: string };
        if (e.code === 'INSUFFICIENT_CREDITS') {
          setSampleError('크레딧이 부족합니다.');
        } else {
          // API 실패 시 폴백 (샘플은 크레딧 없이도 들을 수 있게)
          try {
            const fallback = await generateFallbackAudio(
              sampleText,
              { id: voiceId, name: voiceName, gender: 'FEMALE', pitchOffset: 0, rateOffset: 0 },
              speed,
              0
            );
            sampleCacheRef.current[cacheKey] = fallback;
            return fallback;
          } catch {
            setSampleError('샘플 생성 실패');
          }
        }
        return null;
      } finally {
        setSampleLoadingId(null);
      }
    },
    []
  );

  // 샘플 캐시 초기화 (속도/피치 변경 시)
  const clearSampleCache = useCallback(() => {
    Object.values(sampleCacheRef.current).forEach((s) => {
      try { URL.revokeObjectURL(s.blobUrl); } catch { /* 무시 */ }
    });
    sampleCacheRef.current = {};
  }, []);

  // ── 단일 컷 오디오 생성 (실제 TTS → 폴백) ─────────────────────────────
  const generateCutAudio = useCallback(
    async (
      cutId: string,
      text: string,
      voice: VoiceProfile,
      speed: number,
      pitch: number,
      userId?: string | null
    ) => {
      setRecordingId(cutId);
      setIsRecording(true);
      setTtsError(null);
      setIsInsufficientCredits(false);

      try {
        let result: TtsResult;
        try {
          result = await callTtsEdgeFunction(text, voice.name, speed, userId);
        } catch (apiErr) {
          const err = apiErr as Error & { code?: string };
          if (err.code === 'INSUFFICIENT_CREDITS') {
            setIsInsufficientCredits(true);
            setTtsError(err.message);
            throw err;
          }
          // API 실패 → 폴백
          console.warn('[TTS] API 실패, 폴백 사용:', err.message);
          result = await generateFallbackAudio(text, voice, speed, pitch);
        }

        const audio: GeneratedAudio = { cutId, blobUrl: result.blobUrl, duration: result.duration, text };
        setGeneratedAudios((prev) => ({ ...prev, [cutId]: audio }));
        return audio;
      } finally {
        setIsRecording(false);
        setRecordingId(null);
      }
    },
    []
  );

  // ── 전체 컷 일괄 생성 (실제 TTS) ──────────────────────────────────────
  const generateAllAudios = useCallback(
    async (
      cuts: Array<{ id: string; text: string }>,
      voice: VoiceProfile,
      speed: number,
      pitch: number,
      onProgress?: (idx: number) => void,
      userId?: string | null
    ) => {
      setIsRecording(true);
      setTtsError(null);
      setIsInsufficientCredits(false);
      const results: Record<string, GeneratedAudio> = {};

      for (let i = 0; i < cuts.length; i++) {
        const cut = cuts[i];
        onProgress?.(i);
        setRecordingId(cut.id);

        try {
          let result: TtsResult;
          try {
            result = await callTtsEdgeFunction(cut.text, voice.name, speed, userId);
          } catch (apiErr) {
            const err = apiErr as Error & { code?: string };
            if (err.code === 'INSUFFICIENT_CREDITS') {
              setIsInsufficientCredits(true);
              setTtsError(err.message);
              setIsRecording(false);
              setRecordingId(null);
              // 지금까지 생성된 것만 저장
              setGeneratedAudios((prev) => ({ ...prev, ...results }));
              throw err;
            }
            console.warn(`[TTS] 컷 ${cut.id} API 실패, 폴백:`, err.message);
            result = await generateFallbackAudio(cut.text, voice, speed, pitch);
          }
          results[cut.id] = { cutId: cut.id, blobUrl: result.blobUrl, duration: result.duration, text: cut.text };
        } catch (err) {
          const e = err as Error & { code?: string };
          if (e.code === 'INSUFFICIENT_CREDITS') throw err;
          // 기타 에러는 폴백으로 계속
          const fallback = await generateFallbackAudio(cut.text, voice, speed, pitch);
          results[cut.id] = { cutId: cut.id, blobUrl: fallback.blobUrl, duration: fallback.duration, text: cut.text };
        }
      }

      setGeneratedAudios((prev) => ({ ...prev, ...results }));
      setIsRecording(false);
      setRecordingId(null);
      return results;
    },
    []
  );

  // ── 전체 나레이션 단일 TTS 생성 ───────────────────────────────────────
  const generateFullNarration = useCallback(
    async (
      fullText: string,
      voice: VoiceProfile,
      speed: number,
      pitch: number,
      userId?: string | null
    ): Promise<TtsResult> => {
      try {
        return await callTtsEdgeFunction(fullText, voice.name, speed, userId);
      } catch (apiErr) {
        const err = apiErr as Error & { code?: string };
        if (err.code === 'INSUFFICIENT_CREDITS') throw err;
        console.warn('[TTS] 전체 나레이션 API 실패, 폴백:', err.message);
        return generateFallbackAudio(fullText, voice, speed, pitch);
      }
    },
    []
  );

  const downloadAudio = useCallback((cutId: string, voiceName: string) => {
    const audio = generatedAudios[cutId];
    if (!audio) return;
    const a = document.createElement('a');
    a.href = audio.blobUrl;
    a.download = `voice_${voiceName}_${cutId}.wav`;
    a.click();
  }, [generatedAudios]);

  const downloadAllAudios = useCallback((voiceName: string) => {
    Object.entries(generatedAudios).forEach(([cutId, audio]) => {
      const a = document.createElement('a');
      a.href = audio.blobUrl;
      a.download = `voice_${voiceName}_${cutId}.wav`;
      setTimeout(() => a.click(), 200 * parseInt(cutId.replace('c', ''), 10));
    });
  }, [generatedAudios]);

  const clearError = useCallback(() => {
    setTtsError(null);
    setIsInsufficientCredits(false);
  }, []);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    Object.values(generatedAudios).forEach((a) => URL.revokeObjectURL(a.blobUrl));
  }, [generatedAudios]);

  return {
    generatedAudios,
    isRecording,
    recordingId,
    ttsError,
    isInsufficientCredits,
    sampleLoadingId,
    sampleError,
    generateSampleAudio,
    clearSampleCache,
    generateCutAudio,
    generateAllAudios,
    generateFullNarration,
    downloadAudio,
    downloadAllAudios,
    clearError,
    cleanup,
  };
}

// ── WAV encoder (폴백용) ─────────────────────────────────────────────────────
function encodeWAV(buffer: AudioBuffer, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const data = buffer.getChannelData(0);
  const numSamples = data.length;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return arrayBuffer;
}
