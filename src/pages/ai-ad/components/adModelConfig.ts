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

// 프론트 표시용 비용 (실제 차감은 Edge Function에서만 수행)
// Flux Pro = 20CR, Kling v1 text-to-video = 50CR, image-to-video = 50CR
// redux(image-to-image) = 22CR
export const IMAGE_COST_DISPLAY = 20;       // fal-ai/flux-pro
export const IMAGE_I2I_COST_DISPLAY = 22;   // fal-ai/flux-pro/v1/redux (image-to-image)
export const VIDEO_BASE_COST = 50;          // Kling v1 기준 기본 비용
// 영상+이미지 파이프라인: 이미지 redux(22) + 영상 i2v = 72CR (기본 모델 기준)
export const VIDEO_WITH_IMAGE_BASE_COST = 72;

export function getVideoCostDisplay(modelId: string, hasProductImage: boolean): number {
  const model = VIDEO_MODEL_OPTIONS.find((m) => m.id === modelId);
  const multiplier = model?.costMultiplier ?? 1.0;
  const base = hasProductImage ? VIDEO_WITH_IMAGE_BASE_COST : VIDEO_BASE_COST;
  return Math.round(base * multiplier);
}
