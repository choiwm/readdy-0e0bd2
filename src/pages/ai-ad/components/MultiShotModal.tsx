import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useVideoMerge } from '@/pages/ai-ad/hooks/useVideoMerge';

const MULTISHOT_CREDIT_COST_FALLBACK = 180;
const SESSION_KEY = 'ai_ad_session_id';
const POLL_INTERVAL_MS = 5000;
const IMAGE_POLL_MAX = 30;
const VIDEO_POLL_MAX = 60;

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `ad_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

type PipelineState =
  | 'idle'
  | 'init'
  | 'gen_image'
  | 'poll_image'
  | 'gen_video'
  | 'poll_video'
  | 'done'
  | 'error';

interface ShotPlan {
  shots: Array<{ shot_number: number; prompt: string; duration: string }>;
  total_duration: string;
  base_image_prompt: string;
}

interface ShotStep {
  label: string;
  icon: string;
  color: string;
}

const SHOT_STEPS: ShotStep[] = [
  { label: 'Claude Opus — 샷 플랜 생성', icon: 'ri-sparkling-2-line', color: 'text-amber-400' },
  { label: 'FLUX Schnell — 첫 프레임 이미지', icon: 'ri-image-line', color: 'text-sky-400' },
  { label: 'Kling v2.1 Pro — 샷 1 영상', icon: 'ri-movie-line', color: 'text-emerald-400' },
  { label: 'Kling v2.1 Pro — 샷 2 영상', icon: 'ri-movie-line', color: 'text-emerald-400' },
  { label: 'Kling v2.1 Pro — 샷 3 영상', icon: 'ri-movie-line', color: 'text-emerald-400' },
];

const EXAMPLE_PROMPTS = [
  '새벽 도쿄 거리를 걷는 사무라이, 네온사인이 빗속에 반짝이는 사이버펑크 분위기',
  '황금빛 밀밭 위로 드론이 날아오르며 석양을 향해 달려가는 말 떼',
  '심해 탐험가가 발광 해파리 군집 사이를 헤엄치며 고대 난파선을 발견하는 장면',
  '눈 덮인 산 정상에서 등반가가 깃발을 꽂고 구름 위 파노라마를 바라보는 순간',
];

interface MultiShotModalProps {
  onClose: () => void;
}

// ── 멀티샷 순차 플레이어 (병합 기능 포함) ──
function MultiShotPlayer({
  videoUrls,
  onDownloadAll,
  onReset,
  completedSec,
}: {
  videoUrls: string[];
  onDownloadAll: () => void;
  onReset: () => void;
  completedSec: number;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    mergeStatus,
    mergeProgress,
    mergedBlobUrl,
    mergeError,
    startMerge,
    cancelMerge,
    resetMerge,
    downloadMerged,
    convertStatus,
    convertProgress,
    mp4Url,
    convertError,
    startConvert,
    resetConvert,
    downloadMp4,
  } = useVideoMerge();

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  const handleEnded = useCallback(() => {
    const next = currentIdx + 1;
    if (next < videoUrls.length) {
      setCurrentIdx(next);
    } else {
      setCurrentIdx(0);
    }
  }, [currentIdx, videoUrls.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.src = videoUrls[currentIdx];
    if (isPlaying) video.play().catch(() => {});
  }, [currentIdx, videoUrls, isPlaying]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSelectShot = (idx: number) => {
    setCurrentIdx(idx);
    setIsPlaying(true);
  };

  const handleMerge = () => {
    if (mergeStatus === 'merging') {
      cancelMerge();
    } else {
      resetMerge();
      startMerge(videoUrls);
    }
  };

  const isMerging = mergeStatus === 'merging';
  const mergeDone = mergeStatus === 'done' && !!mergedBlobUrl;

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      {/* 메인 비디오 */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover object-top"
          autoPlay
          muted
          playsInline
          onEnded={handleEnded}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

        {/* 상단 배지 */}
        <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-black px-3 py-1.5 rounded-full">
            <i className="ri-checkbox-circle-fill text-xs" />
            멀티샷 영상 완성
          </div>
          {completedSec > 0 && (
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-zinc-400 text-xs px-3 py-1.5 rounded-full border border-white/10">
              <i className="ri-time-line text-xs" />
              {formatTime(completedSec)} 소요
            </div>
          )}
        </div>

        {/* 현재 샷 표시 */}
        <div className="absolute top-4 right-4">
          <div className="bg-black/60 backdrop-blur-sm text-zinc-300 text-xs px-3 py-1.5 rounded-full border border-white/10 font-bold">
            Shot {currentIdx + 1} / {videoUrls.length}
          </div>
        </div>

        {/* 병합 진행 오버레이 */}
        {isMerging && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10">
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center">
              <i className="ri-film-line text-rose-400 text-2xl" />
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-black text-sm mb-1">영상 병합 중...</p>
              <p className="text-zinc-400 text-xs">영상을 순서대로 녹화해 하나로 합칩니다</p>
            </div>
            <div className="w-48 flex flex-col gap-2">
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${mergeProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-500 text-center">{mergeProgress}% 완료</p>
            </div>
            <button
              onClick={cancelMerge}
              className="flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 text-xs font-bold px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap border border-white/10"
            >
              <i className="ri-close-line" /> 취소
            </button>
          </div>
        )}

        {/* 병합 완료 + MP4 변환 패널 */}
        {mergeDone && !isMerging && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 px-3">
            <div className="w-full max-w-sm bg-black/85 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 flex flex-col gap-2.5">
              {/* WebM 완료 행 */}
              <div className="flex items-center gap-2">
                <i className="ri-checkbox-circle-fill text-emerald-400 text-sm flex-shrink-0" />
                <span className="text-xs text-emerald-400 font-black flex-1">WebM 병합 완료</span>
                <button
                  onClick={() => downloadMerged(`multishot_merged_${Date.now()}.webm`)}
                  className="flex items-center gap-1 bg-zinc-700/80 hover:bg-zinc-600 text-zinc-300 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line text-[10px]" /> WebM
                </button>
                <button
                  onClick={resetMerge}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer transition-all flex-shrink-0"
                >
                  <i className="ri-close-line text-zinc-500 text-xs" />
                </button>
              </div>

              {/* MP4 변환 섹션 */}
              {convertStatus === 'idle' && (
                <button
                  onClick={startConvert}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500/80 to-amber-500/80 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-black py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-file-video-line" /> MP4로 변환하기
                </button>
              )}

              {(convertStatus === 'uploading' || convertStatus === 'converting' || convertStatus === 'polling') && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin flex-shrink-0" />
                    <span className="text-[11px] text-amber-400 font-black flex-1">
                      {convertStatus === 'uploading' ? '서버에 업로드 중...' : convertStatus === 'converting' ? 'MP4 변환 요청 중...' : 'MP4 변환 중...'}
                    </span>
                    <span className="text-[10px] text-zinc-500">{convertProgress}%</span>
                    <button
                      onClick={resetConvert}
                      className="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer flex-shrink-0"
                    >
                      <i className="ri-close-line text-zinc-500 text-[10px]" />
                    </button>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${convertProgress}%` }}
                    />
                  </div>
                  {convertStatus === 'polling' && (
                    <p className="text-[9px] text-zinc-600 text-center">fal.ai 서버에서 변환 중... 약 1~2분 소요</p>
                  )}
                </div>
              )}

              {convertStatus === 'done' && mp4Url && (
                <div className="flex items-center gap-2">
                  <i className="ri-checkbox-circle-fill text-amber-400 text-sm flex-shrink-0" />
                  <span className="text-xs text-amber-400 font-black flex-1">MP4 변환 완료!</span>
                  <button
                    onClick={() => downloadMp4(`multishot_${Date.now()}.mp4`)}
                    className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-download-line text-[10px]" /> MP4 다운로드
                  </button>
                  <button
                    onClick={resetConvert}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer transition-all flex-shrink-0"
                  >
                    <i className="ri-close-line text-zinc-500 text-xs" />
                  </button>
                </div>
              )}

              {convertStatus === 'error' && convertError && (
                <div className="flex items-start gap-2">
                  <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-red-400 leading-relaxed flex-1">{convertError}</span>
                  <button
                    onClick={resetConvert}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer flex-shrink-0"
                  >
                    <i className="ri-close-line text-zinc-500 text-[10px]" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 병합 오류 */}
        {mergeStatus === 'error' && mergeError && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 px-4">
            <div className="flex items-center gap-2 bg-black/80 backdrop-blur-sm border border-red-500/30 rounded-2xl px-4 py-3 max-w-xs">
              <i className="ri-error-warning-line text-red-400 text-sm flex-shrink-0" />
              <span className="text-xs text-red-400 leading-relaxed">{mergeError}</span>
              <button onClick={resetMerge} className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 cursor-pointer flex-shrink-0">
                <i className="ri-close-line text-zinc-500 text-xs" />
              </button>
            </div>
          </div>
        )}

        {/* 재생/일시정지 */}
        {!isMerging && (
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 w-full h-full flex items-center justify-center cursor-pointer group"
          >
            <div className={`w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center transition-all duration-200 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
              <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-2xl`} />
            </div>
          </button>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-sm px-4 py-3">
        {/* 샷 썸네일 선택 */}
        <div className="flex items-center gap-2 mb-3">
          {videoUrls.map((url, i) => (
            <button
              key={i}
              onClick={() => handleSelectShot(i)}
              className={`relative flex-1 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                i === currentIdx
                  ? 'border-sky-400 ring-1 ring-sky-400/50'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <video
                src={url}
                className="w-full h-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
              <div className={`absolute inset-0 flex items-center justify-center ${i === currentIdx ? 'bg-sky-500/20' : 'bg-black/40'}`}>
                <span className={`text-[10px] font-black ${i === currentIdx ? 'text-sky-300' : 'text-zinc-400'}`}>
                  Shot {i + 1}
                </span>
              </div>
              {i === currentIdx && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400" />
              )}
            </button>
          ))}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {/* 병합 버튼 */}
          <button
            onClick={handleMerge}
            disabled={mergeStatus === 'unsupported'}
            className={`flex items-center justify-center gap-1.5 text-xs font-black px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap border ${
              isMerging
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : mergeDone
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : mergeStatus === 'unsupported'
                ? 'bg-zinc-800/50 border-white/5 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-800 border-white/10 text-zinc-300 hover:bg-zinc-700'
            }`}
            title={mergeStatus === 'unsupported' ? '이 브라우저는 병합을 지원하지 않습니다' : ''}
          >
            {isMerging ? (
              <><i className="ri-loader-4-line animate-spin" /> 병합 중...</>
            ) : mergeDone ? (
              <><i className="ri-checkbox-circle-line" /> 병합 완료</>
            ) : (
              <><i className="ri-film-line" /> 하나로 합치기</>
            )}
          </button>

          {/* 개별 다운로드 */}
          <button
            onClick={onDownloadAll}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white/90 hover:bg-white text-black text-xs font-black px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-download-line" /> 개별 다운로드
          </button>

          {/* 다시 생성 */}
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-black px-3 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap border border-white/10"
          >
            <i className="ri-refresh-line" />
          </button>
        </div>

        {/* 병합 진행 바 (하단) */}
        {isMerging && (
          <div className="mt-2 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${mergeProgress}%` }}
            />
          </div>
        )}

        {/* 병합 안내 문구 */}
        {mergeStatus === 'idle' && (
          <p className="text-[9px] text-zinc-600 text-center mt-2">
            &quot;하나로 합치기&quot;는 브라우저에서 실시간 녹화로 병합합니다 (WebM 포맷)
          </p>
        )}
      </div>
    </div>
  );
}

