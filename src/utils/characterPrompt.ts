/**
 * 캐릭터별 상세 외모 프롬프트 데이터
 * AI 이미지 생성 시 캐릭터 외모를 일관되게 재현하기 위한 영문 프롬프트
 */

export interface CharacterAppearance {
  /** 핵심 외모 묘사 (얼굴형, 피부톤, 눈, 헤어) */
  appearance: string;
  /** 스타일/의상 키워드 */
  style: string;
  /** 분위기/표정 키워드 */
  mood: string;
  /** 촬영 스타일 키워드 */
  cameraStyle: string;
}

const characterAppearances: Record<string, CharacterAppearance> = {
  // ── 여자 캐릭터 ──────────────────────────────────────────────────────────
  f1: {
    appearance: 'Korean woman, oval face, fair porcelain skin, soft dark brown eyes, long straight black hair, natural minimal makeup, delicate features',
    style: 'natural casual outfit, soft pastel tones, clean minimal fashion',
    mood: 'pure innocent expression, gentle warm smile, calm serene atmosphere',
    cameraStyle: 'soft studio lighting, shallow depth of field, clean background',
  },
  f2: {
    appearance: 'Korean woman, round cheerful face, warm peachy skin tone, bright expressive eyes, medium wavy brown hair, fresh dewy makeup',
    style: 'casual warm-toned clothing, comfortable everyday fashion, bright colors',
    mood: 'bright cheerful smile, energetic friendly expression, positive warm vibe',
    cameraStyle: 'natural daylight, lifestyle photography, warm color grading',
  },
  f3: {
    appearance: 'Korean woman, defined facial features, neutral cool skin tone, almond-shaped eyes, shoulder-length layered hair, modern chic makeup',
    style: 'modern casual trendy outfit, contemporary Korean fashion, neutral tones',
    mood: 'confident relaxed expression, stylish cool demeanor, effortless chic',
    cameraStyle: 'editorial lighting, urban background, clean modern aesthetic',
  },
  f4: {
    appearance: 'Korean woman, sharp professional features, clear fair skin, intelligent eyes, neat tied-back dark hair, polished business makeup',
    style: 'business formal attire, blazer, professional corporate fashion',
    mood: 'confident authoritative expression, trustworthy professional demeanor',
    cameraStyle: 'clean studio lighting, neutral office background, sharp focus',
  },
  f5: {
    appearance: 'Korean woman, elegant refined features, luminous fair skin, deep expressive eyes, sleek long dark hair, sophisticated makeup',
    style: 'luxury elegant fashion, high-end minimal clothing, monochrome or dark tones',
    mood: 'graceful poised expression, sophisticated elegant aura, mysterious allure',
    cameraStyle: 'dramatic studio lighting, dark minimal background, high contrast',
  },
  f6: {
    appearance: 'Korean woman, smart approachable features, healthy natural skin, bright intelligent eyes, medium straight hair, fresh professional makeup',
    style: 'business casual smart outfit, modern workwear, clean contemporary style',
    mood: 'friendly professional expression, approachable smart demeanor, confident',
    cameraStyle: 'bright office lighting, modern workspace background, crisp focus',
  },
  f7: {
    appearance: 'Korean woman, classic refined features, porcelain skin, calm steady eyes, elegant updo or neat hair, classic formal makeup',
    style: 'classic formal attire, timeless fashion, structured tailored clothing',
    mood: 'dignified composed expression, authoritative graceful presence',
    cameraStyle: 'formal portrait lighting, neutral classic background, timeless look',
  },
  f8: {
    appearance: 'Korean woman, youthful vibrant features, glowing skin, sparkling lively eyes, colorful or highlighted hair, trendy makeup',
    style: 'trendy youthful outfit, colorful streetwear, fun contemporary fashion',
    mood: 'energetic playful expression, vibrant youthful energy, fun dynamic vibe',
    cameraStyle: 'bright dynamic lighting, colorful urban background, lively atmosphere',
  },
  f9: {
    appearance: 'Korean woman, striking unique features, flawless skin, intense captivating eyes, bold styled hair, artistic avant-garde makeup',
    style: 'avant-garde artistic fashion, bold statement clothing, unique experimental style',
    mood: 'intense artistic expression, mysterious bold presence, creative unique aura',
    cameraStyle: 'dramatic artistic lighting, dark moody background, editorial style',
  },
  f10: {
    appearance: 'Korean woman, cute adorable features, soft rosy skin, large sweet eyes, soft wavy or pigtail hair, cute girly makeup',
    style: 'cute girly outfit, pastel colors, sweet kawaii-inspired fashion',
    mood: 'sweet adorable smile, lovable charming expression, innocent cute vibe',
    cameraStyle: 'soft pastel lighting, pink or white background, dreamy aesthetic',
  },
  f11: {
    appearance: 'Korean woman, sharp editorial features, flawless matte skin, piercing eyes, sleek styled hair, high-fashion makeup',
    style: 'high fashion editorial clothing, luxury brand style, avant-garde fashion',
    mood: 'fierce editorial expression, high-fashion model demeanor, powerful presence',
    cameraStyle: 'high contrast editorial lighting, dark or abstract background, magazine style',
  },
  f12: {
    appearance: 'Korean woman, fresh global features, bright clear skin, warm friendly eyes, natural flowing hair, fresh natural makeup',
    style: 'global casual fashion, international style, fresh contemporary clothing',
    mood: 'bright open smile, globally appealing friendly expression, fresh energetic vibe',
    cameraStyle: 'bright natural lighting, clean minimal background, fresh color palette',
  },

  // ── 남자 캐릭터 ──────────────────────────────────────────────────────────
  m1: {
    appearance: 'Korean man, intelligent sharp features, clear fair skin, calm focused eyes, neat short dark hair, clean professional look',
    style: 'business casual attire, smart blazer or shirt, professional modern fashion',
    mood: 'calm trustworthy expression, intellectual confident demeanor, reliable presence',
    cameraStyle: 'clean studio lighting, neutral office background, sharp professional focus',
  },
  m2: {
    appearance: 'Korean man, friendly warm features, healthy natural skin, kind expressive eyes, casual medium hair, approachable look',
    style: 'casual everyday outfit, comfortable relaxed fashion, warm neutral tones',
    mood: 'warm genuine smile, friendly approachable expression, relatable natural vibe',
    cameraStyle: 'natural warm lighting, outdoor or casual background, lifestyle photography',
  },
  m3: {
    appearance: 'Korean man, sleek modern features, smooth clear skin, sharp focused eyes, styled short hair, polished grooming',
    style: 'modern business fashion, sleek contemporary outfit, sophisticated casual',
    mood: 'confident composed expression, modern professional demeanor, sharp presence',
    cameraStyle: 'modern studio lighting, minimal dark background, contemporary aesthetic',
  },
  m4: {
    appearance: 'Korean man, youthful trendy features, fresh skin, lively eyes, styled trendy hair, urban cool look',
    style: 'streetwear fashion, trendy urban outfit, bold contemporary clothing',
    mood: 'cool confident expression, youthful energetic vibe, street-style attitude',
    cameraStyle: 'urban street lighting, city background, dynamic contemporary photography',
  },
  m5: {
    appearance: 'Korean man, distinguished mature features, refined skin, steady authoritative eyes, neat classic hair, formal grooming',
    style: 'classic formal suit, high-end tailored clothing, timeless elegant fashion',
    mood: 'dignified authoritative expression, commanding presence, classic elegance',
    cameraStyle: 'formal portrait lighting, classic neutral background, distinguished look',
  },
  m6: {
    appearance: 'Korean man, artistic expressive features, unique skin texture, deep creative eyes, artistic styled hair, creative grooming',
    style: 'artistic creative outfit, unique fashion, expressive clothing choices',
    mood: 'thoughtful artistic expression, creative sensitive demeanor, unique personality',
    cameraStyle: 'artistic moody lighting, creative studio background, expressive photography',
  },
  m7: {
    appearance: 'Korean man, athletic strong features, toned healthy skin, energetic bright eyes, sporty short hair, fit athletic build',
    style: 'sportswear activewear, athletic fashion, dynamic performance clothing',
    mood: 'energetic motivated expression, athletic confident demeanor, active powerful vibe',
    cameraStyle: 'bright dynamic lighting, gym or outdoor background, action-oriented photography',
  },
  m8: {
    appearance: 'Korean man, natural warm features, sun-kissed healthy skin, gentle sincere eyes, natural casual hair, relaxed grooming',
    style: 'natural lifestyle casual outfit, earthy tones, comfortable authentic fashion',
    mood: 'warm genuine expression, natural relaxed demeanor, authentic sincere vibe',
    cameraStyle: 'natural outdoor lighting, nature or casual background, warm color grading',
  },
  m9: {
    appearance: 'Korean man, strong charismatic features, defined jawline, intense piercing eyes, dark styled hair, powerful masculine look',
    style: 'dark bold fashion, strong masculine clothing, dramatic statement style',
    mood: 'intense charismatic expression, powerful commanding presence, dark mysterious aura',
    cameraStyle: 'dramatic low-key lighting, dark moody background, high contrast photography',
  },
  m10: {
    appearance: 'Korean man, fresh innocent features, clear bright skin, pure gentle eyes, neat clean hair, youthful natural look',
    style: 'clean casual youthful outfit, fresh simple fashion, light bright colors',
    mood: 'pure innocent smile, fresh youthful expression, boy-next-door charm',
    cameraStyle: 'bright clean lighting, white or light background, fresh natural photography',
  },
  m11: {
    appearance: 'Korean man, global sophisticated features, refined clear skin, worldly confident eyes, polished styled hair, international grooming',
    style: 'international business fashion, global sophisticated style, premium clothing',
    mood: 'confident global expression, sophisticated international demeanor, polished presence',
    cameraStyle: 'premium studio lighting, clean minimal background, international aesthetic',
  },
  m12: {
    appearance: 'Korean man, fresh bright features, healthy glowing skin, cheerful open eyes, natural casual hair, clean fresh look',
    style: 'fresh casual outfit, bright natural fashion, clean contemporary clothing',
    mood: 'bright cheerful smile, fresh positive expression, energetic natural vibe',
    cameraStyle: 'bright natural lighting, clean background, fresh lifestyle photography',
  },
};

