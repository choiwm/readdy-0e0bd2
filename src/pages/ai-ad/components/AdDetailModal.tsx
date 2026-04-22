import { useState, useRef, useCallback, useEffect } from 'react';
import { TvcTemplate } from '@/mocks/tvcSamples';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useNotifications } from '@/hooks/useNotifications';
import { uploadProductImagesToStorage } from '@/pages/ai-ad/utils/uploadProductImage';
import SnsExportModal from './SnsExportModal';
import GeneratingPanel from './GeneratingPanel';
import ErrorPanel, { ErrorType } from './ErrorPanel';

type OutputRatio = '16:9' | '9:16' | '1:1';
type OutputRes = '1K' | '2K' | '4K';
type OutputFmt = 'PNG' | 'JPG' | 'WEBP';
type GenerationState = 'idle' | 'uploading' | 'generating' | 'done' | 'error';

export interface VideoModelOption {
  id: string;
  label: string;
  badge: string;
  badgeColor: string;
  desc: string;
  speed: 'fast' | 'normal' | 'slow';
  quality: 'standard' | 'high' | 'ultra';
  costMultiplier: number; // 기본 비용 대비 배수
  t2vModel: string;
  i2vModel: string;
  recommended?: boolean;
}

export const VIDEO_MODEL_OPTIONS: VideoModelOption[] = [
  {
    id: 'kling-v1',
    label: 'Kling v1',
    badge: '추천',
    badgeColor: 'emerald',
    desc: '안정적 · 표준 품질 · 검증됨',
    speed: 'normal',
    quality: 'standard',
    costMultiplier: 1.0,
    t2vModel: 'fal-ai/kling-video/v1/standard/text-to-video',
    i2vModel: 'fal-ai/kling-video/v1/standard/image-to-video',
    recommended: true,
  },
  {
    id: 'kling-v25-turbo',
    label: 'Kling 2.5 Turbo',
    badge: '고품질',
    badgeColor: 'rose',
    desc: '유동적 모션 · 고품질',
    speed: 'normal',
    quality: 'high',
    costMultiplier: 1.6,
    t2vModel: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    i2vModel: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video',
  },
  {
    id: 'kling-v3-pro',
    label: 'Kling 3.0 Pro',
    badge: '최고품질',
    badgeColor: 'amber',
    desc: '최상위 품질 · 커스텀 요소',
    speed: 'slow',
    quality: 'ultra',
    costMultiplier: 2.5,
    t2vModel: 'fal-ai/kling-video/v3/pro/text-to-video',
    i2vModel: 'fal-ai/kling-video/v3/pro/image-to-video',
  },
  {
    id: 'veo3',
    label: 'Veo 3',
    badge: 'Google',
    badgeColor: 'sky',
    desc: 'Google 모델 · 4K · 오디오',
    speed: 'slow',
    quality: 'ultra',
    costMultiplier: 3.0,
    t2vModel: 'fal-ai/veo3',
    i2vModel: 'fal-ai/veo3',
  },
];

export interface GenerationResult {
  type: 'image' | 'video';
  url: string;
  ratio: OutputRatio;
  res: OutputRes;
  fmt: OutputFmt;
  dbId?: string;
  templateTitle?: string;
}

interface AdDetailModalProps {
  template: TvcTemplate;
  productName: string;
  productDesc: string;
  sidebarProducts?: string[];
  onClose: () => void;
  onAddToMyWorks: (result: GenerationResult) => void;
  onGeneratingChange?: (generating: boolean) => void;
}

// 프론트 표시용 비용 (실제 차감은 Edge Function에서만 수행)
// Flux Pro = 20CR, Kling v1 text-to-video = 50CR, image-to-video = 50CR
// redux(image-to-image) = 22CR
const IMAGE_COST_DISPLAY = 20;       // fal-ai/flux-pro
const IMAGE_I2I_COST_DISPLAY = 22;   // fal-ai/flux-pro/v1/redux (image-to-image)
const VIDEO_BASE_COST = 50;          // Kling v1 기준 기본 비용
// 영상+이미지 파이프라인: 이미지 redux(22) + 영상 i2v = 72CR (기본 모델 기준)
const VIDEO_WITH_IMAGE_BASE_COST = 72;

function getVideoCostDisplay(modelId: string, hasProductImage: boolean): number {
  const model = VIDEO_MODEL_OPTIONS.find((m) => m.id === modelId);
  const multiplier = model?.costMultiplier ?? 1.0;
  const base = hasProductImage ? VIDEO_WITH_IMAGE_BASE_COST : VIDEO_BASE_COST;
  return Math.round(base * multiplier);
}

