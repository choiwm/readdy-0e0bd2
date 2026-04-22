import { useState, useRef, useCallback, useEffect } from 'react';
import { voices, Voice } from '@/mocks/voiceLibrary';
import { AudioHistoryItem } from '@/mocks/audioHistory';
import { SoundCostKey } from '@/pages/ai-sound/hooks/useSoundCredits';
import PageHeader from '@/components/feature/PageHeader';
import { SpeechModel, SpeechParams } from '@/pages/ai-sound/components/FilterSidebar';
import { ErrorBanner, useApiError } from '@/components/base/ErrorBanner';
import { uploadAudioToStorage } from '@/hooks/useAudioHistory';
import { supabase } from '@/lib/supabase';

interface SpeechSegment {
  id: string;
  voiceId: string | number;
  text: string;
}

interface SpeechMainPanelProps {
  selectedVoice: Voice | null;
  model: SpeechModel;
  onModelChange?: (m: SpeechModel) => void;
  params: SpeechParams;
  recentItems: AudioHistoryItem[];
  credits: number;
  onDeductCredits: (key: SoundCostKey) => boolean;
  onGenerateStart: (id: string, title: string, text: string, voice: Voice, type?: import('@/mocks/audioHistory').AudioType) => void;
  onGenerateComplete: (id: string, audioUrl?: string, storageUrl?: string, durationSec?: number) => void;
  onGenerateCancel: (id: string) => void;
}

