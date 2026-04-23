export interface VideoCut {
  id: number;
  start: number;
  end: number;
  text: string;
  thumb: string;
  thumbPrompt: string;
  videoPrompt: string;
  hasVideo: boolean;
  videoUrl?: string;
}

export const initialCuts: VideoCut[] = [
  {
    id: 1, start: 0.0, end: 5.9,
    text: '아직도 인공지능을 먼 미래라고 생각하시나요?\n이미 우리 일상은 AI 시스템으로 굴러가고 있습니다.',
    thumb: 'https://readdy.ai/api/search-image?query=busy%20modern%20city%20street%20morning%20people%20checking%20smartphones%20digital%20billboards%20news%20updates%20cinematic%20wide%20shot&width=640&height=360&seq=vcut1&orientation=landscape',
    thumbPrompt: 'Wide shot. A busy modern city ...',
    videoPrompt: 'Wide shot. A busy modern city street in the morning, with people checking their smartphones while walking, surrounded by digital billboards displaying news updates.',
    hasVideo: false,
  },
  {
    id: 2, start: 5.9, end: 12.2,
    text: '아침에 확인하는 맞춤형 뉴스부터 최적의 출근길을\n찾는 네비게이션까지 모두 AI의 작품입니다.',
    thumb: 'https://readdy.ai/api/search-image?query=inside%20car%20person%20using%20navigation%20app%20on%20dashboard%20smart%20phone%20morning%20commute%20AI%20technology%20futuristic&width=640&height=360&seq=vcut2&orientation=landscape',
    thumbPrompt: 'Medium shot. Inside a car, a pe...',
    videoPrompt: 'Medium shot. Inside a car, a person uses AI-powered navigation on their dashboard while commuting through city streets in the morning light.',
    hasVideo: false,
  },
  {
    id: 3, start: 12.2, end: 22.0,
    text: '기업의 현대 시스템은 더욱 놀랍니다.\n방대한 데이터를 실시간으로 분석해 소비자의 마음을 읽고,\n스마트 팩토리는 불량률을 제로에 가깝게 낮추며 생산성을 극대화하죠.',
    thumb: 'https://readdy.ai/api/search-image?query=person%20working%20at%20multiple%20computer%20screens%20data%20analytics%20dashboard%20office%20modern%20technology%20holographic&width=640&height=360&seq=vcut3&orientation=landscape',
    thumbPrompt: 'Close-up. A person working at ...',
    videoPrompt: 'Close-up. A person working at multiple monitors displaying real-time data analytics dashboards, with holographic data visualizations floating around the workspace.',
    hasVideo: false,
  },
  {
    id: 4, start: 22.0, end: 28.6,
    text: '단순한 자동화를 넘어 스스로 상황을 판단하고\n최적의 결정을 내리는 지능형 네트워크가\n바로 현대 시스템의 핵심입니다.',
    thumb: 'https://readdy.ai/api/search-image?query=bird%20eye%20view%20bustling%20smart%20city%20autonomous%20vehicles%20flowing%20traffic%20AI%20controlled%20infrastructure%20dusk&width=640&height=360&seq=vcut4&orientation=landscape',
    thumbPrompt: "Bird's eye view. A bustling smar...",
    videoPrompt: "Bird's eye view of a bustling smart city with autonomous vehicles flowing seamlessly through AI-controlled traffic systems at dusk.",
    hasVideo: false,
  },
  {
    id: 5, start: 28.6, end: 32.3,
    text: '이제 인공지능은 선택이 아닌 생존을 위한 필수 인프라입니다.',
    thumb: 'https://readdy.ai/api/search-image?query=low%20angle%20high%20tech%20server%20room%20glowing%20blue%20lights%20AI%20infrastructure%20data%20center%20futuristic%20dark&width=640&height=360&seq=vcut5&orientation=landscape',
    thumbPrompt: 'Low angle shot. A high-tech se...',
    videoPrompt: 'Low angle shot of a high-tech server room with glowing blue lights and rows of AI infrastructure, representing the essential backbone of modern technology.',
    hasVideo: false,
  },
  {
    id: 6, start: 32.3, end: 38.6,
    text: '세상을 움직이는 보이지 않는 힘,\n인공지능.\n지금 바로 여러분의 삶과 비즈니스에 혁신을 도입해 보세요.',
    thumb: 'https://readdy.ai/api/search-image?query=dynamic%20business%20innovation%20diverse%20team%20celebrating%20success%20AI%20technology%20transformation%20bright%20energetic%20hologram&width=640&height=360&seq=vcut6&orientation=landscape',
    thumbPrompt: 'Wide shot. A dynamic business...',
    videoPrompt: 'Wide shot. A dynamic business team celebrating innovation success surrounded by holographic AI interfaces, representing the transformative power of artificial intelligence.',
    hasVideo: false,
  },
];

