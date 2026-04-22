import { useState, useRef, useEffect, useCallback } from 'react';
import ConfirmModal from '@/components/base/ConfirmModal';
import { Toast } from '@/components/base/Toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Step2ScriptProps {
  onNext: (script: string) => void;
  onBack: () => void;
  selectedStyle?: string | null;
  selectedRatio?: string;
  keywords?: string[];
  channelName?: string;
  initialTitle?: string;
  initialScript?: string;
}

export default function Step2Script({ onNext, onBack, selectedStyle, selectedRatio, keywords = [], channelName = '', initialTitle, initialScript }: Step2ScriptProps) {
  const { profile } = useAuth();
  const [projectTitle, setProjectTitle] = useState(
    initialTitle ?? (channelName ? `${channelName} - 새 영상` : '새 영상 프로젝트')
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [script, setScript] = useState(initialScript ?? '');
  const [videoLength, setVideoLength] = useState(60);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApiLoading, setIsApiLoading] = useState(false); // API 응답 대기 중 (스트리밍 전)
  const [creditCost] = useState(2);
  const [apiError, setApiError] = useState<string | null>(null);

  // Confirm/Toast state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showGeneratedToast, setShowGeneratedToast] = useState(false);

  // Voice upload state
  const [showVoiceUpload, setShowVoiceUpload] = useState(false);
  const [isDraggingVoice, setIsDraggingVoice] = useState(false);
  const [uploadedVoice, setUploadedVoice] = useState<{ name: string; size: string; duration: string } | null>(null);
  const [voiceUploadProgress, setVoiceUploadProgress] = useState(0);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const voiceInputRef = useRef<HTMLInputElement>(null);

  const maxChars = 15000;
  const charCount = script.length;

  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── 실제 AI 대본 생성 (generate-script Edge Function) ──────────────────
  const startStreaming = useCallback(async () => {
    setIsGenerating(true);
    setIsApiLoading(true);
    setScript('');
    setApiError(null);

    // AbortController for cancellation
    abortRef.current = new AbortController();

    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
        body: {
          keywords,
          style: selectedStyle,
          ratio: selectedRatio ?? '16:9',
          channelName,
          videoLength,
          user_id: profile?.id ?? null,
        },
      });

      if (abortRef.current?.signal.aborted) return;

      setIsApiLoading(false);

      // Edge Function 에러 파싱 — non-2xx 응답의 실제 메시지 추출
      if (error) {
        let errMsg = '대본 생성 실패';
        try {
          // FunctionsHttpError의 경우 context에 실제 응답 body가 있음
          const ctx = (error as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            errMsg = body?.error ?? body?.message ?? errMsg;
          } else {
            errMsg = error.message ?? errMsg;
          }
        } catch {
          errMsg = error.message ?? errMsg;
        }
        throw new Error(errMsg);
      }
      if (!data?.success || !data?.script) throw new Error(data?.error ?? '대본 생성 결과가 없습니다');

      const generatedScript: string = data.script;

      // 스트리밍 효과로 텍스트 출력
      let idx = 0;
      streamRef.current = setInterval(() => {
        if (abortRef.current?.signal.aborted) {
          if (streamRef.current) clearInterval(streamRef.current);
          setIsGenerating(false);
          return;
        }
        idx += Math.floor(Math.random() * 5) + 3;
        if (idx >= generatedScript.length) {
          idx = generatedScript.length;
          if (streamRef.current) clearInterval(streamRef.current);
          setIsGenerating(false);
          setShowGeneratedToast(true);
          setTimeout(() => setShowGeneratedToast(false), 3000);
        }
        setScript(generatedScript.slice(0, idx));
      }, 25);

    } catch (err) {
      if (abortRef.current?.signal.aborted) return;
      const msg = err instanceof Error ? err.message : '대본 생성 중 오류가 발생했습니다';
      setApiError(msg);
      setIsGenerating(false);
      setIsApiLoading(false);
    }
  }, [keywords, selectedStyle, selectedRatio, channelName, videoLength, profile?.id]);

  useEffect(() => {
    return () => {
      if (streamRef.current) clearInterval(streamRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const handleGenerate = () => {
    if (isGenerating) {
      // 생성 중지
      abortRef.current?.abort();
      if (streamRef.current) clearInterval(streamRef.current);
      setIsGenerating(false);
      setIsApiLoading(false);
      return;
    }
    if (script.trim().length > 0) {
      setShowClearConfirm(true);
      return;
    }
    startStreaming();
  };

  const handleClearConfirm = useCallback(() => {
    setShowClearConfirm(false);
    startStreaming();
  }, [startStreaming]);

  // Voice upload handlers
  const handleVoiceFile = (file: File) => {
    if (!file) return;
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a|webm|aac)$/i)) return;
    setIsUploadingVoice(true);
    setVoiceUploadProgress(0);

    const interval = setInterval(() => {
      setVoiceUploadProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsUploadingVoice(false);
          const sizeKB = Math.round(file.size / 1024);
          const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
          const estSec = Math.round((file.size / 1024 / 128) * 8);
          const durStr = `${Math.floor(estSec / 60)}:${String(estSec % 60).padStart(2, '0')}`;
          setUploadedVoice({ name: file.name, size: sizeStr, duration: durStr });
          return 100;
        }
        return p + Math.floor(Math.random() * 15) + 8;
      });
    }, 120);
  };

  const handleVoiceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingVoice(false);
    const file = e.dataTransfer.files[0];
    if (file) handleVoiceFile(file);
  };

  const handleVoiceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVoiceFile(file);
  };

  return (
    <div className="flex flex-col h-full">
      {showClearConfirm && (
        <ConfirmModal
          title="대본을 새로 생성할까요?"
          description="현재 작성된 대본이 AI 생성 대본으로 교체됩니다. 기존 내용은 사라집니다."
          confirmLabel="새로 생성"
          cancelLabel="취소"
          variant="warning"
          onConfirm={handleClearConfirm}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {showGeneratedToast && (
        <Toast message="대본 생성이 완료되었습니다! 내용을 확인하고 수정해보세요." type="success" onClose={() => setShowGeneratedToast(false)} />
      )}

      {/* Voice Upload Modal */}
      {showVoiceUpload && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          onClick={() => setShowVoiceUpload(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">음성 파일 업로드</p>
                <p className="text-zinc-500 text-xs mt-0.5">MP3, WAV, M4A, OGG 지원 · 최대 500MB</p>
              </div>
              <button
                onClick={() => setShowVoiceUpload(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
              >
                <i className="ri-close-line" />
              </button>
            </div>

            <div className="p-5 md:p-6 space-y-4">
              {uploadedVoice ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <i className="ri-music-2-line text-emerald-400 text-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{uploadedVoice.name}</p>
                      <p className="text-zinc-500 text-xs mt-0.5">{uploadedVoice.size} · {uploadedVoice.duration}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <i className="ri-check-line text-white text-xs" />
                      </div>
                      <button
                        onClick={() => setUploadedVoice(null)}
                        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : isUploadingVoice ? (
                <div className="bg-zinc-800 border border-white/5 rounded-xl p-6 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <p className="text-zinc-300 text-sm font-semibold">업로드 중...</p>
                  <div className="w-full bg-zinc-700 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-200"
                      style={{ width: `${voiceUploadProgress}%` }}
                    />
                  </div>
                  <p className="text-zinc-500 text-xs">{voiceUploadProgress}%</p>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingVoice(true); }}
                  onDragLeave={() => setIsDraggingVoice(false)}
                  onDrop={handleVoiceDrop}
                  onClick={() => voiceInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 md:p-8 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                    isDraggingVoice
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-white/10 hover:border-white/20 hover:bg-white/3'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <i className="ri-upload-cloud-2-line text-zinc-400 text-2xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">파일을 드래그하거나 클릭하여 업로드</p>
                    <p className="text-zinc-500 text-xs mt-1">MP3, WAV, M4A, OGG, AAC · 최대 500MB</p>
                  </div>
                  <input
                    ref={voiceInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleVoiceInputChange}
                  />
                </div>
              )}

              <div className="bg-zinc-800/60 rounded-xl p-3 space-y-1.5">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">업로드 팁</p>
                {[
                  '음성 파일을 업로드하면 자동으로 대본을 추출합니다',
                  '배경 소음이 적은 깨끗한 음성일수록 정확도가 높아요',
                  '여러 화자가 있는 경우 화자 분리 기능이 자동 적용됩니다',
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <i className="ri-information-line text-indigo-400 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowVoiceUpload(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  취소
                </button>
                {uploadedVoice && (
                  <button
                    onClick={() => {
                      setShowVoiceUpload(false);
                      // 음성 파일 기반 대본 생성 시뮬레이션
                      startStreaming();
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <i className="ri-sparkling-2-line" /> 대본 추출하기
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-3 md:py-5">
        <div className="max-w-3xl mx-auto">
          {/* Title */}
          <div className="mb-3 md:mb-4 flex items-center gap-3">
            <h2 className="text-sm font-bold text-white">어떤 영상을 만들고 싶으세요?</h2>
            <p className="text-zinc-500 text-xs hidden sm:block">주제나 대본을 입력하면 구조화를 도와드립니다.</p>
          </div>

          {/* Project title row */}
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-xl px-3 md:px-4 py-2.5 md:py-3 mb-4">
            <span className="text-xs text-zinc-500 whitespace-nowrap flex-shrink-0">프로젝트:</span>
            {isEditingTitle ? (
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                autoFocus
                className="flex-1 bg-transparent text-sm text-white focus:outline-none"
              />
            ) : (
              <span className="flex-1 text-sm text-white truncate">{projectTitle}</span>
            )}
            <button
              onClick={() => setIsEditingTitle(!isEditingTitle)}
              className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 cursor-pointer flex-shrink-0 transition-colors"
            >
              <i className="ri-edit-line text-sm" />
            </button>
          </div>

          {/* Keywords & Style info */}
          {(keywords.length > 0 || selectedStyle) && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {selectedStyle && (
                <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                  <i className="ri-palette-line text-indigo-400 text-[10px]" />
                  <span className="text-[10px] text-indigo-300 font-semibold">{selectedStyle}</span>
                </div>
              )}
              {keywords.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-zinc-500 font-semibold whitespace-nowrap">키워드:</span>
                  {keywords.map((kw) => (
                    <button
                      key={kw}
                      onClick={() => {
                        if (!isGenerating) {
                          setScript((prev) => prev ? `${prev} #${kw}` : `#${kw} 주제로 대본을 작성해주세요`);
                        }
                      }}
                      className="text-[10px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-semibold cursor-pointer hover:bg-indigo-500/20 transition-colors whitespace-nowrap"
                    >
                      #{kw}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Script label */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <i className="ri-text text-zinc-400 text-sm" />
            <span className="text-sm font-semibold text-zinc-300">대본 / 프롬프트</span>
            <span className="hidden sm:block text-[11px] text-zinc-600">* 영어나 일본어 등 주제를 외국어로 주시면 해당 언어로 대본을 작성합니다.</span>
          </div>

          {/* API Error */}
          {apiError && (
            <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-red-400 font-semibold mb-0.5">대본 생성 실패</p>
                <p className="text-[11px] text-red-300/70 leading-relaxed">{apiError}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { setApiError(null); startStreaming(); }}
                  className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-refresh-line text-[11px]" /> 재시도
                </button>
                <button onClick={() => setApiError(null)} className="text-red-400 hover:text-red-300 cursor-pointer transition-colors">
                  <i className="ri-close-line text-sm" />
                </button>
              </div>
            </div>
          )}

          {/* Script textarea */}
          <div className="relative mb-4">
            <textarea
              value={script}
              onChange={(e) => {
                if (!isGenerating && e.target.value.length <= maxChars) setScript(e.target.value);
              }}
              placeholder={keywords.length > 0
                ? `"${keywords.slice(0, 2).join(', ')}" 주제로 AI가 대본을 생성합니다. 아래 버튼을 클릭하거나 직접 입력하세요.`
                : '대본이나 주제를 입력하세요... (예: AI 기술의 현재와 미래에 대한 60초 유튜브 영상)'}
              className={`w-full bg-zinc-900/60 border rounded-xl p-3 md:p-4 text-sm text-white placeholder-zinc-600 focus:outline-none transition-colors resize-none leading-relaxed ${
                isApiLoading ? 'border-indigo-500/40' : 'border-white/5 focus:border-indigo-500/40'
              }`}
              style={{ minHeight: '180px' }}
              readOnly={isGenerating}
            />

            {/* API 대기 중 오버레이 */}
            {isApiLoading && (
              <div className="absolute inset-0 rounded-xl bg-zinc-900/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <span className="text-sm font-bold text-indigo-300">AI 대본 생성 중...</span>
                </div>
                <p className="text-xs text-zinc-500">API 응답을 기다리는 중입니다. 잠시만 기다려주세요.</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 스트리밍 중 커서 */}
            {isGenerating && !isApiLoading && (
              <span className="inline-block w-0.5 h-4 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
            )}

            {/* 상태 배지 */}
            {isGenerating && (
              <div className={`absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
                isApiLoading
                  ? 'bg-amber-500/20 border border-amber-500/30'
                  : 'bg-indigo-500/20 border border-indigo-500/30'
              }`}>
                {isApiLoading ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] text-amber-300 font-semibold">API 연결 중</span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-[10px] text-indigo-300 font-semibold">AI 생성 중</span>
                  </>
                )}
              </div>
            )}

            {!isGenerating && script.trim().length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 bg-zinc-900/60 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 px-2 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                title="대본 초기화"
              >
                <i className="ri-delete-bin-line text-[10px]" /> 초기화
              </button>
            )}
          </div>

          {/* Uploaded voice badge */}
          {uploadedVoice && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mb-3">
              <i className="ri-music-2-line text-emerald-400 text-sm" />
              <span className="text-xs text-emerald-300 font-semibold flex-1 truncate">{uploadedVoice.name}</span>
              <span className="text-xs text-zinc-500">{uploadedVoice.duration}</span>
              <button
                onClick={() => setUploadedVoice(null)}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line text-xs" />
              </button>
            </div>
          )}

          {/* Bottom bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              {charCount.toLocaleString()} / {maxChars.toLocaleString()} 자
            </span>

            <div className="flex-1" />

            <div className="flex items-center gap-1.5 bg-zinc-900/60 border border-white/5 rounded-lg px-2.5 py-1.5">
              <i className="ri-time-line text-zinc-500 text-xs" />
              <input
                type="number"
                min={10}
                max={600}
                value={videoLength}
                onChange={(e) => setVideoLength(Number(e.target.value))}
                className="w-10 bg-transparent text-sm text-white text-center focus:outline-none tabular-nums"
              />
              <span className="text-xs text-zinc-500">초</span>
            </div>

            <button
              onClick={() => setShowVoiceUpload(true)}
              className={`flex items-center gap-1.5 md:gap-2 font-bold text-xs md:text-sm px-3 md:px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                uploadedVoice
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white'
              }`}
            >
              <i className={uploadedVoice ? 'ri-music-2-line' : 'ri-upload-line'} />
              <span className="hidden sm:inline">{uploadedVoice ? '음성 변경' : '음성 업로드'}</span>
              <span className="sm:hidden">{uploadedVoice ? '변경' : '업로드'}</span>
            </button>

            <button
              onClick={handleGenerate}
              className={`flex items-center gap-1.5 md:gap-2 font-bold text-xs md:text-sm px-3 md:px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                isApiLoading
                  ? 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                  : isGenerating
                  ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
                  : 'bg-indigo-500 hover:bg-indigo-400 text-white'
              }`}
            >
              {isApiLoading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                  <span className="hidden sm:inline">API 응답 대기 중...</span>
                  <span className="sm:hidden">대기 중</span>
                </>
              ) : isGenerating ? (
                <>
                  <i className="ri-stop-fill" />
                  <span className="hidden sm:inline">생성 중지</span>
                  <span className="sm:hidden">중지</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">
                    {keywords.length > 0 ? 'AI 대본 생성' : '대본 생성하기'}
                  </span>
                  <span className="sm:hidden">AI 생성</span>
                  <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                    <i className="ri-sparkling-2-line text-[10px]" />
                    {creditCost}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Generation complete notice */}
          {!isGenerating && script.length > 0 && !apiError && (
            <div className="mt-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-sm" />
              <p className="text-xs text-emerald-300 font-semibold">대본 생성 완료! 내용을 확인하고 수정한 뒤 다음 단계로 진행하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#0f0f11] px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium cursor-pointer transition-colors whitespace-nowrap"
        >
          <i className="ri-arrow-left-line" />
          이전
        </button>
        <button
          onClick={() => onNext(script)}
          disabled={!script.trim()}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm px-4 md:px-6 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          다음
          <i className="ri-arrow-right-line" />
        </button>
      </div>
    </div>
  );
}
