// ── Types ──────────────────────────────────────────────────────────────────
export interface ApiKeyRecord {
  id: string;
  service_name: string;
  service_slug: string;
  key_hint: string | null;
  status: 'active' | 'inactive' | 'error';
  last_tested_at: string | null;
  test_result: string | null;
  monthly_limit: number;
  monthly_used: number;
  notes: string | null;
  updated_at: string;
}

export interface UsageStats {
  [slug: string]: { total: number; success: number; failed: number; credits: number };
}

export interface ModelSettings {
  image: { active_model: string; available_models: string[] };
  video: { active_model: string; available_models: string[] };
  music: {
    active_provider: string;
    active_model: string;
    available_fal_models: string[];
    suno_enabled: string;
  };
}

export interface ApiService {
  name: string;
  status: string;
  latency: string;
  uptime: string;
  requests: number;
  errors: number;
}

// ── Constants ──────────────────────────────────────────────────────────────
export const MODEL_LABELS: Record<string, { name: string; badge: string; desc: string }> = {
  'fal-ai/flux/schnell':          { name: 'FLUX Schnell',       badge: '빠름',    desc: '가장 빠른 생성, 기본 품질' },
  'fal-ai/flux/dev':              { name: 'FLUX Dev',           badge: '균형',    desc: '속도와 품질의 균형' },
  'fal-ai/flux-pro':              { name: 'FLUX Pro',           badge: '고품질',  desc: '높은 품질, 상업용' },
  'fal-ai/flux-pro/v1.1':         { name: 'FLUX Pro v1.1',      badge: '고품질',  desc: '개선된 Pro 버전' },
  'fal-ai/flux-pro/v1.1-ultra':   { name: 'FLUX Pro Ultra',     badge: '최고품질', desc: '최고 품질, 느린 속도' },
  'fal-ai/stable-diffusion-v3-medium': { name: 'SD v3 Medium', badge: '범용',    desc: 'Stable Diffusion v3' },
  'fal-ai/kling-video/v1/standard/text-to-video':   { name: 'Kling v1 Standard', badge: '기본',    desc: '기본 영상 생성' },
  'fal-ai/kling-video/v1.5/pro/text-to-video':      { name: 'Kling v1.5 Pro',    badge: '고품질',  desc: '향상된 품질' },
  'fal-ai/kling-video/v2.1/standard/text-to-video': { name: 'Kling v2.1 Standard', badge: '최신',  desc: '최신 표준 모델' },
  'fal-ai/kling-video/v2.1/pro/text-to-video':      { name: 'Kling v2.1 Pro',    badge: '최고',    desc: '최신 최고 품질' },
  'fal-ai/kling-video/v2.5-turbo/pro/text-to-video':{ name: 'Kling v2.5 Turbo',   badge: '최신',    desc: '빠른 v2.5 turbo' },
  'fal-ai/kling-video/v3/pro/text-to-video':        { name: 'Kling v3 Pro',       badge: 'Beta',    desc: '최신 v3 (preview)' },
  'fal-ai/veo3':                                    { name: 'Google Veo 3',       badge: '대안',    desc: 'Google Veo 3' },
  'fal-ai/minimax-video/image-to-video':            { name: 'MiniMax Video (i2v)', badge: 'i2v 전용', desc: 'MiniMax 영상 — image-to-video 전용' },
  'fal-ai/wan-t2v':                                 { name: 'WAN T2V',            badge: '대안',    desc: 'WAN 텍스트→영상' },
  'fal-ai/stable-audio':  { name: 'Stable Audio',  badge: 'fal.ai', desc: '고품질 음악 생성' },
  'fal-ai/musicgen':      { name: 'MusicGen',       badge: 'fal.ai', desc: 'Meta MusicGen' },
  'suno':                 { name: 'Suno AI',        badge: 'Suno',   desc: '가사 포함 음악 생성' },
};

export const BADGE_COLORS: Record<string, string> = {
  '빠름':    'bg-emerald-500/15 text-emerald-400',
  '균형':    'bg-indigo-500/15 text-indigo-400',
  '고품질':  'bg-amber-500/15 text-amber-400',
  '최고품질':'bg-red-500/15 text-red-400',
  '최고':    'bg-red-500/15 text-red-400',
  '최신':    'bg-violet-500/15 text-violet-400',
  '범용':    'bg-zinc-500/15 text-zinc-400',
  '기본':    'bg-zinc-500/15 text-zinc-400',
  '대안':    'bg-cyan-500/15 text-cyan-400',
  'fal.ai':  'bg-indigo-500/15 text-indigo-400',
  'Suno':    'bg-emerald-500/15 text-emerald-400',
};

export const DEFAULT_SETTINGS: ModelSettings = {
  image: {
    active_model: 'fal-ai/flux/dev',
    available_models: [
      'fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro',
      'fal-ai/flux-pro/v1.1', 'fal-ai/flux-pro/v1.1-ultra', 'fal-ai/stable-diffusion-v3-medium',
    ],
  },
  video: {
    active_model: 'fal-ai/kling-video/v1/standard/text-to-video',
    available_models: [
      'fal-ai/kling-video/v1/standard/text-to-video', 'fal-ai/kling-video/v1.5/pro/text-to-video',
      'fal-ai/kling-video/v2.1/standard/text-to-video', 'fal-ai/kling-video/v2.1/pro/text-to-video',
      'fal-ai/minimax-video/image-to-video', 'fal-ai/wan-t2v',
    ],
  },
  music: {
    active_provider: 'fal',
    active_model: 'fal-ai/stable-audio',
    available_fal_models: ['fal-ai/stable-audio', 'fal-ai/musicgen'],
    suno_enabled: 'true',
  },
};