export const libraryVideos = [
  { id: 'lv1', url: 'https://readdy.ai/api/search-image?query=abstract%20technology%20digital%20network%20glowing%20lines%20dark%20background%20futuristic%20concept%20cinematic&width=160&height=90&seq=lv1&orientation=landscape', label: '테크 네트워크' },
  { id: 'lv2', url: 'https://readdy.ai/api/search-image?query=artificial%20intelligence%20robot%20humanoid%20face%20close%20up%20dramatic%20lighting%20dark%20background%20cinematic&width=160&height=90&seq=lv2&orientation=landscape', label: 'AI 로봇' },
  { id: 'lv3', url: 'https://readdy.ai/api/search-image?query=data%20center%20server%20room%20blue%20lights%20rows%20of%20servers%20technology%20infrastructure%20cinematic&width=160&height=90&seq=lv3&orientation=landscape', label: '데이터 센터' },
  { id: 'lv4', url: 'https://readdy.ai/api/search-image?query=business%20team%20meeting%20modern%20office%20technology%20startup%20collaboration%20cinematic&width=160&height=90&seq=lv4&orientation=landscape', label: '비즈니스 팀' },
  { id: 'lv5', url: 'https://readdy.ai/api/search-image?query=smart%20city%20aerial%20view%20night%20lights%20urban%20technology%20future%20concept%20cinematic&width=160&height=90&seq=lv5&orientation=landscape', label: '스마트 시티' },
  { id: 'lv6', url: 'https://readdy.ai/api/search-image?query=medical%20AI%20technology%20doctor%20analyzing%20data%20holographic%20display%20hospital%20cinematic&width=160&height=90&seq=lv6&orientation=landscape', label: '의료 AI' },
  { id: 'lv7', url: 'https://readdy.ai/api/search-image?query=financial%20technology%20stock%20market%20data%20visualization%20trading%20screen%20cinematic&width=160&height=90&seq=lv7&orientation=landscape', label: '핀테크' },
  { id: 'lv8', url: 'https://readdy.ai/api/search-image?query=autonomous%20self%20driving%20car%20interior%20dashboard%20technology%20future%20transportation%20cinematic&width=160&height=90&seq=lv8&orientation=landscape', label: '자율주행' },
  { id: 'lv9', url: 'https://readdy.ai/api/search-image?query=cloud%20computing%20abstract%20concept%20data%20storage%20network%20sky%20technology%20cinematic&width=160&height=90&seq=lv9&orientation=landscape', label: '클라우드' },
  { id: 'lv10', url: 'https://readdy.ai/api/search-image?query=cybersecurity%20digital%20shield%20protection%20network%20security%20concept%20dark%20cinematic&width=160&height=90&seq=lv10&orientation=landscape', label: '사이버보안' },
  { id: 'lv11', url: 'https://readdy.ai/api/search-image?query=blockchain%20cryptocurrency%20digital%20currency%20network%20nodes%20glowing%20concept%20cinematic&width=160&height=90&seq=lv11&orientation=landscape', label: '블록체인' },
  { id: 'lv12', url: 'https://readdy.ai/api/search-image?query=education%20technology%20student%20learning%20digital%20tablet%20classroom%20modern%20cinematic&width=160&height=90&seq=lv12&orientation=landscape', label: '에듀테크' },
];

export const durationColor = (d: number) => {
  if (d < 5) return 'bg-red-500';
  if (d < 7) return 'bg-orange-500';
  return 'bg-emerald-600';
};

export interface VideoError {
  message: string;
  isInsufficientCredits: boolean;
  required?: number;
  available?: number;
}

// ── fal.ai 에러 파싱 ──────────────────────────────────────────────────────
export function parseVideoError(raw: string): VideoError {
  if (raw.includes('insufficient_credits') || raw.includes('크레딧이 부족')) {
    const reqMatch = raw.match(/필요:\s*(\d+)/);
    const avlMatch = raw.match(/보유:\s*(\d+)/);
    return {
      message: raw,
      isInsufficientCredits: true,
      required: reqMatch ? parseInt(reqMatch[1]) : undefined,
      available: avlMatch ? parseInt(avlMatch[1]) : undefined,
    };
  }
  if (raw.includes('FAL_KEY') || raw.includes('API 키가 설정되지 않았습니다')) {
    return { message: 'fal.ai API 키가 설정되지 않았습니다. 관리자 페이지에서 fal.ai API 키를 등록해주세요.', isInsufficientCredits: false };
  }
  if (raw.includes('401') || raw.includes('Unauthorized')) {
    return { message: 'fal.ai 인증 실패: API 키를 확인해주세요.', isInsufficientCredits: false };
  }
  if (raw.includes('timeout') || raw.includes('504')) {
    return { message: '영상 생성 시간이 초과되었습니다 (5분). 다시 시도해주세요.', isInsufficientCredits: false };
  }
  if (raw && raw !== 'Edge Function returned a non-2xx status code') {
    return { message: raw, isInsufficientCredits: false };
  }
  return { message: '영상 생성 중 오류가 발생했습니다.', isInsufficientCredits: false };
}