/**
 * 캐릭터 + 사용자 장면 프롬프트를 조합해서 최종 생성 프롬프트 반환
 */
export function buildCharacterPrompt(
  characterId: string,
  characterName: string,
  gender: '여자' | '남자',
  tags: string[],
  userScenePrompt: string,
): string {
  const appearance = characterAppearances[characterId];
  const genderEn = gender === '여자' ? 'woman' : 'man';

  if (!appearance) {
    // fallback: 기본 조합
    const tagsEn = tags.join(', ');
    const scene = userScenePrompt.trim();
    return scene
      ? `Korean ${genderEn}, ${tagsEn}, ${scene}, photorealistic, high quality, 8k`
      : `Korean ${genderEn}, ${tagsEn}, portrait, photorealistic, high quality, 8k`;
  }

  const scene = userScenePrompt.trim();

  // 장면 묘사가 있을 때: 캐릭터 외모 + 장면 자연스럽게 조합
  if (scene) {
    return [
      appearance.appearance,
      scene,
      appearance.style,
      appearance.mood,
      appearance.cameraStyle,
      'photorealistic, high quality, 8k resolution, consistent character',
    ].join(', ');
  }

  // 장면 묘사 없을 때: 캐릭터 포트레이트 기본 생성
  return [
    appearance.appearance,
    appearance.style,
    appearance.mood,
    appearance.cameraStyle,
    'portrait photography, photorealistic, high quality, 8k resolution',
  ].join(', ');
}

