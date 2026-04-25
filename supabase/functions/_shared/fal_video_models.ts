// Single source of truth for fal.ai VIDEO model IDs.
//
// Same contract as fal_image_models.ts. Each entry has a t2v (text-to-video)
// path and an optional i2v (image-to-video) path. The `verified` flag marks
// whether the path has been actually confirmed against fal.ai's catalog —
// `false` means the entry is here because the frontend lists it but live
// validation is pending. Diagnostic-healthcheck flips these to `true` once
// it gets a 200 response.

export interface VideoModelEntry {
  id: string;
  /** Text-to-video path. `null` if the model only supports image-to-video. */
  t2v: string | null;
  i2v: string | null;
  /** True when we have a smoke-test artifact proving the path is live. */
  verified: boolean;
  /** True for models gated behind a special tier or in private preview. */
  preview?: boolean;
}

export const VERIFIED_FAL_VIDEO_MODELS: Record<string, VideoModelEntry> = {
  // ── Kling — fully supported, multiple tiers ──────────────────────────────
  'kling-v1': {
    id: 'kling-v1',
    t2v: 'fal-ai/kling-video/v1/standard/text-to-video',
    i2v: 'fal-ai/kling-video/v1/standard/image-to-video',
    verified: true,
  },
  'kling-v1.5': {
    id: 'kling-v1.5',
    t2v: 'fal-ai/kling-video/v1.5/pro/text-to-video',
    i2v: 'fal-ai/kling-video/v1.5/pro/image-to-video',
    verified: true,
  },
  'kling-v2.1': {
    id: 'kling-v2.1',
    t2v: 'fal-ai/kling-video/v2.1/standard/text-to-video',
    i2v: 'fal-ai/kling-video/v2.1/standard/image-to-video',
    verified: true,
  },
  'kling-v2.1-pro': {
    id: 'kling-v2.1-pro',
    t2v: 'fal-ai/kling-video/v2.1/pro/text-to-video',
    i2v: 'fal-ai/kling-video/v2.1/pro/image-to-video',
    verified: true,
  },
  'kling-v25-turbo': {
    id: 'kling-v25-turbo',
    t2v: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    // ⚠️ pro/text but standard/image — historical inconsistency. Keep as-is
    // until verified that the pro tier has an i2v variant on fal.ai.
    i2v: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video',
    verified: true,
  },

  // ── Kling v3 — listed in frontend but NOT confirmed on fal.ai catalog ────
  // diagnostic-healthcheck (PR #8) will mark this verified=true if it
  // ever returns 200. Until then frontend should display "Beta".
  'kling-v3-pro': {
    id: 'kling-v3-pro',
    t2v: 'fal-ai/kling-video/v3/pro/text-to-video',
    i2v: 'fal-ai/kling-video/v3/pro/image-to-video',
    verified: false,
    preview: true,
  },

  // ── Google Veo 3 ─────────────────────────────────────────────────────────
  'veo3': {
    id: 'veo3',
    t2v: 'fal-ai/veo3',
    i2v: 'fal-ai/veo3',
    verified: true,
  },

  // ── WAN — Alibaba's open-source video model ──────────────────────────────
  // Path naming changed across fal.ai versions; both wan25 (preview) and
  // wan-t2v (legacy) are listed. The first 502 from a wan-* call will
  // produce a clear error via the diagnostic helper.
  'wan25': {
    id: 'wan25',
    t2v: 'fal-ai/wan-25-preview/text-to-video',
    i2v: 'fal-ai/wan-25-preview/image-to-video',
    verified: false,
    preview: true,
  },
  'wan-t2v': {
    id: 'wan-t2v',
    t2v: 'fal-ai/wan-t2v',
    i2v: 'fal-ai/wan-t2v',
    verified: false,
  },

  // ── MiniMax (i2v only on this account's catalog) ─────────────────────────
  // 이전엔 t2v 도 'minimax-video/image-to-video' 로 잘못 매핑돼 있어서, 사용자가
  // 텍스트-투-비디오로 minimax 를 고르면 i2v 엔드포인트가 image_url 없는 요청
  // 을 422 로 거절했어요. 실제 minimax t2v 의 fal.ai 경로는 계정·모델 라이선스
  // 별로 다른 형태 (`fal-ai/minimax-video-01` 류) 라 일단 null 로 표시하고,
  // 프런트가 t2v=null 인 모델은 i2v 모드로만 노출하도록 처리.
  'minimax': {
    id: 'minimax',
    t2v: null,
    i2v: 'fal-ai/minimax-video/image-to-video',
    verified: true,
  },
};

export function resolveVideoModel(modelId: string): VideoModelEntry | null {
  return VERIFIED_FAL_VIDEO_MODELS[modelId] ?? null;
}

export const DEFAULT_VIDEO_MODEL: VideoModelEntry =
  VERIFIED_FAL_VIDEO_MODELS['kling-v1'];
