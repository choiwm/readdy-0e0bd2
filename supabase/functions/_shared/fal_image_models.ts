// Single source of truth for fal.ai IMAGE model IDs.
//
// Keep this list in sync with https://fal.ai/models. Each entry is an ID
// that has been smoke-tested via /admin → AI 엔진 → API 키 관리 → 테스트
// or the diagnostic-healthcheck function. Adding a new model here is the
// only place you should be touching when fal.ai ships something new.
//
// ── Two layers ──────────────────────────────────────────────────────────────
//
// 1. VERIFIED_FAL_IMAGE_MODELS — the canonical fal.ai endpoint paths.
// 2. IMAGE_MODEL_ALIASES — display names the frontend may send (e.g. the
//    PromptBar dropdown). Each alias resolves to one of the verified IDs.
//
// Anything that's not in either list will hit the fallback branch in
// generate-image and be logged as `[generate-image] 알 수 없는 모델` so
// that miswired frontends are visible instead of silently producing
// wrong results.

export interface ImageModelEntry {
  /** fal.ai endpoint path (without https://). */
  id: string;
  /** Image-to-image variant. `null` if the model has no i2i variant. */
  i2i: string | null;
  /** Whether this model can be called via the synchronous /fal.run/<id> URL.
   *  schnell is the only one fast enough for sync; everything else queues. */
  sync: boolean;
}

export const VERIFIED_FAL_IMAGE_MODELS: Record<string, ImageModelEntry> = {
  'fal-ai/flux/schnell': {
    id: 'fal-ai/flux/schnell',
    i2i: 'fal-ai/flux/schnell/redux',
    sync: true,
  },
  'fal-ai/flux/dev': {
    id: 'fal-ai/flux/dev',
    i2i: 'fal-ai/flux/dev/image-to-image',
    sync: false,
  },
  'fal-ai/flux-pro': {
    id: 'fal-ai/flux-pro',
    i2i: 'fal-ai/flux-pro/v1/redux',
    sync: false,
  },
  'fal-ai/flux-pro/v1.1': {
    id: 'fal-ai/flux-pro/v1.1',
    i2i: 'fal-ai/flux-pro/v1.1/redux',
    sync: false,
  },
  'fal-ai/flux-pro/v1.1-ultra': {
    id: 'fal-ai/flux-pro/v1.1-ultra',
    i2i: 'fal-ai/flux-pro/v1.1-ultra/redux',
    sync: false,
  },
};

/**
 * Display-name → fal.ai model ID.
 *
 * Three categories of aliases are intentional and supported:
 *
 *   1. **Canonical names** (Flux Realism / Flux Pro / Flux Pro Ultra).
 *      Shown directly in the PromptBar dropdown. Removing these would
 *      break user-visible UI.
 *
 *   2. **Brand aliases** (Nano Banana 2/3) — marketing-friendly labels
 *      used in admin test panel + AI Ad detail flow that route to the
 *      same backing model. Removing breaks those flows.
 *
 * ⚠️ DEPRECATED placeholder names that previously lived here
 * ("Sora 2", "FLUX 2", "Aurora V1 Pro", "Ultra Banana", "Seedance 2.0")
 * are intentionally absent. They were never sent from production UI
 * (only appeared in src/mocks/ and marketing copy), but if a future
 * frontend wires them up they will hit the unknown-model fallback
 * with a visible warning, which is exactly what we want.
 */
export const IMAGE_MODEL_ALIASES: Record<string, string> = {
  // 1. Canonical (PromptBar dropdown)
  'Flux Realism':    'fal-ai/flux/schnell',
  'Flux Pro':        'fal-ai/flux-pro',
  'Flux Pro Ultra':  'fal-ai/flux-pro/v1.1-ultra',

  // 2. Brand aliases (admin test panel + ai-ad)
  'Nano Banana 2':   'fal-ai/flux/schnell',  // 빠른 생성 별칭
  'Nano Banana 3':   'fal-ai/flux/dev',      // 균형 별칭
};

/**
 * Resolve a display name OR raw fal.ai path to a verified entry.
 * Returns null when the name is unknown — caller should log + fall back.
 */
export function resolveImageModel(displayOrId: string): ImageModelEntry | null {
  // 1. Try alias lookup first (display names like "Flux Pro").
  const aliased = IMAGE_MODEL_ALIASES[displayOrId];
  if (aliased && VERIFIED_FAL_IMAGE_MODELS[aliased]) {
    return VERIFIED_FAL_IMAGE_MODELS[aliased];
  }
  // 2. Direct id lookup ("fal-ai/flux/schnell").
  if (VERIFIED_FAL_IMAGE_MODELS[displayOrId]) {
    return VERIFIED_FAL_IMAGE_MODELS[displayOrId];
  }
  return null;
}

/** Default model used as last-resort fallback. */
export const DEFAULT_IMAGE_MODEL: ImageModelEntry =
  VERIFIED_FAL_IMAGE_MODELS['fal-ai/flux/schnell'];