export const ALL_IMAGE_MODELS = [
  'fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro',
  'fal-ai/flux-pro/v1.1', 'fal-ai/flux-pro/v1.1-ultra', 'fal-ai/stable-diffusion-v3-medium',
];
// 백엔드의 supabase/functions/_shared/fal_video_models.ts 와 동기 유지.
// 모두 t2v (텍스트→비디오) 경로 — admin 이 active_model 로 선택하면 백엔드가
// 이미지 입력이 있을 때만 자동으로 i2v 경로로 매핑해요. 여기 i2v 경로를 직접
// 노출하면 t2v 요청 시 422 가 발생해서 t2v 만 나열.
export const ALL_VIDEO_MODELS = [
  'fal-ai/kling-video/v1/standard/text-to-video',
  'fal-ai/kling-video/v1.5/pro/text-to-video',
  'fal-ai/kling-video/v2.1/standard/text-to-video',
  'fal-ai/kling-video/v2.1/pro/text-to-video',
  'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
  'fal-ai/kling-video/v3/pro/text-to-video',
  'fal-ai/veo3',
  'fal-ai/wan-t2v',
];
export const ALL_FAL_MUSIC_MODELS = ['fal-ai/stable-audio', 'fal-ai/musicgen'];

// DB service_name 표시명 매핑 (slug → 표시명)
export const SLUG_TO_DISPLAY: Record<string, string> = {
  fal:        'fal.ai (통합 AI)',
  goapi:      'GoAPI (이미지/영상)',
  elevenlabs: 'ElevenLabs (TTS/SFX)',
  suno:       'Suno (음악)',
  openai:     'OpenAI GPT-4o',
  lalalai:    'LALAL.AI (오디오 클린)',
  openrouter: 'OpenRouter (Claude/GPT/Gemini)',
};

// 기본 서비스 목록 — DB에 없어도 항상 표시
export const DEFAULT_SERVICES: ApiKeyRecord[] = [
  { id: 'default-fal',        service_name: 'fal.ai (통합 AI)',                service_slug: 'fal',        key_hint: null, status: 'inactive', last_tested_at: null, test_result: null, monthly_limit: 0, monthly_used: 0, notes: null, updated_at: '' },
  { id: 'default-goapi',      service_name: 'GoAPI (이미지/영상)',              service_slug: 'goapi',      key_hint: null, status: 'inactive', last_tested_at: null, test_result: null, monthly_limit: 0, monthly_used: 0, notes: null, updated_at: '' },
  { id: 'default-elevenlabs', service_name: 'ElevenLabs (TTS/SFX)',            service_slug: 'elevenlabs', key_hint: null, status: 'inactive', last_tested_at: null, test_result: null, monthly_limit: 0, monthly_used: 0, notes: null, updated_at: '' },
  { id: 'default-suno',       service_name: 'Suno (음악)',                      service_slug: 'suno',       key_hint: null, status: 'inactive', last_tested_at: null, test_result: null, monthly_limit: 0, monthly_used: 0, notes: null, updated_at: '' },
  { id: 'default-openai',     service_name: 'OpenAI GPT-4o',                   service_slug: 'openai',     key_hint: null, status: 'inactive', last_tested_at: null, test_result: null, monthly_limit: 0, monthly_used: 0, notes: null, updated_at: '' },
  { id: 'default-lalalai',    service_name: 'LALAL.AI (오디오 클린)',           service_slug: 'lalalai',    key_hint: null, status: 'inactive', last_tested_at: null, test_result: null, monthly_limit: 0, monthly_used: 0, notes: null, updated_at: '' },
  { id: 'default-openrouter', service_name: 'OpenRouter (Claude/GPT/Gemini)',  service_slug: 'openrouter', key_hint: null, status: 'inactive', last_tested_at: null, test_result: null, monthly_limit: 0, monthly_used: 0, notes: null, updated_at: '' },
];

// ── GPU Mock Data (실시간 시뮬레이션) ─────────────────────────────────────
export const GPU_INSTANCES = [
  { name: 'GPU-01 (이미지)', baseLoad: 65, baseMem: 62, color: 'bg-indigo-500', icon: 'ri-image-ai-line', iconColor: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { name: 'GPU-02 (영상)',   baseLoad: 82, baseMem: 78, color: 'bg-amber-500',  icon: 'ri-video-ai-line', iconColor: 'text-amber-400',  bg: 'bg-amber-500/10' },
  { name: 'GPU-03 (음성)',   baseLoad: 41, baseMem: 48, color: 'bg-emerald-500', icon: 'ri-music-2-line', iconColor: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { name: 'GPU-04 (예비)',   baseLoad: 10, baseMem: 18, color: 'bg-zinc-500',   icon: 'ri-server-line',  iconColor: 'text-zinc-400',   bg: 'bg-zinc-500/10' },
];

// ── Helper: safe JSON parse ────────────────────────────────────────────────
export function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (Array.isArray(val)) return val as unknown as T;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return fallback;
}
