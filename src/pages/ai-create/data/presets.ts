// ── Shared preset data for ai-create components ────────────────────────────
// Single source of truth: PromptBar, Sidebar, AngleView, LookView, LookView all import from here.

// ── Look Preset Images (used by LookView full preview) ────────────────────
export const LOOK_PRESET_IMAGES: Record<string, string> = {
  cinematic: 'https://readdy.ai/api/search-image?query=cinematic%20dramatic%20film%20look%20color%20grading%2C%20warm%20orange%20teal%20contrast%2C%20movie%20still%20quality%2C%20professional%20cinematography%2C%20dark%20moody%20atmosphere%2C%20shallow%20depth%20of%20field%2C%20anamorphic%20lens%20flare&width=120&height=80&seq=look_cin&orientation=landscape',
  vintage:   'https://readdy.ai/api/search-image?query=vintage%20retro%20film%20photography%20look%2C%20faded%20colors%2C%20warm%20yellow%20tones%2C%20grain%20texture%2C%20nostalgic%201970s%20aesthetic%2C%20soft%20vignette%2C%20analog%20film%20style&width=120&height=80&seq=look_vin&orientation=landscape',
  neon:      'https://readdy.ai/api/search-image?query=neon%20cyberpunk%20color%20grading%2C%20vivid%20pink%20purple%20blue%20neon%20lights%2C%20dark%20background%2C%20futuristic%20aesthetic%2C%20glowing%20light%20effects%2C%20high%20contrast%2C%20urban%20night%20scene&width=120&height=80&seq=look_neo&orientation=landscape',
  minimal:   'https://readdy.ai/api/search-image?query=minimal%20clean%20white%20aesthetic%20photography%2C%20bright%20airy%20light%2C%20soft%20shadows%2C%20neutral%20tones%2C%20Scandinavian%20style%2C%20clean%20background%2C%20high%20key%20lighting%2C%20simple%20elegant%20composition&width=120&height=80&seq=look_min&orientation=landscape',
  dark:      'https://readdy.ai/api/search-image?query=dark%20moody%20photography%20look%2C%20deep%20shadows%2C%20low%20key%20lighting%2C%20dramatic%20contrast%2C%20black%20background%2C%20mysterious%20atmosphere%2C%20noir%20style%2C%20high%20contrast%20black%20and%20white%20tones&width=120&height=80&seq=look_drk&orientation=landscape',
  pastel:    'https://readdy.ai/api/search-image?query=soft%20pastel%20color%20photography%2C%20light%20pink%20lavender%20mint%20tones%2C%20dreamy%20aesthetic%2C%20soft%20light%2C%20gentle%20shadows%2C%20romantic%20atmosphere%2C%20kawaii%20style%2C%20delicate%20colors&width=120&height=80&seq=look_pas&orientation=landscape',
  golden:    'https://readdy.ai/api/search-image?query=golden%20hour%20photography%2C%20warm%20orange%20golden%20sunlight%2C%20sunset%20backlight%2C%20lens%20flare%2C%20warm%20skin%20tones%2C%20beautiful%20natural%20light%2C%20outdoor%20portrait%2C%20glowing%20atmosphere&width=120&height=80&seq=look_gld&orientation=landscape',
  studio:    'https://readdy.ai/api/search-image?query=professional%20studio%20photography%20lighting%2C%20clean%20white%20background%2C%20perfect%20even%20lighting%2C%20commercial%20product%20photography%20style%2C%20sharp%20details%2C%20neutral%20color%20balance%2C%20high%20resolution&width=120&height=80&seq=look_stu&orientation=landscape',
};

