import { useState, useRef, useCallback, useEffect } from 'react';
import PageHeader from '@/components/feature/PageHeader';
import SidebarCredits from '@/pages/ai-sound/components/SidebarCredits';
import SidebarUpgrade from '@/pages/ai-sound/components/SidebarUpgrade';
import { supabase } from '@/lib/supabase';
import { SUPABASE_URL } from '@/lib/env';
import { uploadUrlToStorage } from '@/hooks/useSfxStore';

type CleanMode = 'noise' | 'isolate' | 'separate';
type CleanStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

const stemColorMap: Record<string, { badge: string; wave: string; bg: string }> = {
  indigo: {
    badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    wave: 'bg-indigo-400',
    bg: 'from-indigo-500/10',
  },
  violet: {
    badge: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    wave: 'bg-violet-400',
    bg: 'from-violet-500/10',
  },
  emerald: {
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    wave: 'bg-emerald-400',
    bg: 'from-emerald-500/10',
  },
  amber: {
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    wave: 'bg-amber-400',
    bg: 'from-amber-500/10',
  },
};

interface StemTrack {
  label: string;
  icon: string;
  color: string;
  preset: string;
  audioUrl?: string;
}

function StemTrackRow({ track }: { track: StemTrack }) {
  const [playing, setPlaying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const c = stemColorMap[track.color] ?? stemColorMap.indigo;

  useEffect(() => {
    if (!track.audioUrl) return;
    const audio = new Audio(track.audioUrl);
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setPlaying(false));
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [track.audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleDownload = async () => {
    if (!track.audioUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(track.audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stem_${track.label}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch {
      // fallback
    } finally {
      setDownloading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const hasAudio = !!track.audioUrl;

  return (
    <div className={`p-3 md:p-4 rounded-2xl bg-gradient-to-r ${c.bg} to-transparent bg-zinc-900/60 border border-white/5 flex items-center gap-2.5 md:gap-4`}>
      <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${c.badge}`}>
        <i className={`${track.icon} text-xs md:text-sm`} />
      </div>
      <span className="text-xs font-bold text-white w-14 md:w-20 flex-shrink-0">{track.label}</span>
      <button
        onClick={togglePlay}
        disabled={!hasAudio}
        className={`w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 cursor-pointer transition-colors ${playing ? 'bg-indigo-500 text-white' : hasAudio ? 'bg-zinc-800 hover:bg-indigo-600 text-white' : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed'}`}
      >
        <i className={`${playing ? 'ri-pause-fill' : 'ri-play-fill'} text-xs`} />
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-[2px] h-5">
          {[4, 8, 5, 11, 6, 9, 4, 7, 10, 5, 8, 3, 9, 6, 11, 4, 8, 5, 7, 10].map((h, i) => (
            <div
              key={i}
              className={`w-[2px] rounded-full transition-all ${hasAudio ? c.wave : 'bg-zinc-700'} ${playing ? 'animate-pulse' : hasAudio ? 'opacity-50' : 'opacity-20'}`}
              style={{ height: `${h * 1.4}px`, animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
        {hasAudio && duration > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-600 font-mono">{formatTime(currentTime)}</span>
            <div className="flex-1 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${c.wave} rounded-full transition-all`}
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[9px] text-zinc-600 font-mono">{formatTime(duration)}</span>
          </div>
        )}
      </div>
      {hasAudio ? (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors flex-shrink-0 ${downloaded ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
          title={`${track.label} 다운로드`}
        >
          {downloading ? (
            <i className="ri-loader-4-line text-xs animate-spin" />
          ) : downloaded ? (
            <i className="ri-check-line text-xs" />
          ) : (
            <i className="ri-download-line text-xs" />
          )}
        </button>
      ) : (
        <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
          <i className="ri-time-line text-xs text-zinc-700" />
        </div>
      )}
    </div>
  );
}

interface AudioPlayerProps {
  audioUrl: string;
  fileName: string;
}

function AudioPlayer({ audioUrl, fileName }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('ended', () => setPlaying(false));
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const t = parseFloat(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = fileName.replace(/\.[^.]+$/, '');
      a.href = url;
      a.download = `${baseName}_cleaned.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch {
      // fallback
    } finally {
      setDownloading(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 md:p-5 rounded-2xl bg-zinc-900/60 border border-white/5">
      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3 md:mb-4">처리 결과</p>
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={togglePlay}
          className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-indigo-500 hover:bg-indigo-400 text-white cursor-pointer transition-colors flex-shrink-0"
        >
          <i className={`${playing ? 'ri-pause-fill' : 'ri-play-fill'} text-sm md:text-base`} />
        </button>
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {/* 파형 — 모바일에서 바 수 줄이기 */}
          <div className="flex items-center gap-[2px] h-6">
            {[3, 7, 5, 12, 6, 9, 4, 10, 5, 8, 3, 7, 11, 5, 9, 4, 8, 6, 10, 5, 7, 3, 9, 6, 11, 4, 8, 5, 7, 9].map((h, i) => (
              <div
                key={i}
                className={`w-[2px] rounded-full bg-indigo-400 transition-all ${i >= 20 ? 'hidden sm:block' : ''} ${playing ? 'animate-pulse' : 'opacity-50'}`}
                style={{ height: `${h * 1.6}px`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-mono w-8">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 cursor-pointer accent-indigo-500"
            />
            <span className="text-[10px] text-zinc-500 font-mono w-8 text-right">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end pt-2 border-t border-white/5">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${downloaded ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800/60 border-white/5 text-zinc-400 hover:text-white hover:border-white/10'}`}
        >
          {downloading ? (
            <i className="ri-loader-4-line animate-spin" />
          ) : downloaded ? (
            <i className="ri-check-line" />
          ) : (
            <i className="ri-download-line" />
          )}
          {downloaded ? '다운로드 완료' : 'WAV 다운로드'}
        </button>
      </div>
    </div>
  );
}

interface CleanSidebarContentProps {
  credits: number;
  maxCredits: number;
}

export function CleanSidebarContent({ credits, maxCredits }: CleanSidebarContentProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 md:space-y-6">
      <SidebarCredits credits={credits} maxCredits={maxCredits} />

      <div className="space-y-1.5 md:space-y-2">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 mb-2.5 md:mb-3">처리 방식</h4>
        {[
          { icon: 'ri-volume-mute-line', label: '노이즈 제거', desc: '배경 소음·잡음 제거' },
          { icon: 'ri-user-voice-line', label: '보이스 아이솔레이션', desc: '음악에서 보컬 추출' },
          { icon: 'ri-equalizer-2-line', label: '스템 분리', desc: '보컬·드럼·베이스 분리' },
        ].map((m) => (
          <div key={m.label} className="flex items-start gap-2.5 md:gap-3 px-3 py-2 md:py-3 rounded-xl bg-zinc-900/40 border border-white/5">
            <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className={`${m.icon} text-indigo-400 text-xs`} />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-300">{m.label}</p>
              <p className="text-[10px] text-zinc-600">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 md:space-y-3">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">지원 포맷</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {['MP3', 'WAV', 'M4A', 'FLAC', 'MP4', 'MOV'].map((fmt) => (
            <div key={fmt} className="flex items-center justify-center px-2 py-1.5 md:py-2 rounded-lg bg-zinc-800/50 border border-white/5 text-[10px] text-zinc-400 font-bold">
              {fmt}
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 py-2.5 md:py-3 rounded-xl bg-zinc-900/40 border border-white/5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-shield-check-line text-emerald-400 text-xs" />
          </div>
          <span className="text-[10px] font-bold text-zinc-400">Powered by LALAL.AI</span>
        </div>
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          Phoenix 모델 기반 고품질 오디오 분리 엔진
        </p>
      </div>

      <SidebarUpgrade />
    </div>
  );
}

interface CleanPanelProps {
  onDeductCredits?: (key: import('@/pages/ai-sound/hooks/useSoundCredits').SoundCostKey) => boolean;
  credits?: number;
  onRefundCredits?: (key: import('@/pages/ai-sound/hooks/useSoundCredits').SoundCostKey) => void;
}

export default function CleanPanel({ onDeductCredits, credits = 999, onRefundCredits }: CleanPanelProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<CleanMode>('noise');
  const [status, setStatus] = useState<CleanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [intensity, setIntensity] = useState(75);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultAudioUrl, setResultAudioUrl] = useState<string | null>(null);
  const [stemResults, setStemResults] = useState<Record<string, string>>({});
  const [progressLabel, setProgressLabel] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const modeConfig: Record<CleanMode, { icon: string; label: string; sub: string; credit: number }> = {
    noise: { icon: 'ri-volume-mute-line', label: '노이즈 제거', sub: 'Neural Noise Removal · LALAL.AI', credit: 1 },
    isolate: { icon: 'ri-user-voice-line', label: 'Voice Isolation', sub: 'Vocal Extraction · LALAL.AI', credit: 2 },
    separate: { icon: 'ri-equalizer-2-line', label: '스템 분리', sub: 'Multi-Track Separation · LALAL.AI', credit: 4 },
  };

  const stemTracks: StemTrack[] = [
    { label: '보컬', icon: 'ri-mic-2-line', color: 'indigo', preset: 'vocals', audioUrl: stemResults['vocals'] },
    { label: '드럼', icon: 'ri-rhythm-line', color: 'violet', preset: 'drums', audioUrl: stemResults['drums'] },
    { label: '베이스', icon: 'ri-sound-module-line', color: 'emerald', preset: 'bass', audioUrl: stemResults['bass'] },
    { label: '기타·기타', icon: 'ri-music-line', color: 'amber', preset: 'other', audioUrl: stemResults['other'] },
  ];

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  // LALAL.AI 업로드 한도 (라이선스마다 다르지만 100MB 이상은 거의 거절).
  // type/size 검증 누락 시 사용자가 0.5GB 영상 드롭하고 진행 안 되는 이유를
  // 모르거나, 비디오/오디오가 아닌 파일(예: 이미지) 드롭 시 LALAL.AI 가
  // 502 로 응답해서 로딩만 무한 도는 케이스 발생.
  const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
  const acceptUploadedFile = (file: File): boolean => {
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      setErrorMsg('오디오 또는 영상 파일만 올릴 수 있어요.');
      setStatus('error');
      return false;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setErrorMsg(`파일이 너무 커요 (${(file.size / 1024 / 1024).toFixed(1)}MB). 100MB 이하로 줄여주세요.`);
      setStatus('error');
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && acceptUploadedFile(file)) { setUploadedFile(file); setStatus('idle'); setProgress(0); setErrorMsg(''); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && acceptUploadedFile(f)) { setUploadedFile(f); setStatus('idle'); setProgress(0); setErrorMsg(''); }
  };

  const startFakeProgress = useCallback((startVal: number, endVal: number, durationMs: number) => {
    if (progressRef.current) clearInterval(progressRef.current);
    const steps = Math.floor(durationMs / 200);
    const increment = (endVal - startVal) / steps;
    let current = startVal;
    progressRef.current = setInterval(() => {
      current = Math.min(current + increment + Math.random() * 0.5, endVal);
      setProgress(Math.floor(current));
      if (current >= endVal) {
        clearInterval(progressRef.current!);
        progressRef.current = null;
      }
    }, 200);
  }, []);

  const handleProcess = useCallback(async () => {
    if (!uploadedFile) return;

    // 크레딧 차감
    const costKeyMap: Record<CleanMode, import('@/pages/ai-sound/hooks/useSoundCredits').SoundCostKey> = {
      noise: 'clean_noise',
      isolate: 'clean_isolate',
      separate: 'clean_separate',
    };
    if (onDeductCredits && !onDeductCredits(costKeyMap[mode])) {
      return;
    }

    setStatus('uploading');
    setProgress(0);
    setErrorMsg('');
    setResultAudioUrl(null);
    setStemResults({});
    setProgressLabel('파일 업로드 중...');
    startFakeProgress(0, 20, 3000);

    abortRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('audio', uploadedFile, uploadedFile.name);
      formData.append('mode', mode);
      formData.append('intensity', intensity.toString());

      setStatus('processing');
      setProgressLabel('AI 분석 중...');
      startFakeProgress(20, 60, 8000);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/clean-audio`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ''}`,
        },
        body: formData,
        signal: abortRef.current.signal,
      });

      setProgressLabel('처리 완료 중...');
      startFakeProgress(60, 95, 3000);

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error ?? '처리 실패';
        // 실패 시 크레딧 환불
        onRefundCredits?.(costKeyMap[mode]);
        if (data.needsKey) {
          setErrorMsg('LALAL_KEY가 설정되지 않았습니다.\nSupabase → Edge Functions → Secrets에 LALAL_KEY를 추가해주세요.');
        } else {
          setErrorMsg(errMsg);
        }
        setStatus('error');
        return;
      }

      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(100);

      if (mode === 'separate' && data.stems) {
        // LALAL.AI 스템 URL → Supabase Storage 영구 저장
        const persistedStems: Record<string, string> = {};
        await Promise.all(
          Object.entries(data.stems as Record<string, string>).map(async ([stemKey, stemUrl]) => {
            const fileName = `clean-stem-${stemKey}-${Date.now()}.wav`;
            const stored = await uploadUrlToStorage(stemUrl, fileName, 'audio/wav');
            persistedStems[stemKey] = stored ?? stemUrl;
          })
        );
        setStemResults(persistedStems);
      } else if (data.audioUrl) {
        // LALAL.AI 결과 URL → Supabase Storage 영구 저장
        const fileName = `clean-${mode}-${Date.now()}.wav`;
        const stored = await uploadUrlToStorage(data.audioUrl, fileName, 'audio/wav');
        setResultAudioUrl(stored ?? data.audioUrl);
      }

      setStatus('done');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 취소 시 크레딧 환불
        onRefundCredits?.(costKeyMap[mode]);
        setStatus('idle');
        setProgress(0);
        return;
      }
      // 실패 시 크레딧 환불
      onRefundCredits?.(costKeyMap[mode]);
      setErrorMsg(String(err));
      setStatus('error');
    }
  }, [uploadedFile, mode, intensity, startFakeProgress, onDeductCredits, onRefundCredits]);

  const handleCancel = () => {
    abortRef.current?.abort();
    if (progressRef.current) clearInterval(progressRef.current);
    setStatus('idle');
    setProgress(0);
    setProgressLabel('');
  };

  const handleReset = () => {
    setStatus('idle');
    setProgress(0);
    setErrorMsg('');
    setResultAudioUrl(null);
    setStemResults({});
    setProgressLabel('');
  };

  const cfg = modeConfig[mode];

  const processingSteps = [
    { label: '파일 업로드', icon: 'ri-upload-cloud-2-line', threshold: 20 },
    { label: 'AI 분석', icon: 'ri-cpu-line', threshold: 50 },
    { label: '오디오 처리', icon: 'ri-equalizer-line', threshold: 80 },
    { label: '결과 생성', icon: 'ri-check-double-line', threshold: 100 },
  ];

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      <PageHeader title={cfg.label} subtitle={cfg.sub} />

      {/* 모드 탭 */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 md:mb-6 p-1 bg-zinc-900/60 border border-white/5 rounded-2xl mx-3 md:mx-6 mt-4 md:mt-5">
        {(Object.keys(modeConfig) as CleanMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); handleReset(); }}
            disabled={status === 'uploading' || status === 'processing'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 md:py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${mode === m ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400' : 'border border-transparent text-zinc-500 hover:text-zinc-300'}`}
          >
            <i className={modeConfig[m].icon} />
            <span className="hidden sm:inline">{modeConfig[m].label}</span>
            <span className="sm:hidden text-[10px]">{modeConfig[m].label.replace('노이즈 제거', '노이즈').replace('Voice Isolation', 'Isolation').replace('스템 분리', '스템')}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 md:px-6 pb-6">
        {status === 'done' ? (
          <div className="flex flex-col gap-3 md:gap-4">
            {/* 완료 헤더 카드 */}
            <div className="flex items-center gap-2.5 md:gap-3 p-3 md:p-4 rounded-2xl bg-zinc-900/60 border border-white/5">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <i className="ri-check-double-line text-emerald-400 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{uploadedFile?.name}</p>
                <p className="text-[10px] text-zinc-500">처리 완료 · {cfg.label} · LALAL.AI Phoenix</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold">
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

            {mode === 'separate' ? (
              <div className="space-y-2.5 md:space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">분리된 트랙</p>
                  <span className="text-[10px] text-zinc-600">
                    {Object.keys(stemResults).length}개 트랙 완료
                  </span>
                </div>
                {stemTracks.map((track) => (
                  <StemTrackRow key={track.label} track={track} />
                ))}
                {Object.keys(stemResults).length === 0 && (
                  <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 text-center">
                    <i className="ri-information-line text-zinc-600 text-2xl mb-2 block" />
                    <p className="text-xs text-zinc-500">스템 분리 결과를 불러오는 중...</p>
                  </div>
                )}
              </div>
            ) : (
              resultAudioUrl ? (
                <AudioPlayer audioUrl={resultAudioUrl} fileName={uploadedFile?.name ?? 'audio'} />
              ) : (
                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-white/5 text-center">
                  <i className="ri-information-line text-zinc-600 text-2xl mb-2 block" />
                  <p className="text-xs text-zinc-500">처리된 오디오 URL을 가져오는 중...</p>
                </div>
              )
            )}
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="p-4 md:p-5 rounded-2xl bg-red-500/5 border border-red-500/20">
              <div className="flex items-start gap-2.5 md:gap-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="ri-error-warning-line text-red-400 text-sm" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-400 mb-1">처리 실패</p>
                  <p className="text-[11px] text-zinc-500 whitespace-pre-line leading-relaxed">{errorMsg}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line" /> 다시 시도
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 드롭존 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed transition-all duration-300 mb-4 md:mb-5 ${isDragging ? 'border-indigo-500/60 bg-indigo-500/5' : uploadedFile ? 'border-indigo-500/30 bg-zinc-900/60' : 'border-white/10 bg-zinc-900/40 hover:border-white/20 hover:bg-zinc-900/60'}`}
            >
              {uploadedFile ? (
                /* 파일 선택됨 */
                <div className="flex items-center gap-3 md:gap-4 p-3 md:p-5">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <i className="ri-file-music-line text-indigo-400 text-lg md:text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-bold text-white truncate">{uploadedFile.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB · 처리 준비 완료
                    </p>
                  </div>
                  <button
                    onClick={() => { setUploadedFile(null); setStatus('idle'); setProgress(0); setErrorMsg(''); }}
                    disabled={status === 'uploading' || status === 'processing'}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              ) : (
                /* 빈 드롭존 */
                <div className="flex flex-col items-center gap-3 md:gap-4 py-7 md:py-12 px-4 md:px-8 text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-zinc-800/80 border border-white/10 flex items-center justify-center">
                    <i className="ri-upload-cloud-2-line text-zinc-400 text-xl md:text-2xl" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm md:text-lg mb-1">
                      <span className="hidden sm:inline">Drop Audio Portal</span>
                      <span className="sm:hidden">파일을 선택하세요</span>
                    </p>
                    <p className="text-zinc-500 text-xs md:text-sm mb-1 hidden sm:block">오디오 또는 비디오 파일을 끌어다 놓거나 탐색기를 여세요.</p>
                    <p className="text-zinc-600 text-[10px] md:text-xs">MP3, WAV, M4A, FLAC · 최대 200MB</p>
                  </div>
                  <label className="mt-1 cursor-pointer">
                    <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileSelect} />
                    <span className="px-6 md:px-8 py-2 md:py-2.5 bg-white text-black text-xs font-black uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-colors">
                      CHOOSE ASSETS
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* 노이즈 강도 슬라이더 */}
            {mode === 'noise' && (
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5 mb-4 md:mb-5">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">노이즈 제거 강도</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${intensity >= 80 ? 'bg-red-500/10 text-red-400' : intensity >= 50 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-zinc-800 text-zinc-400'}`}>
                    {intensity >= 80 ? 'Aggressive' : intensity >= 50 ? 'Normal' : 'Mild'} · {intensity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={intensity}
                  onChange={(e) => setIntensity(parseInt(e.target.value))}
                  className="w-full h-1 cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-zinc-700">Mild (약하게)</span>
                  <span className="text-[10px] text-zinc-700">Aggressive (강하게)</span>
                </div>
              </div>
            )}

            {/* 처리 진행 바 */}
            {(status === 'uploading' || status === 'processing') && (
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5 mb-4 md:mb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span className="text-xs text-indigo-400 font-bold">{progressLabel}</span>
                  </div>
                  <span className="text-xs text-indigo-400 font-mono font-bold">{progress}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-3 md:mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {processingSteps.map((step) => (
                    <div key={step.label} className="flex flex-col items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${progress >= step.threshold ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-zinc-800/60 border border-white/5'}`}>
                        <i className={`${step.icon} text-xs ${progress >= step.threshold ? 'text-indigo-400' : 'text-zinc-600'}`} />
                      </div>
                      <span className={`text-[9px] text-center leading-tight ${progress >= step.threshold ? 'text-zinc-400' : 'text-zinc-700'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 mt-3 text-center">
                  LALAL.AI Phoenix 모델이 오디오를 처리하고 있습니다...
                </p>
              </div>
            )}

            {/* 처리 버튼 */}
            <div className="flex items-center justify-center gap-3 mt-auto pt-4 pb-2">
              {(status === 'uploading' || status === 'processing') ? (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-6 py-2.5 md:py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-stop-circle-line" /> 취소
                </button>
              ) : (
                <button
                  onClick={handleProcess}
                  disabled={!uploadedFile || credits < cfg.credit}
                  className="flex items-center gap-2 px-7 md:px-10 py-2.5 md:py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-sparkling-2-line" />
                  <span className="hidden sm:inline">{mode === 'noise' ? '노이즈 제거' : mode === 'isolate' ? '보이스 아이솔레이션' : '스템 분리'}</span>
                  <span className="sm:hidden text-xs">{mode === 'noise' ? '노이즈 제거' : mode === 'isolate' ? 'Isolation' : '스템 분리'}</span>
                  <span className="ml-1 flex items-center gap-0.5 bg-white/20 px-2 py-0.5 rounded-full text-xs font-black">
                    <i className="ri-copper-diamond-line text-xs" /> {cfg.credit}
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
