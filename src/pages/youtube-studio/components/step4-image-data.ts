export interface Cut {
  id: number;
  start: number;
  end: number;
  text: string;
  image: string | null;
  prompt: string;
  optimized: boolean;
}

// Step4ImageData: Step5Video와 Step6LocalStyle에서 사용하는 공유 타입
export interface Step4ImageData {
  id: number;
  image: string | null;
  prompt: string;
  start: number;
  end: number;
  text: string;
}

export const initialCuts: Cut[] = [
  { id: 1, start: 0.0, end: 5.9, text: '아직도 인공지능을 먼 미래라고 생각하시나요?\n\n이미 우리 일상은 AI 시스템으로 굴러가고 있습니다.', image: null, prompt: '', optimized: false },
  { id: 2, start: 5.9, end: 12.2, text: '아침에 확인하는 맞춤형 뉴스부터 최적의 출근길을\n\n찾는 네비게이션까지 모두 AI의 작품입니다.', image: null, prompt: '', optimized: false },
  { id: 3, start: 12.2, end: 22.0, text: '기업의 현대 시스템은 더욱 놀랍니다.\n\n방대한 데이터를 실시간으로 분석해 소비자의 마음을 읽고,\n\n스마트 팩토리는 불량률을 제로에 가깝게 낮추며 생산성을 극대화하죠.', image: null, prompt: '', optimized: false },
  { id: 4, start: 22.0, end: 28.6, text: '단순한 자동화를 넘어 스스로 상황을 판단하고\n\n최적의 결정을 내리는 지능형 네트워크가\n\n바로 현대 시스템의 핵심입니다.', image: null, prompt: '', optimized: false },
  { id: 5, start: 28.6, end: 32.3, text: '이제 인공지능은 선택이 아닌 생존을 위한 필수 인프라입니다.', image: null, prompt: '', optimized: false },
  { id: 6, start: 32.3, end: 38.0, text: '세상을 움직이는 보이지 않는 힘, 인공지능.\n\n지금 바로 여러분의 삶과 비즈니스에 혁신을 도입해 보세요!', image: null, prompt: '', optimized: false },
];

// ── Style prompt modifiers ─────────────────────────────────────────────────
export const stylePromptModifiers: Record<string, { prefix: string; suffix: string; label: string }> = {
  cartoon_studio: { prefix: 'colorful cartoon animation studio style, bright bold colors, thick outlines, flat illustration,', suffix: ', vibrant explainer video aesthetic, comic style', label: '카툰 스튜디오' },
  cartoon: { prefix: 'cartoon explainer style, bold black outlines, flat colors, expressive characters,', suffix: ', news commentary illustration, bright saturated colors', label: '카툰 해설' },
  sketch: { prefix: 'hand drawn pencil sketch style, rough gestural lines, minimal shading, monochrome,', suffix: ', cream paper texture, loose artistic quality', label: '스케치' },
  mixed: { prefix: 'mixed media collage style, layered magazine clippings, vibrant colors, bold typography,', suffix: ', editorial photomontage aesthetic', label: '믹스미디어' },
  tonedown: { prefix: 'muted toned down film collage, desaturated cinematic photographs, dark moody atmosphere,', suffix: ', film grain texture, sophisticated editorial', label: '톤다운' },
  photo: { prefix: 'realistic photography style, natural warm lighting, shallow depth of field,', suffix: ', documentary photo aesthetic, authentic candid moment', label: '포토' },
  film: { prefix: 'cinematic dark film style, low key dramatic lighting, deep shadows, moody atmosphere,', suffix: ', high contrast, thriller aesthetic', label: '영화' },
  news: { prefix: 'news broadcast style, formal studio setting, television production quality,', suffix: ', authoritative corporate atmosphere', label: '뉴스' },
  anime: { prefix: 'Japanese anime style, vibrant colors, detailed urban architecture,', suffix: ', Makoto Shinkai inspired, neon lights, cinematic', label: '애니메이션' },
  '3d_anime': { prefix: '3D animated Pixar style, expressive characters, soft warm lighting,', suffix: ', high quality CGI rendering, subsurface scattering', label: '3D 애니' },
  webtoon: { prefix: 'Korean webtoon manhwa style, clean line art, vibrant colors,', suffix: ', bright saturated palette, detailed urban background', label: '웹툰' },
  flat_illust: { prefix: 'flat design illustration, minimal geometric shapes, pastel color palette,', suffix: ', clean modern infographic, Scandinavian inspired', label: '플랫 일러스트' },
  korean_wild: { prefix: 'traditional Korean folk tale illustration, ink wash painting style,', suffix: ', Joseon dynasty aesthetic, muted earthy tones, atmospheric depth', label: '한국 야담' },
  korean_webtoon: { prefix: 'modern Korean webtoon romance style, soft pastel colors, detailed manga illustration,', suffix: ', cherry blossoms, dreamy bokeh background', label: '한국 웹툰' },
  retro_pixel: { prefix: 'retro pixel art style, 16-bit SNES era video game aesthetic, chunky pixels,', suffix: ', bright color palette, nostalgic RPG game screenshot', label: '픽셀 아트' },
  us_cartoon: { prefix: 'American cartoon animation style, bold outlines, exaggerated expressions,', suffix: ', Cartoon Network inspired, flat colors, dynamic comic styling', label: '미국 카툰' },
  claymation: { prefix: 'Aardman claymation stop motion style, textured clay characters, warm studio lighting,', suffix: ', handmade feel, visible fingerprints texture', label: '클레이' },
  pen_sketch: { prefix: 'detailed pen and ink style, fine line crosshatching, cream paper texture,', suffix: ', precise technical pen drawing, dramatic shadows', label: '펜 스케치' },
};