export default function SpeechMainPanel({
  selectedVoice,
  model,
  onModelChange,
  params,
  recentItems,
  credits,
  onDeductCredits,
  onGenerateStart,
  onGenerateComplete,
  onGenerateCancel,
}: SpeechMainPanelProps) {
  const defaultVoice = selectedVoice ?? voices[0];
  const [segments, setSegments] = useState<SpeechSegment[]>([
    { id: 'seg-1', voiceId: defaultVoice.id, text: '' },
  ]);

  // selectedVoice가 외부에서 변경되면 첫 번째 세그먼트 voiceId 동기화
  useEffect(() => {
    if (selectedVoice) {
      setSegments((prev) =>
        prev.map((seg, idx) => idx === 0 ? { ...seg, voiceId: selectedVoice.id } : seg)
      );
    }
  }, [selectedVoice]);
  const [activeSegId, setActiveSegId] = useState('seg-1');
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenId, setCurrentGenId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [isApiCalling, setIsApiCalling] = useState(false);
  const [isSavingToStorage, setIsSavingToStorage] = useState(false);
  const [lastGenerateArgs, setLastGenerateArgs] = useState<{ text: string; voice: Voice } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { error, setApiError, clearError } = useApiError();

  const ttsHistory = recentItems.filter((i) => i.type === 'tts' && i.status === 'completed').slice(0, 8);

  const handleLoadHistory = (item: AudioHistoryItem) => {
    setSegments([{ id: 'seg-1', voiceId: defaultVoice.id, text: item.text }]);
    setActiveSegId('seg-1');
    setHistoryOpen(false);
  };

  const totalChars = segments.reduce((s, seg) => s + seg.text.length, 0);
  const maxChars = 5000;

  const modelLabel = model === 'flash' ? '2.5 Flash' : 'V3 Alpha';
  const modelCredit = model === 'flash' ? 0 : 2;
  const costKey: SoundCostKey = model === 'flash' ? 'tts_flash' : 'tts_v3';

  const getVoice = useCallback((id: string | number) => voices.find((v) => v.id === id) ?? defaultVoice, [defaultVoice]);

  const updateSegText = (id: string, text: string) => {
    if (totalChars - (segments.find((s) => s.id === id)?.text.length ?? 0) + text.length > maxChars) return;
    setSegments((prev) => prev.map((s) => s.id === id ? { ...s, text } : s));
  };

  const addSegment = () => {
    const newId = `seg-${Date.now()}`;
    setSegments((prev) => [...prev, { id: newId, voiceId: defaultVoice.id, text: '' }]);
    setActiveSegId(newId);
  };

  const removeSegment = (id: string) => {
    if (segments.length <= 1) return;
    const remaining = segments.filter((s) => s.id !== id);
    setSegments(remaining);
    // 삭제 후 남은 세그먼트 중 첫 번째로 activeSegId 설정
    if (activeSegId === id) {
      setActiveSegId(remaining[0]?.id ?? '');
    }
  };

  const changeSegVoice = (segId: string, voiceId: string | number) => {
    setSegments((prev) => prev.map((s) => s.id === segId ? { ...s, voiceId } : s));
    setVoiceDropdownOpen(null);
  };

  // 단일 세그먼트 TTS 호출 헬퍼
  // authentication.md: supabase.functions.invoke 사용 — Authorization 헤더 자동 포함
  const callTtsApi = useCallback(async (
    text: string,
    voiceName: string,
    signal: AbortSignal,
  ): Promise<string | null> => {
    const invokePromise = supabase.functions.invoke('generate-tts', {
      body: {
        text,
        voiceName,
        model,
        stability: params.stability,
        similarity_boost: params.similarity,
        style: params.style,
        speed: params.speed,
      },
    });

    const abortPromise = new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });

    const { data, error: invokeError } = (await Promise.race([invokePromise, abortPromise])) as {
      data: { error?: string; audioUrl?: string; audioBase64?: string; mimeType?: string } | null;
      error: { message?: string } | null;
    };

    if (invokeError) throw new Error(invokeError.message ?? '서버 오류');
    if (data?.error) throw new Error(data.error);

    if (data?.audioUrl) return data.audioUrl;
    if (data?.audioBase64) {
      const blob = new Blob(
        [Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))],
        { type: data.mimeType ?? 'audio/mpeg' }
      );
      return URL.createObjectURL(blob);
    }
    return null;
  }, [model, params]);

  const handleGenerate = useCallback(async (retryArgs?: { text: string; voice: Voice }) => {
    // 레거시 retry 경로: 단일 텍스트+보이스
    if (retryArgs) {
      if (!onDeductCredits(costKey)) return;
      setIsGenerating(true);
      setIsApiCalling(true);
      clearError();
      setGeneratedAudioUrl(null);
      const newId = `tts-${Date.now()}`;
      setCurrentGenId(newId);
      onGenerateStart(newId, retryArgs.text.slice(0, 24) + '...', retryArgs.text, retryArgs.voice);
      abortRef.current = new AbortController();
      try {
        const blobUrl = await callTtsApi(retryArgs.text, retryArgs.voice.name, abortRef.current.signal);
        setGeneratedAudioUrl(blobUrl);
        setIsGenerating(false);
        setIsApiCalling(false);
        setCurrentGenId(null);
        let storageUrl: string | undefined;
        if (blobUrl) {
          setIsSavingToStorage(true);
          const uploaded = await uploadAudioToStorage(blobUrl, `tts-${newId}-${Date.now()}.mp3`);
          if (uploaded) storageUrl = uploaded;
          setIsSavingToStorage(false);
        }
        onGenerateComplete(newId, blobUrl ?? undefined, storageUrl);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('aborted') || errMsg.includes('abort')) return;
        setIsGenerating(false); setIsApiCalling(false); setCurrentGenId(null);
        setApiError(err, errMsg); onGenerateCancel(newId);
      }
      return;
    }

    // 세그먼트별 다중 보이스 처리
    const validSegs = segments.filter((s) => s.text.trim().length > 0);
    if (validSegs.length === 0) return;
    if (!onDeductCredits(costKey)) return;

    setIsGenerating(true);
    setIsApiCalling(true);
    clearError();
    setGeneratedAudioUrl(null);

    const allText = validSegs.map((s) => s.text).join('\n');
    const firstVoice = getVoice(validSegs[0].voiceId);
    const newId = `tts-${Date.now()}`;
    setCurrentGenId(newId);
    setLastGenerateArgs({ text: allText, voice: firstVoice });
    onGenerateStart(newId, allText.slice(0, 24) + '...', allText, firstVoice);

    abortRef.current = new AbortController();

    try {
      // 세그먼트가 1개이거나 모두 같은 보이스면 단일 호출
      const allSameVoice = validSegs.every((s) => s.voiceId === validSegs[0].voiceId);

      let finalBlobUrl: string | null = null;

      if (validSegs.length === 1 || allSameVoice) {
        // 단일 API 호출
        finalBlobUrl = await callTtsApi(allText, firstVoice.name, abortRef.current.signal);
      } else {
        // 세그먼트별 개별 호출 → 순서대로 표시 (첫 번째 결과를 대표 URL로)
        const results: string[] = [];
        for (const seg of validSegs) {
          const voice = getVoice(seg.voiceId);
          const url = await callTtsApi(seg.text.trim(), voice.name, abortRef.current.signal);
          if (url) results.push(url);
        }
        // 첫 번째 세그먼트 결과를 대표 URL로 사용
        finalBlobUrl = results[0] ?? null;
      }

      setGeneratedAudioUrl(finalBlobUrl);
      setIsGenerating(false);
      setIsApiCalling(false);
      setCurrentGenId(null);

      let storageUrl: string | undefined;
      if (finalBlobUrl) {
        setIsSavingToStorage(true);
        const uploaded = await uploadAudioToStorage(finalBlobUrl, `tts-${newId}-${Date.now()}.mp3`);
        if (uploaded) storageUrl = uploaded;
        setIsSavingToStorage(false);
      }

      onGenerateComplete(newId, finalBlobUrl ?? undefined, storageUrl);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('aborted') || errMsg.includes('abort')) return;
      setIsGenerating(false);
      setIsApiCalling(false);
      setCurrentGenId(null);
      setApiError(err, errMsg);
      onGenerateCancel(newId);
    }
  }, [segments, costKey, onDeductCredits, onGenerateStart, onGenerateComplete, onGenerateCancel, clearError, setApiError, callTtsApi, getVoice]);

  const handleRetry = useCallback(() => {
    if (lastGenerateArgs) { clearError(); handleGenerate(lastGenerateArgs); }
  }, [lastGenerateArgs, clearError, handleGenerate]);

  const handleCancel = () => {
    abortRef.current?.abort();
    if (currentGenId) onGenerateCancel(currentGenId);
    setIsGenerating(false);
    setIsApiCalling(false);
    setCurrentGenId(null);
  };

  const speakerColors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-pink-500', 'bg-amber-500'];
  const canGenerate = totalChars > 0 && !isGenerating && (modelCredit === 0 || credits >= modelCredit);

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

      {/* PageHeader — history dropdown */}
      <PageHeader
        title="Text to Speech"
        subtitle="Dialogue Editor"
        statusLabel={`${credits} credits`}
        actions={
          ttsHistory.length > 0 ? (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  historyOpen
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                    : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:border-indigo-500/30 hover:text-indigo-400'
                }`}
              >
                <i className="ri-history-line text-sm" />
                <span className="hidden sm:inline">이전 텍스트</span>
                <span className="px-1.5 py-px rounded-md bg-zinc-800 text-zinc-500 text-[9px] font-black">
                  {ttsHistory.length}
                </span>
                <i className={historyOpen ? 'ri-arrow-up-s-line text-xs' : 'ri-arrow-down-s-line text-xs'} />
              </button>

              {historyOpen && (
                /* Mobile: full-width below header / Desktop: right-aligned dropdown */
                <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">이전 생성 텍스트</span>
                    <button
                      onClick={() => setHistoryOpen(false)}
                      className="text-zinc-600 hover:text-white cursor-pointer transition-colors"
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                  <div className="max-h-56 md:max-h-64 overflow-y-auto p-2 flex flex-col gap-1">
                    {ttsHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleLoadHistory(item)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <img
                            src={item.voiceAvatar}
                            alt={item.voiceName}
                            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                          />
                          <span className="text-[10px] font-bold text-zinc-400 truncate">{item.voiceName}</span>
                          <span className="ml-auto text-[9px] text-zinc-600 flex-shrink-0">{item.duration}s</span>
                        </div>
                        <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed group-hover:text-white transition-colors">
                          {item.text}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : undefined
        }
      />

      {/* 생성된 오디오 플레이어 */}
      {generatedAudioUrl && (
        <div className="mx-3 md:mx-6 mt-3 p-2.5 md:p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <i className="ri-music-2-line text-emerald-400 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] md:text-[11px] font-bold text-emerald-300">GoAPI TTS 생성 완료</p>
              {isSavingToStorage ? (
                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                  <div className="w-2.5 h-2.5 border border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                  저장 중...
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[9px] text-emerald-500/60">
                  <i className="ri-cloud-line text-[10px]" />
                  저장됨
                </div>
              )}
            </div>
            <audio
              controls
              src={generatedAudioUrl}
              className="w-full h-7"
              style={{ filter: 'invert(0.8) hue-rotate(120deg)' }}
            />
          </div>
          <button
            onClick={() => setGeneratedAudioUrl(null)}
            className="w-6 h-6 flex items-center justify-center rounded text-emerald-500/50 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      )}

      {/* Segment editor */}
      <div
        className="flex-1 overflow-y-auto px-3 md:px-6 pb-4 space-y-2 mt-3"
        onClick={() => setVoiceDropdownOpen(null)}
      >
        {segments.map((seg, idx) => {
          const voice = getVoice(seg.voiceId);
          const colorClass = speakerColors[idx % speakerColors.length];
          const isActive = activeSegId === seg.id;

          return (
            <div
              key={seg.id}
              onClick={(e) => { e.stopPropagation(); setActiveSegId(seg.id); }}
              className={`group rounded-2xl border transition-all ${
                isActive
                  ? 'border-white/10 bg-zinc-900/60'
                  : 'border-transparent hover:border-white/5 hover:bg-zinc-900/30'
              }`}
            >
              {/* Segment header */}
              <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 pt-3 md:pt-4 pb-2">
                {/* Voice picker button */}
                <div className="relative flex-1 min-w-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVoiceDropdownOpen(voiceDropdownOpen === seg.id ? null : seg.id);
                    }}
                    className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-full border border-white/10 bg-zinc-800/60 hover:bg-zinc-800 transition-all cursor-pointer max-w-full"
                  >
                    <span
                      className={`w-4 h-4 md:w-5 md:h-5 rounded-full ${colorClass} flex items-center justify-center flex-shrink-0`}
                    >
                      <span className="text-[8px] md:text-[9px] font-black text-white">{voice.name[0]}</span>
                    </span>
                    <span className="text-xs font-bold text-white truncate max-w-[80px] md:max-w-none">
                      {voice.name}
                    </span>
                    <i className="ri-arrow-down-s-line text-zinc-500 text-xs flex-shrink-0" />
                  </button>

                  {/* Voice dropdown — full width on mobile, fixed on desktop */}
                  {voiceDropdownOpen === seg.id && (
                    <div
                      className="absolute top-full left-0 mt-1 w-full sm:w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-1.5 md:p-2 max-h-48 md:max-h-52 overflow-y-auto">
                        {voices.slice(0, 12).map((v) => (
                          <button
                            key={v.id}
                            onClick={() => changeSegVoice(seg.id, v.id)}
                            className={`w-full flex items-center gap-2 md:gap-2.5 px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg text-left transition-all cursor-pointer ${
                              seg.voiceId === v.id
                                ? 'bg-indigo-500/15 text-indigo-400'
                                : 'text-zinc-300 hover:bg-white/5'
                            }`}
                          >
                            <img
                              src={v.avatar}
                              alt={v.name}
                              className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">{v.name}</p>
                              <p className="text-[9px] text-zinc-500">{v.lang}</p>
                            </div>
                            {seg.voiceId === v.id && (
                              <i className="ri-check-line text-indigo-400 text-xs flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Delete segment button:
                    - Desktop: hidden until hover
                    - Mobile: always visible when multiple segments */}
                {segments.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSegment(seg.id); }}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex-shrink-0"
                  >
                    <i className="ri-close-line text-xs" />
                  </button>
                )}
              </div>

              {/* Textarea */}
              <div className="px-3 md:px-4 pb-3 md:pb-4">
                <textarea
                  value={seg.text}
                  onChange={(e) => updateSegText(seg.id, e.target.value)}
                  placeholder="이 목소리로 읽을 텍스트를 입력하세요..."
                  className="w-full bg-transparent text-zinc-200 text-xs md:text-sm leading-relaxed resize-none outline-none placeholder-zinc-700 min-h-[72px] md:min-h-[80px]"
                  rows={3}
                />
              </div>
            </div>
          );
        })}

        {/* Add segment button */}
        <button
          onClick={addSegment}
          className="w-full flex items-center gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-xl border border-dashed border-white/10 text-zinc-600 hover:text-zinc-400 hover:border-white/20 transition-all cursor-pointer text-xs font-medium"
        >
          <i className="ri-add-line" /> 세그먼트 추가
        </button>
      </div>

      {/* Bottom action bar */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#0d0d0f]/80 backdrop-blur-sm px-3 md:px-6 py-2.5 md:py-4">
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          {/* Char count */}
          <div className="flex items-center gap-2 md:gap-3 text-xs text-zinc-500">
            <span className={totalChars > maxChars * 0.9 ? 'text-amber-400' : ''}>
              {totalChars.toLocaleString()} / {maxChars.toLocaleString()}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-700 hidden sm:block" />
            <span className="hidden sm:block">{segments.length}개 세그먼트</span>
          </div>

          {/* GoAPI badge */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/8 border border-emerald-500/15">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isApiCalling ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`}
            />
            <span className="text-[9px] text-emerald-400/70 font-bold hidden sm:block">GoAPI TTS</span>
          </div>

          <div className="flex-1" />

          {/* Model toggle */}
          <button
            onClick={() => { const next: SpeechModel = model === 'flash' ? 'v3' : 'flash'; onModelChange?.(next); }}
            className="flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 md:py-2 rounded-xl bg-zinc-900 border border-white/5 cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all"
            title="모델 전환 (Flash ↔ V3)"
          >
            <span className="text-xs font-bold text-zinc-300">{modelLabel}</span>
            <span className="text-[9px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-md font-bold hidden sm:block">
              {model === 'flash' ? '권장' : 'Alpha'}
            </span>
            <i className="ri-refresh-line text-zinc-500 text-xs" />
          </button>

          {/* Cancel button */}
          {isGenerating && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs md:text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-stop-circle-line text-sm" />
              <span className="hidden sm:block">취소</span>
            </button>
          )}

          {/* Generate button */}
          <button
            onClick={() => handleGenerate()}
            disabled={!canGenerate}
            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 font-bold text-xs md:text-sm rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              !canGenerate && !isGenerating
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="hidden sm:block">{isApiCalling ? 'GoAPI 처리 중...' : '생성 중...'}</span>
              </>
            ) : (
              <>
                <i className="ri-sparkling-2-line text-sm" />
                생성
                {modelCredit > 0 && (
                  <span className="flex items-center gap-0.5 bg-white/20 px-1.5 py-0.5 rounded-md text-xs font-black">
                    <i className="ri-copper-diamond-line text-xs" /> {modelCredit}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