/**
 * 프롬프트 바에 표시할 캐릭터 외모 태그 목록 반환 (UI용)
 */
export function getCharacterAppearanceTags(characterId: string): string[] {
  const a = characterAppearances[characterId];
  if (!a) return [];
  // appearance 문자열에서 핵심 키워드만 추출
  const raw = a.appearance.split(',').map((s) => s.trim()).filter(Boolean);
  // 첫 번째(성별/민족) 제외하고 최대 4개
  return raw.slice(1, 5);
}

// ── 룩(스타일) 프롬프트 매핑 ─────────────────────────────────────────────

export interface AppliedLook {
  id: string;
  label: string;
  category: string;
  intensity: number; // 0~100
}

/** 룩 ID → 영문 스타일/조명 프롬프트 */
const lookPromptMap: Record<string, string> = {
  cinematic: 'cinematic color grading, warm orange teal contrast, dramatic film lighting, shallow depth of field, anamorphic lens flare, movie still quality',
  vintage:   'vintage retro film look, faded warm tones, grain texture, nostalgic analog aesthetic, soft vignette, 1970s film style',
  neon:      'neon cyberpunk color grading, vivid pink purple blue neon lights, dark background, futuristic glowing effects, high contrast',
  minimal:   'minimal clean white aesthetic, bright airy high-key lighting, soft shadows, neutral tones, Scandinavian style, simple elegant composition',
  dark:      'dark moody low-key lighting, deep shadows, dramatic contrast, mysterious noir atmosphere, black background',
  pastel:    'soft pastel color palette, light pink lavender mint tones, dreamy romantic atmosphere, gentle soft light, kawaii delicate aesthetic',
  golden:    'golden hour warm sunlight, orange golden backlight, lens flare, warm glowing skin tones, beautiful natural outdoor light',
  studio:    'professional studio lighting, clean neutral background, perfect even illumination, commercial photography quality, sharp crisp details',
};