// ── Base prompts per cut (scene-aware) ────────────────────────────────────
export const baseCutPrompts = [
  'futuristic AI neural network visualization, glowing nodes and connections, dark cinematic background, blue purple light rays, dramatic 3D render',
  'smart city morning commute scene, autonomous vehicles on highway, holographic navigation displays, golden hour lighting, urban future',
  'modern smart factory interior, robotic arms on assembly line, industrial AI technology, clean manufacturing environment, blue accent lighting',
  'abstract AI decision-making network, intelligent system data flow visualization, digital brain concept, dark background with glowing connections',
  'AI infrastructure concept art, essential technology pillars, digital transformation business innovation, abstract geometric shapes, dramatic lighting',
  'invisible force of AI technology concept, world innovation and business revolution, abstract energy waves, cinematic wide shot, inspiring',
];

// ── Keyword-to-visual mapping ──────────────────────────────────────────────
export const keywordVisualMap: Record<string, string> = {
  '인공지능 활용법': 'person using AI interface on laptop, practical application',
  'AI 자동화': 'automated workflow with AI robots and digital processes',
  '챗GPT 프롬프트': 'chat interface with AI conversation, glowing text prompts',
  '생성형 AI': 'generative AI creating images and content, creative explosion',
  'AI 부업': 'person earning money with AI tools, laptop and coins',
  '딥러닝 입문': 'neural network layers visualization, learning concept',
  'AI 이미지 생성': 'AI generating beautiful images, creative digital art process',
  '머신러닝 기초': 'machine learning algorithm visualization, data patterns',
  'AI 에이전트': 'autonomous AI agent working independently, digital assistant',
  'Sora 영상 AI': 'AI video generation concept, cinematic frames being created',
  'Claude 3.5': 'advanced AI language model interface, sophisticated chat',
  'AI 코딩 도구': 'AI-assisted coding environment, code editor with suggestions',
  'Gemini Ultra': 'multimodal AI processing images and text simultaneously',
  'AI 영상 편집': 'AI video editing timeline, automated post-production',
};

