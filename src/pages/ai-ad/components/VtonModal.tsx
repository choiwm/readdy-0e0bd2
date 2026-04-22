import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { uploadProductImageToStorage } from '@/pages/ai-ad/utils/uploadProductImage';

const VTON_CREDIT_COST_FALLBACK = 133;
const SESSION_KEY = 'ai_ad_session_id';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `ad_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

type VtonState = 'idle' | 'uploading' | 'generating' | 'done' | 'error';

async function pollVtonResult(
  requestId: string,
  saveOpts?: Record<string, unknown>,
  maxAttempts = 180,
  intervalMs = 5000
): Promise<string | null> {
  let consecutiveErrors = 0;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const { data, error } = await supabase.functions.invoke('generate-vton', {
        body: { _poll: true, request_id: requestId, save_opts: saveOpts },
      });
      if (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) throw new Error(`폴링 연속 오류: ${error.message}`);
        continue;
      }
      consecutiveErrors = 0;
      if (data?.videoUrl) return data.videoUrl;
      if (data?.status === 'FAILED') throw new Error(data.error ?? '가상 피팅 생성 실패');
    } catch (e) {
      if (e instanceof Error && (e.message.includes('실패') || e.message.includes('FAILED'))) throw e;
      consecutiveErrors++;
      if (consecutiveErrors >= 5) throw new Error('폴링 중 반복 오류가 발생했습니다.');
    }
  }
  return null;
}

interface VtonModalProps {
  onClose: () => void;
}

export default function VtonModal({ onClose }: VtonModalProps) {
  const { profile } = useAuth();
  const { credits, refreshCredits } = useCredits();

  const [vtonCreditCost, setVtonCreditCost] = useState<number>(VTON_CREDIT_COST_FALLBACK);
  const [costLoading, setCostLoading] = useState(true);

  const [modelImage, setModelImage] = useState<string | null>(null);
  const [garmentImage, setGarmentImage] = useState<string | null>(null);
  const [vtonState, setVtonState] = useState<VtonState>('idle');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [completedSec, setCompletedSec] = useState(0);

  const modelInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // DB에서 최신 VTON 비용 조회
  useEffect(() => {
    const fetchCost = async () => {
      setCostLoading(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('generate-vton', {
          body: { _get_cost: true },
        });
        if (!fnError && data?.cost != null) {
          setVtonCreditCost(data.cost as number);
        }
      } catch {
        // 폴백 유지
      } finally {
        setCostLoading(false);
      }
    };
    fetchCost();
  }, []);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  }, []);

  const handleImageUpload = (type: 'model' | 'garment') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === 'model') setModelImage(url);
    else setGarmentImage(url);
    e.target.value = '';
  };

  const handleGenerate = useCallback(async () => {
    if (!modelImage || !garmentImage) return;
    if (credits < vtonCreditCost) {
      setError(`크레딧이 부족합니다. 필요: ${vtonCreditCost} CR, 보유: ${credits} CR`);
      setVtonState('error');
      return;
    }

    setError(null);
    setResultUrl(null);
    setProgress(0);
    setElapsedSec(0);
    startTimeRef.current = Date.now();

    // 1단계: 이미지 업로드
    setVtonState('uploading');
    setStep('이미지 업로드 중...');

    let modelUrl: string;
    let garmentUrl: string;

    try {
      [modelUrl, garmentUrl] = await Promise.all([
        uploadProductImageToStorage(modelImage, profile?.id ?? null),
        uploadProductImageToStorage(garmentImage, profile?.id ?? null),
      ]);
    } catch (err) {
      clearTimers();
      setError(err instanceof Error ? err.message : '이미지 업로드 실패');
      setVtonState('error');
      return;
    }

    // 2단계: 생성
    setVtonState('generating');
    setStep('AI 가상 피팅 분석 중...');

    clearTimers();

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    progressTimerRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 0.5, 88));
    }, 300);

    const steps = [
      'AI 가상 피팅 분석 중...',
      '의상 패턴 인식 중...',
      '모델 체형 분석 중...',
      '피팅 이미지 합성 중...',
      '모션 프롬프트 생성 중...',
      '피팅 영상 렌더링 중...',
      '최종 후처리 중...',
    ];
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setStep(steps[stepIdx]);
    }, 15000);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-vton', {
        body: {
          model_image: modelUrl,
          garment_image: garmentUrl,
          user_id: profile?.id ?? null,
          session_id: getSessionId(),
        },
      });

      clearInterval(stepTimer);

      if (fnError) throw new Error(fnError.message ?? '가상 피팅 생성 실패');
      if (data?.error) throw new Error(data.error);

      let finalUrl: string | null = null;

      if (data?.pending && data?.request_id) {
        setStep('영상 렌더링 완료 대기 중...');
        finalUrl = await pollVtonResult(data.request_id, data.save_opts);
        if (!finalUrl) throw new Error('가상 피팅 영상 생성 시간이 초과되었습니다 (15분). 잠시 후 다시 시도해주세요.');
      } else if (data?.videoUrl) {
        finalUrl = data.videoUrl;
      } else {
        throw new Error('결과를 받지 못했습니다.');
      }

      clearTimers();
      setProgress(100);
      setStep('완료!');
      setCompletedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setResultUrl(finalUrl);
      setVtonState('done');
      await refreshCredits().catch(() => {});

    } catch (err) {
      clearInterval(stepTimer);
      clearTimers();
      setError(err instanceof Error ? err.message : '생성 중 오류가 발생했습니다');
      setVtonState('error');
      await refreshCredits().catch(() => {});
    }
  }, [modelImage, garmentImage, credits, vtonCreditCost, profile, clearTimers, refreshCredits]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `vton_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(resultUrl, '_blank');
    }
  }, [resultUrl]);

  const handleReset = useCallback(() => {
    clearTimers();
    setVtonState('idle');
    setProgress(0);
    setStep('');
    setError(null);
    setResultUrl(null);
    setElapsedSec(0);
    setCompletedSec(0);
  }, [clearTimers]);

  const isGenerating = vtonState === 'uploading' || vtonState === 'generating';
  const canGenerate = !!modelImage && !!garmentImage && !isGenerating && !costLoading && credits >= vtonCreditCost;

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col sm:flex-row w-full sm:w-[900px] max-h-[90vh] rounded-2xl overflow-hidden bg-[#0d0d0f] border border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Preview */}
        <div className="hidden sm:flex relative flex-1 bg-black overflow-hidden flex-col" style={{ minHeight: '480px' }}>
          {vtonState === 'done' && resultUrl ? (
            <div className="absolute inset-0 flex flex-col">
              <video src={resultUrl} className="w-full h-full object-cover object-top" autoPlay muted loop playsInline />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-black px-3 py-1.5 rounded-full">
                  <i className="ri-checkbox-circle-fill text-xs" />
                  가상 피팅 완료
                </div>
                {completedSec > 0 && (
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-zinc-400 text-xs px-3 py-1.5 rounded-full border border-white/10">
                    <i className="ri-time-line text-xs" />
                    {formatElapsed(completedSec)} 소요
                  </div>
                )}
              </div>
              <div className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-2 flex-wrap px-4">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-black text-xs font-black px-4 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line" /> 다운로드
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-zinc-400 text-xs font-black px-4 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap border border-white/10"
                >
                  <i className="ri-refresh-line" /> 다시 생성
                </button>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
              <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center">
                  <i className="ri-t-shirt-2-line text-violet-400 text-2xl" />
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-sm mb-1">AI 가상 피팅 생성 중</p>
                  <p className="text-zinc-500 text-xs">{step}</p>
                </div>
                <div className="w-full flex flex-col gap-2">
                  {[
                    { label: '의상 피팅 (fashn/tryon)', icon: 'ri-t-shirt-2-line', done: progress > 30 },
                    { label: '모션 프롬프트 생성 (Claude)', icon: 'ri-sparkling-2-line', done: progress > 60 },
                    { label: '피팅 영상 생성 (Seedance)', icon: 'ri-movie-line', done: progress > 90 },
                  ].map((s, i) => (
                    <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                      s.done ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-900/40 border-white/[0.06]'
                    }`}>
                      <div className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                        s.done ? 'bg-emerald-500/20' : 'bg-zinc-800'
                      }`}>
                        {s.done
                          ? <i className="ri-check-line text-emerald-400 text-xs" />
                          : <i className={`${s.icon} text-zinc-500 text-xs`} />
                        }
                      </div>
                      <span className={`text-xs ${s.done ? 'text-emerald-400 font-bold' : 'text-zinc-500'}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                  <span>경과 {formatElapsed(elapsedSec)}</span>
                  <span>·</span>
                  <span>예상 2~3분</span>
                </div>
              </div>
            </div>
          ) : vtonState === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <i className="ri-error-warning-line text-red-400 text-2xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-sm mb-1">생성 실패</p>
                <p className="text-zinc-500 text-xs leading-relaxed max-w-xs">{error}</p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black px-4 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line" /> 다시 시도
              </button>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/30 flex items-center justify-center">
                <i className="ri-t-shirt-2-line text-violet-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-lg mb-2">AI 가상 피팅</p>
                <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
                  모델 이미지와 의상 이미지를 업로드하면<br />
                  AI가 실제로 입어보는 영상을 만들어드립니다
                </p>
              </div>
              <div className="w-full max-w-xs flex flex-col gap-2">
                {[
                  { icon: 'ri-t-shirt-2-line', label: 'fashn/tryon', desc: '의상 피팅 이미지 생성' },
                  { icon: 'ri-sparkling-2-line', label: 'Claude 3.7', desc: '모션 프롬프트 자동 생성' },
                  { icon: 'ri-movie-line', label: 'Seedance v1 Pro', desc: '피팅 영상 생성' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/[0.06]">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 flex-shrink-0">
                      <i className={`${s.icon} text-zinc-400 text-sm`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-300">{s.label}</p>
                      <p className="text-[9px] text-zinc-600">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings */}
        <div className="w-full sm:w-[360px] flex-shrink-0 flex flex-col bg-[#111114] border-l border-white/[0.06] overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20">
                <i className="ri-t-shirt-2-line text-violet-400 text-sm" />
              </div>
              <div>
                <p className="text-sm font-black text-white">AI 가상 피팅</p>
                <p className="text-[10px] text-zinc-500">fal-vton 워크플로우</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-zinc-800/60 border border-white/[0.06] hover:bg-zinc-700 flex items-center justify-center cursor-pointer transition-all flex-shrink-0"
            >
              <i className="ri-close-line text-zinc-400 text-sm" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
            {/* 모델 이미지 업로드 */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <i className="ri-user-3-line text-violet-400 text-sm" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">모델 이미지</p>
                <span className="text-[9px] text-red-400 font-bold ml-auto">필수</span>
              </div>
              <div
                onClick={() => !isGenerating && modelInputRef.current?.click()}
                className={`relative w-full aspect-[3/4] rounded-xl overflow-hidden border flex items-center justify-center transition-all ${
                  modelImage
                    ? 'border-violet-500/30'
                    : 'border-dashed border-white/[0.08] bg-zinc-900/40 hover:border-violet-500/30 hover:bg-violet-500/[0.03]'
                } ${isGenerating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} group`}
              >
                {modelImage ? (
                  <>
                    <img src={modelImage} alt="모델" className="w-full h-full object-cover object-top" />
                    {!isGenerating && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                          <i className="ri-image-edit-line text-white text-xl" />
                          <span className="text-white text-[10px] font-bold">변경하기</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-600 group-hover:text-zinc-400 transition-colors p-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-800/60 group-hover:bg-violet-500/10 transition-colors">
                      <i className="ri-user-3-line text-2xl" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold mb-0.5">모델 이미지 업로드</p>
                      <p className="text-[10px] leading-relaxed">사람이 포함된 전신 또는<br />상반신 이미지를 업로드하세요</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={modelInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload('model')} />
            </div>

            {/* 의상 이미지 업로드 */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <i className="ri-t-shirt-2-line text-pink-400 text-sm" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">의상 이미지</p>
                <span className="text-[9px] text-red-400 font-bold ml-auto">필수</span>
              </div>
              <div
                onClick={() => !isGenerating && garmentInputRef.current?.click()}
                className={`relative w-full aspect-[3/4] rounded-xl overflow-hidden border flex items-center justify-center transition-all ${
                  garmentImage
                    ? 'border-pink-500/30'
                    : 'border-dashed border-white/[0.08] bg-zinc-900/40 hover:border-pink-500/30 hover:bg-pink-500/[0.03]'
                } ${isGenerating ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} group`}
              >
                {garmentImage ? (
                  <>
                    <img src={garmentImage} alt="의상" className="w-full h-full object-cover object-top" />
                    {!isGenerating && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1">
                          <i className="ri-image-edit-line text-white text-xl" />
                          <span className="text-white text-[10px] font-bold">변경하기</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-zinc-600 group-hover:text-zinc-400 transition-colors p-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-800/60 group-hover:bg-pink-500/10 transition-colors">
                      <i className="ri-t-shirt-2-line text-2xl" />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold mb-0.5">의상 이미지 업로드</p>
                      <p className="text-[10px] leading-relaxed">입혀볼 옷 이미지를<br />업로드하세요</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={garmentInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload('garment')} />
            </div>

            {/* 비용 안내 */}
            <div className="bg-zinc-900/40 border border-white/[0.05] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <i className="ri-copper-diamond-line text-amber-400 text-sm" />
                  <span className="text-xs text-zinc-400">예상 크레딧 소모</span>
                </div>
                {costLoading ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                    <span className="text-xs text-zinc-500">조회 중...</span>
                  </div>
                ) : (
                  <span className="text-sm font-black text-amber-400">{vtonCreditCost} CR</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                fal-vton 워크플로우 1회 실행 비용 (Est. $1.33)
              </p>
              <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                <span className="text-[10px] text-zinc-600">보유 크레딧</span>
                <span className={`text-[10px] font-black ${credits >= vtonCreditCost ? 'text-emerald-400' : 'text-red-400'}`}>
                  {credits} CR
                </span>
              </div>
              {/* 관리자 조정 안내 */}
              <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-1.5">
                <i className="ri-settings-3-line text-zinc-600 text-[10px]" />
                <span className="text-[9px] text-zinc-600">관리자 페이지 &gt; 크레딧 비용에서 조정 가능</span>
              </div>
            </div>

            {/* 크레딧 부족 경고 */}
            {!costLoading && credits < vtonCreditCost && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <i className="ri-copper-diamond-line text-red-400 text-sm flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-red-400 font-bold">크레딧 부족</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">필요: {vtonCreditCost} CR · 보유: {credits} CR</p>
                </div>
                <a href="/credit-purchase" className="text-[10px] font-black text-amber-400 hover:text-amber-300 whitespace-nowrap cursor-pointer">충전하기</a>
              </div>
            )}

            {/* 에러 표시 */}
            {vtonState === 'error' && error && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-red-400 mb-0.5">생성 실패</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 생성 중 상태 표시 */}
            {isGenerating && (
              <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs font-black text-violet-400">{step}</p>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-zinc-600">경과 {formatElapsed(elapsedSec)}</span>
                  <span className="text-[10px] text-zinc-600">예상 2~3분</span>
                </div>
              </div>
            )}

            {/* 완료 상태 */}
            {vtonState === 'done' && resultUrl && (
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <i className="ri-checkbox-circle-fill text-emerald-400 text-sm" />
                  <p className="text-xs font-black text-emerald-400">가상 피팅 영상 생성 완료!</p>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">왼쪽 미리보기에서 영상을 확인하세요</p>
              </div>
            )}
          </div>

          {/* Bottom action */}
          <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06]">
            {vtonState === 'done' ? (
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/90 hover:bg-white text-black text-sm font-black transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line" /> 다운로드
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-refresh-line" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-400 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
              >
                {isGenerating ? (
                  <><i className="ri-loader-4-line animate-spin" /> {vtonState === 'uploading' ? '업로드 중...' : '생성 중...'}</>
                ) : costLoading ? (
                  <><i className="ri-loader-4-line animate-spin" /> 비용 조회 중...</>
                ) : (
                  <><i className="ri-t-shirt-2-line" /> 가상 피팅 영상 만들기 ({vtonCreditCost} CR)</>
                )}
              </button>
            )}
            {!modelImage || !garmentImage ? (
              <p className="text-[10px] text-zinc-600 text-center mt-2">
                모델 이미지와 의상 이미지를 모두 업로드해주세요
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
