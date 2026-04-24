import { useState, useRef, useCallback } from 'react';
import { logDev } from '@/lib/logger';
import { supabase } from '@/lib/supabase';

export type MergeStatus = 'idle' | 'merging' | 'done' | 'error' | 'unsupported';
export type ConvertStatus = 'idle' | 'uploading' | 'converting' | 'polling' | 'done' | 'error';

const POLL_INTERVAL_MS = 5000;
const CONVERT_POLL_MAX = 36; // 최대 3분

interface UseVideoMergeReturn {
  // WebM 병합
  mergeStatus: MergeStatus;
  mergeProgress: number;
  mergedBlobUrl: string | null;
  mergeError: string | null;
  startMerge: (videoUrls: string[]) => Promise<void>;
  cancelMerge: () => void;
  resetMerge: () => void;
  downloadMerged: (filename?: string) => void;

  // MP4 변환
  convertStatus: ConvertStatus;
  convertProgress: number;
  mp4Url: string | null;
  convertError: string | null;
  startConvert: () => Promise<void>;
  resetConvert: () => void;
  downloadMp4: (filename?: string) => void;
}

async function invokeAction(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('generate-multishot', {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message ?? `${action} 호출 실패`);
  if (data?.error) throw new Error(data.error as string);
  return data as Record<string, unknown>;
}

/**
 * MediaRecorder로 WebM 병합 + fal.ai ffmpeg-api로 MP4 변환
 */
export function useVideoMerge(): UseVideoMergeReturn {
  // ── WebM 병합 상태 ──
  const [mergeStatus, setMergeStatus] = useState<MergeStatus>('idle');
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergedBlobUrl, setMergedBlobUrl] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const mergedBlobRef = useRef<Blob | null>(null);

  // ── MP4 변환 상태 ──
  const [convertStatus, setConvertStatus] = useState<ConvertStatus>('idle');
  const [convertProgress, setConvertProgress] = useState(0);
  const [mp4Url, setMp4Url] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mergeAbortRef = useRef(false);
  const convertAbortRef = useRef(false);
  const prevBlobUrlRef = useRef<string | null>(null);

  // ── WebM 병합 ──
  const cancelMerge = useCallback(() => {
    mergeAbortRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setMergeStatus('idle');
    setMergeProgress(0);
  }, []);

  const resetMerge = useCallback(() => {
    mergeAbortRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }
    mergedBlobRef.current = null;
    setMergeStatus('idle');
    setMergeProgress(0);
    setMergedBlobUrl(null);
    setMergeError(null);
    chunksRef.current = [];
    recorderRef.current = null;
  }, []);

  const downloadMerged = useCallback((filename = `multishot_merged_${Date.now()}.webm`) => {
    if (!mergedBlobUrl) return;
    const a = document.createElement('a');
    a.href = mergedBlobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [mergedBlobUrl]);

  const startMerge = useCallback(async (videoUrls: string[]) => {
    if (!videoUrls.length) return;

    if (typeof MediaRecorder === 'undefined') {
      setMergeStatus('unsupported');
      setMergeError('이 브라우저는 영상 병합을 지원하지 않습니다.');
      return;
    }

    if (prevBlobUrlRef.current) {
      URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
    }

    mergeAbortRef.current = false;
    chunksRef.current = [];
    mergedBlobRef.current = null;
    setMergeStatus('merging');
    setMergeProgress(0);
    setMergedBlobUrl(null);
    setMergeError(null);
    // 병합 시작 시 변환 상태도 초기화
    setConvertStatus('idle');
    setConvertProgress(0);
    setMp4Url(null);
    setConvertError(null);

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

    try {
      await new Promise<void>((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1280px;height:720px;opacity:0;pointer-events:none;';
        document.body.appendChild(video);

        let recorder: MediaRecorder | null = null;
        let currentIdx = 0;

        const cleanup = () => {
          try { video.pause(); video.src = ''; document.body.removeChild(video); } catch { /* 무시 */ }
        };

        const loadNext = () => {
          if (mergeAbortRef.current) { cleanup(); reject(new Error('취소됨')); return; }
          if (currentIdx >= videoUrls.length) {
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            return;
          }
          setMergeProgress(Math.round((currentIdx / videoUrls.length) * 85));
          video.src = videoUrls[currentIdx];
          video.load();
          video.play().catch((e) => { cleanup(); reject(new Error(`영상 ${currentIdx + 1} 재생 실패: ${e.message}`)); });
        };

        video.onloadedmetadata = () => {
          if (currentIdx === 0) {
            try {
              type VideoWithCapture = HTMLVideoElement & {
                captureStream?: () => MediaStream;
                mozCaptureStream?: () => MediaStream;
              };
              const stream = (video as VideoWithCapture).captureStream?.()
                ?? (video as VideoWithCapture).mozCaptureStream?.();

              if (!stream) { cleanup(); reject(new Error('captureStream을 지원하지 않는 브라우저입니다.')); return; }

              recorder = new MediaRecorder(stream, { mimeType: supportedMime, videoBitsPerSecond: 8_000_000 });
              recorderRef.current = recorder;

              recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };

              recorder.onstop = () => {
                cleanup();
                if (mergeAbortRef.current) { reject(new Error('취소됨')); return; }
                const blob = new Blob(chunksRef.current, { type: supportedMime });
                mergedBlobRef.current = blob;
                const url = URL.createObjectURL(blob);
                prevBlobUrlRef.current = url;
                setMergedBlobUrl(url);
                setMergeProgress(100);
                setMergeStatus('done');
                resolve();
              };

              recorder.onerror = (e) => { cleanup(); reject(new Error(`녹화 오류: ${(e as ErrorEvent).message ?? '알 수 없는 오류'}`)); };
              recorder.start(100);
            } catch (e) {
              cleanup();
              reject(new Error(`녹화 시작 실패: ${e instanceof Error ? e.message : String(e)}`));
            }
          }
        };

        video.onended = () => { currentIdx++; loadNext(); };
        video.onerror = () => { cleanup(); reject(new Error(`영상 ${currentIdx + 1} 로드 실패`)); };

        loadNext();
      });
    } catch (err) {
      if (mergeAbortRef.current) { setMergeStatus('idle'); setMergeProgress(0); return; }
      setMergeError(err instanceof Error ? err.message : '병합 중 오류가 발생했습니다');
      setMergeStatus('error');
    }
  }, []);

  // ── MP4 변환 ──
  const resetConvert = useCallback(() => {
    convertAbortRef.current = true;
    setConvertStatus('idle');
    setConvertProgress(0);
    setMp4Url(null);
    setConvertError(null);
    setTimeout(() => { convertAbortRef.current = false; }, 100);
  }, []);

  const downloadMp4 = useCallback((filename = `multishot_${Date.now()}.mp4`) => {
    if (!mp4Url) return;
    const a = document.createElement('a');
    a.href = mp4Url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [mp4Url]);

  const startConvert = useCallback(async () => {
    const blob = mergedBlobRef.current;
    if (!blob) {
      setConvertError('병합된 영상이 없습니다. 먼저 "하나로 합치기"를 실행해주세요.');
      setConvertStatus('error');
      return;
    }

    convertAbortRef.current = false;
    setConvertStatus('uploading');
    setConvertProgress(5);
    setMp4Url(null);
    setConvertError(null);

    try {
      // 1. Blob → base64
      setConvertProgress(10);
      const arrayBuffer = await blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);

      if (convertAbortRef.current) return;

      // 2. fal.ai storage에 업로드
      setConvertProgress(20);
      logDev('[useVideoMerge] fal.ai 업로드 시작, size:', blob.size);
      const uploadData = await invokeAction('upload_to_fal', {
        webm_base64: base64,
        content_type: blob.type || 'video/webm',
      });

      if (convertAbortRef.current) return;

      const uploadedUrl = uploadData.url as string;
      if (!uploadedUrl) throw new Error('업로드 URL을 받지 못했습니다');
      logDev('[useVideoMerge] 업로드 완료:', uploadedUrl);

      // 3. ffmpeg-api/compose로 MP4 변환 요청
      setConvertStatus('converting');
      setConvertProgress(35);
      const convertData = await invokeAction('convert_to_mp4', { video_url: uploadedUrl });

      if (convertAbortRef.current) return;

      const requestId = convertData.request_id as string;
      if (!requestId) throw new Error('변환 request_id를 받지 못했습니다');

      // 4. 변환 완료 폴링
      setConvertStatus('polling');
      for (let i = 0; i < CONVERT_POLL_MAX; i++) {
        if (convertAbortRef.current) return;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (convertAbortRef.current) return;

        const pollData = await invokeAction('poll_convert', { request_id: requestId });
        const progress = 35 + Math.round((i / CONVERT_POLL_MAX) * 60);
        setConvertProgress(Math.min(progress, 94));

        if (pollData.status === 'COMPLETED') {
          const finalMp4Url = pollData.mp4_url as string;
          if (!finalMp4Url) throw new Error('MP4 URL을 받지 못했습니다');
          setMp4Url(finalMp4Url);
          setConvertProgress(100);
          setConvertStatus('done');
          logDev('[useVideoMerge] MP4 변환 완료:', finalMp4Url);
          return;
        }

        if (pollData.status === 'FAILED') {
          throw new Error((pollData.error as string) ?? 'MP4 변환 실패');
        }
      }

      throw new Error('MP4 변환 시간 초과 (3분)');

    } catch (err) {
      if (convertAbortRef.current) return;
      const msg = err instanceof Error ? err.message : 'MP4 변환 중 오류가 발생했습니다';
      setConvertError(msg);
      setConvertStatus('error');
    }
  }, []);

  return {
    mergeStatus, mergeProgress, mergedBlobUrl, mergeError,
    startMerge, cancelMerge, resetMerge, downloadMerged,
    convertStatus, convertProgress, mp4Url, convertError,
    startConvert, resetConvert, downloadMp4,
  };
}
