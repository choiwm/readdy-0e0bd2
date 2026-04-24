import { useState, useRef, useCallback } from 'react';
import PageHeader from '@/components/feature/PageHeader';
import SidebarCredits from '@/pages/ai-sound/components/SidebarCredits';
import SidebarUpgrade from '@/pages/ai-sound/components/SidebarUpgrade';
import { supabase } from '@/lib/supabase';

const TRANSCRIBE_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/generate-transcribe`;
const TRANSLATE_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/translate-text`;
const SUMMARIZE_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/summarize-text`;

const transcribeLangs = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

type TranscribeStatus = 'idle' | 'uploading' | 'transcribing' | 'done' | 'error';

interface TranscriptLine {
  time: string;
  startSec: number;
  endSec: number;
  speaker: string;
  text: string;
}

interface TranscribeResult {
  fullText: string;
  lines: TranscriptLine[];
  detectedLanguage: string;
  duration: number;
  wordCount: number;
  segmentCount: number;
}

interface TranscribeSidebarContentProps {
  credits: number;
  maxCredits: number;
}

export function TranscribeSidebarContent({ credits, maxCredits }: TranscribeSidebarContentProps) {
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-6">
      <SidebarCredits credits={credits} maxCredits={maxCredits} />

      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">지원 포맷</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {['MP3', 'WAV', 'M4A', 'FLAC', 'OGG', 'MP4', 'MOV', 'WEBM', 'MKV'].map((fmt) => (
            <div
              key={fmt}
              className="flex items-center justify-center px-2 py-2 rounded-lg bg-zinc-800/50 border border-white/5 text-[10px] text-zinc-400 font-bold"
            >
              {fmt}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1 mb-3">기능</h4>
        {[
          { icon: 'ri-time-line', label: '타임스탬프 포함', desc: '세그먼트별 시간 정보 제공' },
          { icon: 'ri-user-voice-line', label: '화자 분리', desc: '여러 화자 자동 구분' },
          { icon: 'ri-translate-2', label: '자동 언어 감지', desc: '99개 이상 언어 지원' },
          { icon: 'ri-file-text-line', label: 'SRT/VTT 내보내기', desc: '자막 파일 직접 생성' },
        ].map((feat) => (
          <div
            key={feat.label}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/40 border border-white/5"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className={`${feat.icon} text-indigo-400 text-xs`} />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-300">{feat.label}</p>
              <p className="text-[10px] text-zinc-600">{feat.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Powered by</span>
        </div>
        <p className="text-xs font-bold text-zinc-300">OpenAI Whisper</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">GoAPI를 통한 실시간 음성 인식</p>
      </div>

      <SidebarUpgrade />
    </div>
  );
}

interface TranscribePanelProps {
  onDeductCredits?: (key: import('@/pages/ai-sound/hooks/useSoundCredits').SoundCostKey) => boolean;
  credits?: number;
}

export default function TranscribePanel({ onDeductCredits, credits = 999 }: TranscribePanelProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLang, setSelectedLang] = useState('auto');
  const [withTimestamp, setWithTimestamp] = useState(true);
  const [withSpeaker, setWithSpeaker] = useState(true);
  const [status, setStatus] = useState<TranscribeStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [activeTab, setActiveTab] = useState<'transcript' | 'translate'>('transcript');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  // 번역 관련 상태
  const [translateTargetLang, setTranslateTargetLang] = useState('en');
  const [translatedLines, setTranslatedLines] = useState<{ time: string; startSec: number; endSec: number; speaker: string; text: string }[]>([]);
  const [translateStatus, setTranslateStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [translateError, setTranslateError] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { setUploadedFile(file); setStatus('idle'); setProgress(0); setResult(null); setErrorMsg(''); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setUploadedFile(f); setStatus('idle'); setProgress(0); setResult(null); setErrorMsg(''); }
  };

  const startFakeProgress = useCallback((from: number, to: number, durationMs: number, label: string) => {
    setProgressLabel(label);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    const steps = Math.ceil(durationMs / 150);
    const increment = (to - from) / steps;
    let current = from;
    progressTimerRef.current = setInterval(() => {
      current = Math.min(current + increment, to);
      setProgress(Math.round(current));
      if (current >= to) {
        clearInterval(progressTimerRef.current!);
        progressTimerRef.current = null;
      }
    }, 150);
  }, []);

  const handleTranscribe = async () => {
    if (!uploadedFile) return;

    // 크레딧 차감
    if (onDeductCredits && !onDeductCredits('transcribe')) {
      return;
    }

    abortRef.current = new AbortController();
    setStatus('uploading');
    setProgress(0);
    setErrorMsg('');
    setResult(null);
    startFakeProgress(0, 30, 1500, '파일 업로드 중...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const formData = new FormData();
      formData.append('audio', uploadedFile, uploadedFile.name);
      formData.append('language', selectedLang);
      formData.append('with_timestamp', String(withTimestamp));
      formData.append('with_speaker', String(withSpeaker));
      formData.append('response_format', 'verbose_json');
      setStatus('transcribing');
      startFakeProgress(30, 85, 8000, 'AI 음성 인식 중...');
      const res = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: { ...authHeader },
        body: formData,
        signal: abortRef.current.signal,
      });
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `서버 오류 (${res.status})`);
      setProgress(100);
      setProgressLabel('변환 완료!');
      await new Promise((r) => setTimeout(r, 400));
      setResult(data);
      setStatus('done');
    } catch (err: unknown) {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (err instanceof Error && err.name === 'AbortError') { setStatus('idle'); setProgress(0); return; }
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setStatus('idle');
    setProgress(0);
  };

  const handleReset = () => { setStatus('idle'); setProgress(0); setResult(null); setErrorMsg(''); setTranslatedLines([]); setTranslateStatus('idle'); };

  // 번역 탭 전환 시 자동 번역 실행
  const handleTabChange = async (tab: 'transcript' | 'translate') => {
    setActiveTab(tab);
    if (tab === 'translate' && result && translatedLines.length === 0 && translateStatus !== 'loading') {
      await handleTranslate(translateTargetLang);
    }
  };

  // 실제 번역 API 호출
  const handleTranslate = async (targetLang: string) => {
    if (!result) return;
    setTranslateStatus('loading');
    setTranslateError('');
    try {
      const fullText = result.lines.map((l) => {
        const parts: string[] = [];
        if (withTimestamp) parts.push(`[${l.time}]`);
        if (withSpeaker) parts.push(`${l.speaker}:`);
        parts.push(l.text);
        return parts.join(' ');
      }).join('\n');

      const res = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          targetLang,
          sourceLang: result.detectedLanguage !== 'unknown' ? result.detectedLanguage : 'auto',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? '번역 실패');

      const translatedRaw = data.translatedText as string;
      const translatedParts = translatedRaw.split('\n').filter((l: string) => l.trim());

      const mapped = result.lines.map((line, idx) => {
        const rawLine = translatedParts[idx] ?? '';
        let text = rawLine;
        if (withTimestamp) text = text.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
        if (withSpeaker) text = text.replace(/^[A-Z]:\s*/, '');
        return { ...line, text: text.trim() || line.text };
      });

      setTranslatedLines(mapped);
      setTranslateStatus('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTranslateError(msg);
      setTranslateStatus('error');
    }
  };

  // 번역 대상 언어 변경 시 재번역
  const handleTranslateLangChange = async (lang: string) => {
    setTranslateTargetLang(lang);
    setTranslatedLines([]);
    setTranslateStatus('idle');
    if (activeTab === 'translate' && result) {
      await handleTranslate(lang);
    }
  };

  // 현재 탭에 맞는 라인 반환
  const getDisplayLines = () => {
    if (activeTab === 'translate' && translateStatus === 'done' && translatedLines.length > 0) {
      return translatedLines;
    }
    return result?.lines ?? [];
  };

  const handleCopy = () => {
    if (!result) return;
    const lines = getDisplayLines();
    const text = lines
      .map((l) => {
        const parts: string[] = [];
        if (withTimestamp) parts.push(`[${l.time}]`);
        if (withSpeaker) parts.push(`${l.speaker}:`);
        parts.push(l.text);
        return parts.join(' ');
      })
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportSRT = () => {
    if (!result) return;
    const lines = getDisplayLines();
    const toSrtTime = (s: number) => {
      const h = Math.floor(s / 3600).toString().padStart(2, '0');
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
      const sec = Math.floor(s % 60).toString().padStart(2, '0');
      return `${h}:${m}:${sec},000`;
    };
    const srtContent = lines
      .map((line, idx) => `${idx + 1}\n${toSrtTime(line.startSec)} --> ${toSrtTime(line.endSec)}\n${withSpeaker ? `[${line.speaker}] ` : ''}${line.text}`)
      .join('\n\n');
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${uploadedFile?.name.replace(/\.[^.]+$/, '') ?? 'output'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTXT = () => {
    if (!result) return;
    const lines = getDisplayLines();
    const txtContent = lines
      .map((line) => {
        const parts: string[] = [];
        if (withTimestamp) parts.push(`[${line.time}]`);
        if (withSpeaker) parts.push(`${line.speaker}:`);
        parts.push(line.text);
        return parts.join(' ');
      })
      .join('\n\n');
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${uploadedFile?.name.replace(/\.[^.]+$/, '') ?? 'output'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSummary = async () => {
    if (!result) return;
    setSummaryLoading(true);
    setSummaryOpen(true);
    setSummaryText('');
    try {
      // 현재 탭 기준 텍스트 사용 (번역 탭이면 번역 텍스트로 요약)
      const lines = getDisplayLines();
      const fullText = lines.map((l) => l.text).join(' ');

      const res = await fetch(SUMMARIZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullText,
          targetLang: activeTab === 'translate' ? translateTargetLang : (result.detectedLanguage !== 'unknown' ? result.detectedLanguage : 'ko'),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? '요약 실패');

      setSummaryText(data.summaryText ?? '');
    } catch (_err) {
      // AI 요약 실패 시 fallback: 앞부분 텍스트 사용
      const fallback = result.fullText.slice(0, 300) + (result.fullText.length > 300 ? '...' : '');
      setSummaryText(fallback);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const speakerColor: Record<string, string> = {
    A: 'text-indigo-400',
    B: 'text-violet-400',
    C: 'text-emerald-400',
    D: 'text-amber-400',
  };

  const isProcessing = status === 'uploading' || status === 'transcribing';

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Summary Modal — mobile bottom sheet style */}
      {summaryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg bg-zinc-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            {/* drag handle on mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/5">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <i className="ri-sparkling-2-line text-indigo-400 text-xs md:text-sm" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-bold text-white">AI 요약</h3>
                  <p className="text-[10px] text-zinc-500 hidden sm:block">변환된 텍스트 기반 요약</p>
                </div>
              </div>
              <button
                onClick={() => setSummaryOpen(false)}
                className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex-shrink-0"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
            <div className="p-4 md:p-6">
              {summaryLoading ? (
                <div className="flex flex-col items-center gap-4 py-6 md:py-8">
                  <div className="w-8 h-8 md:w-10 md:h-10 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                  <p className="text-xs text-zinc-400">텍스트를 분석하고 있습니다...</p>
                </div>
              ) : (
                <>
                  <p className="text-xs md:text-sm text-zinc-300 leading-relaxed">{summaryText}</p>
                  <div className="flex items-center gap-2 mt-4 md:mt-5 pt-3 md:pt-4 border-t border-white/5 flex-wrap">
                    <button
                      onClick={() => { navigator.clipboard.writeText(summaryText); setSummaryOpen(false); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 rounded-xl bg-zinc-800/60 border border-white/5 text-xs font-bold text-zinc-400 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-clipboard-line" /> 복사
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'summary.txt';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 md:py-2 rounded-xl bg-zinc-800/60 border border-white/5 text-xs font-bold text-zinc-400 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-download-line" /> TXT 저장
                    </button>
                    <button
                      onClick={() => setSummaryOpen(false)}
                      className="ml-auto flex items-center gap-1.5 px-4 py-1.5 md:py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-xs font-bold text-indigo-400 hover:bg-indigo-500/30 transition-all cursor-pointer whitespace-nowrap"
                    >
                      닫기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <PageHeader title="AI Transcribe" subtitle="Speech to Text · Whisper · 99+ Languages" />

      {/* Main scroll area — tighter padding on mobile */}
      <div className="flex flex-col flex-1 px-3 md:px-6 pb-4 md:pb-6 overflow-y-auto">
        {status !== 'done' ? (
          <>
            {/* ── Drop Zone ── */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed transition-all duration-300 mb-4 md:mb-5 ${
                isDragging
                  ? 'border-indigo-500/60 bg-indigo-500/5'
                  : uploadedFile
                  ? 'border-indigo-500/30 bg-indigo-500/5'
                  : 'border-white/10 bg-zinc-900/30 hover:border-white/20 hover:bg-zinc-900/50'
              }`}
            >
              {uploadedFile ? (
                /* File selected — compact row */
                <div className="flex items-center gap-3 p-3 md:p-5">
                  <div className="w-9 h-9 md:w-12 md:h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <i className="ri-file-music-line text-indigo-400 text-base md:text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-bold text-white truncate">{uploadedFile.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {(uploadedFile.size / 1024 / 1024).toFixed(1)}MB · 업로드 준비 완료
                    </p>
                  </div>
                  {!isProcessing && (
                    <button
                      onClick={() => { setUploadedFile(null); setStatus('idle'); setProgress(0); setResult(null); setErrorMsg(''); }}
                      className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex-shrink-0"
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                  )}
                </div>
              ) : (
                /* Empty drop zone — compact on mobile */
                <div className="flex flex-col items-center gap-3 md:gap-4 py-7 md:py-12 px-4 md:px-8 text-center">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-zinc-800/80 border border-white/10 flex items-center justify-center">
                    <i className="ri-upload-cloud-2-line text-zinc-400 text-xl md:text-2xl" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm md:text-lg mb-1">
                      <span className="hidden sm:inline">오디오 또는 비디오 파일을 드래그하세요</span>
                      <span className="sm:hidden">파일을 선택하세요</span>
                    </p>
                    <p className="text-zinc-500 text-xs md:text-sm mb-1">
                      MP3, WAV, M4A, FLAC, MP4
                      <span className="hidden sm:inline">, MOV, WEBM</span>
                      <span className="hidden md:inline"> · 최대 25MB</span>
                    </p>
                    <p className="text-zinc-600 text-[10px] md:text-xs hidden sm:block">
                      Whisper AI가 99개 이상 언어를 자동 인식합니다
                    </p>
                  </div>
                  <label className="cursor-pointer">
                    <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileChange} />
                    <span className="px-6 md:px-8 py-2 md:py-2.5 bg-white text-black text-xs font-black uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-colors">
                      CHOOSE FILE
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* ── Settings ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
              {/* Language select */}
              <div className="sm:col-span-1 rounded-2xl bg-zinc-900/60 border border-white/5 p-3 md:p-4">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 md:mb-3">언어 선택</p>
                <div className="relative">
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-zinc-800/60 border border-white/5 text-xs text-zinc-300 px-3 py-2 md:py-2.5 rounded-xl appearance-none cursor-pointer focus:outline-none focus:border-indigo-500/30 transition-colors disabled:opacity-50"
                  >
                    <option value="auto" className="bg-zinc-900">🌐 자동 감지</option>
                    {transcribeLangs.map((l) => (
                      <option key={l.code} value={l.code} className="bg-zinc-900">
                        {l.flag} {l.label}
                      </option>
                    ))}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none text-sm" />
                </div>
              </div>

              {/* Timestamp toggle */}
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-3 md:p-4 flex items-center justify-between sm:flex-col sm:items-start sm:justify-between">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest sm:mb-3">타임스탬프</p>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-xs text-zinc-400">{withTimestamp ? 'ON' : 'OFF'}</span>
                  <button
                    onClick={() => setWithTimestamp(!withTimestamp)}
                    disabled={isProcessing}
                    className={`relative w-10 h-5 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 disabled:opacity-50 ${withTimestamp ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${withTimestamp ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Speaker toggle */}
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-3 md:p-4 flex items-center justify-between sm:flex-col sm:items-start sm:justify-between">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest sm:mb-3">화자 분리</p>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-xs text-zinc-400">{withSpeaker ? 'ON' : 'OFF'}</span>
                  <button
                    onClick={() => setWithSpeaker(!withSpeaker)}
                    disabled={isProcessing}
                    className={`relative w-10 h-5 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0 disabled:opacity-50 ${withSpeaker ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${withSpeaker ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Progress ── */}
            {isProcessing && (
              <div className="rounded-2xl bg-zinc-900/60 border border-white/5 p-4 md:p-5 mb-4 md:mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span className="text-xs text-indigo-400 font-bold">{progressLabel}</span>
                  </div>
                  <span className="text-xs text-indigo-400 font-mono font-bold">{progress}%</span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-zinc-600 hidden sm:block">
                    {status === 'uploading' ? '파일을 서버에 업로드하고 있습니다...' : 'Whisper AI가 음성을 텍스트로 변환하고 있습니다...'}
                  </p>
                  <button
                    onClick={handleCancel}
                    className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {status === 'error' && (
              <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-3 md:p-4 mb-4 md:mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-error-warning-line text-red-400 text-sm" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-red-400 mb-1">변환 실패</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{errorMsg}</p>
                    {errorMsg.includes('GOAPI_KEY') && (
                      <p className="text-[10px] text-zinc-600 mt-1.5">
                        Supabase → Edge Functions → Secrets에서{' '}
                        <span className="text-indigo-400 font-bold">GOAPI_KEY</span>를 등록해주세요.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-[10px] text-zinc-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            )}

            {/* ── Transcribe Button ── */}
            <div className="flex justify-center mt-auto pt-3 md:pt-4">
              <button
                onClick={handleTranscribe}
                disabled={!uploadedFile || isProcessing || credits < 3}
                className="flex items-center gap-2 px-8 md:px-10 py-3 md:py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-full transition-all cursor-pointer whitespace-nowrap"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="hidden sm:inline">{progressLabel}</span>
                    <span className="sm:hidden">처리 중...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-sparkling-2-line" />
                    <span className="hidden sm:inline">변환 시작</span>
                    <span className="sm:hidden">변환</span>
                    <span className="flex items-center gap-0.5 bg-white/20 px-2 py-0.5 rounded-full text-xs font-black">
                      <i className="ri-copper-diamond-line text-xs" /> 3
                    </span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          /* ── Result View ── */
          <div className="flex flex-col flex-1 min-h-0">
            {/* File Info Bar */}
            <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-2xl bg-zinc-900/60 border border-white/5 mb-4 md:mb-5">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                <i className="ri-file-music-line text-indigo-400 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{uploadedFile?.name}</p>
                <p className="text-[10px] text-zinc-500">
                  {result && formatDuration(result.duration)}
                  <span className="hidden sm:inline"> · {result?.segmentCount}개 세그먼트 · {result?.wordCount} 단어</span>
                  {result?.detectedLanguage && result.detectedLanguage !== 'unknown' && (
                    <> · <span className="text-indigo-400">{result.detectedLanguage}</span></>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
                <span className="flex items-center gap-1 px-1.5 md:px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold">
                  <i className="ri-check-line" />
                  <span className="hidden sm:inline">완료</span>
                </span>
                <span className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-400 font-bold">
                  <i className="ri-sparkling-2-line" /> Whisper
                </span>
                <button
                  onClick={handleReset}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex-shrink-0"
                >
                  <i className="ri-refresh-line text-xs" />
                </button>
              </div>
            </div>

            {/* Tab */}
            <div className="flex items-center gap-1 mb-3 md:mb-4 bg-zinc-900/60 border border-white/5 rounded-xl p-1 w-fit">
              {(['transcript', 'translate'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none border ${
                    activeTab === tab
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                      : 'text-zinc-500 hover:text-white border-transparent'
                  }`}
                >
                  {tab === 'transcript' ? '원문 텍스트' : '번역'}
                </button>
              ))}
            </div>

            {/* 번역 탭 언어 선택 */}
            {activeTab === 'translate' && (
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[10px] text-zinc-500 font-bold">번역 언어:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {transcribeLangs.filter((l) => l.code !== 'auto').map((l) => (
                    <button
                      key={l.code}
                      onClick={() => handleTranslateLangChange(l.code)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                        translateTargetLang === l.code
                          ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
                          : 'bg-zinc-800/60 border border-transparent text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span>{l.flag}</span>
                      <span className="hidden sm:inline">{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 번역 로딩/에러 상태 */}
            {activeTab === 'translate' && translateStatus === 'loading' && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin flex-shrink-0" />
                <span className="text-[11px] text-indigo-400">AI 번역 중...</span>
              </div>
            )}
            {activeTab === 'translate' && translateStatus === 'error' && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/8 border border-red-500/20">
                <i className="ri-error-warning-line text-red-400 text-xs flex-shrink-0" />
                <span className="text-[11px] text-red-400 flex-1">{translateError}</span>
                <button
                  onClick={() => handleTranslate(translateTargetLang)}
                  className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer whitespace-nowrap"
                >
                  재시도
                </button>
              </div>
            )}

            {/* Transcript Lines */}
            <div className="flex-1 overflow-y-auto rounded-2xl bg-zinc-900/40 border border-white/5 p-3 md:p-5 space-y-3 md:space-y-4 min-h-0">
              {getDisplayLines().map((line, idx) => (
                <div key={idx} className="flex gap-2 md:gap-3 group">
                  {withTimestamp && (
                    <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0 mt-0.5 w-10 md:w-16">
                      {line.time}
                    </span>
                  )}
                  {withSpeaker && (
                    <span className={`text-[10px] font-black flex-shrink-0 mt-0.5 w-4 md:w-5 ${speakerColor[line.speaker] ?? 'text-zinc-400'}`}>
                      {line.speaker}
                    </span>
                  )}
                  <p className="text-xs md:text-sm text-zinc-300 leading-relaxed flex-1">
                    {line.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/5 gap-2 flex-wrap">
              <span className="text-[10px] text-zinc-600 hidden sm:block">
                {result?.segmentCount}개 세그먼트 · 약 {result?.wordCount} 단어
              </span>
              <div className="flex items-center gap-1.5 md:gap-2 flex-wrap w-full sm:w-auto">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    copied
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-zinc-800/60 border border-white/5 text-zinc-400 hover:text-white hover:border-white/10'
                  }`}
                >
                  <i className={copied ? 'ri-check-line' : 'ri-clipboard-line'} />
                  {copied ? '복사됨' : '복사'}
                </button>
                <button
                  onClick={handleExportSRT}
                  className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl bg-zinc-800/60 border border-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line" /> SRT
                </button>
                <button
                  onClick={handleExportTXT}
                  className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl bg-zinc-800/60 border border-white/5 text-xs font-bold text-zinc-400 hover:text-white hover:border-white/10 transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line" /> TXT
                </button>
                <button
                  onClick={handleSummary}
                  className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-xs font-bold text-white transition-all cursor-pointer whitespace-nowrap ml-auto sm:ml-0"
                >
                  <i className="ri-sparkling-2-line" />
                  <span className="hidden sm:inline">요약 생성</span>
                  <span className="sm:hidden">요약</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