// ── Look Result Images (used by LookView generation results) ──────────────
export const LOOK_RESULT_IMAGES: Record<string, string> = {
  cinematic: 'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20cinematic%20color%20grading%20applied%2C%20warm%20orange%20teal%20contrast%2C%20dramatic%20lighting%2C%20film%20look%2C%20professional%20quality%2C%20shallow%20depth%20of%20field%2C%20movie%20still%20aesthetic&width=400&height=500&seq=lres_cin&orientation=portrait',
  vintage:   'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20vintage%20retro%20film%20look%20applied%2C%20faded%20warm%20tones%2C%20grain%20texture%2C%20nostalgic%20aesthetic%2C%20analog%20film%20style%2C%20soft%20vignette&width=400&height=500&seq=lres_vin&orientation=portrait',
  neon:      'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20neon%20cyberpunk%20look%20applied%2C%20vivid%20pink%20purple%20neon%20lights%2C%20dark%20background%2C%20futuristic%20aesthetic%2C%20glowing%20effects&width=400&height=500&seq=lres_neo&orientation=portrait',
  minimal:   'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20minimal%20clean%20white%20aesthetic%2C%20bright%20airy%20light%2C%20soft%20shadows%2C%20neutral%20tones%2C%20high%20key%20lighting%2C%20simple%20elegant&width=400&height=500&seq=lres_min&orientation=portrait',
  dark:      'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20dark%20moody%20look%20applied%2C%20deep%20shadows%2C%20low%20key%20lighting%2C%20dramatic%20contrast%2C%20mysterious%20atmosphere%2C%20noir%20style&width=400&height=500&seq=lres_drk&orientation=portrait',
  pastel:    'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20soft%20pastel%20look%20applied%2C%20light%20pink%20lavender%20tones%2C%20dreamy%20aesthetic%2C%20soft%20light%2C%20romantic%20atmosphere%2C%20delicate%20colors&width=400&height=500&seq=lres_pas&orientation=portrait',
  golden:    'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20golden%20hour%20look%20applied%2C%20warm%20orange%20golden%20sunlight%2C%20sunset%20backlight%2C%20lens%20flare%2C%20warm%20skin%20tones%2C%20glowing%20atmosphere&width=400&height=500&seq=lres_gld&orientation=portrait',
  studio:    'https://readdy.ai/api/search-image?query=portrait%20photography%20with%20professional%20studio%20lighting%20look%20applied%2C%20clean%20background%2C%20perfect%20even%20lighting%2C%20commercial%20style%2C%20sharp%20details%2C%20neutral%20color%20balance&width=400&height=500&seq=lres_stu&orientation=portrait',
};

// ── Look Options ───────────────────────────────────────────────────────────
export interface LookOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  category: string;
  desc: string;
}

export const LOOK_OPTIONS: LookOption[] = [
  { id: 'cinematic', label: '시네마틱', icon: 'ri-film-line',        color: 'text-amber-400',  category: '분위기', desc: '영화 같은 드라마틱 색감' },
  { id: 'vintage',   label: '빈티지',   icon: 'ri-time-line',         color: 'text-orange-400', category: '분위기', desc: '레트로 필름 감성' },
  { id: 'neon',      label: '네온',     icon: 'ri-flashlight-line',   color: 'text-violet-400', category: '분위기', desc: '사이버펑크 네온 효과' },
  { id: 'minimal',   label: '미니멀',   icon: 'ri-sun-line',          color: 'text-zinc-300',   category: '스타일', desc: '깔끔한 화이트 톤' },
  { id: 'dark',      label: '다크',     icon: 'ri-moon-line',         color: 'text-zinc-400',   category: '스타일', desc: '강렬하고 어두운 무드' },
  { id: 'pastel',    label: '파스텔',   icon: 'ri-heart-line',        color: 'text-rose-400',   category: '스타일', desc: '부드러운 파스텔 톤' },
  { id: 'golden',    label: '골든아워', icon: 'ri-sun-foggy-line',    color: 'text-yellow-400', category: '조명',   desc: '황금빛 일몰 자연광' },
  { id: 'studio',    label: '스튜디오', icon: 'ri-camera-line',       color: 'text-sky-400',    category: '조명',   desc: '전문 스튜디오 조명' },
];

// ── Angle Presets ──────────────────────────────────────────────────────────
export interface AnglePreset {
  id: string;
  label: string;
  pan: number;
  tilt: number;
  icon?: string;
}

export const ANGLE_PRESETS: AnglePreset[] = [
  { id: 'front',   label: '정면',     pan: 0,    tilt: 0,   icon: 'ri-arrow-up-line' },
  { id: 'back',    label: '뒷면',     pan: 180,  tilt: 0,   icon: 'ri-arrow-down-line' },
  { id: 'left45',  label: '좌 45°',   pan: -45,  tilt: 0,   icon: 'ri-arrow-left-up-line' },
  { id: 'right45', label: '우 45°',   pan: 45,   tilt: 0,   icon: 'ri-arrow-right-up-line' },
  { id: 'leftup',  label: '좌상 45°', pan: -45,  tilt: 30,  icon: 'ri-corner-left-up-line' },
  { id: 'rightup', label: '우상 45°', pan: 45,   tilt: 30,  icon: 'ri-corner-right-up-line' },
  { id: 'top',     label: '탑뷰',     pan: 0,    tilt: 85,  icon: 'ri-focus-3-line' },
  { id: 'bottom',  label: '바텀뷰',   pan: 0,    tilt: -85, icon: 'ri-focus-2-line' },
];
