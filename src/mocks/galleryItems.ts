export type GalleryItemType = 'image' | 'video';
export type GalleryItemSource = 'ai-create' | 'ai-ad' | 'ai-automation' | 'youtube-studio';

export interface GalleryItem {
  id: string;
  type: GalleryItemType;
  url: string;
  prompt: string;
  model: string;
  ratio: string;
  createdAt: string;
  liked: boolean;
  duration?: string;
  source?: GalleryItemSource;
}

export const galleryItems: GalleryItem[] = [
  {
    id: 'g1',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=futuristic%20neon%20cityscape%20at%20night%20with%20glowing%20yellow%20and%20orange%20lights%20reflecting%20on%20wet%20streets%2C%20cyberpunk%20aesthetic%2C%20dark%20moody%20atmosphere%2C%20ultra%20detailed%20digital%20art%2C%20cinematic%20composition&width=800&height=800&seq=gal1&orientation=squarish',
    prompt: '미래적인 네온 도시 야경, 빗물에 반사되는 불빛들, 사이버펑크 분위기',
    model: 'Nano Banana 2',
    ratio: '1K · 1:1 · PNG',
    createdAt: '2026-04-09T10:23:00Z',
    liked: true,
  },
  {
    id: 'g2',
    type: 'video',
    url: 'https://readdy.ai/api/search-image?query=abstract%20flowing%20liquid%20gold%20and%20silver%20metallic%20waves%20in%20motion%2C%20smooth%20curves%2C%20minimalist%20dark%20background%2C%20studio%20lighting%2C%20high%20resolution%203d%20render%2C%20elegant%20luxury&width=800&height=450&seq=gal2&orientation=landscape',
    prompt: '황금빛 액체 금속이 흐르는 추상적인 장면',
    model: 'Seedance 2.0',
    ratio: '1K · 16:9 · MP4',
    createdAt: '2026-04-09T10:18:00Z',
    liked: false,
    duration: '0:05',
  },
  {
    id: 'g3',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=ethereal%20magical%20forest%20with%20bioluminescent%20glowing%20plants%20and%20mushrooms%20in%20darkness%2C%20deep%20blue%20and%20teal%20tones%2C%20fantasy%20digital%20art%2C%20mystical%20atmosphere%2C%20soft%20light%20rays&width=800&height=1200&seq=gal3&orientation=portrait',
    prompt: '생물발광 식물이 빛나는 신비로운 숲, 판타지 분위기',
    model: 'Aurora V1 Pro',
    ratio: '1K · 2:3 · PNG',
    createdAt: '2026-04-09T10:05:00Z',
    liked: false,
  },
  {
    id: 'g4',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=minimalist%20Japanese%20zen%20garden%20with%20raked%20sand%20patterns%2C%20smooth%20stones%2C%20cherry%20blossom%20petals%20falling%2C%20soft%20morning%20light%2C%20peaceful%20serene%20atmosphere%2C%20high%20detail%20photography&width=800&height=800&seq=gal4&orientation=squarish',
    prompt: '일본 선 정원, 벚꽃 잎이 떨어지는 고요한 아침',
    model: 'FLUX 2',
    ratio: '1K · 1:1 · PNG',
    createdAt: '2026-04-09T09:55:00Z',
    liked: true,
  },
  {
    id: 'g5',
    type: 'video',
    url: 'https://readdy.ai/api/search-image?query=dramatic%20ocean%20waves%20crashing%20against%20rocky%20cliffs%20at%20sunset%2C%20golden%20hour%20light%2C%20spray%20and%20mist%2C%20powerful%20nature%20scene%2C%20cinematic%20wide%20angle%2C%20vivid%20warm%20colors&width=800&height=450&seq=gal5&orientation=landscape',
    prompt: '일몰 시 바위 절벽에 부딪히는 파도, 황금빛 시간대',
    model: 'Seedance 2.0',
    ratio: '1K · 16:9 · MP4',
    createdAt: '2026-04-09T09:40:00Z',
    liked: false,
    duration: '0:08',
  },
  {
    id: 'g6',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=surreal%20floating%20islands%20with%20waterfalls%20in%20the%20sky%2C%20lush%20green%20vegetation%2C%20dramatic%20clouds%2C%20fantasy%20landscape%2C%20epic%20scale%2C%20vibrant%20colors%2C%20digital%20painting%20style&width=800&height=800&seq=gal6&orientation=squarish',
    prompt: '하늘에 떠있는 섬들과 폭포, 판타지 풍경화',
    model: 'Nano Banana 2',
    ratio: '1K · 1:1 · PNG',
    createdAt: '2026-04-09T09:30:00Z',
    liked: true,
  },
  {
    id: 'g7',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=elegant%20woman%20portrait%20with%20dramatic%20studio%20lighting%2C%20high%20fashion%20editorial%20style%2C%20dark%20background%2C%20sharp%20details%2C%20professional%20photography%2C%20cinematic%20mood%2C%20warm%20skin%20tones&width=800&height=1200&seq=gal7&orientation=portrait',
    prompt: '드라마틱한 스튜디오 조명의 하이패션 인물 사진',
    model: 'Aurora V1 Pro',
    ratio: '1K · 2:3 · PNG',
    createdAt: '2026-04-09T09:15:00Z',
    liked: false,
  },
  {
    id: 'g8',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=macro%20photography%20of%20colorful%20tropical%20butterfly%20wings%20with%20intricate%20patterns%2C%20vivid%20orange%20and%20black%20colors%2C%20shallow%20depth%20of%20field%2C%20natural%20light%2C%20detailed%20texture&width=800&height=800&seq=gal8&orientation=squarish',
    prompt: '열대 나비 날개의 매크로 사진, 선명한 패턴과 색상',
    model: 'FLUX 2',
    ratio: '1K · 1:1 · PNG',
    createdAt: '2026-04-09T09:00:00Z',
    liked: false,
  },
  {
    id: 'g9',
    type: 'video',
    url: 'https://readdy.ai/api/search-image?query=time%20lapse%20of%20northern%20lights%20aurora%20borealis%20dancing%20over%20snowy%20mountain%20landscape%2C%20vivid%20green%20and%20purple%20colors%2C%20starry%20night%20sky%2C%20long%20exposure%20photography%20effect&width=800&height=450&seq=gal9&orientation=landscape',
    prompt: '눈 덮인 산 위에서 춤추는 오로라 타임랩스',
    model: 'Seedance 2.0',
    ratio: '1K · 16:9 · MP4',
    createdAt: '2026-04-08T22:10:00Z',
    liked: true,
    duration: '0:12',
  },
  {
    id: 'g10',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=ancient%20temple%20ruins%20covered%20in%20jungle%20vines%20and%20moss%2C%20golden%20sunlight%20filtering%20through%20trees%2C%20mysterious%20atmosphere%2C%20archaeological%20discovery%2C%20cinematic%20composition%2C%20warm%20tones&width=800&height=800&seq=gal10&orientation=squarish',
    prompt: '정글에 뒤덮인 고대 신전 유적, 황금빛 햇살',
    model: 'Nano Banana 2',
    ratio: '1K · 1:1 · PNG',
    createdAt: '2026-04-08T21:45:00Z',
    liked: false,
  },
  {
    id: 'g11',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=futuristic%20robot%20hand%20reaching%20toward%20human%20hand%20in%20dramatic%20lighting%2C%20symbolic%20connection%20between%20AI%20and%20humanity%2C%20dark%20background%2C%20cinematic%20composition%2C%20detailed%20metallic%20texture&width=800&height=800&seq=gal11&orientation=squarish',
    prompt: 'AI와 인간의 손이 맞닿는 상징적인 장면, 드라마틱한 조명',
    model: 'Aurora V1 Pro',
    ratio: '1K · 1:1 · PNG',
    createdAt: '2026-04-08T21:20:00Z',
    liked: true,
  },
  {
    id: 'g12',
    type: 'image',
    url: 'https://readdy.ai/api/search-image?query=abstract%20geometric%20art%20with%20interlocking%20hexagonal%20shapes%20in%20gradient%20colors%20from%20deep%20orange%20to%20bright%20yellow%2C%20modern%20design%2C%20clean%20background%2C%20digital%20art%2C%20vibrant%20and%20bold&width=800&height=800&seq=gal12&orientation=squarish',
    prompt: '육각형 기하학적 패턴, 오렌지에서 노란색으로 그라데이션',
    model: 'FLUX 2',
    ratio: '1K · 1:1 · PNG',
    createdAt: '2026-04-08T20:55:00Z',
    liked: false,
  },
];