export default function MultiShotModal({ onClose }: MultiShotModalProps) {
  const { profile } = useAuth();
  const { credits, refreshCredits } = useCredits();

  const [creditCost, setCreditCost] = useState<number>(MULTISHOT_CREDIT_COST_FALLBACK);
  const [costLoading, setCostLoading] = useState(true);

  const [prompt, setPrompt] = useState('');
  const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [completedSec, setCompletedSec] = useState(0);

  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const abortRef = useRef(false);

  // DB에서 직접 비용 조회
  useEffect(() => {
    let cancelled = false;
    const fetchCost = async () => {
      setCostLoading(true);
      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        );
        const queryPromise = supabase
          .from('credit_costs')
          .select('cost')
          .eq('category', 'workflow')
          .eq('model_id', 'workflows/kling-multi-shot-creator')
          .eq('is_active', true)
          .maybeSingle();

        const result = await Promise.race([queryPromise, timeoutPromise]);
        if (!cancelled && result && 'data' in result && result.data?.cost != null) {
          setCreditCost(result.data.cost as number);
        }
      } catch {
        // 폴백값 유지
      } finally {
        if (!cancelled) setCostLoading(false);
      }
    };
    fetchCost();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const startElapsedTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(async (
    fn: () => Promise<{ status: string; [key: string]: unknown }>,
    maxAttempts: number,
    timeoutMsg: string
  ): Promise<{ status: string; [key: string]: unknown }> => {
    for (let i = 0; i < maxAttempts; i++) {
      if (abortRef.current) throw new Error('취소됨');
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (abortRef.current) throw new Error('취소됨');
      const result = await fn();
      if (result.status === 'COMPLETED' || result.status === 'FAILED') return result;
    }
    throw new Error(timeoutMsg);
  }, []);

  const invokeAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const { data, error: fnError } = await supabase.functions.invoke('generate-multishot', {
      body: { action, ...params },
    });
    if (fnError) throw new Error(fnError.message ?? `${action} 호출 실패`);
    if (data?.error) throw new Error(data.error);
    return data as Record<string, unknown>;
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || pipelineState !== 'idle') return;
    if (credits < creditCost) {
      setError(`크레딧이 부족합니다. 필요: ${creditCost} CR, 보유: ${credits} CR`);
      setPipelineState('error');
      return;
    }

    abortRef.current = false;
    setError(null);
    setVideoUrls([]);
    setCurrentStep(0);
    setElapsedSec(0);
    startElapsedTimer();

    try {
      // ── Step 0: init (Claude 샷 플랜) ──
      setPipelineState('init');
      setCurrentStep(0);
      const initData = await invokeAction('init', {
        prompt: prompt.trim(),
        user_id: profile?.id ?? null,
        session_id: getSessionId(),
      });

      if (abortRef.current) return;
      const jobId = initData.job_id as string;
      const shotPlan = initData.shot_plan as ShotPlan;

      // 멀티샷 init 이후의 후속 액션들에 user_id/session_id 를 그대로 흘려보내요.
      // 백엔드의 actionPollImage / actionPollVideo / actionPollConvert 가
      // persistFalAsset 호출 시 owner ID 로 사용 → Storage 경로가
      // image/<user_id>/... 형태로 일관되게 namespace 됩니다.
      const owner = { user_id: profile?.id ?? null, session_id: getSessionId() };

      // ── Step 1: 이미지 생성 ──
      setPipelineState('gen_image');
      setCurrentStep(1);
      const imgData = await invokeAction('gen_image', {
        job_id: jobId,
        base_image_prompt: shotPlan.base_image_prompt,
        ...owner,
      });
      const imageRequestId = imgData.request_id as string;

      setPipelineState('poll_image');
      const imgResult = await poll(
        async () => {
          const d = await invokeAction('poll_image', { job_id: jobId, request_id: imageRequestId, ...owner });
          return d as { status: string; [key: string]: unknown };
        },
        IMAGE_POLL_MAX,
        '이미지 생성 시간 초과 (2.5분)'
      );
      if (imgResult.status === 'FAILED') throw new Error('첫 프레임 이미지 생성 실패');
      const baseImageUrl = imgResult.image_url as string;

      // ── Step 2~4: 각 샷 영상 생성 ──
      const collectedUrls: string[] = [];

      for (let i = 0; i < shotPlan.shots.length; i++) {
        if (abortRef.current) return;
        const shot = shotPlan.shots[i];
        setPipelineState('gen_video');
        setCurrentStep(2 + i);

        const vidData = await invokeAction('gen_video', {
          job_id: jobId,
          shot_prompt: shot.prompt,
          image_url: baseImageUrl,
          duration: shot.duration,
          shot_index: i,
          ...owner,
        });
        const videoRequestId = vidData.request_id as string;

        setPipelineState('poll_video');
        const vidResult = await poll(
          async () => {
            const d = await invokeAction('poll_video', {
              job_id: jobId,
              request_id: videoRequestId,
              shot_index: i,
              ...owner,
            });
            return d as { status: string; [key: string]: unknown };
          },
          VIDEO_POLL_MAX,
          `샷 ${i + 1} 영상 생성 시간 초과 (5분)`
        );

        if (vidResult.status === 'FAILED') throw new Error(vidResult.error as string ?? `샷 ${i + 1} 생성 실패`);
        const videoUrl = vidResult.video_url as string;
        collectedUrls.push(videoUrl);

        // 완료된 샷 즉시 반영 (실시간 업데이트)
        setVideoUrls([...collectedUrls]);
      }

      // ── DB에 결과 저장 (첫 번째 영상 URL로) ──
      if (!abortRef.current) {
        try {
          await supabase.from('ad_works').update({
            result_url: collectedUrls[0],
            step_status: { step: 'done', all_video_urls: collectedUrls },
            updated_at: new Date().toISOString(),
          }).eq('id', jobId);
        } catch { /* 무시 */ }
      }

      // ── 완료 ──
      stopElapsedTimer();
      setCompletedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      setVideoUrls(collectedUrls);
      setPipelineState('done');
      await refreshCredits().catch(() => {});

    } catch (err) {
      if (abortRef.current) return;
      stopElapsedTimer();
      const msg = err instanceof Error ? err.message : '생성 중 오류가 발생했습니다';
      setError(msg);
      setPipelineState('error');
      await refreshCredits().catch(() => {});
    }
  }, [prompt, pipelineState, credits, creditCost, profile, invokeAction, poll, startElapsedTimer, stopElapsedTimer, refreshCredits]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    stopElapsedTimer();
    setPipelineState('idle');
    setError(null);
    setVideoUrls([]);
    setCurrentStep(0);
    setElapsedSec(0);
    setCompletedSec(0);
    setTimeout(() => { abortRef.current = false; }, 100);
  }, [stopElapsedTimer]);

  // 전체 영상 순차 다운로드
  const handleDownloadAll = useCallback(async () => {
    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i];
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `multishot_shot${i + 1}_${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        // 다운로드 간 짧은 딜레이
        await new Promise((r) => setTimeout(r, 500));
      } catch {
        window.open(url, '_blank');
      }
    }
  }, [videoUrls]);

  const isProcessing = pipelineState !== 'idle' && pipelineState !== 'done' && pipelineState !== 'error';
  const canGenerate = prompt.trim().length > 0 && !isProcessing && !costLoading && credits >= creditCost;

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  const getStepLabel = () => {
    switch (pipelineState) {
      case 'init': return 'Claude가 샷 플랜 설계 중...';
      case 'gen_image':
      case 'poll_image': return '첫 프레임 이미지 생성 중...';
      case 'gen_video':
      case 'poll_video': return `샷 ${currentStep - 1} 영상 생성 중...`;
      default: return '처리 중...';
    }
  };

  const progressPercent = isProcessing
    ? Math.min(((currentStep + 0.5) / SHOT_STEPS.length) * 95, 95)
    : pipelineState === 'done' ? 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col sm:flex-row w-full sm:w-[960px] max-h-[90vh] rounded-2xl overflow-hidden bg-[#0d0d0f] border border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: Preview / Pipeline ── */}
        <div className="hidden sm:flex relative flex-1 bg-black overflow-hidden flex-col" style={{ minHeight: '520px' }}>
          {pipelineState === 'done' && videoUrls.length > 0 ? (
            <MultiShotPlayer
              videoUrls={videoUrls}
              onDownloadAll={handleDownloadAll}
              onReset={handleReset}
              completedSec={completedSec}
            />
          ) : isProcessing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
              <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 border border-sky-500/30 flex items-center justify-center">
                  <i className="ri-film-line text-sky-400 text-2xl" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-white font-black text-sm mb-1">{getStepLabel()}</p>
                  <p className="text-zinc-500 text-xs">각 단계가 순서대로 진행됩니다</p>
                </div>

                {/* 파이프라인 단계 */}
                <div className="w-full flex flex-col gap-1.5">
                  {SHOT_STEPS.map((step, i) => {
                    const isDone = i < currentStep;
                    const isActive = i === currentStep;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all ${
                          isDone
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : isActive
                            ? 'bg-sky-500/10 border-sky-500/30'
                            : 'bg-zinc-900/40 border-white/[0.06]'
                        }`}
                      >
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                          isDone ? 'bg-emerald-500/20' : isActive ? 'bg-sky-500/20' : 'bg-zinc-800'
                        }`}>
                          {isDone ? (
                            <i className="ri-check-line text-emerald-400 text-xs" />
                          ) : isActive ? (
                            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                          ) : (
                            <i className={`${step.icon} text-zinc-600 text-xs`} />
                          )}
                        </div>
                        <span className={`text-xs ${
                          isDone ? 'text-emerald-400 font-bold' : isActive ? 'text-sky-300 font-bold' : 'text-zinc-600'
                        }`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 프로그레스 바 */}
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                  <span>경과 {formatElapsed(elapsedSec)}</span>
                  <span>·</span>
                  <span>
                    {pipelineState === 'init'
                      ? '예상 10~30초'
                      : pipelineState === 'gen_image' || pipelineState === 'poll_image'
                      ? '예상 20~40초'
                      : '예상 3~5분 (영상 생성 중)'}
                  </span>
                </div>
              </div>
            </div>
          ) : pipelineState === 'error' ? (
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
            /* 초기 상태 */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 border border-sky-500/30 flex items-center justify-center">
                <i className="ri-film-line text-sky-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-black text-lg mb-2">AI 멀티샷 영상</p>
                <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
                  프롬프트 하나로 3개 샷이 연결된<br />
                  시네마틱 영상을 자동으로 생성합니다
                </p>
              </div>
              <div className="w-full max-w-xs flex flex-col gap-1.5">
                {SHOT_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/[0.06]">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 flex-shrink-0">
                      <i className={`${step.icon} ${step.color} text-sm`} />
                    </div>
                    <span className="text-xs text-zinc-400">{step.label}</span>
                  </div>
                ))}
                {/* 합치기 없이 순차 재생 안내 */}
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/[0.06]">
                  <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 flex-shrink-0">
                    <i className="ri-play-circle-line text-rose-400 text-sm" />
                  </div>
                  <span className="text-xs text-zinc-400">순차 재생 플레이어 — 샷 전환</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Settings ── */}
        <div className="w-full sm:w-[380px] flex-shrink-0 flex flex-col bg-[#111114] border-l border-white/[0.06] overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 border border-sky-500/20">
                <i className="ri-film-line text-sky-400 text-sm" />
              </div>
              <div>
                <p className="text-sm font-black text-white">AI 멀티샷 영상</p>
                <p className="text-[10px] text-zinc-500">kling-multi-shot-creator</p>
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
            {/* 프롬프트 입력 */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <i className="ri-quill-pen-line text-sky-400 text-sm" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">영상 프롬프트</p>
                <span className="text-[9px] text-red-400 font-bold ml-auto">필수</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isProcessing}
                placeholder="어떤 영상을 만들고 싶으신가요? 장면, 분위기, 인물, 배경 등을 자유롭게 설명해주세요."
                className="w-full h-32 bg-zinc-900/60 border border-white/[0.08] rounded-xl px-3.5 py-3 text-xs text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-sky-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-[10px] text-zinc-600 mt-1.5">
                한국어로 입력하셔도 됩니다. AI가 자동으로 영어 프롬프트로 변환합니다.
              </p>
            </div>

            {/* 예시 프롬프트 */}
            <div>
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">예시 프롬프트</p>
              <div className="flex flex-col gap-1.5">
                {EXAMPLE_PROMPTS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => !isProcessing && setPrompt(ex)}
                    disabled={isProcessing}
                    className="text-left px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/[0.05] hover:border-sky-500/30 hover:bg-sky-500/[0.03] text-[11px] text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 leading-relaxed"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* 파이프라인 정보 */}
            <div className="bg-zinc-900/40 border border-white/[0.05] rounded-xl px-4 py-3">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2.5">생성 파이프라인</p>
              <div className="flex flex-col gap-1.5">
                {[
                  { icon: 'ri-sparkling-2-line', color: 'text-amber-400', label: 'Claude Opus 4.5', desc: '3개 샷 시나리오 자동 설계' },
                  { icon: 'ri-image-line', color: 'text-sky-400', label: 'FLUX Schnell', desc: '첫 프레임 이미지 생성' },
                  { icon: 'ri-movie-line', color: 'text-emerald-400', label: 'Kling v2.1 Pro × 3', desc: '각 샷별 영상 생성 (5초씩)' },
                  { icon: 'ri-play-circle-line', color: 'text-rose-400', label: '순차 재생 플레이어', desc: '샷 1→2→3 자동 전환 재생' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg bg-zinc-800 flex-shrink-0">
                      <i className={`${item.icon} ${item.color} text-xs`} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-300">{item.label}</p>
                      <p className="text-[9px] text-zinc-600">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                  <span className="text-sm font-black text-amber-400">{creditCost} CR</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-600 leading-relaxed">
                Claude + FLUX + Kling × 3 포함 (Est. $1.50)
              </p>
              <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                <span className="text-[10px] text-zinc-600">보유 크레딧</span>
                <span className={`text-[10px] font-black ${credits >= creditCost ? 'text-emerald-400' : 'text-red-400'}`}>
                  {credits} CR
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-1.5">
                <i className="ri-settings-3-line text-zinc-600 text-[10px]" />
                <span className="text-[9px] text-zinc-600">관리자 페이지 &gt; 크레딧 비용에서 조정 가능</span>
              </div>
            </div>

            {/* 크레딧 부족 경고 */}
            {!costLoading && credits < creditCost && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <i className="ri-copper-diamond-line text-red-400 text-sm flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-red-400 font-bold">크레딧 부족</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">필요: {creditCost} CR · 보유: {credits} CR</p>
                </div>
                <a href="/credit-purchase" className="text-[10px] font-black text-amber-400 hover:text-amber-300 whitespace-nowrap cursor-pointer">충전하기</a>
              </div>
            )}

            {/* 에러 */}
            {pipelineState === 'error' && error && (
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

            {/* 생성 중 상태 */}
            {isProcessing && (
              <div className="bg-sky-500/8 border border-sky-500/20 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin flex-shrink-0" />
                  <p className="text-xs font-black text-sky-400">
                    {getStepLabel()} ({formatElapsed(elapsedSec)})
                  </p>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-600 mt-1.5">
                  {pipelineState === 'init'
                    ? 'Claude 3.5 Haiku가 샷 플랜을 설계합니다 (10~30초)'
                    : pipelineState === 'gen_image' || pipelineState === 'poll_image'
                    ? 'FLUX Schnell로 첫 프레임 이미지를 생성합니다'
                    : 'Kling v2.1 Pro 영상 생성 중 — 페이지를 닫으면 중단됩니다'}
                </p>
              </div>
            )}

            {/* 완료 — 샷별 다운로드 버튼 */}
            {pipelineState === 'done' && videoUrls.length > 0 && (
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <i className="ri-checkbox-circle-fill text-emerald-400 text-sm" />
                  <p className="text-xs font-black text-emerald-400">멀티샷 영상 생성 완료!</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {videoUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900/60 border border-white/[0.06] hover:border-emerald-500/30 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 flex items-center justify-center rounded-md bg-emerald-500/20 flex-shrink-0">
                          <i className="ri-movie-line text-emerald-400 text-[10px]" />
                        </div>
                        <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors">Shot {i + 1}</span>
                      </div>
                      <i className="ri-external-link-line text-zinc-600 group-hover:text-emerald-400 text-xs transition-colors" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom action */}
          <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06]">
            {pipelineState === 'done' ? (
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadAll}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/90 hover:bg-white text-black text-sm font-black transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-download-line" /> 전체 다운로드
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
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
              >
                {isProcessing ? (
                  <><i className="ri-loader-4-line animate-spin" /> {getStepLabel()}</>
                ) : costLoading ? (
                  <><i className="ri-loader-4-line animate-spin" /> 비용 조회 중...</>
                ) : (
                  <><i className="ri-film-line" /> 멀티샷 영상 만들기 ({creditCost} CR)</>
                )}
              </button>
            )}
            {!prompt.trim() && pipelineState === 'idle' && (
              <p className="text-[10px] text-zinc-600 text-center mt-2">
                영상 프롬프트를 입력해주세요
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