// ── Library images ─────────────────────────────────────────────────────────
export const libraryImages = [
  { id: 'lib1', url: 'https://readdy.ai/api/search-image?query=abstract%20technology%20digital%20network%20glowing%20lines%20dark%20background%20futuristic%20concept&width=160&height=100&seq=lib1&orientation=landscape', label: '테크 네트워크' },
  { id: 'lib2', url: 'https://readdy.ai/api/search-image?query=artificial%20intelligence%20robot%20humanoid%20face%20close%20up%20dramatic%20lighting%20dark%20background&width=160&height=100&seq=lib2&orientation=landscape', label: 'AI 로봇' },
  { id: 'lib3', url: 'https://readdy.ai/api/search-image?query=data%20center%20server%20room%20blue%20lights%20rows%20of%20servers%20technology%20infrastructure&width=160&height=100&seq=lib3&orientation=landscape', label: '데이터 센터' },
  { id: 'lib4', url: 'https://readdy.ai/api/search-image?query=business%20team%20meeting%20modern%20office%20technology%20startup%20collaboration&width=160&height=100&seq=lib4&orientation=landscape', label: '비즈니스 팀' },
  { id: 'lib5', url: 'https://readdy.ai/api/search-image?query=smart%20city%20aerial%20view%20night%20lights%20urban%20technology%20future%20concept&width=160&height=100&seq=lib5&orientation=landscape', label: '스마트 시티' },
  { id: 'lib6', url: 'https://readdy.ai/api/search-image?query=medical%20AI%20technology%20doctor%20analyzing%20data%20holographic%20display%20hospital&width=160&height=100&seq=lib6&orientation=landscape', label: '의료 AI' },
  { id: 'lib7', url: 'https://readdy.ai/api/search-image?query=financial%20technology%20stock%20market%20data%20visualization%20trading%20screen&width=160&height=100&seq=lib7&orientation=landscape', label: '핀테크' },
  { id: 'lib8', url: 'https://readdy.ai/api/search-image?query=education%20technology%20student%20learning%20digital%20tablet%20classroom%20modern&width=160&height=100&seq=lib8&orientation=landscape', label: '에듀테크' },
  { id: 'lib9', url: 'https://readdy.ai/api/search-image?query=autonomous%20self%20driving%20car%20interior%20dashboard%20technology%20future%20transportation&width=160&height=100&seq=lib9&orientation=landscape', label: '자율주행' },
  { id: 'lib10', url: 'https://readdy.ai/api/search-image?query=blockchain%20cryptocurrency%20digital%20currency%20network%20nodes%20glowing%20concept&width=160&height=100&seq=lib10&orientation=landscape', label: '블록체인' },
  { id: 'lib11', url: 'https://readdy.ai/api/search-image?query=cloud%20computing%20abstract%20concept%20data%20storage%20network%20sky%20technology&width=160&height=100&seq=lib11&orientation=landscape', label: '클라우드' },
  { id: 'lib12', url: 'https://readdy.ai/api/search-image?query=cybersecurity%20digital%20shield%20protection%20network%20security%20concept%20dark&width=160&height=100&seq=lib12&orientation=landscape', label: '사이버보안' },
];

export const styleList = [
  { id: 'cartoon_studio', label: '카툰 스튜디오', icon: 'ri-brush-line', color: 'from-pink-500 to-orange-400' },
  { id: 'cartoon', label: '카툰 해설', icon: 'ri-emotion-line', color: 'from-yellow-400 to-orange-500' },
  { id: 'sketch', label: '스케치 스타삭', icon: 'ri-pencil-line', color: 'from-zinc-400 to-zinc-600' },
  { id: 'mixed', label: '믹스미디어 콜라주', icon: 'ri-collage-line', color: 'from-purple-500 to-pink-500' },
  { id: 'tonedown', label: '톤다운 믹스', icon: 'ri-contrast-2-line', color: 'from-slate-500 to-slate-700' },
  { id: 'photo', label: '포토 스타일', icon: 'ri-camera-line', color: 'from-emerald-500 to-teal-600' },
  { id: 'film', label: '영화 스닥컷', icon: 'ri-film-line', color: 'from-zinc-700 to-zinc-900' },
  { id: 'news', label: '뉴스 스타일', icon: 'ri-newspaper-line', color: 'from-red-500 to-red-700' },
  { id: 'anime', label: '일본 애니메이션', icon: 'ri-star-line', color: 'from-sky-400 to-indigo-500' },
  { id: '3d_anime', label: '3D 애니메이션', icon: 'ri-box-3-line', color: 'from-violet-500 to-purple-700' },
  { id: 'webtoon', label: '웹툰 풀컷', icon: 'ri-book-open-line', color: 'from-green-400 to-emerald-600' },
  { id: 'flat_illust', label: '플랫 일러스트', icon: 'ri-layout-line', color: 'from-cyan-400 to-sky-600' },
  { id: 'retro_pixel', label: '레트로 픽셀', icon: 'ri-gamepad-line', color: 'from-amber-400 to-orange-600' },
  { id: 'us_cartoon', label: '미국 카툰', icon: 'ri-tv-line', color: 'from-red-400 to-pink-600' },
  { id: 'claymation', label: '클레이 애니메이션', icon: 'ri-hand-coin-line', color: 'from-lime-400 to-green-600' },
  { id: 'pen_sketch', label: '펜 스케치', icon: 'ri-edit-2-line', color: 'from-stone-400 to-stone-600' },
];

