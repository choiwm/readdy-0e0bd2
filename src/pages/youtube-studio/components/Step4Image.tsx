import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ── 갤러리 자동 저장 토스트 ────────────────────────────────────────────────
interface GalleryToast {
  id: string;
  message: string;
  count: number;
  type: 'success' | 'info';
}

function GallerySaveToast({ toasts, onDismiss }: { toasts: GalleryToast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2.5 bg-zinc-900 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 pointer-events-auto"
          style={{ animation: 'slideInRight 0.3s ease-out' }}
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <i className="ri-image-line text-emerald-400 text-sm" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white whitespace-nowrap">{t.message}</p>
            <p className="text-[10px] text-zinc-500 whitespace-nowrap">AI 갤러리에서 확인하세요</p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors flex-shrink-0"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      ))}
    </div>
  );
}

interface Cut {
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

const initialCuts: Cut[] = [
  { id: 1, start: 0.0, end: 5.9, text: '아직도 인공지능을 먼 미래라고 생각하시나요?\n\n이미 우리 일상은 AI 시스템으로 굴러가고 있습니다.', image: null, prompt: '', optimized: false },
  { id: 2, start: 5.9, end: 12.2, text: '아침에 확인하는 맞춤형 뉴스부터 최적의 출근길을\n\n찾는 네비게이션까지 모두 AI의 작품입니다.', image: null, prompt: '', optimized: false },
  { id: 3, start: 12.2, end: 22.0, text: '기업의 현대 시스템은 더욱 놀랍니다.\n\n방대한 데이터를 실시간으로 분석해 소비자의 마음을 읽고,\n\n스마트 팩토리는 불량률을 제로에 가깝게 낮추며 생산성을 극대화하죠.', image: null, prompt: '', optimized: false },
  { id: 4, start: 22.0, end: 28.6, text: '단순한 자동화를 넘어 스스로 상황을 판단하고\n\n최적의 결정을 내리는 지능형 네트워크가\n\n바로 현대 시스템의 핵심입니다.', image: null, prompt: '', optimized: false },
  { id: 5, start: 28.6, end: 32.3, text: '이제 인공지능은 선택이 아닌 생존을 위한 필수 인프라입니다.', image: null, prompt: '', optimized: false },
  { id: 6, start: 32.3, end: 38.0, text: '세상을 움직이는 보이지 않는 힘, 인공지능.\n\n지금 바로 여러분의 삶과 비즈니스에 혁신을 도입해 보세요!', image: null, prompt: '', optimized: false },
];

const cutImages = [
  'https://readdy.ai/api/search-image?query=futuristic%20AI%20neural%20network%20glowing%20nodes%20dark%20background%20cinematic%20blue%20purple%20light%20high%20quality%20render&width=480&height=270&seq=cut1img&orientation=landscape',
  'https://readdy.ai/api/search-image?query=smart%20city%20morning%20commute%20autonomous%20vehicles%20and%20digital%20navigation%20holographic%20display%20urban%20future&width=480&height=270&seq=cut2img&orientation=landscape',
  'https://readdy.ai/api/search-image?query=smart%20factory%20automation%20robots%20assembly%20line%20industrial%20AI%20technology%20modern%20manufacturing&width=480&height=270&seq=cut3img&orientation=landscape',
  'https://readdy.ai/api/search-image?query=AI%20decision%20making%20network%20intelligent%20system%20data%20analysis%20abstract%20digital%20brain%20concept&width=480&height=270&seq=cut4img&orientation=landscape',
  'https://readdy.ai/api/search-image?query=AI%20infrastructure%20essential%20technology%20digital%20transformation%20business%20innovation%20concept&width=480&height=270&seq=cut5img&orientation=landscape',
  'https://readdy.ai/api/search-image?query=invisible%20force%20of%20AI%20technology%20world%20innovation%20business%20revolution%20digital%20future%20concept&width=480&height=270&seq=cut6img&orientation=landscape',
];

// ── Style prompt modifiers ─────────────────────────────────────────────────
const stylePromptModifiers: Record<string, { prefix: string; suffix: string; label: string }> = {
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
const baseCutPrompts = [
  'futuristic AI neural network visualization, glowing nodes and connections, dark cinematic background, blue purple light rays, dramatic 3D render',
  'smart city morning commute scene, autonomous vehicles on highway, holographic navigation displays, golden hour lighting, urban future',
  'modern smart factory interior, robotic arms on assembly line, industrial AI technology, clean manufacturing environment, blue accent lighting',
  'abstract AI decision-making network, intelligent system data flow visualization, digital brain concept, dark background with glowing connections',
  'AI infrastructure concept art, essential technology pillars, digital transformation business innovation, abstract geometric shapes, dramatic lighting',
  'invisible force of AI technology concept, world innovation and business revolution, abstract energy waves, cinematic wide shot, inspiring',
];

// ── Keyword-to-visual mapping ──────────────────────────────────────────────
const keywordVisualMap: Record<string, string> = {
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
const libraryImages = [
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

const styleList = [
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

const stylePreviewImages: Record<string, string> = {
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

const durationColor = (d: number) => {
  if (d < 5) return 'bg-red-500';
  if (d < 7) return 'bg-orange-500';
  return 'bg-emerald-600';
};

// ── Prompt optimizer engine ────────────────────────────────────────────────
function buildOptimizedPrompt(
  cutId: number,
  styleId: string | null,
  keywords: string[],
): string {
  const base = baseCutPrompts[(cutId - 1) % baseCutPrompts.length];
  const modifier = styleId ? stylePromptModifiers[styleId] : null;

  // Pick up to 2 relevant keyword visuals
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

interface Step4ImageProps {
  onNext: (images: string[], cuts?: Cut[]) => void;
  onBack: () => void;
  selectedStyle: string | null;
  selectedRatio: string;
  onGoToStep1: () => void;
  onStyleChange?: (style: string) => void;
  selectedKeywords?: string[];
  channelName?: string;
  initialCuts?: Cut[];
}

type ModalType = 'library' | 'upload' | 'regen' | 'style' | null;

// ── Prompt Optimization Panel ──────────────────────────────────────────────
function PromptOptimizePanel({
  cutId,
  styleId,
  keywords,
  onApply,
  onClose,
}: {
  cutId: number;
  styleId: string | null;
  keywords: string[];
  onApply: (prompt: string) => void;
  onClose: () => void;
}) {
  const [selectedKws, setSelectedKws] = useState<Set<string>>(new Set(keywords.slice(0, 2)));
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [optimizeStep, setOptimizeStep] = useState(0);

  const modifier = styleId ? stylePromptModifiers[styleId] : null;

  const handleOptimize = () => {
    setIsOptimizing(true);
    setOptimizeStep(0);
    setOptimizedPrompt('');

    const steps = [300, 700, 1100, 1500];
    steps.forEach((d, i) => setTimeout(() => setOptimizeStep(i + 1), d));

    setTimeout(() => {
      const result = buildOptimizedPrompt(cutId, styleId, Array.from(selectedKws));
      setOptimizedPrompt(result);
      setIsOptimizing(false);
    }, 1700);
  };

  const optimizeSteps = ['씬 텍스트 분석', '스타일 모디파이어 적용', '키워드 시각화 매핑', '프롬프트 최적화 완료'];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
          </div>
          <div>
            <p className="text-xs font-black text-white">AI 프롬프트 최적화</p>
            <p className="text-[9px] text-zinc-600">Cut {cutId} · 채널 분석 데이터 반영</p>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors">
          <i className="ri-close-line text-sm" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Style modifier preview */}
        {modifier && (
          <div className="bg-zinc-900/60 border border-indigo-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-palette-line text-indigo-400 text-xs" />
              <span className="text-[10px] font-bold text-indigo-300">스타일 모디파이어</span>
              <span className="text-[9px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">{modifier.label}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-[9px] text-emerald-400 font-bold w-8 flex-shrink-0 mt-0.5">앞</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed">{modifier.prefix}</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[9px] text-amber-400 font-bold w-8 flex-shrink-0 mt-0.5">뒤</span>
                <p className="text-[10px] text-zinc-400 leading-relaxed">{modifier.suffix}</p>
              </div>
            </div>
          </div>
        )}

        {/* Keyword selection */}
        {keywords.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <i className="ri-price-tag-3-line text-zinc-500 text-xs" />
                <span className="text-[10px] font-bold text-zinc-400">채널 키워드 반영</span>
              </div>
              <span className="text-[9px] text-zinc-600">{selectedKws.size}개 선택</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => {
                const isSelected = selectedKws.has(kw);
                const hasVisual = !!keywordVisualMap[kw];
                return (
                  <button
                    key={kw}
                    onClick={() => {
                      setSelectedKws((prev) => {
                        const next = new Set(prev);
                        if (next.has(kw)) next.delete(kw);
                        else next.add(kw);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                        : 'bg-zinc-800/60 border-white/5 text-zinc-500 hover:border-white/15'
                    }`}
                  >
                    {isSelected && <i className="ri-check-line text-[9px]" />}
                    #{kw}
                    {hasVisual && <i className="ri-image-line text-[9px] opacity-60" />}
                  </button>
                );
              })}
            </div>
            {selectedKws.size > 0 && (
              <div className="mt-2 space-y-1">
                {Array.from(selectedKws).map((kw) => keywordVisualMap[kw] && (
                  <div key={kw} className="flex items-start gap-2 bg-zinc-800/40 rounded-lg px-2 py-1.5">
                    <span className="text-[9px] text-indigo-400 font-bold whitespace-nowrap mt-0.5">#{kw}</span>
                    <p className="text-[9px] text-zinc-500 leading-relaxed">{keywordVisualMap[kw]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* No keywords state */}
        {keywords.length === 0 && (
          <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-3 flex items-start gap-2">
            <i className="ri-information-line text-zinc-600 text-xs mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Step 1에서 채널 분석 후 키워드를 선택하면 프롬프트에 자동 반영됩니다.
            </p>
          </div>
        )}

        {/* Optimize button */}
        <button
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer transition-all whitespace-nowrap"
        >
          {isOptimizing ? (
            <><i className="ri-loader-4-line animate-spin" /> 최적화 중...</>
          ) : (
            <><i className="ri-sparkling-2-line" /> AI 프롬프트 최적화</>
          )}
        </button>

        {/* Optimization progress */}
        {isOptimizing && (
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-3 space-y-2">
            {optimizeSteps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  i < optimizeStep ? 'bg-emerald-500' : i === optimizeStep ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-800'
                }`}>
                  {i < optimizeStep && <i className="ri-check-line text-white text-[8px]" />}
                  {i === optimizeStep && <div className="w-1 h-1 rounded-full bg-white" />}
                </div>
                <span className={`text-[10px] ${
                  i < optimizeStep ? 'text-zinc-600 line-through' : i === optimizeStep ? 'text-zinc-300' : 'text-zinc-700'
                }`}>{step}</span>
              </div>
            ))}
          </div>
        )}

        {/* Optimized result */}
        {optimizedPrompt && !isOptimizing && (
          <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-checkbox-circle-fill text-emerald-400 text-xs" />
              <span className="text-[10px] font-bold text-emerald-400">최적화 완료</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed mb-3">{optimizedPrompt}</p>
            <button
              onClick={() => { onApply(optimizedPrompt); onClose(); }}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-bold py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-check-line" /> 이 프롬프트 적용
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Step4Image({
  onNext, onBack, selectedStyle, selectedRatio, onGoToStep1, onStyleChange,
  selectedKeywords = [], channelName: _channelName = '', initialCuts: initialCutsProp,
}: Step4ImageProps) {
  const [cuts, setCuts] = useState<Cut[]>(initialCutsProp ?? initialCuts);

  // initialCutsProp이 외부에서 변경될 때 state 재초기화 (편집 프로젝트 전환 시)
  // undefined → 기본값, 빈 배열 → 기본값, 데이터 있음 → 해당 데이터로 초기화
  useEffect(() => {
    if (initialCutsProp !== undefined) {
      setCuts(initialCutsProp.length > 0 ? initialCutsProp : initialCuts);
    }
  }, [initialCutsProp]);
  const [selectedCut, setSelectedCut] = useState<number>(1);
  const [imageModel, setImageModel] = useState('Flux Realism');
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isInsufficientCredits, setIsInsufficientCredits] = useState(false);
  const [galleryToasts, setGalleryToasts] = useState<GalleryToast[]>([]);
  const savedUrlsRef = useRef<Set<string>>(new Set()); // 중복 저장 방지
  const { user } = useAuth();

  // 토스트 자동 제거
  useEffect(() => {
    if (galleryToasts.length === 0) return;
    const timer = setTimeout(() => {
      setGalleryToasts((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [galleryToasts]);

  // ── 갤러리 자동 저장 (백그라운드) ─────────────────────────────────────
  const saveToGallery = useCallback(async (
    imageUrl: string,
    prompt: string,
    cutId: number,
    showToast = true
  ) => {
    // 비로그인 사용자는 저장 안 함
    if (!user?.id) return;
    // 이미 저장된 URL이면 스킵 (재생성 시 중복 방지)
    if (savedUrlsRef.current.has(imageUrl)) return;

    try {
      const styleLabel = selectedStyle
        ? (stylePromptModifiers[selectedStyle]?.label ?? selectedStyle)
        : '기본';

      await supabase.from('gallery_items').insert({
        type: 'image',
        url: imageUrl,
        prompt: prompt || `YouTube Studio Cut ${cutId} — ${styleLabel} 스타일`,
        model: imageModel,
        ratio: selectedRatio,
        liked: false,
        duration: null,
        user_id: user.id,
        source: 'youtube-studio',
      });

      savedUrlsRef.current.add(imageUrl);

      if (showToast) {
        const toastId = `gallery_${Date.now()}_${cutId}`;
        setGalleryToasts((prev) => [
          ...prev.slice(-2), // 최대 3개만 표시
          { id: toastId, message: `Cut ${cutId} 이미지가 갤러리에 저장됨`, count: 1, type: 'success' },
        ]);
      }
    } catch (err) {
      // 갤러리 저장 실패는 조용히 무시 (이미지 생성 결과에 영향 없음)
      console.warn('[Gallery] 자동 저장 실패:', err);
    }
  }, [user, selectedStyle, imageModel, selectedRatio]);
  const [modelOpen, setModelOpen] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingCutId, setGeneratingCutId] = useState<number | null>(null);
  const [generateAllProgress, setGenerateAllProgress] = useState(0);
  const [generateAllDoneCount, setGenerateAllDoneCount] = useState(0);
  const [isFreeEnabled, setIsFreeEnabled] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isRegenAll, setIsRegenAll] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [regenDone, setRegenDone] = useState(false);
  const [showOptimizePanel, setShowOptimizePanel] = useState(false);
  const [isOptimizingAll, setIsOptimizingAll] = useState(false);
  const [optimizeAllProgress, setOptimizeAllProgress] = useState(0);
  const [optimizeAllDone, setOptimizeAllDone] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [styleHover, setStyleHover] = useState<string | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Mobile cut list drawer
  const [showMobileCutList, setShowMobileCutList] = useState(false);

  const current = cuts.find((c) => c.id === selectedCut)!;
  const styleLabel = selectedStyle ? (stylePromptModifiers[selectedStyle]?.label || selectedStyle) : null;
  const generatedCount = cuts.filter((c) => c.image).length;

  // Credit cost per model
  const modelCreditMap: Record<string, number> = {
    'Flux Realism': 2,
    'Flux Pro': 4,
    'Flux Pro Ultra': 8,
  };
  const creditPerImage = modelCreditMap[imageModel] ?? 2;
  const totalCreditsNeeded = creditPerImage * cuts.length;

  // Check if current cut's image URL contains the style modifier (i.e., was generated with style applied)
  const currentImageHasStyle = Boolean(
    current.image &&
    selectedStyle &&
    stylePromptModifiers[selectedStyle] &&
    current.image.includes(encodeURIComponent(stylePromptModifiers[selectedStyle].prefix.slice(0, 15)))
  );
  const optimizedCount = cuts.filter((c) => c.optimized).length;
  const filteredStyles = styleList.filter((s) => s.label.toLowerCase().includes(styleSearch.toLowerCase()));
  const filteredLibraryImages = libraryImages.filter((img) =>
    img.label.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const handlePromptChange = (val: string) => {
    setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, prompt: val, optimized: false } : c));
  };

  const handleAutoPrompt = () => {
    const prompt = buildOptimizedPrompt(selectedCut, selectedStyle, selectedKeywords);
    setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, prompt, optimized: true } : c));
    // Show a brief visual cue that style was applied
    setShowOptimizePanel(false);
  };

  const handleApplyOptimized = (prompt: string) => {
    setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, prompt, optimized: true } : c));
  };

  const handleGenerateCut = useCallback(async (id: number) => {
    setGeneratingCutId(id);
    setGenerateError(null);
    setIsInsufficientCredits(false);

    const cut = cuts.find((c) => c.id === id);
    if (!cut) { setGeneratingCutId(null); return; }

    // Build final prompt with style modifier
    let finalPrompt = cut.prompt.trim();
    if (!finalPrompt) {
      finalPrompt = buildOptimizedPrompt(id, selectedStyle, selectedKeywords);
    } else {
      const modifier = selectedStyle ? stylePromptModifiers[selectedStyle] : null;
      if (modifier) {
        const alreadyHasStyle = finalPrompt.toLowerCase().includes(modifier.prefix.slice(0, 20).toLowerCase());
        if (!alreadyHasStyle) {
          finalPrompt = `${modifier.prefix} ${finalPrompt}${modifier.suffix}`;
        }
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: finalPrompt,
          model: imageModel,
          ratio: selectedRatio,
          mode: 'default',
          ...(user?.id ? { user_id: user.id } : {}),
        },
      });

      if (error) {
        const detail = data?.error || data?.detail || error.message;
        throw Object.assign(new Error(detail), { data });
      }
      if (!data?.success || !data?.imageUrl) {
        throw Object.assign(new Error(data?.error || '이미지 생성에 실패했습니다.'), { data });
      }

      setCuts((prev) => prev.map((c) =>
        c.id === id ? { ...c, image: data.imageUrl } : c
      ));

      // 갤러리 자동 저장 (백그라운드)
      const finalPromptForGallery = cut.prompt.trim() || buildOptimizedPrompt(id, selectedStyle, selectedKeywords);
      saveToGallery(data.imageUrl, finalPromptForGallery, id, true);

    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const errData = (err as Error & { data?: { insufficient_credits?: boolean; required?: number; available?: number } }).data;

      let msg = '이미지 생성 중 오류가 발생했습니다.';
      let isCredits = false;

      if (errData?.insufficient_credits) {
        msg = `크레딧이 부족합니다. 필요: ${errData.required} CR, 보유: ${errData.available} CR`;
        isCredits = true;
      } else if (raw.includes('크레딧') || raw.includes('insufficient') || raw.includes('402')) {
        msg = '크레딧이 부족합니다. 크레딧을 충전해주세요.';
        isCredits = true;
      } else if (raw.includes('API 키') || raw.includes('api key') || raw.includes('FAL_KEY')) {
        msg = 'fal.ai API 키가 설정되지 않았습니다. 관리자 페이지에서 API 키를 등록해주세요.';
      } else if (raw.includes('401') || raw.includes('Unauthorized')) {
        msg = 'fal.ai 인증 실패: API 키를 확인해주세요.';
      } else if (raw.includes('timeout') || raw.includes('504')) {
        msg = '이미지 생성 시간이 초과되었습니다. 다시 시도해주세요.';
      } else if (raw && raw !== 'Edge Function returned a non-2xx status code') {
        msg = raw;
      }

      setIsInsufficientCredits(isCredits);
      setGenerateError(msg);
      if (!isCredits) setTimeout(() => setGenerateError(null), 8000);
    } finally {
      setGeneratingCutId(null);
    }
  }, [cuts, selectedStyle, selectedKeywords, imageModel, selectedRatio, user, saveToGallery]);

  const handleGenerateAll = useCallback(async () => {
    setIsGeneratingAll(true);
    setGenerateError(null);
    setIsInsufficientCredits(false);
    setGenerateAllProgress(0);
    setGenerateAllDoneCount(0);

    let savedCount = 0;

    for (let i = 0; i < cuts.length; i++) {
      const cut = cuts[i];
      setGeneratingCutId(cut.id);

      // Build prompt for this cut
      let finalPrompt = cut.prompt.trim();
      if (!finalPrompt) {
        finalPrompt = buildOptimizedPrompt(cut.id, selectedStyle, selectedKeywords);
      } else {
        const modifier = selectedStyle ? stylePromptModifiers[selectedStyle] : null;
        if (modifier) {
          const alreadyHasStyle = finalPrompt.toLowerCase().includes(modifier.prefix.slice(0, 20).toLowerCase());
          if (!alreadyHasStyle) {
            finalPrompt = `${modifier.prefix} ${finalPrompt}${modifier.suffix}`;
          }
        }
      }

      try {
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: finalPrompt,
            model: imageModel,
            ratio: selectedRatio,
            mode: 'default',
            ...(user?.id ? { user_id: user.id } : {}),
          },
        });

        if (error) {
          const detail = data?.error || data?.detail || error.message;
          throw Object.assign(new Error(detail), { data });
        }
        if (data?.success && data?.imageUrl) {
          setCuts((prev) => prev.map((c) =>
            c.id === cut.id ? { ...c, image: data.imageUrl } : c
          ));
          // 갤러리 자동 저장 (개별 토스트 없이 백그라운드 저장)
          const promptForGallery = finalPrompt;
          saveToGallery(data.imageUrl, promptForGallery, cut.id, false);
          savedCount++;
        } else if (data?.error) {
          throw Object.assign(new Error(data.error), { data });
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const errData = (err as Error & { data?: { insufficient_credits?: boolean; required?: number; available?: number } }).data;

        if (errData?.insufficient_credits || raw.includes('크레딧') || raw.includes('insufficient') || raw.includes('402')) {
          const msg = errData?.insufficient_credits
            ? `크레딧이 부족합니다. 필요: ${errData.required} CR, 보유: ${errData.available} CR`
            : '크레딧이 부족합니다. 크레딧을 충전해주세요.';
          setIsInsufficientCredits(true);
          setGenerateError(msg);
          setIsGeneratingAll(false);
          setGeneratingCutId(null);
          // 지금까지 저장된 것 토스트 표시
          if (savedCount > 0 && user?.id) {
            setGalleryToasts((prev) => [...prev.slice(-2), {
              id: `gallery_all_${Date.now()}`,
              message: `${savedCount}개 이미지가 갤러리에 저장됨`,
              count: savedCount,
              type: 'success',
            }]);
          }
          return;
        }

        if (raw.includes('API 키') || raw.includes('FAL_KEY') || raw.includes('api key')) {
          const msg = 'fal.ai API 키가 설정되지 않았습니다. 관리자 페이지에서 API 키를 등록해주세요.';
          setGenerateError(msg);
          setIsGeneratingAll(false);
          setGeneratingCutId(null);
          return;
        }

        if (raw.includes('401') || raw.includes('Unauthorized')) {
          setGenerateError('fal.ai 인증 실패: API 키를 확인해주세요.');
          setIsGeneratingAll(false);
          setGeneratingCutId(null);
          return;
        }

        // 기타 에러는 해당 컷만 스킵하고 계속
        const msg = raw && raw !== 'Edge Function returned a non-2xx status code'
          ? `Cut ${cut.id}: ${raw}`
          : `Cut ${cut.id} 생성 실패`;
        setGenerateError(msg);
        console.error(`Cut ${cut.id} 생성 실패:`, raw);
        setTimeout(() => setGenerateError(null), 5000);
      } finally {
        setGeneratingCutId(null);
        const doneCount = i + 1;
        setGenerateAllDoneCount(doneCount);
        setGenerateAllProgress(Math.round((doneCount / cuts.length) * 100));
      }
    }

    setIsGeneratingAll(false);

    // 전체 생성 완료 후 일괄 갤러리 저장 토스트
    if (savedCount > 0 && user?.id) {
      setGalleryToasts((prev) => [...prev.slice(-2), {
        id: `gallery_all_${Date.now()}`,
        message: `${savedCount}개 이미지가 갤러리에 저장됨`,
        count: savedCount,
        type: 'success',
      }]);
    }
  }, [cuts, selectedStyle, selectedKeywords, imageModel, selectedRatio, user, saveToGallery]);

  // Optimize all prompts with channel data
  const handleOptimizeAll = useCallback(() => {
    setIsOptimizingAll(true);
    setOptimizeAllDone(false);
    setOptimizeAllProgress(0);
    let i = 0;
    const go = () => {
      if (i >= cuts.length) {
        setIsOptimizingAll(false);
        setOptimizeAllProgress(100);
        setOptimizeAllDone(true);
        return;
      }
      const cut = cuts[i];
      const prompt = buildOptimizedPrompt(cut.id, selectedStyle, selectedKeywords);
      setCuts((prev) => prev.map((c) => c.id === cut.id ? { ...c, prompt, optimized: true } : c));
      setOptimizeAllProgress(Math.round(((i + 1) / cuts.length) * 100));
      i++;
      setTimeout(go, 280);
    };
    go();
  }, [cuts, selectedStyle, selectedKeywords]);

  const handleRegenAllPrompts = () => {
    setIsRegenAll(true);
    setRegenDone(false);
    setRegenProgress(0);
    let i = 0;
    const go = () => {
      if (i >= cuts.length) {
        setIsRegenAll(false);
        setRegenProgress(100);
        setRegenDone(true);
        return;
      }
      const cut = cuts[i];
      const prompt = buildOptimizedPrompt(cut.id, selectedStyle, selectedKeywords);
      setCuts((prev) => prev.map((c) => c.id === cut.id ? { ...c, prompt, optimized: true } : c));
      setRegenProgress(Math.round(((i + 1) / cuts.length) * 100));
      i++;
      setTimeout(go, 300);
    };
    go();
  };

  const handleUploadFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploading(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          const url = URL.createObjectURL(file);
          setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, image: url } : c));
          setActiveModal(null);
          return 100;
        }
        return Math.min(p + Math.floor(Math.random() * 20) + 10, 100);
      });
    }, 100);
  };

  const dismissToast = useCallback((id: string) => {
    setGalleryToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="flex flex-col h-full" onClick={() => setModelOpen(false)}>

      {/* ── 갤러리 저장 토스트 ── */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <GallerySaveToast toasts={galleryToasts} onDismiss={dismissToast} />

      {/* ── Library Modal ── */}
      {activeModal === 'library' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">이미지 라이브러리</p>
                <p className="text-zinc-500 text-xs mt-0.5">Cut {selectedCut}에 적용할 이미지를 선택하세요</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-4 md:p-5">
              <div className="flex items-center gap-2 bg-zinc-800 border border-white/5 rounded-xl px-3 py-2 mb-4">
                <i className="ri-search-line text-zinc-500 text-sm" />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="이미지 검색..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
                />
                {librarySearch && (
                  <button onClick={() => setLibrarySearch('')} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
                    <i className="ri-close-line text-sm" />
                  </button>
                )}
              </div>
              {filteredLibraryImages.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-sm">
                  <i className="ri-search-line text-2xl mb-2 block" />
                  &quot;{librarySearch}&quot; 검색 결과가 없습니다
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto">
                {filteredLibraryImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => {
                      setCuts((prev) => prev.map((c) => c.id === selectedCut ? { ...c, image: img.url.replace('160', '480').replace('100', '270') } : c));
                      setActiveModal(null);
                    }}
                    className="relative rounded-xl overflow-hidden cursor-pointer group ring-1 ring-white/5 hover:ring-indigo-500 transition-all"
                  >
                    <img src={img.url} alt={img.label} className="w-full h-[70px] object-cover object-top" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center">
                        <i className="ri-add-line text-white text-sm" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pb-1.5 pt-4 px-1.5">
                      <p className="text-[9px] text-white font-semibold truncate">{img.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Modal ── */}
      {activeModal === 'upload' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">이미지 업로드</p>
                <p className="text-zinc-500 text-xs mt-0.5">Cut {selectedCut}에 적용할 이미지를 업로드하세요</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-5 md:p-6 space-y-4">
              {isUploading ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  <p className="text-zinc-300 text-sm font-semibold">업로드 중...</p>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-zinc-500 text-xs">{uploadProgress}%</p>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingUpload(true); }}
                  onDragLeave={() => setIsDraggingUpload(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDraggingUpload(false); const file = e.dataTransfer.files[0]; if (file) handleUploadFile(file); }}
                  onClick={() => uploadInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 md:p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${isDraggingUpload ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'}`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <i className="ri-image-add-line text-zinc-400 text-2xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-white text-sm font-semibold">이미지를 드래그하거나 클릭하여 업로드</p>
                    <p className="text-zinc-500 text-xs mt-1">JPG, PNG, WEBP · 최대 20MB</p>
                  </div>
                  <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadFile(file); }} />
                </div>
              )}
              <button onClick={() => setActiveModal(null)} className="w-full py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Regen All Modal ── */}
      {activeModal === 'regen' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => !isRegenAll && setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">프롬프트 전체 재생성</p>
                <p className="text-zinc-500 text-xs mt-0.5">
                  {selectedKeywords.length > 0 ? `채널 키워드 ${selectedKeywords.length}개 + 스타일 반영` : '스타일 기반 자동 생성'}
                </p>
              </div>
              {!isRegenAll && !regenDone && (
                <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                  <i className="ri-close-line" />
                </button>
              )}
            </div>
            <div className="p-5 md:p-6 space-y-5">
              {regenDone ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <i className="ri-check-line text-emerald-400 text-2xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">전체 재생성 완료!</p>
                    <p className="text-zinc-500 text-xs mt-1">총 {cuts.length}개 컷의 프롬프트가 최적화되었습니다</p>
                  </div>
                  <div className="w-full space-y-2 max-h-[160px] overflow-y-auto bg-zinc-800/50 rounded-xl p-3">
                    {cuts.map((c) => (
                      <div key={c.id} className="flex items-start gap-2">
                        <span className="text-[10px] text-emerald-400 font-bold whitespace-nowrap mt-0.5 w-10 flex-shrink-0">Cut {c.id}</span>
                        <p className="text-[10px] text-zinc-300 leading-relaxed line-clamp-2 flex-1">{c.prompt || '—'}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setRegenDone(false); setActiveModal(null); }} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap">확인</button>
                </div>
              ) : isRegenAll ? (
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative w-14 h-14">
                    <div className="w-14 h-14 rounded-full border-2 border-zinc-700" />
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{regenProgress}%</span>
                    </div>
                  </div>
                  <p className="text-zinc-300 text-sm font-semibold">AI 프롬프트 최적화 중...</p>
                  <div className="w-full bg-zinc-700 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${regenProgress}%` }} />
                  </div>
                  <div className="w-full space-y-1.5 max-h-[140px] overflow-y-auto">
                    {cuts.map((c) => {
                      const isDone = c.optimized;
                      return (
                        <div key={c.id} className="flex items-start gap-2 rounded-lg px-2 py-1">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isDone ? 'bg-emerald-500/20' : 'bg-zinc-700'}`}>
                            {isDone && <i className="ri-check-line text-emerald-400 text-[8px]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-zinc-500 font-semibold">Cut {c.id}</span>
                            {isDone && <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-1 mt-0.5">{c.prompt}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {(selectedKeywords.length > 0 || selectedStyle) && (
                    <div className="bg-zinc-800/60 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-bold text-zinc-400 mb-2">반영될 데이터</p>
                      {selectedStyle && (
                        <div className="flex items-center gap-2">
                          <i className="ri-palette-line text-indigo-400 text-xs" />
                          <span className="text-[10px] text-zinc-400">스타일:</span>
                          <span className="text-[10px] text-indigo-300 font-semibold">{styleLabel}</span>
                        </div>
                      )}
                      {selectedKeywords.length > 0 && (
                        <div className="flex items-start gap-2">
                          <i className="ri-price-tag-3-line text-emerald-400 text-xs mt-0.5" />
                          <div className="flex flex-wrap gap-1">
                            {selectedKeywords.map((kw) => (
                              <span key={kw} className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">{kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5">
                    <i className="ri-alert-line text-amber-400 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">기존 프롬프트가 있는 컷도 모두 새로 생성됩니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setActiveModal(null)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap">취소</button>
                    <button onClick={handleRegenAllPrompts} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap">
                      <i className="ri-sparkling-2-line" /> 전체 재생성
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Style Modal ── */}
      {activeModal === 'style' && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setActiveModal(null)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">이미지 스타일 선택</p>
                <p className="text-zinc-500 text-xs mt-0.5">전체 컷에 적용할 스타일을 선택하세요</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex h-[400px] md:h-[480px]">
              <div className="flex-1 flex flex-col border-r border-white/5">
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2 bg-zinc-800 border border-white/5 rounded-xl px-3 py-2">
                    <i className="ri-search-line text-zinc-500 text-sm" />
                    <input type="text" value={styleSearch} onChange={(e) => setStyleSearch(e.target.value)} placeholder="스타일 검색..." className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {filteredStyles.map((s) => {
                      const isSelected = selectedStyle === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { onStyleChange?.(s.id); setActiveModal(null); }}
                          onMouseEnter={() => setStyleHover(s.id)}
                          onMouseLeave={() => setStyleHover(null)}
                          className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-zinc-800/50 hover:border-white/15 hover:bg-zinc-800'}`}
                        >
                          <div className="w-full h-[60px] rounded-lg overflow-hidden relative">
                            {stylePreviewImages[s.id] ? (
                              <img src={stylePreviewImages[s.id]} alt={s.label} className="w-full h-full object-cover object-top" />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                                <i className={`${s.icon} text-white text-xl`} />
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-indigo-500/20 flex items-center justify-center">
                                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                                  <i className="ri-check-line text-white text-xs" />
                                </div>
                              </div>
                            )}
                          </div>
                          <span className={`text-[11px] font-semibold text-center leading-tight ${isSelected ? 'text-indigo-300' : 'text-zinc-300'}`}>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex w-[220px] flex-shrink-0 flex-col">
                {(styleHover || selectedStyle) ? (
                  <>
                    <div className="flex-1 h-[140px] flex-shrink-0 overflow-hidden">
                      {stylePreviewImages[styleHover || selectedStyle || ''] ? (
                        <img src={stylePreviewImages[styleHover || selectedStyle || '']} alt="preview" className="w-full h-full object-cover object-top" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${styleList.find((s) => s.id === (styleHover || selectedStyle))?.color || 'from-zinc-700 to-zinc-900'} flex items-center justify-center`}>
                          <i className={`${styleList.find((s) => s.id === (styleHover || selectedStyle))?.icon || 'ri-image-line'} text-white text-3xl`} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-4 space-y-3">
                      <div>
                        <p className="text-white font-bold text-sm">{styleList.find((s) => s.id === (styleHover || selectedStyle))?.label}</p>
                        {selectedStyle === (styleHover || selectedStyle) && (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[10px] text-emerald-400 font-semibold">현재 적용 중</span>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { onStyleChange?.(styleHover || selectedStyle || ''); setActiveModal(null); }} className="w-full py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold cursor-pointer transition-colors whitespace-nowrap">이 스타일 적용</button>
                      <button onClick={() => { setActiveModal(null); onGoToStep1(); }} className="w-full py-2 rounded-xl border border-white/10 text-zinc-400 text-xs font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap">
                        <i className="ri-arrow-left-line text-xs mr-1" />Step 1에서 선택
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                      <i className="ri-palette-line text-zinc-500 text-xl" />
                    </div>
                    <p className="text-zinc-500 text-xs">스타일에 마우스를 올려 미리보기</p>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 md:px-6 py-3 border-t border-white/5 flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                {selectedStyle ? <><span className="text-indigo-400 font-semibold">{styleLabel}</span> 스타일 적용 중</> : '스타일 미선택'}
              </p>
              <button onClick={() => setActiveModal(null)} className="text-xs text-zinc-400 hover:text-white cursor-pointer transition-colors whitespace-nowrap">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Cut List Drawer ── */}
      {showMobileCutList && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileCutList(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-[#0d0d0f] border-t border-white/10 rounded-t-2xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
              <span className="text-sm font-bold text-white">컷 목록 ({generatedCount}/{cuts.length})</span>
              <button onClick={() => setShowMobileCutList(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cuts.map((cut) => {
                const dur = (cut.end - cut.start).toFixed(1);
                const isSelected = selectedCut === cut.id;
                const isGen = generatingCutId === cut.id;
                return (
                  <div
                    key={cut.id}
                    onClick={() => { setSelectedCut(cut.id); setShowMobileCutList(false); }}
                    className={`border-b border-white/5 p-3 cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/3'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-zinc-500 font-semibold">Cut {cut.id}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGenerateCut(cut.id); }}
                        className="w-5 h-5 rounded-full bg-zinc-700 hover:bg-indigo-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                      >
                        {isGen ? <i className="ri-loader-4-line animate-spin text-white text-[9px]" /> : <i className="ri-play-fill text-white text-[9px] ml-px" />}
                      </button>
                      <span className="text-[9px] text-zinc-600">{cut.start.toFixed(1)}s–{cut.end.toFixed(1)}s</span>
                      <span className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full ml-auto ${durationColor(Number(dur))}`}>{dur}s</span>
                    </div>
                    {cut.image ? (
                      <div className="relative group mb-2">
                        <img src={cut.image} alt={`Cut ${cut.id}`} className="w-full h-[70px] object-cover object-top rounded-lg" />
                        {isGen && (
                          <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
                            <i className="ri-loader-4-line animate-spin text-white text-lg" />
                          </div>
                        )}
                        {cut.optimized && (
                          <div className="absolute top-1 right-1 bg-indigo-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <i className="ri-sparkling-2-line text-[8px]" /> 최적화
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 leading-relaxed mb-2 whitespace-pre-line line-clamp-2">{cut.text}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Toolbar ── */}
      <div className="flex-shrink-0 border-b border-white/5 bg-[#0f0f11] px-2 md:px-6 py-2 md:py-3 flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-none">
        {/* Mobile cut list button */}
        <button
          onClick={() => setShowMobileCutList(true)}
          className="md:hidden flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-2.5 py-2 rounded-lg cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-list-check text-xs" />
          컷 {selectedCut}/{cuts.length}
          {generatedCount > 0 && <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">{generatedCount}생성</span>}
        </button>

        {/* Model dropdown */}
        <div className="relative hidden md:block flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setModelOpen(!modelOpen)} className="flex items-center gap-2 bg-zinc-800 border border-white/10 hover:border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap">
            <i className="ri-flashlight-line text-indigo-400 text-xs" />
            {imageModel}
            <i className={`ri-arrow-down-s-line text-zinc-500 text-xs transition-transform ${modelOpen ? 'rotate-180' : ''}`} />
          </button>
          {modelOpen && (
            <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-xl z-30 overflow-hidden min-w-[200px]">
              {[
                { id: 'Flux Realism', label: 'Flux Realism', desc: '빠른 사실적 이미지', icon: 'ri-flashlight-line' },
                { id: 'Flux Pro', label: 'Flux Pro', desc: '고품질 균형', icon: 'ri-image-line' },
                { id: 'Flux Pro Ultra', label: 'Flux Pro Ultra', desc: '최고 품질', icon: 'ri-sparkling-2-line' },
              ].map((m) => (
                <button key={m.id} onClick={() => { setImageModel(m.id); setModelOpen(false); }} className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${imageModel === m.id ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/5'}`}>
                  <i className={`${m.icon} text-xs flex-shrink-0`} />
                  <div className="text-left">
                    <div className="font-semibold">{m.label}</div>
                    <div className="text-[10px] text-zinc-500">{m.desc}</div>
                  </div>
                  {imageModel === m.id && <i className="ri-check-line text-indigo-400 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Style button */}
        <button
          onClick={() => setActiveModal('style')}
          className={`flex items-center gap-1 md:gap-1.5 border text-xs font-semibold px-2 md:px-3 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0 ${selectedStyle ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 hover:border-indigo-500/60' : 'bg-zinc-800 border-white/10 text-zinc-300 hover:border-white/20'}`}
        >
          <i className="ri-palette-line text-xs" />
          <span className="hidden sm:inline">{styleLabel || '스타일 미선택'}</span>
          <span className="sm:hidden">{styleLabel ? styleLabel.slice(0, 4) : '스타일'}</span>
          {selectedStyle ? (
            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-500/20">적용</span>
          ) : (
            <span className="hidden sm:block text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">선택</span>
          )}
        </button>

        {/* Ratio - desktop only */}
        <div className="hidden md:flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0">
          <i className="ri-aspect-ratio-line text-xs" />
          {selectedRatio}
          <span className="text-[9px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">Step 1</span>
        </div>

        {/* Channel keywords badge - desktop only */}
        {selectedKeywords.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0">
            <i className="ri-price-tag-3-line text-xs" />
            키워드 {selectedKeywords.length}개
          </div>
        )}

        {/* Optimize all button */}
        <button
          onClick={() => { setOptimizeAllDone(false); setActiveModal('regen'); }}
          className="hidden md:flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer hover:border-indigo-500/40 hover:text-indigo-300 transition-all whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
          프롬프트 재생성
          {optimizedCount > 0 && (
            <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">{optimizedCount}/{cuts.length}</span>
          )}
        </button>

        {/* Mobile: AI optimize button */}
        <button
          onClick={() => { setOptimizeAllDone(false); setActiveModal('regen'); }}
          className="md:hidden flex items-center gap-1 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-2 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
        >
          <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
          AI
        </button>

        <div className="flex-1 min-w-0" />

        {/* Free toggle - desktop only */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <i className="ri-sparkling-2-line text-zinc-500 text-xs" />
          <span className="text-xs text-zinc-500">Free (200/200)</span>
          <button onClick={() => setIsFreeEnabled(!isFreeEnabled)} className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${isFreeEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isFreeEnabled ? 'left-4' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Credit cost badge - desktop only */}
        {!isGeneratingAll && (
          <div className="hidden md:flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0">
            <i className="ri-coin-line text-xs" />
            {totalCreditsNeeded} 크레딧
            <span className="text-[9px] text-amber-400/70 font-normal">({creditPerImage}/컷)</span>
          </div>
        )}

        {/* Generate all */}
        <button
          onClick={handleGenerateAll}
          disabled={isGeneratingAll}
          className="flex items-center gap-1 md:gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 text-white font-bold text-xs px-2.5 md:px-4 py-2 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
        >
          {isGeneratingAll ? (
            <>
              <i className="ri-loader-4-line animate-spin" />
              <span className="hidden sm:inline">
                {generatingCutId ? `Cut ${generatingCutId} 생성 중...` : '생성 중...'}
              </span>
              <span className="sm:hidden">생성 중</span>
              <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                {generateAllDoneCount}/{cuts.length}
              </span>
            </>
          ) : (
            <>
              <i className="ri-play-fill text-xs ml-0.5" />
              <span className="hidden sm:inline">전체 생성</span>
              <span className="sm:hidden">전체</span>
              <span className="flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                <i className="ri-sparkling-2-line text-[10px]" />{cuts.length}
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Generate All Progress Bar ── */}
      {isGeneratingAll && (
        <div className="flex-shrink-0 bg-[#0a0a0c] border-b border-white/5 px-4 md:px-6 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin flex-shrink-0" />
              <span className="text-xs font-semibold text-zinc-300">
                전체 이미지 생성 중
                {generatingCutId && (
                  <span className="text-zinc-500 font-normal ml-1">— Cut {generatingCutId} 처리 중</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-semibold">
                <span className="text-white">{generateAllDoneCount}</span>
                <span className="text-zinc-600">/{cuts.length}</span>
                <span className="text-zinc-600 ml-1">컷 완료</span>
              </span>
              <span className="text-xs font-bold text-indigo-400">{generateAllProgress}%</span>
              <div className="hidden md:flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <i className="ri-coin-line text-[10px]" />
                {generateAllDoneCount * creditPerImage}/{totalCreditsNeeded} 크레딧 사용
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="relative w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${generateAllProgress}%` }}
            />
            {/* Cut markers */}
            {cuts.map((_, idx) => {
              const pos = ((idx + 1) / cuts.length) * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 w-px bg-black/40"
                  style={{ left: `${pos}%` }}
                />
              );
            })}
          </div>
          {/* Cut status dots */}
          <div className="flex items-center gap-1 mt-2">
            {cuts.map((cut) => {
              const isDone = generateAllDoneCount >= cut.id;
              const isCurrent = generatingCutId === cut.id;
              return (
                <div key={cut.id} className="flex flex-col items-center gap-0.5 flex-1">
                  <div className={`w-full h-1 rounded-full transition-all duration-300 ${
                    isDone
                      ? 'bg-emerald-500'
                      : isCurrent
                      ? 'bg-indigo-500 animate-pulse'
                      : 'bg-zinc-700'
                  }`} />
                  <span className={`text-[8px] font-semibold ${
                    isDone ? 'text-emerald-400' : isCurrent ? 'text-indigo-400' : 'text-zinc-700'
                  }`}>
                    {isDone ? <i className="ri-check-line" /> : isCurrent ? <i className="ri-loader-4-line animate-spin" /> : cut.id}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Cut list (desktop only) */}
        <div className="hidden md:block w-[260px] flex-shrink-0 border-r border-white/5 overflow-y-auto bg-[#0d0d0f]">
          <div className="sticky top-0 bg-[#0d0d0f] border-b border-white/5 px-3 py-2 flex items-center gap-2 z-10">
            <span className="text-xs text-zinc-400 font-semibold">{generatedCount}/{cuts.length} Cut</span>
            <div className="w-px h-3 bg-zinc-700" />
            <span className="text-xs text-zinc-500">0:38</span>
            {optimizedCount > 0 && (
              <>
                <div className="w-px h-3 bg-zinc-700" />
                <span className="text-[10px] text-indigo-400 font-semibold">{optimizedCount}개 최적화됨</span>
              </>
            )}
          </div>

          {cuts.map((cut) => {
            const dur = (cut.end - cut.start).toFixed(1);
            const isSelected = selectedCut === cut.id;
            const isGen = generatingCutId === cut.id;
            return (
              <div
                key={cut.id}
                onClick={() => setSelectedCut(cut.id)}
                className={`border-b border-white/5 p-3 cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : 'hover:bg-white/3'}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-zinc-500 font-semibold">Cut {cut.id}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleGenerateCut(cut.id); }}
                    className="w-5 h-5 rounded-full bg-zinc-700 hover:bg-indigo-500 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
                  >
                    {isGen ? <i className="ri-loader-4-line animate-spin text-white text-[9px]" /> : <i className="ri-play-fill text-white text-[9px] ml-px" />}
                  </button>
                  <span className="text-[9px] text-zinc-600">{cut.start.toFixed(1)}s–{cut.end.toFixed(1)}s</span>
                  <span className={`text-[9px] text-white font-bold px-1.5 py-0.5 rounded-full ml-auto ${durationColor(Number(dur))}`}>{dur}s</span>
                </div>

                {cut.image ? (
                  <div className="relative group mb-2">
                    <img src={cut.image} alt={`Cut ${cut.id}`} className="w-full h-[80px] object-cover object-top rounded-lg" />
                    {isGen && (
                      <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
                        <i className="ri-loader-4-line animate-spin text-white text-lg" />
                      </div>
                    )}
                    {cut.optimized && (
                      <div className="absolute top-1 right-1 bg-indigo-500/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <i className="ri-sparkling-2-line text-[8px]" /> 최적화
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 leading-relaxed mb-2 whitespace-pre-line line-clamp-3">{cut.text}</p>
                )}

                <div className="flex items-center gap-2">
                  {cut.optimized && (
                    <span className="text-[9px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">AI 최적화</span>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedCut(cut.id); setActiveModal('library'); }} className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-zinc-300 cursor-pointer">
                      <i className="ri-image-line text-xs" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 가위 버튼: 해당 컷 이미지 제거 (재생성 준비)
                        setCuts((prev) => prev.map((c) => c.id === cut.id ? { ...c, image: null } : c));
                        setSelectedCut(cut.id);
                      }}
                      className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
                      title="이미지 제거 (재생성 준비)"
                    >
                      <i className="ri-scissors-line text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right — Image editor + Optimize panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main editor */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0f0f11]">
            {/* Style + channel data banner */}
            {(selectedStyle || selectedKeywords.length > 0) && (
              <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 bg-indigo-500/5 border-b border-indigo-500/10 flex-wrap">
                {selectedStyle && (
                  <div className="flex items-center gap-1.5">
                    <i className="ri-palette-line text-indigo-400 text-xs" />
                    <span className="text-xs text-indigo-300 font-semibold">{styleLabel}</span>
                  </div>
                )}
                {selectedStyle && selectedKeywords.length > 0 && <div className="w-px h-3 bg-indigo-500/30" />}
                {selectedKeywords.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <i className="ri-price-tag-3-line text-emerald-400 text-xs" />
                    {selectedKeywords.slice(0, 2).map((kw) => (
                      <span key={kw} className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">{kw}</span>
                    ))}
                    {selectedKeywords.length > 2 && (
                      <span className="text-[9px] text-zinc-500">+{selectedKeywords.length - 2}개</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setShowOptimizePanel(!showOptimizePanel)}
                  className={`ml-auto flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                    showOptimizePanel
                      ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                      : 'text-indigo-400 hover:text-indigo-300'
                  }`}
                >
                  <i className="ri-sparkling-2-line text-xs" />
                  <span className="hidden sm:inline">{showOptimizePanel ? '최적화 패널 닫기' : 'AI 프롬프트 최적화'}</span>
                  <span className="sm:hidden">AI 최적화</span>
                </button>
              </div>
            )}

            {/* Error banner */}
            {generateError && (
              <div className={`flex-shrink-0 flex items-start gap-2 px-4 py-2.5 border-b ${
                isInsufficientCredits
                  ? 'bg-amber-500/10 border-amber-500/20'
                  : 'bg-red-500/10 border-red-500/20'
              }`}>
                <i className={`text-sm flex-shrink-0 mt-0.5 ${
                  isInsufficientCredits ? 'ri-coin-line text-amber-400' : 'ri-error-warning-line text-red-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isInsufficientCredits ? 'text-amber-300' : 'text-red-300'}`}>
                    {isInsufficientCredits ? '크레딧 부족' : '이미지 생성 오류'}
                  </p>
                  <p className={`text-xs mt-0.5 ${isInsufficientCredits ? 'text-amber-200/70' : 'text-red-200/70'}`}>
                    {generateError}
                  </p>
                  {isInsufficientCredits && (
                    <p className="text-[10px] text-amber-400/60 mt-1">크레딧 충전 후 다시 시도하거나, 라이브러리에서 이미지를 선택하세요.</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!isInsufficientCredits && (
                    <button
                      onClick={() => { setGenerateError(null); setIsInsufficientCredits(false); handleGenerateCut(selectedCut); }}
                      className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-refresh-line text-[11px]" /> 재시도
                    </button>
                  )}
                  <button
                    onClick={() => { setGenerateError(null); setIsInsufficientCredits(false); }}
                    className={`cursor-pointer transition-colors ${
                      isInsufficientCredits ? 'text-amber-400 hover:text-amber-300' : 'text-red-400 hover:text-red-300'
                    }`}
                  >
                    <i className="ri-close-line text-sm" />
                  </button>
                </div>
              </div>
            )}

            {/* Image preview */}
            <div className="flex-1 flex items-center justify-center p-2 md:p-6">
              <div className="relative rounded-2xl overflow-hidden max-w-[560px] w-full">
                {current.image ? (
                  generatingCutId === current.id ? (
                    <div className="w-full h-[160px] md:h-[315px] bg-zinc-800 flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-zinc-400 text-sm font-semibold">AI 이미지 생성 중...</p>
                      <p className="text-zinc-600 text-xs">fal.ai {imageModel} · 최대 2분 소요</p>
                    </div>
                  ) : (
                    <>
                      <img src={current.image} alt="Selected cut" className="w-full h-[160px] md:h-[315px] object-cover object-top" />
                      <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">Cut {current.id}</div>
                      {selectedStyle && (
                        <div className={`absolute top-3 left-16 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${currentImageHasStyle ? 'bg-indigo-500/70' : 'bg-amber-500/70'}`}>
                          <i className={`text-[10px] ${currentImageHasStyle ? 'ri-palette-line' : 'ri-alert-line'}`} />
                          {currentImageHasStyle ? styleLabel : `${styleLabel} 미반영`}
                        </div>
                      )}
                      {current.optimized && (
                        <div className="absolute top-3 right-16 bg-emerald-500/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <i className="ri-sparkling-2-line text-[10px]" /> AI 최적화
                        </div>
                      )}
                      <div className="absolute top-3 right-3 flex gap-2">
                        {selectedStyle && !currentImageHasStyle && (
                          <button
                            onClick={() => handleGenerateCut(current.id)}
                            className="bg-amber-500/80 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap"
                          >
                            <i className="ri-palette-line text-xs" /> 스타일 적용 재생성
                          </button>
                        )}
                        {(!selectedStyle || currentImageHasStyle) && (
                          <button onClick={() => handleGenerateCut(current.id)} className="bg-black/60 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer transition-colors flex items-center gap-1 whitespace-nowrap">
                            <i className="ri-refresh-line text-xs" /> 재생성
                          </button>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3 flex gap-2">
                        <button onClick={() => setActiveModal('library')} className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                          <i className="ri-folder-line text-xs" /> 라이브러리
                        </button>
                        <button onClick={() => setActiveModal('upload')} className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                          <i className="ri-upload-line text-xs" /> 업로드
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center max-w-xs mx-auto py-6 md:py-0">
                    {generatingCutId === current.id ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                        <p className="text-zinc-400 text-sm font-semibold">AI 이미지 생성 중...</p>
                        <p className="text-zinc-600 text-xs">fal.ai {imageModel} · 최대 2분 소요</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                          <i className="ri-image-add-line text-zinc-500 text-2xl" />
                        </div>
                        <p className="text-zinc-500 text-sm">이미지를 생성하거나 업로드해 보세요.</p>
                        <div className="flex gap-3">
                          <button onClick={() => setActiveModal('library')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                            <i className="ri-folder-line" /> 라이브러리
                          </button>
                          <button onClick={() => setActiveModal('upload')} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                            <i className="ri-upload-line" /> 업로드
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prompt area */}
            <div className="flex-shrink-0 border-t border-white/5 px-3 md:px-6 py-2.5 md:py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <i className="ri-sparkling-2-line text-indigo-400 text-xs" />
                  <span className="text-xs font-semibold text-zinc-300">이미지 프롬프트</span>
                  {selectedStyle && (
                    <span className="text-[9px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-semibold">{styleLabel}</span>
                  )}
                  {current.optimized && (
                    <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                      <i className="ri-sparkling-2-line text-[8px]" /> AI 최적화됨
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowOptimizePanel(!showOptimizePanel)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  >
                    <i className="ri-magic-line text-xs" /> AI 최적화
                  </button>
                  <div className="w-px h-3 bg-zinc-700" />
                  <button onClick={handleAutoPrompt} className="text-xs text-zinc-400 hover:text-zinc-300 cursor-pointer flex items-center gap-1 whitespace-nowrap">
                    <i className="ri-refresh-line text-xs" /> 자동
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={current.prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="이미지 프롬프트를 입력하세요..."
                  className="flex-1 bg-zinc-900/60 border border-white/5 rounded-xl px-3 md:px-4 py-2 md:py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
                <button
                  onClick={() => handleGenerateCut(current.id)}
                  disabled={generatingCutId === current.id}
                  className="flex items-center gap-1 md:gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white font-bold text-sm px-3 md:px-4 py-2 md:py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  {generatingCutId === current.id ? <><i className="ri-loader-4-line animate-spin" /> 생성 중</> : <><i className="ri-image-add-line" /> 생성</>}
                </button>
              </div>
            </div>
          </div>

          {/* Optimize panel — desktop: side panel, mobile: bottom sheet */}
          {showOptimizePanel && (
            <>
              {/* Desktop side panel */}
              <div className="hidden md:flex w-[280px] flex-shrink-0 flex-col overflow-hidden border-l border-white/5">
                <PromptOptimizePanel
                  cutId={current.id}
                  styleId={selectedStyle}
                  keywords={selectedKeywords}
                  onApply={handleApplyOptimized}
                  onClose={() => setShowOptimizePanel(false)}
                />
              </div>
              {/* Mobile bottom sheet */}
              <div className="md:hidden fixed inset-0 z-50">
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowOptimizePanel(false)}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-[#0d0d0f] border-t border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col">
                  <PromptOptimizePanel
                    cutId={current.id}
                    styleId={selectedStyle}
                    keywords={selectedKeywords}
                    onApply={handleApplyOptimized}
                    onClose={() => setShowOptimizePanel(false)}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 border-t border-white/5 bg-[#0f0f11] px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium cursor-pointer transition-colors whitespace-nowrap">
          <i className="ri-arrow-left-line" />
          이전
        </button>
        <div className="flex items-center gap-2 md:gap-3">
          {/* 갤러리 저장 현황 */}
          {savedUrlsRef.current.size > 0 && user?.id && (
            <a
              href="/ai-create"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/15 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-image-line text-xs" />
              갤러리 {savedUrlsRef.current.size}개 저장됨
              <i className="ri-external-link-line text-[10px]" />
            </a>
          )}
          <span className="hidden sm:block text-xs text-zinc-500">
            {generatedCount === 0
              ? '이미지를 1개 이상 생성해주세요'
              : <span className="text-emerald-400 font-semibold">{generatedCount}/{cuts.length}컷 생성됨</span>
            }
          </span>
          {optimizedCount > 0 && (
            <span className="hidden sm:block text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
              {optimizedCount}개 AI 최적화
            </span>
          )}
          <button
            onClick={() => {
              if (generatedCount === 0) return;
              onNext(cuts.filter((c) => c.image !== null).map((c) => c.image as string), cuts);
            }}
            disabled={generatedCount === 0}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm px-4 md:px-6 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            다음
            <i className="ri-arrow-right-line" />
          </button>
        </div>
      </div>
    </div>
  );
}