const SESSION_KEY = 'ai_ad_session_id';
function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `ad_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * 이미지 생성 pending 폴링 — generate-image Edge Function 프록시 사용
 * maxAttempts=60, intervalMs=5000 → 최대 5분 대기
 */
async function pollImageResult(
  falModel: string,
  requestId: string,
  statusUrl?: string | null,
  responseUrl?: string | null,
  saveOpts?: Record<string, unknown>,
  maxAttempts = 75,
  intervalMs = 4000
): Promise<string | null> {
  let consecutiveErrors = 0;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          _poll: true,
          request_id: requestId,
          model: falModel,
          status_url: statusUrl ?? undefined,
          response_url: responseUrl ?? undefined,
          save_opts: saveOpts,
        },
      });
      if (error) {
        consecutiveErrors++;
        console.warn(`[pollImageResult] Edge Function 오류 (${consecutiveErrors}회):`, error.message);
        if (consecutiveErrors >= 8) throw new Error(`이미지 폴링 연속 오류: ${error.message}`);
        continue;
      }
      consecutiveErrors = 0;
      if (data?.imageUrl) return data.imageUrl;
      if (data?.status === 'FAILED') throw new Error(data.error ?? '이미지 생성 실패');
      const queuePos = data?.queue_position;
      console.log(`[pollImageResult] ${i + 1}/${maxAttempts}: status=${data?.status ?? 'IN_PROGRESS'}${queuePos != null ? `, queue_pos=${queuePos}` : ''}`);
    } catch (e) {
      if (e instanceof Error && (e.message.includes('실패') || e.message.includes('FAILED') || e.message.includes('오류'))) throw e;
      consecutiveErrors++;
      if (consecutiveErrors >= 8) throw new Error('이미지 폴링 중 반복 오류가 발생했습니다.');
    }
  }
  return null;
}

// fal.ai error_type 중 재시도 가능한 타입 목록 (공식 문서 기준)
const _FAL_RETRYABLE_ERROR_TYPES = new Set([
  'request_timeout', 'startup_timeout', 'runner_scheduling_failure',
  'runner_connection_timeout', 'runner_disconnected', 'runner_connection_refused',
  'runner_connection_error', 'runner_incomplete_response', 'runner_server_error',
  'internal_error',
]);

// 영구 실패 타입 — 재시도해도 소용 없음
const FAL_PERMANENT_ERROR_TYPES = new Set([
  'client_disconnected', 'client_cancelled', 'bad_request',
  'auth_error', 'not_found', 'url_error',
]);

/**
 * Edge Function이 pending 반환 시 프론트에서 Edge Function 폴링 프록시를 통해 결과 확인
 * fal.ai API 키는 Edge Function 내부에서만 사용 (보안)
 * statusUrl: pending 응답에 포함된 status_url — Edge Function에 전달해 정확한 폴링
 * responseUrl: pending 응답에 포함된 response_url — COMPLETED 시 결과 조회에 사용
 * saveOpts: pending 시 반환된 save_opts — 폴링 완료 시 Edge Function에서 ad_works 저장
 * 절대 타임아웃: 20분 (1200초) — 이 시간이 지나면 무조건 포기
 */
async function pollFalVideoResult(
  falModel: string,
  requestId: string,
  statusUrl?: string,
  responseUrl?: string,
  saveOpts?: Record<string, unknown>,
  onCancelRef?: React.MutableRefObject<boolean>,
  onStepUpdate?: (step: string) => void
): Promise<string | null> {
  const ABSOLUTE_TIMEOUT_MS = 20 * 60 * 1000; // 20분 절대 타임아웃
  const POLL_INTERVAL_MS = 6000; // 6초마다 폴링
  const startTime = Date.now();
  let consecutiveErrors = 0;
  let attempt = 0;

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= ABSOLUTE_TIMEOUT_MS) {
      throw new Error('영상 생성 시간이 초과되었습니다 (20분). fal.ai 서버가 혼잡하거나 요청이 실패했을 수 있어요. 잠시 후 다시 시도해주세요.');
    }

    if (onCancelRef?.current) throw new Error('사용자가 생성을 취소했습니다.');

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    attempt++;

    if (onCancelRef?.current) throw new Error('사용자가 생성을 취소했습니다.');

    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          _poll: true,
          request_id: requestId,
          model: falModel,
          status_url: statusUrl,
          response_url: responseUrl,
          save_opts: saveOpts,
        },
      });

      if (error) {
        consecutiveErrors++;
        console.warn(`[pollFalVideoResult] Edge Function 오류 (${consecutiveErrors}회):`, error.message);
        if (consecutiveErrors >= 8) throw new Error(`영상 폴링 연속 오류: ${error.message}`);
        continue;
      }

      consecutiveErrors = 0;

      if (data?.videoUrl) return data.videoUrl;

      if (data?.status === 'FAILED') {
        const falErrorType: string | undefined = data.fal_error_type;
        const errMsg: string = data.error ?? '영상 생성 실패';
        const isPermanent: boolean = falErrorType ? FAL_PERMANENT_ERROR_TYPES.has(falErrorType) : false;

        console.error(`[pollFalVideoResult] FAILED — error_type=${falErrorType}, msg=${errMsg}`);
        if (isPermanent) throw new Error(errMsg);
        throw new Error(errMsg);
      }

      const elapsedSec = Math.round(elapsed / 1000);
      const queuePos = data?.queue_position;
      const queuePosMsg = queuePos != null ? ` (대기열 ${queuePos}위)` : '';
      console.log(`[pollFalVideoResult] 시도 ${attempt} (${elapsedSec}s): status=${data?.status ?? 'IN_PROGRESS'}, queue_pos=${queuePos ?? '-'}`);

      // queue_position UI 업데이트
      if (queuePos != null && queuePos > 0) {
        onStepUpdate?.(`영상 렌더링 대기 중${queuePosMsg} — ${Math.floor(elapsedSec / 60)}분 ${elapsedSec % 60}초 경과`);
      } else if (queuePos === 0 || data?.status === 'IN_PROGRESS') {
        onStepUpdate?.(`영상 렌더링 진행 중... ${Math.floor(elapsedSec / 60)}분 ${elapsedSec % 60}초 경과`);
      }

    } catch (e) {
      if (e instanceof Error && (
        e.message.includes('취소') ||
        e.message.includes('실패') ||
        e.message.includes('FAILED') ||
        e.message.includes('초과') ||
        e.message.includes('timeout') ||
        e.message.includes('fal.ai') ||
        e.message.includes('오류')
      )) throw e;
      consecutiveErrors++;
      if (consecutiveErrors >= 8) throw new Error('영상 폴링 중 반복 오류가 발생했습니다.');
    }
  }
}



export default function AdDetailModal({ template, productName, productDesc, sidebarProducts = [], onClose, onAddToMyWorks, onGeneratingChange }: AdDetailModalProps) {
  const { profile } = useAuth();
  const { credits, deduct, refreshCredits } = useCredits();
  const { sendGenerationInProgress, completeGenerationNotif, failGenerationNotif } = useNotifications();

  const [productImages, setProductImages] = useState<string[]>(sidebarProducts.slice(0, 3));
  const [outputRatio, setOutputRatio] = useState<OutputRatio>('16:9');
  const [outputRes, setOutputRes] = useState<OutputRes>('1K');
  const [outputFmt, setOutputFmt] = useState<OutputFmt>('PNG');
  const [fmtOpen, setFmtOpen] = useState(false);
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>('kling-v1');
  const [advantage, setAdvantage] = useState(productDesc);
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [genType, setGenType] = useState<'image' | 'video'>('image');
  const [genProgress, setGenProgress] = useState(0);
  const [genStep, setGenStep] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const [genErrorType, setGenErrorType] = useState<ErrorType>('unknown');
  // 에러 발생 시 어떤 모델을 쓰고 있었는지 추적
  const [genErrorModel, setGenErrorModel] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [snsExportOpen, setSnsExportOpen] = useState(false);
  const [_savedToMyWorks, setSavedToMyWorks] = useState(false);
  // 업로드된 Storage URL 캐시 (같은 이미지 재업로드 방지)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [completedElapsedSec, setCompletedElapsedSec] = useState(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const genStartTimeRef = useRef<number>(0);
  const productFileRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 사용자 취소 플래그 — pollFalVideoResult에 전달해서 즉시 중단 가능
  const cancelPollRef = useRef<boolean>(false);
  // [FIX] selectedVideoModel을 ref로도 유지 — handleGenerate 클로저에서 최신값 보장
  const selectedVideoModelRef = useRef<string>('kling-v1');

  // isVip 계산을 컴포넌트 최상단에서 한 번만 (모든 조건에서 공통 사용)
  const userPlan = (profile?.plan ?? '').toLowerCase();
  const isVipUser = ['enterprise', 'vip', 'admin'].includes(userPlan) || credits >= 99990;

  const maxProductImages = 3;

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  // 생성 상태 변경 시 부모에 알림
  useEffect(() => {
    const generating = genState === 'generating' || genState === 'uploading';
    onGeneratingChange?.(generating);
  }, [genState, onGeneratingChange]);

  useEffect(() => {
    if (genState === 'idle') {
      setAdvantage(productDesc);
    }
  }, [productDesc, genState]);

  // 제품 이미지가 변경되면 캐시 초기화
  useEffect(() => {
    setUploadedUrls([]);
  }, [productImages]);

  // selectedVideoModel 변경 시 ref도 동기화
  useEffect(() => {
    selectedVideoModelRef.current = selectedVideoModel;
  }, [selectedVideoModel]);

  const clearAllTimers = useCallback(() => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
  }, []);

  // 경과 시간 포맷 (mm:ss)
  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  // 에러 타입 정밀 분류 — HTTP 코드, 키워드, 모델별 패턴 매칭
  const classifyError = (msg: string): ErrorType => {
    const lower = msg.toLowerCase();

    // 1. 크레딧 부족 (최우선)
    if (
      lower.includes('크레딧') || lower.includes('credit') ||
      lower.includes('insufficient') || lower.includes('402') ||
      lower.includes('결제') || lower.includes('충전')
    ) return 'credits';

    // 2. API 키 인증 오류
    if (
      lower.includes('api 키') || lower.includes('api key') ||
      lower.includes('unauthorized') || lower.includes('401') ||
      lower.includes('403') || lower.includes('인증') ||
      lower.includes('등록') || lower.includes('invalid key') ||
      lower.includes('key not found')
    ) return 'api_key';

    // 3. 콘텐츠 정책 위반
    if (
      lower.includes('content policy') || lower.includes('nsfw') ||
      lower.includes('safety') || lower.includes('정책') ||
      lower.includes('inappropriate') || lower.includes('blocked')
    ) return 'content_policy';

    // 4. 요청 한도 초과
    if (
      lower.includes('429') || lower.includes('rate limit') ||
      lower.includes('too many') || lower.includes('한도') ||
      lower.includes('throttl')
    ) return 'rate_limit';

    // 5. 모델 사용 불가
    if (
      lower.includes('model') && (lower.includes('unavailable') || lower.includes('not found') || lower.includes('deprecated')) ||
      lower.includes('모델') && (lower.includes('사용 불가') || lower.includes('점검')) ||
      lower.includes('422') // 잘못된 모델 파라미터
    ) return 'model_unavailable';

    // 6. 타임아웃
    if (
      (lower.includes('시간') && lower.includes('초과')) ||
      lower.includes('timeout') || lower.includes('timed out') ||
      lower.includes('504') || lower.includes('20분') || lower.includes('15분')
    ) return 'timeout';

    // 7. 네트워크 오류
    if (
      lower.includes('network') || lower.includes('fetch') ||
      lower.includes('연결') || lower.includes('econnrefused') ||
      lower.includes('enotfound') || lower.includes('socket')
    ) return 'network';

    // 8. 서버 오류 (502, 500, 503 등)
    if (
      lower.includes('502') || lower.includes('500') || lower.includes('503') ||
      lower.includes('서버') || lower.includes('server error') ||
      lower.includes('fal.ai') || lower.includes('1단계') || lower.includes('2단계') ||
      lower.includes('failed') || lower.includes('실패')
    ) return 'server';

    return 'unknown';
  };

  const handleClose = useCallback(() => {
    if (genState === 'generating' || genState === 'uploading') { setCloseConfirm(true); return; }
    // 생성 완료 후 닫기 — 갤러리에 자동 저장됐으므로 바로 닫기 허용
    // (내 작업 저장은 별도 버튼으로 명시적으로 수행)
    onClose();
  }, [genState, onClose]);

  const handleForceClose = useCallback(() => {
    clearAllTimers();
    // 폴링 즉시 중단 플래그 세팅
    cancelPollRef.current = true;
    // 강제 닫기 시 크레딧 환불은 Edge Function에서 처리됨
    onClose();
  }, [clearAllTimers, onClose]);

  const buildPrompt = useCallback((type: 'image' | 'video', hasProductImage: boolean) => {
    const base = `${template.title} advertisement, ${template.subtitle}`;
    const product = productName ? `, product: ${productName}` : '';
    const desc = advantage ? `, ${advantage}` : '';
    const style = `cinematic high quality commercial photography, professional lighting, luxury brand aesthetic, dark background`;
    const ratio = outputRatio === '9:16' ? 'vertical portrait format' : outputRatio === '1:1' ? 'square format' : 'widescreen landscape format';

    if (hasProductImage) {
      // 제품 이미지가 있을 때: 이미지 기반 광고 씬 생성 프롬프트
      const imgHint = `transform this product into a stunning ${template.title} advertisement scene, maintain product appearance, professional commercial photography`;
      if (type === 'video') {
        return `${imgHint}${product}${desc}, ${style}, ${ratio}, smooth cinematic camera movement, professional video production`;
      }
      return `${imgHint}${product}${desc}, ${style}, ${ratio}`;
    }

    // 제품 이미지 없을 때: 텍스트 기반 생성
    if (type === 'video') {
      return `${base}${product}${desc}, ${style}, ${ratio}, smooth camera movement, professional video production`;
    }
    return `${base}${product}${desc}, ${style}, ${ratio}`;
  }, [template, productName, advantage, outputRatio]);

  /**
   * 핵심 파이프라인:
   * 1. 제품 이미지가 있으면 → Storage 업로드 → image_url 획득
   * 2. 이미지 생성: image_url 있으면 image-to-image, 없으면 text-to-image
   * 3. 동영상 생성: 이미지 먼저 생성 → 그 결과로 image-to-video
   */
  const handleGenerate = useCallback(async (type: 'image' | 'video') => {
    // 생성 중이면 중복 실행 방지 (에러/완료 상태에서는 재시도 허용)
    if (genState === 'generating' || genState === 'uploading') return;

    const hasProductImagesForCost = productImages.length > 0;
    const displayCost = type === 'image'
      ? (hasProductImagesForCost ? IMAGE_I2I_COST_DISPLAY : IMAGE_COST_DISPLAY)
      : getVideoCostDisplay(selectedVideoModelRef.current, hasProductImagesForCost);

    // [FIX] isVip를 컴포넌트 스코프에서 계산한 값 사용 (클로저 stale 방지)
    const currentIsVip = ['enterprise', 'vip', 'admin'].includes((profile?.plan ?? '').toLowerCase()) || credits >= 99990;

    console.log(`[AdDetailModal] handleGenerate: type=${type}, plan=${profile?.plan}, credits=${credits}, isVip=${currentIsVip}, displayCost=${displayCost}`);

    if (!currentIsVip && credits < displayCost) {
      setGenError(`크레딧이 부족합니다. 필요: ${displayCost} CR, 보유: ${credits} CR`);
      setGenErrorType('credits');
      setGenState('error');
      return;
    }

    setGenType(type);
    setGenError(null);
    setGenErrorType('unknown');
    setGenErrorModel(undefined);
    setResult(null);
    setCloseConfirm(false);
    setElapsedSec(0);
    genStartTimeRef.current = Date.now();
    // 취소 플래그 리셋
    cancelPollRef.current = false;

    // ── Step 1: 제품 이미지 Storage 업로드 ──
    let storageImageUrls: string[] = uploadedUrls;
    const hasBlobImages = productImages.some((u) => u.startsWith('blob:'));

    if (hasBlobImages || (productImages.length > 0 && uploadedUrls.length === 0)) {
      setGenState('uploading');
      setGenProgress(0);

      // 업로드 전체 타임아웃 (30초) — 무한 루프 방지
      const uploadTimeout = new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error('이미지 업로드 시간이 초과됐어요 (30초). 더 작은 이미지를 사용해주세요.')), 30000)
      );

      try {
        storageImageUrls = await Promise.race([
          uploadProductImagesToStorage(productImages, profile?.id ?? null),
          uploadTimeout,
        ]);
        setUploadedUrls(storageImageUrls);
        if (storageImageUrls.length === 0 && productImages.length > 0) {
          console.warn('이미지 업로드 결과 없음, 텍스트 기반으로 진행');
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '이미지 업로드 실패';
        console.warn('이미지 업로드 실패:', errMsg);

        // 타임아웃이나 치명적 오류면 에러 상태로 전환 (무한 루프 방지)
        if (errMsg.includes('시간 초과') || errMsg.includes('timeout')) {
          clearAllTimers();
          setGenError(errMsg);
          setGenErrorType('timeout');
          setGenState('error');
          return;
        }
        // 그 외 업로드 실패는 텍스트 기반으로 계속 진행
        storageImageUrls = [];
      }
    }

    // ── Step 2: 생성 시작 ──
    setGenState('generating');
    setGenProgress(0);

    const hasProductImage = storageImageUrls.length > 0;
    // 동영상 생성 시 이미지 먼저 생성 → image-to-video 파이프라인
    const isVideoWithImage = type === 'video' && hasProductImage;

    const steps = type === 'image'
      ? (hasProductImage
          ? ['제품 이미지 분석 중...', '광고 씬 구성 중...', 'AI 이미지 변환 중...', '후처리 적용 중...', '완료!']
          : ['프롬프트 분석 중...', '씬 구성 중...', '이미지 렌더링 중...', '후처리 적용 중...', '완료!'])
      : (hasProductImage
          ? ['제품 이미지 분석 중...', '광고 이미지 생성 중...', '영상 씬 구성 중...', '영상 합성 중...', '자막 적용 중...', '최종 렌더링 중...', '완료!']
          : ['스크립트 생성 중...', '씬 분할 중...', '이미지 생성 중...', '영상 합성 중...', '자막 적용 중...', '최종 렌더링 중...', '완료!']);

    let stepIdx = 0;
    setGenStep(steps[0]);

    let notifId: string | undefined;
    try {
      notifId = (await sendGenerationInProgress({
        generation_type: type,
        model_name: hasProductImage ? `AI Ad ${type === 'image' ? 'Image' : 'Video'} (제품 이미지 반영)` : `AI Ad ${type === 'image' ? 'Image' : 'Video'}`,
      })) ?? undefined;
    } catch { /* 무시 */ }

    // stepTimerRef는 사용하지 않음 — 실제 작업 단계에서 setGenStep을 직접 호출
    // (타이머 기반으로 step을 올리면 "완료!" 메시지가 실제 완료 전에 표시되는 버그 발생)
    const advanceStep = () => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 2); // 마지막("완료!") 전까지만
      setGenStep(steps[stepIdx]);
    };

    // 타이머 시작 (clearAllTimers 후 재시작)
    clearAllTimers();

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - genStartTimeRef.current) / 1000));
    }, 1000);

    // 프로그레스 타이머:
    // - 이미지만 생성: 0 → 85% 자동 증가 (나머지 15%는 폴링에서 채움)
    // - 영상(제품이미지 있음): 1단계(0~40%) 자동, 1단계 완료 후 setGenProgress(45)로 점프, 2단계(45~85%) 타이머 재시작
    // - 영상(제품이미지 없음): 0 → 85% 자동 증가
    const progressMax = isVideoWithImage ? 40 : 85;
    const progressIncrement = isVideoWithImage ? 0.6 : (type === 'image' ? 2.0 : 1.2);
    progressTimerRef.current = setInterval(() => {
      setGenProgress((p) => Math.min(p + progressIncrement, progressMax));
    }, 300);

    // 실제 차감된 크레딧 추적 (Edge Function에서 차감하므로 프론트는 추적만)
    let actualCreditsUsed = 0;

    try {
      const prompt = buildPrompt(type, hasProductImage);
      const primaryImageUrl = storageImageUrls[0] ?? null;

      let resultUrl: string;

      if (type === 'image') {
        // ── 이미지 생성 (image-to-image or text-to-image) ──
        advanceStep(); // "씬 구성 중..." or "광고 씬 구성 중..."
        // ai-ad 이미지 생성: Flux Dev (주) - DB 활성 모델과 일치
        // 제품이미지 있는 경우만 redux (i2i) 사용
        const adImageModel = primaryImageUrl ? 'Nano Banana 3' : 'Nano Banana 3'; // fal-ai/flux/dev
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt,
            model: adImageModel,
            type: 'IMAGE',
            ratio: outputRatio,
            aspectRatio: outputRatio,
            user_id: profile?.id ?? null,
            session_id: getSessionId(),
            source: 'ai-ad',
            template_id: template.id,
            template_title: template.title,
            product_name: productName || null,
            product_desc: advantage || null,
            resolution: outputRes,
            format: outputFmt,
            ...(primaryImageUrl ? { image_url: primaryImageUrl, image_strength: 0.75 } : {}),
          },
        });
        if (error) {
          throw new Error(error?.message ?? '이미지 생성 실패');
        }
        if (data?.error) {
          throw new Error(data.error);
        }

        // pending 상태 — 프론트에서 폴링
        if (data?.pending && data?.request_id) {
          actualCreditsUsed = data.credits_used ?? IMAGE_COST_DISPLAY;
          advanceStep(); // "이미지 렌더링 중..."
          setGenStep('이미지 렌더링 완료 대기 중...');
          const polledUrl = await pollImageResult(
            data.model ?? 'fal-ai/flux/dev',
            data.request_id,
            data.status_url ?? null,
            data.response_url ?? null,
            data.save_opts,
            75,
            4000
          );
          if (!polledUrl) throw new Error('이미지 생성 시간이 초과되었습니다 (5분). fal.ai 서버가 혼잡할 수 있어요. 잠시 후 다시 시도해주세요.');
          resultUrl = polledUrl;
        } else if (!data?.imageUrl) {
          throw new Error(data?.error ?? '이미지 생성 실패 — 결과를 받지 못했습니다.');
        } else {
          actualCreditsUsed = data.credits_used ?? IMAGE_COST_DISPLAY;
          resultUrl = data.imageUrl;
          advanceStep(); // "후처리 적용 중..."
        }

        if (data?.ad_work_id) {
          console.log('[AdDetailModal] ad_works 저장 완료 (Edge Function):', data.ad_work_id);
        }

      } else {
        // ── 동영상 생성 ──
        if (hasProductImage && primaryImageUrl) {
          // ── 2단계 파이프라인: 제품 이미지 → 광고 이미지 → 영상 ──
          // 1단계: 이미지 생성 (0~45%)
          setGenStep('1단계: 제품 이미지로 광고 이미지 생성 중...');
          setGenProgress(5);

          console.log('[AdDetailModal] 1단계 이미지 생성 시작, image_url:', primaryImageUrl.slice(0, 100));

          const step1Body = {
            prompt: buildPrompt('image', true),
            model: 'Nano Banana 3', // fal-ai/flux/dev → i2i 시 fal-ai/flux/dev/image-to-image
            type: 'IMAGE',
            ratio: outputRatio,
            aspectRatio: outputRatio,
            user_id: profile?.id ?? null,
            session_id: getSessionId(),
            image_url: primaryImageUrl,  // [핵심] 제품 이미지 전달
            image_strength: 0.75,
            // 1단계 이미지는 ad_works에 저장 안 함 (최종 영상만 저장)
            source: 'step1_temp',  // ai-ad 저장 제외용
          };

          console.log('[AdDetailModal] 1단계 요청 바디 (image_url 포함 여부):', Boolean(step1Body.image_url));

          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-image', {
            body: step1Body,
          });

          if (imgError) {
            console.error('[AdDetailModal] 1단계 Edge Function 오류:', imgError);
            throw new Error(imgError.message ?? '광고 이미지 생성 실패 (1단계)');
          }
          if (imgData?.error) {
            console.error('[AdDetailModal] 1단계 서버 오류:', imgData.error);
            throw new Error(imgData.error);
          }

          console.log('[AdDetailModal] 1단계 응답:', JSON.stringify(imgData).slice(0, 200));

          // pending 상태 처리 — Edge Function 타임아웃으로 request_id 반환 시 프론트에서 폴링
          let step1ImageUrl: string;
          if (imgData?.pending && imgData?.request_id) {
            actualCreditsUsed += imgData.credits_used ?? IMAGE_I2I_COST_DISPLAY;
            setGenStep('1단계: 광고 이미지 렌더링 대기 중...');
            console.log('[AdDetailModal] 1단계 pending, 폴링 시작 request_id:', imgData.request_id);
            const polledUrl = await pollImageResult(
              imgData.model ?? 'fal-ai/flux/dev/image-to-image',
              imgData.request_id,
              imgData.status_url ?? null,
              imgData.response_url ?? null,
              undefined, // 1단계 이미지는 ad_works/gallery 저장 불필요
              90,  // 최대 6분 대기
              4000
            );
            if (!polledUrl) throw new Error('광고 이미지 생성 시간이 초과되었습니다 (6분). 잠시 후 다시 시도해주세요.');
            step1ImageUrl = polledUrl;
            console.log('[AdDetailModal] 1단계 완료, 이미지 URL:', step1ImageUrl.slice(0, 80));
          } else if (!imgData?.imageUrl) {
            throw new Error(imgData?.error ?? '광고 이미지 생성 실패 (1단계) — 결과를 받지 못했습니다.');
          } else {
            step1ImageUrl = imgData.imageUrl;
            console.log('[AdDetailModal] 1단계 즉시 완료, 이미지 URL:', step1ImageUrl.slice(0, 80));
          }

          // 1단계 완료 → 프로그레스 45%로 점프
          setGenProgress(45);
          setGenStep('2단계: 광고 이미지로 영상 생성 중...');

          // 2단계 프로그레스 타이머 재시작 (45~85%) — 이전 타이머 먼저 정지
          if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
          progressTimerRef.current = setInterval(() => {
            setGenProgress((p) => Math.min(p + 0.5, 85));
          }, 350);

          // 2단계: image-to-video (source:'ai-ad'로 Edge Function에서 ad_works 자동 저장)
          // [FIX] selectedVideoModel을 직접 참조하지 않고 현재 값을 로컬 변수에 고정
          const currentVideoModelId = selectedVideoModelRef.current;
          const selectedModel = VIDEO_MODEL_OPTIONS.find((m) => m.id === currentVideoModelId) ?? VIDEO_MODEL_OPTIONS[0];
          const { data: vidData, error: vidError } = await supabase.functions.invoke('generate-video', {
            body: {
              prompt,
              ratio: outputRatio,
              duration: 5,
              model_id: selectedModel.i2vModel,
              user_id: profile?.id ?? null,
              session_id: getSessionId(),
              source: 'ai-ad',
              template_id: template.id,
              template_title: template.title,
              product_name: productName || null,
              product_desc: advantage || null,
              resolution: outputRes,
              format: outputFmt,
              image_url: step1ImageUrl,
            },
          });
          if (vidError) {
            console.error('[AdDetailModal] 2단계 영상 Edge Function 오류:', vidError);
            throw new Error(vidError.message ?? '영상 생성 실패 (2단계)');
          }
          if (vidData?.error) {
            console.error('[AdDetailModal] 2단계 영상 서버 오류:', vidData.error);
            throw new Error(String(vidData.error));
          }
          console.log('[AdDetailModal] 2단계 영상 응답:', JSON.stringify(vidData).slice(0, 200));

          // pending 응답 처리
          if (vidData?.pending && vidData?.request_id) {
            actualCreditsUsed += vidData.credits_used ?? VIDEO_BASE_COST;
            setGenStep('영상 렌더링 완료 대기 중...');
            // [핵심] status_url / response_url 전달
            const polledUrl = await pollFalVideoResult(
              vidData.model ?? selectedModel.i2vModel,
              vidData.request_id,
              vidData.status_url,
              vidData.response_url,
              vidData.save_opts,
              cancelPollRef,
              setGenStep
            );
            if (!polledUrl) throw new Error('영상 생성 시간이 초과되었습니다 (20분). fal.ai 서버가 혼잡할 수 있어요. 잠시 후 다시 시도해주세요.');
            resultUrl = polledUrl;
          } else if (!vidData?.videoUrl) {
            throw new Error(vidData?.error ?? '영상 생성 실패 (2단계)');
          } else {
            actualCreditsUsed += vidData.credits_used ?? VIDEO_BASE_COST;
            resultUrl = vidData.videoUrl;
          }

        } else {
          // 제품 이미지 없음: 텍스트 기반 영상 생성 (source:'ai-ad'로 ad_works 자동 저장)
          setGenStep('스크립트 생성 중...');
          // [FIX] selectedVideoModel을 직접 참조하지 않고 현재 값을 로컬 변수에 고정
          const currentVideoModelId = selectedVideoModelRef.current;
          const selectedModel = VIDEO_MODEL_OPTIONS.find((m) => m.id === currentVideoModelId) ?? VIDEO_MODEL_OPTIONS[0];
          const { data, error } = await supabase.functions.invoke('generate-video', {
            body: {
              prompt,
              ratio: outputRatio,
              duration: 5,
              model_id: selectedModel.t2vModel,
              user_id: profile?.id ?? null,
              session_id: getSessionId(),
              source: 'ai-ad',
              template_id: template.id,
              template_title: template.title,
              product_name: productName || null,
              product_desc: advantage || null,
              resolution: outputRes,
              format: outputFmt,
            },
          });
          if (error) throw new Error(error.message ?? '영상 생성 실패');

          // pending 응답 처리: Edge Function 타임아웃으로 request_id 반환 시 프론트에서 직접 폴링
          if (data?.pending && data?.request_id) {
            actualCreditsUsed = data.credits_used ?? VIDEO_BASE_COST;
            setGenStep('영상 렌더링 완료 대기 중...');
            // [핵심] status_url / response_url 전달
            const polledUrl = await pollFalVideoResult(
              data.model ?? selectedModel.t2vModel,
              data.request_id,
              data.status_url,
              data.response_url,
              data.save_opts,
              cancelPollRef,
              setGenStep
            );
            if (!polledUrl) throw new Error('영상 생성 시간이 초과되었습니다 (20분). fal.ai 서버가 혼잡할 수 있어요. 잠시 후 다시 시도해주세요.');
            resultUrl = polledUrl;
          } else if (!data?.videoUrl) {
            throw new Error(data?.error ?? '영상 생성 실패');
          } else {
            actualCreditsUsed = data.credits_used ?? VIDEO_BASE_COST;
            resultUrl = data.videoUrl;
          }
        }
      }

      clearAllTimers();
      setGenProgress(100);
      setGenStep('완료!');

      // 크레딧 UI 동기화: Edge Function에서 실제 차감됐으므로 DB에서 최신 잔액 재조회
      // deduct()는 로컬 추정값이라 오차 발생 가능 → refreshCredits()로 정확한 값 반영
      try {
        await refreshCredits();
      } catch {
        // 실패 시 로컬 추정값으로 폴백
        if (actualCreditsUsed > 0) deduct(actualCreditsUsed);
      }

      // ad_works 저장은 Edge Function에서 service_role로 처리됨 (RLS 우회)
      // Edge Function 응답에서 ad_work_id를 받아서 사용
      const workId = `adwork_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const newResult: GenerationResult = {
        type,
        url: resultUrl,
        ratio: outputRatio,
        res: outputRes,
        fmt: outputFmt,
        dbId: workId,
        templateTitle: template.title,
      };

      await completeGenerationNotif({
        generation_type: type,
        model_name: hasProductImage
          ? `AI Ad ${type === 'image' ? 'Image' : 'Video'} (제품 이미지 반영)`
          : `AI Ad ${type === 'image' ? 'Image' : 'Video'}`,
        credits_used: actualCreditsUsed,
        result_url: resultUrl,
        notification_id: notifId,
      });

      // 완료 시 경과 시간 스냅샷
      setCompletedElapsedSec(Math.floor((Date.now() - genStartTimeRef.current) / 1000));
      setResult(newResult);
      setGenState('done');
      // 생성 완료 시 자동으로 내 작업에 저장
      setSavedToMyWorks(true);
      onAddToMyWorks(newResult);

    } catch (err) {
      clearAllTimers();
      const errMsg = err instanceof Error ? err.message : '생성 중 오류가 발생했습니다';
      setGenError(errMsg);
      setGenErrorType(classifyError(errMsg));
      // 에러 발생 시 어떤 모델을 쓰고 있었는지 기록
      const errModelOption = VIDEO_MODEL_OPTIONS.find((m) => m.id === selectedVideoModelRef.current);
      setGenErrorModel(type === 'video' ? (errModelOption?.i2vModel ?? errModelOption?.t2vModel) : 'fal-ai/flux-pro');
      setGenState('error');
      // Edge Function에서 실패 시 자동 환불 처리됨 → DB에서 최신 잔액 재조회
      try {
        await refreshCredits();
      } catch {
        // 실패 시 로컬 추정값으로 폴백 (부분 차감된 경우만)
        if (actualCreditsUsed > 0) deduct(actualCreditsUsed);
      }

      try {
        await failGenerationNotif({
          generation_type: type,
          model_name: `AI Ad ${type === 'image' ? 'Image' : 'Video'}`,
          error_message: errMsg,
          notification_id: notifId,
        });
      } catch { /* 무시 */ }
    }
  }, [genState, credits, deduct, refreshCredits, buildPrompt, clearAllTimers, outputRatio, outputRes, outputFmt, productName, advantage, template, profile, sendGenerationInProgress, completeGenerationNotif, failGenerationNotif, productImages, uploadedUrls]);

  const handleReset = useCallback(() => {
    clearAllTimers();
    setResult(null);
    setGenState('idle');
    setGenProgress(0);
    setGenStep('');
    setGenError(null);
    setGenErrorType('unknown');
    setGenErrorModel(undefined);
    setElapsedSec(0);
    setCompletedElapsedSec(0);
    setGenType('image');
    setSavedToMyWorks(false);
  }, [clearAllTimers]);

  const handleDownload = useCallback(async () => {
    if (!result) return;
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = result.type === 'video' ? 'mp4' : result.fmt.toLowerCase();
      a.download = `ad_${template.title.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(result.url, '_blank');
    }
  }, [result, template.title]);

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || productImages.length >= maxProductImages) return;
    const url = URL.createObjectURL(file);
    setProductImages((prev) => [...prev, url]);
    e.target.value = '';
  };

  const isGenerating = genState === 'generating' || genState === 'uploading';
  const hasProductImages = productImages.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="relative flex flex-col sm:flex-row w-full sm:w-[980px] max-h-[95vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl overflow-hidden bg-[#0d0d0f] border border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: preview / result ── */}
        <div className="hidden sm:flex relative flex-1 bg-black overflow-hidden flex-col" style={{ minHeight: '420px' }}>
          {isGenerating ? (
            <GeneratingPanel
              genType={genType}
              genState={genState as 'uploading' | 'generating'}
              genStep={genStep}
              genProgress={genProgress}
              hasProductImages={hasProductImages}
              productImageCount={productImages.length}
              onForceCancel={handleForceClose}
            />
          ) : genState === 'error' ? (
            <ErrorPanel
              errorType={genErrorType}
              errorMsg={genError ?? '알 수 없는 오류가 발생했습니다.'}
              genType={genType}
              modelName={genErrorModel}
              onRetry={() => {
                setGenError(null);
                setGenState('idle');
                handleGenerate(genType);
              }}
              onReset={handleReset}
            />
          ) : result ? (
            <div className="absolute inset-0 flex flex-col">
              {result.type === 'video' ? (
                <video src={result.url} className="w-full h-full object-cover object-top" autoPlay muted loop playsInline />
              ) : (
                <img src={result.url} alt="Generated" className="w-full h-full object-cover object-top" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-black px-3 py-1.5 rounded-full">
                  <i className="ri-checkbox-circle-fill text-xs" />
                  {result.type === 'image' ? '이미지 생성 완료' : '동영상 생성 완료'}
                </div>
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-full border border-white/10">
                  <i className="ri-gallery-line text-xs" />
                  갤러리 자동 저장됨
                </div>
                {hasProductImages && (
                  <div className="flex items-center gap-1.5 bg-rose-500/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    <i className="ri-image-2-line text-xs" />
                    제품 이미지 반영
                  </div>
                )}
                {/* 소요 시간 배지 */}
                {completedElapsedSec > 0 && (
                  <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-zinc-400 text-xs px-3 py-1.5 rounded-full border border-white/10">
                    <i className="ri-time-line text-xs" />
                    {completedElapsedSec >= 60
                      ? `${Math.floor(completedElapsedSec / 60)}분 ${completedElapsedSec % 60}초 소요`
                      : `${completedElapsedSec}초 소요`}
                  </div>
                )}
              </div>
              <div className="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-2 px-4">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-black text-xs font-black px-4 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-download-line" /> 다운로드
                  </button>
                  <button
                    onClick={() => setSnsExportOpen(true)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white text-xs font-black px-4 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-share-forward-line" /> SNS 내보내기
                  </button>
                  <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1.5 rounded-full whitespace-nowrap">
                    <i className="ri-check-line" />
                    내 작업 저장됨
                  </div>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-zinc-400 text-xs font-black px-3 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-refresh-line" /> 재생성
                  </button>
                </div>
                {/* 닫기 안내 */}
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-zinc-600 hover:text-zinc-400 text-[10px] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-close-line text-[10px]" /> 닫고 내 작업 탭에서 확인하기
                </button>
              </div>
            </div>
          ) : (
            <>
              <img src={template.img} alt={template.title} className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5">
                <p className="text-white font-black text-lg leading-tight">{template.title}</p>
                <p className="text-zinc-400 text-sm mt-0.5">{template.subtitle}</p>
              </div>
              {/* 제품 이미지 반영 안내 배지 */}
              {hasProductImages && (
                <div className="absolute top-4 left-4">
                  <div className="flex items-center gap-1.5 bg-rose-500/80 backdrop-blur-sm text-white text-xs font-black px-3 py-1.5 rounded-full">
                    <i className="ri-image-2-line text-xs" />
                    제품 이미지 {productImages.length}장 준비됨 — 생성 시 자동 반영
                  </div>
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-1.5">
                {template.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-bold px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-zinc-300 border border-white/10">
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Right: settings panel ── */}
        <div className="w-full sm:w-[400px] flex-shrink-0 flex flex-col bg-[#111114] border-l border-white/[0.06] overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20">
                <i className="ri-film-line text-rose-400 text-sm" />
              </div>
              <div>
                <p className="text-sm font-black text-white line-clamp-1">{template.title}</p>
                <p className="text-[10px] text-zinc-500">{template.subtitle}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 rounded-full bg-zinc-800/60 border border-white/[0.06] hover:bg-zinc-700 flex items-center justify-center cursor-pointer transition-all flex-shrink-0"
            >
              <i className="ri-close-line text-zinc-400 text-sm" />
            </button>
          </div>

          {/* Mobile preview strip */}
          <div className="sm:hidden relative w-full h-44 overflow-hidden flex-shrink-0">
            {result ? (
              <>
                {result.type === 'video'
                  ? <video src={result.url} className="w-full h-full object-cover object-top" autoPlay muted loop playsInline />
                  : <img src={result.url} alt="Generated" className="w-full h-full object-cover object-top" />
                }
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute top-2 left-2">
                  <div className="flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-black px-2 py-1 rounded-full">
                    <i className="ri-checkbox-circle-fill text-[10px]" />
                    {result.type === 'image' ? '이미지 완료' : '동영상 완료'}
                  </div>
                </div>
                <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5 flex-wrap px-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 bg-white/90 text-black text-[10px] font-black px-2.5 py-1.5 rounded-full cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-download-line" /> 다운로드
                  </button>
                  <button
                    onClick={() => setSnsExportOpen(true)}
                    className="flex items-center gap-1 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-full cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-share-forward-line" /> SNS
                  </button>
                  <button
                    className="flex items-center gap-1 text-[10px] font-black px-2.5 py-1.5 rounded-full cursor-default whitespace-nowrap border bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                  >
                    <i className="ri-check-line" />
                    저장됨
                  </button>
                </div>
              </>
            ) : (
              <img src={template.img} alt={template.title} className="w-full h-full object-cover object-top" />
            )}
            {isGenerating && (
              <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                <span className="text-xs text-zinc-400">{genStep}</span>
                <div className="w-32 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-500 to-orange-500 rounded-full" style={{ width: `${genProgress}%` }} />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                  <span>경과 {formatElapsed(elapsedSec)}</span>
                  <span>·</span>
                  <span>예상 {genType === 'video' ? '1~4분' : '30~60초'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5" onClick={() => setFmtOpen(false)}>
            {/* 제품 이미지 섹션 — image-to-image 안내 포함 */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <i className="ri-image-2-line text-rose-400 text-sm" />
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">제품 이미지</p>
                  {hasProductImages && (
                    <span className="text-[9px] font-black bg-rose-500/20 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 rounded-full">
                      AI 반영
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600">{productImages.length}/{maxProductImages}</span>
              </div>

              {/* image-to-image 안내 배너 */}
              {hasProductImages ? (
                <div className="flex items-start gap-2 bg-rose-500/8 border border-rose-500/20 rounded-xl px-3 py-2.5 mb-3">
                  <i className="ri-sparkling-2-fill text-rose-400 text-sm flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-rose-300 mb-0.5">제품 이미지 반영 모드 활성화</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      생성 시 제품 이미지를 AI가 분석해 광고 씬에 자동 합성합니다.
                      {genType === 'video' && ' 동영상은 이미지 → 영상 순서로 생성됩니다.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-3 py-2.5 mb-3">
                  <i className="ri-information-line text-zinc-500 text-sm flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    제품 이미지를 업로드하면 AI가 실제 제품을 광고 씬에 합성합니다
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {productImages.length < maxProductImages && (
                  <button
                    onClick={() => productFileRef.current?.click()}
                    className="w-[64px] h-[64px] rounded-xl bg-zinc-900/60 border border-white/[0.06] hover:border-rose-500/30 flex items-center justify-center cursor-pointer transition-all group flex-shrink-0"
                  >
                    <i className="ri-image-add-line text-zinc-600 group-hover:text-rose-400 text-xl transition-colors" />
                  </button>
                )}
                <input ref={productFileRef} type="file" accept="image/*" className="hidden" onChange={handleProductImageUpload} />
                {productImages.map((url, i) => (
                  <div key={i} className="relative w-[64px] h-[64px] rounded-xl overflow-hidden border border-rose-500/30 flex-shrink-0 group">
                    <img src={url} alt={`제품 ${i + 1}`} className="w-full h-full object-cover" />
                    {/* 첫 번째 이미지에 메인 배지 */}
                    {i === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-rose-500/80 text-white text-[8px] font-black text-center py-0.5">
                        메인
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setProductImages((prev) => prev.filter((_, idx) => idx !== i));
                        setUploadedUrls([]);
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <i className="ri-close-line text-white text-[10px]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 출력 옵션 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-settings-4-line text-rose-400 text-sm" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">출력 옵션</p>
                {genState === 'done' && (
                  <span className="ml-auto flex items-center gap-1 text-[9px] text-zinc-600">
                    <i className="ri-lock-line text-[9px]" /> 생성 완료 후 변경 불가
                  </span>
                )}
              </div>
              <div className={`flex flex-wrap gap-1.5 ${genState === 'done' ? 'opacity-50 pointer-events-none' : ''}`}>
                {(['16:9', '9:16', '1:1'] as OutputRatio[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setOutputRatio(r)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      outputRatio === r
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                        : 'bg-zinc-800/60 border border-white/[0.06] text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
                {(['1K', '2K', '4K'] as OutputRes[]).map((res) => (
                  <button
                    key={res}
                    onClick={() => setOutputRes(res)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      outputRes === res
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                        : 'bg-zinc-800/60 border border-white/[0.06] text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                    }`}
                  >
                    {res}
                  </button>
                ))}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setFmtOpen(!fmtOpen)}
                    className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-zinc-800/60 border border-white/[0.06] hover:border-white/10 text-zinc-300 text-[10px] font-black cursor-pointer transition-all whitespace-nowrap"
                  >
                    {outputFmt}
                    <i className={`ri-arrow-down-s-line text-xs transition-transform ${fmtOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {fmtOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-[#1a1a1e] border border-white/10 rounded-xl z-30 overflow-hidden w-20">
                      {(['PNG', 'JPG', 'WEBP'] as OutputFmt[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => { setOutputFmt(f); setFmtOpen(false); }}
                          className={`w-full px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                            outputFmt === f ? 'bg-rose-500/10 text-rose-300' : 'text-zinc-300 hover:bg-white/5'
                          }`}
                        >
                          {f}
                          {outputFmt === f && <i className="ri-check-line text-rose-400 text-[10px] ml-1" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 영상 AI 모델 선택 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <i className="ri-cpu-line text-rose-400 text-sm" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">영상 AI 모델</p>
                <span className="ml-auto text-[9px] text-zinc-600">이미지 생성엔 영향 없음</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {VIDEO_MODEL_OPTIONS.map((m) => {
                  const isSelected = selectedVideoModel === m.id;
                  const badgeClasses: Record<string, string> = {
                    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                    zinc: 'bg-zinc-700/60 text-zinc-400 border-zinc-600/30',
                    rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
                    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                    sky: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
                  };
                  const speedIcon = m.speed === 'fast' ? 'ri-flashlight-line' : m.speed === 'slow' ? 'ri-time-line' : 'ri-speed-line';
                  const speedColor = m.speed === 'fast' ? 'text-emerald-400' : m.speed === 'slow' ? 'text-amber-400' : 'text-zinc-400';
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedVideoModel(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                        isSelected
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : 'bg-zinc-900/40 border-white/[0.06] hover:border-white/10'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-rose-500 bg-rose-500' : 'border-zinc-600'
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{m.label}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${badgeClasses[m.badgeColor]}`}>{m.badge}</span>
                          {m.recommended && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">추천</span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{m.desc}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className={`flex items-center gap-1 ${speedColor}`}>
                          <i className={`${speedIcon} text-[10px]`} />
                          <span className="text-[9px] font-bold">
                            {m.speed === 'fast' ? '빠름' : m.speed === 'slow' ? '느림' : '보통'}
                          </span>
                        </div>
                        <span className="text-[9px] text-zinc-600">
                          ~{Math.round(VIDEO_BASE_COST * m.costMultiplier)} CR
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 제품 장점 설명 */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <i className="ri-lightbulb-line text-rose-400 text-sm" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">제품의 장점 설명</p>
              </div>
              <textarea
                value={advantage}
                onChange={(e) => setAdvantage(e.target.value)}
                placeholder="이미지 없이 서비스 광고를 만들 수 있습니다. 제품의 핵심 장점을 입력하세요."
                rows={3}
                maxLength={500}
                className="w-full bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3.5 py-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500/30 transition-colors resize-none leading-relaxed"
              />
              <p className="text-[9px] text-zinc-600 text-right mt-0.5">{advantage.length}/500</p>
            </div>

            {/* 에러 표시 (사이드바 인라인 버전) */}
            {genError && genState === 'error' && (() => {
              const errColorMap: Record<string, { bg: string; border: string; text: string; icon: string; label: string }> = {
                api_key:          { bg: 'bg-amber-500/8',  border: 'border-amber-500/20',  text: 'text-amber-400',  icon: 'ri-key-2-line',           label: 'API 키 오류' },
                credits:          { bg: 'bg-orange-500/8', border: 'border-orange-500/20', text: 'text-orange-400', icon: 'ri-copper-diamond-line',   label: '크레딧 부족' },
                timeout:          { bg: 'bg-sky-500/8',    border: 'border-sky-500/20',    text: 'text-sky-400',    icon: 'ri-time-line',             label: '시간 초과' },
                server:           { bg: 'bg-red-500/8',    border: 'border-red-500/20',    text: 'text-red-400',    icon: 'ri-server-line',           label: 'AI 서버 오류' },
                model_unavailable:{ bg: 'bg-violet-500/8', border: 'border-violet-500/20', text: 'text-violet-400', icon: 'ri-cpu-line',              label: '모델 사용 불가' },
                rate_limit:       { bg: 'bg-amber-500/8',  border: 'border-amber-500/20',  text: 'text-amber-400',  icon: 'ri-speed-line',            label: '요청 한도 초과' },
                content_policy:   { bg: 'bg-rose-500/8',   border: 'border-rose-500/20',   text: 'text-rose-400',   icon: 'ri-shield-check-line',     label: '콘텐츠 정책' },
                network:          { bg: 'bg-zinc-800/60',  border: 'border-zinc-700/40',   text: 'text-zinc-400',   icon: 'ri-wifi-off-line',         label: '네트워크 오류' },
                unknown:          { bg: 'bg-red-500/8',    border: 'border-red-500/20',    text: 'text-red-400',    icon: 'ri-error-warning-line',    label: '생성 실패' },
              };
              const c = errColorMap[genErrorType] ?? errColorMap.unknown;
              const canRetry = !['credits', 'api_key', 'content_policy'].includes(genErrorType);
              return (
                <div className={`rounded-xl border overflow-hidden ${c.bg} ${c.border}`}>
                  <div className="flex items-start gap-2 px-3 py-2.5">
                    <i className={`text-sm flex-shrink-0 mt-0.5 ${c.icon} ${c.text}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black mb-0.5 ${c.text}`}>{c.label}</p>
                      <p className="text-[11px] text-zinc-400 leading-relaxed break-words">{genError}</p>
                    </div>
                  </div>
                  <div className="px-3 pb-2.5 flex flex-col gap-1.5">
                    {canRetry && (
                      <button
                        onClick={() => { setGenError(null); setGenState('idle'); handleGenerate(genType); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black transition-all cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-refresh-line" /> 바로 재시도
                      </button>
                    )}
                    {genErrorType === 'credits' && (
                      <a href="/credit-purchase" className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-xs font-black transition-all cursor-pointer whitespace-nowrap">
                        <i className="ri-copper-diamond-line" /> 크레딧 충전하기
                      </a>
                    )}
                    {genErrorType === 'api_key' && (
                      <p className="text-[10px] text-zinc-500 text-center">관리자 페이지 → AI 엔진 탭에서 키 재등록</p>
                    )}
                    <button onClick={handleReset} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 text-xs transition-all cursor-pointer whitespace-nowrap">
                      <i className="ri-arrow-left-line" /> 설정으로 돌아가기
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 크레딧 정보 */}
            <div className="bg-zinc-900/40 border border-white/[0.05] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <i className="ri-copper-diamond-line text-amber-400 text-sm" />
                  <span className="text-xs text-zinc-400">예상 크레딧 소모</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-zinc-500">
                  이미지 <span className="text-amber-400 font-black">
                    {hasProductImages ? `${IMAGE_I2I_COST_DISPLAY} CR` : `${IMAGE_COST_DISPLAY} CR`}
                  </span>
                  {hasProductImages && <span className="text-zinc-600 ml-1">(제품 반영)</span>}
                </span>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-500">
                  동영상 <span className="text-amber-400 font-black">
                    {getVideoCostDisplay(selectedVideoModel, hasProductImages)} CR
                  </span>
                  <span className="text-zinc-600 ml-1">
                    ({VIDEO_MODEL_OPTIONS.find((m) => m.id === selectedVideoModel)?.label ?? 'Wan 2.5'})
                  </span>
                </span>
              </div>
            </div>

            {/* 제품 이미지 없이 영상 생성 시 품질 안내 */}
            {!hasProductImages && (
              <div className="flex items-start gap-2 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-3 py-2.5">
                <i className="ri-lightbulb-line text-amber-400 text-sm flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-amber-400 mb-0.5">품질 향상 팁</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    제품 이미지를 업로드하면 실제 제품이 반영된 고품질 광고 영상을 만들 수 있어요. 텍스트만으로도 생성 가능하지만 품질 차이가 있습니다.
                  </p>
                </div>
              </div>
            )}

            {/* 동영상 크레딧 부족 경고 (이미지는 가능) — VIP는 표시 안 함 */}
            {!isVipUser && credits < getVideoCostDisplay(selectedVideoModel, hasProductImages) &&
             credits >= (hasProductImages ? IMAGE_I2I_COST_DISPLAY : IMAGE_COST_DISPLAY) && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <i className="ri-copper-diamond-line text-amber-400 text-sm flex-shrink-0" />
                <p className="text-xs text-amber-400">
                  동영상 생성 크레딧 부족 ({credits} CR 보유 · 필요 {getVideoCostDisplay(selectedVideoModel, hasProductImages)} CR). 이미지 생성은 가능합니다.
                </p>
              </div>
            )}
            {/* 이미지도 크레딧 부족 — VIP는 표시 안 함 */}
            {!isVipUser && credits < (hasProductImages ? IMAGE_I2I_COST_DISPLAY : IMAGE_COST_DISPLAY) && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <i className="ri-copper-diamond-line text-red-400 text-sm flex-shrink-0" />
                <p className="text-xs text-red-400">크레딧이 부족합니다. 현재 {credits} CR 보유 중</p>
              </div>
            )}
          </div>

          {/* Bottom action buttons */}
          <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06] flex gap-2">
            <button
              onClick={() => handleGenerate('image')}
              disabled={isGenerating || (!isVipUser && credits < (hasProductImages ? IMAGE_I2I_COST_DISPLAY : IMAGE_COST_DISPLAY))}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 disabled:opacity-50 disabled:cursor-not-allowed border border-white/[0.06] text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
            >
              {isGenerating && genType === 'image' ? (
                <><i className="ri-loader-4-line animate-spin" /> {genState === 'uploading' ? '업로드 중...' : '생성 중...'}</>
              ) : isGenerating && genType === 'video' ? (
                <><i className="ri-time-line text-zinc-400 text-sm" /> 대기 중</>
              ) : (
                <><i className="ri-image-ai-line text-sm" /> 이미지</>
              )}
            </button>
            <button
              onClick={() => handleGenerate('video')}
              disabled={isGenerating || (!isVipUser && credits < getVideoCostDisplay(selectedVideoModel, hasProductImages))}
              className="flex-[1.6] flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black transition-all cursor-pointer whitespace-nowrap"
            >
              {isGenerating && genType === 'video' ? (
                <><i className="ri-loader-4-line animate-spin" /> {genState === 'uploading' ? '업로드 중...' : '생성 중...'}</>
              ) : isGenerating && genType === 'image' ? (
                <><i className="ri-time-line text-sm" /> 대기 중</>
              ) : (
                <>
                  <i className="ri-movie-ai-line text-sm" />
                  {hasProductImages ? '제품 영상 만들기' : '동영상 만들기'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SNS 내보내기 모달 */}
      {snsExportOpen && result && (
        <SnsExportModal
          url={result.url}
          type={result.type}
          title={template.title}
          originalRatio={result.ratio}
          onClose={() => setSnsExportOpen(false)}
        />
      )}

      {/* 닫기 확인 모달 */}
      {closeConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#1a1a1e] border border-white/10 rounded-2xl p-6 mx-4 max-w-sm w-full">
            {(genState === 'generating' || genState === 'uploading') ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <i className="ri-alert-line text-amber-400 text-lg" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">생성 중단</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">지금 닫으면 생성이 중단됩니다</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  AI가 현재 광고를 생성하고 있습니다. 닫으면 진행 중인 작업이 취소되고 차감된 크레딧은 환불됩니다.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setCloseConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black transition-all cursor-pointer whitespace-nowrap">
                    계속 생성
                  </button>
                  <button onClick={handleForceClose} className="flex-1 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-black transition-all cursor-pointer whitespace-nowrap">
                    닫기 (크레딧 환불)
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