export const stylePreviewImages: Record<string, string> = {
  cartoon_studio: 'https://readdy.ai/api/search-image?query=colorful%20cartoon%20animation%20studio%20AI%20technology%20concept%20with%20bright%20bold%20colors%2C%20robot%20character%20explaining%20data%20charts%2C%20vibrant%20flat%20illustration%20explainer%20video%20style&width=480&height=270&seq=prev_cartoon_studio&orientation=landscape',
  cartoon: 'https://readdy.ai/api/search-image?query=cartoon%20explainer%20AI%20technology%20concept%20bold%20black%20outlines%20flat%20colors%2C%20shocked%20character%20looking%20at%20AI%20robot%2C%20news%20commentary%20illustration%20style%20bright%20colors&width=480&height=270&seq=prev_cartoon&orientation=landscape',
  sketch: 'https://readdy.ai/api/search-image?query=hand%20drawn%20pencil%20sketch%20AI%20technology%20concept%20rough%20gestural%20lines%20minimal%20shading%2C%20monochrome%20drawing%20cream%20paper%2C%20robot%20and%20human%20interaction%20sketch&width=480&height=270&seq=prev_sketch&orientation=landscape',
  mixed: 'https://readdy.ai/api/search-image?query=mixed%20media%20collage%20AI%20technology%20concept%20newspaper%20magazine%20clippings%20layered%20together%2C%20vibrant%20colors%20bold%20typography%20overlay%2C%20digital%20transformation%20editorial%20photomontage&width=480&height=270&seq=prev_mixed&orientation=landscape',
  tonedown: 'https://readdy.ai/api/search-image?query=muted%20toned%20down%20film%20collage%20AI%20technology%20concept%20desaturated%20cinematic%20photographs%20layered%2C%20dark%20moody%20atmosphere%20film%20grain%20texture%2C%20sophisticated%20editorial&width=480&height=270&seq=prev_tonedown&orientation=landscape',
  photo: 'https://readdy.ai/api/search-image?query=realistic%20photography%20AI%20technology%20concept%20natural%20warm%20lighting%20shallow%20depth%20of%20field%2C%20person%20working%20with%20AI%20interface%2C%20documentary%20photo%20aesthetic%20authentic&width=480&height=270&seq=prev_photo&orientation=landscape',
  film: 'https://readdy.ai/api/search-image?query=cinematic%20dark%20film%20AI%20technology%20concept%20low%20key%20dramatic%20lighting%20deep%20shadows%20moody%20atmosphere%2C%20futuristic%20server%20room%20thriller%20aesthetic%20high%20contrast&width=480&height=270&seq=prev_film&orientation=landscape',
  news: 'https://readdy.ai/api/search-image?query=news%20broadcast%20style%20AI%20technology%20concept%20suited%20presenter%20formal%20studio%20setting%2C%20television%20production%20quality%20lighting%20corporate%20authoritative%20atmosphere&width=480&height=270&seq=prev_news&orientation=landscape',
  anime: 'https://readdy.ai/api/search-image?query=Japanese%20anime%20style%20AI%20technology%20concept%20cityscape%20night%20neon%20lights%20rain%20reflections%2C%20cyberpunk%20city%20environment%20detailed%20urban%20architecture%20Makoto%20Shinkai%20inspired&width=480&height=270&seq=prev_anime&orientation=landscape',
  '3d_anime': 'https://readdy.ai/api/search-image?query=3D%20animated%20Pixar%20style%20AI%20technology%20concept%20expressive%20characters%20soft%20warm%20lighting%20cozy%20interior%2C%20high%20quality%20CGI%20rendering%20subsurface%20scattering&width=480&height=270&seq=prev_3d&orientation=landscape',
  webtoon: 'https://readdy.ai/api/search-image?query=Korean%20webtoon%20manhwa%20style%20AI%20technology%20concept%20full%20color%20illustration%20clean%20line%20art%20vibrant%20colors%2C%20office%20worker%20AI%20robot%20interaction%20bright%20saturated%20palette&width=480&height=270&seq=prev_webtoon&orientation=landscape',
  flat_illust: 'https://readdy.ai/api/search-image?query=flat%20design%20illustration%20AI%20technology%20concept%20minimal%20geometric%20shapes%20limited%20pastel%20color%20palette%2C%20clean%20modern%20infographic%20simple%20character%20icon%20elements%20Scandinavian&width=480&height=270&seq=prev_flat&orientation=landscape',
  retro_pixel: 'https://readdy.ai/api/search-image?query=retro%20pixel%20art%20style%20AI%20technology%20concept%2016-bit%20SNES%20era%20video%20game%20aesthetic%20chunky%20pixels%20bright%20color%20palette%20nostalgic%20RPG%20game%20screenshot&width=480&height=270&seq=prev_pixel&orientation=landscape',
  us_cartoon: 'https://readdy.ai/api/search-image?query=American%20cartoon%20animation%20style%20AI%20technology%20concept%20bold%20outlines%20exaggerated%20expressions%20oversized%20head%20character%2C%20Cartoon%20Network%20Adventure%20Time%20inspired%20flat%20colors%20dynamic&width=480&height=270&seq=prev_us_cartoon&orientation=landscape',
  claymation: 'https://readdy.ai/api/search-image?query=Aardman%20claymation%20stop%20motion%20style%20AI%20technology%20concept%20textured%20clay%20characters%20warm%20studio%20lighting%20handmade%20feel%20visible%20fingerprints%20texture&width=480&height=270&seq=prev_clay&orientation=landscape',
  pen_sketch: 'https://readdy.ai/api/search-image?query=detailed%20pen%20and%20ink%20AI%20technology%20concept%20fine%20line%20crosshatching%20technique%20cream%20paper%20texture%20precise%20technical%20pen%20drawing%20dramatic%20shadows%20robot%20human&width=480&height=270&seq=prev_pen&orientation=landscape',
};

export const durationColor = (d: number) => {
  if (d < 5) return 'bg-red-500';
  if (d < 7) return 'bg-orange-500';
  return 'bg-emerald-600';
};

// ── Prompt optimizer engine ────────────────────────────────────────────────
export function buildOptimizedPrompt(
  cutId: number,
  styleId: string | null,
  keywords: string[],
): string {
  const base = baseCutPrompts[(cutId - 1) % baseCutPrompts.length];
  const modifier = styleId ? stylePromptModifiers[styleId] : null;

  const kwVisuals = keywords
    .slice(0, 2)
    .map((kw) => keywordVisualMap[kw])
    .filter(Boolean)
    .join(', ');

  let prompt = base;
  if (kwVisuals) prompt = `${kwVisuals}, ${prompt}`;
  if (modifier) prompt = `${modifier.prefix} ${prompt}${modifier.suffix}`;

  return prompt;
}

export interface GalleryToast {
  id: string;
  message: string;
  count: number;
  type: 'success' | 'info';
}