/**
 * 룩 정보를 영문 스타일 프롬프트로 변환
 * intensity에 따라 강도 키워드 조정
 */
export function buildLookPrompt(look: AppliedLook): string {
  const base = lookPromptMap[look.id] ?? look.label;
  if (look.intensity >= 80) {
    return `${base}, strong ${look.label.toLowerCase()} effect`;
  }
  if (look.intensity <= 30) {
    return `subtle ${base}`;
  }
  return base;
}

// ── 앵글 프롬프트 매핑 ────────────────────────────────────────────────────

export interface AppliedAngle {
  /** 프리셋 ID (front, back, left45 등) 또는 null (커스텀) */
  presetId: string | null;
  /** 한국어 레이블 (UI 표시용) */
  label: string;
  /** Pan 각도 */
  pan: number;
  /** Tilt 각도 */
  tilt: number;
  /** Zoom 값 */
  zoom: number;
}

/** 앵글 프리셋 ID → 영문 카메라 앵글 프롬프트 */
const anglePromptMap: Record<string, string> = {
  front:    'front-facing view, direct eye contact, straight-on camera angle, symmetrical composition',
  back:     'rear view, shot from behind, back-facing angle, over-the-shoulder perspective',
  left45:   'three-quarter left angle, 45-degree left side view, slight left profile',
  right45:  'three-quarter right angle, 45-degree right side view, slight right profile',
  leftup:   'upper-left angle, 45-degree left elevated view, looking up from lower-left',
  rightup:  'upper-right angle, 45-degree right elevated view, looking up from lower-right',
  top:      'bird\'s eye view, top-down overhead shot, aerial perspective looking straight down',
  bottom:   'low angle shot, worm\'s eye view, looking up from below, dramatic upward perspective',
};

/**
 * Pan/Tilt 값으로 커스텀 앵글 영문 프롬프트 생성
 */
function buildCustomAnglePrompt(pan: number, tilt: number): string {
  const parts: string[] = [];

  // Pan 방향
  if (Math.abs(pan) < 15) {
    parts.push('front-facing view');
  } else if (pan > 150 || pan < -150) {
    parts.push('rear view, back-facing angle');
  } else if (pan > 0) {
    parts.push(`${Math.round(pan)}-degree right side angle`);
  } else {
    parts.push(`${Math.round(Math.abs(pan))}-degree left side angle`);
  }

  // Tilt 방향
  if (tilt > 60) {
    parts.push('bird\'s eye view, top-down perspective');
  } else if (tilt > 20) {
    parts.push('elevated high angle shot, looking down');
  } else if (tilt < -60) {
    parts.push('worm\'s eye view, extreme low angle');
  } else if (tilt < -20) {
    parts.push('low angle shot, looking up');
  }

  return parts.join(', ');
}

/**
 * 앵글 정보를 영문 카메라 앵글 프롬프트로 변환
 */
export function buildAnglePrompt(angle: AppliedAngle): string {
  if (angle.presetId && anglePromptMap[angle.presetId]) {
    return anglePromptMap[angle.presetId];
  }
  return buildCustomAnglePrompt(angle.pan, angle.tilt);
}


