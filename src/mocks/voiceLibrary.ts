export type VoiceGender = 'MALE' | 'FEMALE' | 'NEUTRAL';

export interface Voice {
  id: string | number;
  name: string;
  lang: string;
  gender: VoiceGender;
  accent: string;
  type: string;
  desc: string;
  tags: string[];
  avatar: string;
  sampleUrl?: string;
}

// ElevenLabs 공개 샘플 오디오 URL (실제 재생 가능)
const EL_BASE = 'https://storage.googleapis.com/eleven-public-prod/premade/voices';

export const voices: Voice[] = [
  {
    id: 1, name: 'Amelia', lang: 'ENGLISH', gender: 'FEMALE', accent: 'british', type: 'GENERAL',
    desc: "A young British English woman's voice, clear and easy to understand. Expressive and enthusiastic, it's beautiful for narration, podcasts and social media such as YouTube, Tiktok, Reels and Stories.",
    tags: ['#clear', '#young', '#enthusiastic'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Amelia&size=96',
    sampleUrl: `${EL_BASE}/9BWtsMINqrJLrRacOk9x/aria.mp3`,
  },
  {
    id: 2, name: 'Amrut', lang: 'ENGLISH', gender: 'MALE', accent: 'Indian', type: 'GENERAL',
    desc: 'Booklet Guy - Amrut Deshmukh is an influencer and co-founder of the Booklet app. His voice has an energetic, typical Indian English accent.',
    tags: ['#Raw', '#Gritty', '#Vibrant'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Amrut&size=96',
    sampleUrl: `${EL_BASE}/TxGEqnHWrfWFTfGW9XjX/josh.mp3`,
  },
  {
    id: 3, name: 'Andrew', lang: 'ENGLISH', gender: 'MALE', accent: '', type: 'GENERAL',
    desc: "A deep and unique South African voice from a brilliant 40's man. A very easy listening and calming voice. Andrew's tone is warm and easy to understand.",
    tags: ['#smooth', '#deep', '#Resonant'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Andrew&size=96',
    sampleUrl: `${EL_BASE}/VR6AewLTigWG4xSOukaG/arnold.mp3`,
  },
  {
    id: 4, name: 'Antonio', lang: 'ENGLISH', gender: 'MALE', accent: 'Italian', type: 'GENERAL',
    desc: 'English with Subtle Italian Accent - A young adult English voice with an Italian accent, slightly nasal, lively, and versatile.',
    tags: ['#Authoritative', '#Confident', '#Sharp'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Antonio&size=96',
    sampleUrl: `${EL_BASE}/ErXwobaYiN019PkySvjV/Antoni.mp3`,
  },
  {
    id: 5, name: 'Aria', lang: 'ENGLISH', gender: 'FEMALE', accent: '', type: 'GENERAL',
    desc: "Children's book narration - A kind and soft voice for children's books or anything related to children's content. British English female narrator.",
    tags: ['#Warm', '#Empathetic', "#Children's book narration"],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria&size=96',
    sampleUrl: `${EL_BASE}/9BWtsMINqrJLrRacOk9x/aria.mp3`,
  },
  {
    id: 6, name: 'Chris', lang: 'ENGLISH', gender: 'MALE', accent: '', type: 'GENERAL',
    desc: 'Father Christmas - magical storyteller, older British English male. A festive Father Christmas sounding old age character with hints of nature documentary narrator.',
    tags: ['#storyteller', '#old man', '#santa'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Chris&size=96',
    sampleUrl: `${EL_BASE}/IKne3meq5aSn9XLyUdCD/charlie.mp3`,
  },
  {
    id: 7, name: 'Ivanna', lang: 'ENGLISH', gender: 'FEMALE', accent: 'American', type: 'GENERAL',
    desc: 'A dynamic and versatile voice, perfect for bringing your projects to life. With a youthful, fresh tone and a natural delivery, this voice captivates audiences effortlessly.',
    tags: ['#Young', '#Casual', '#lively'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Ivanna&size=96',
    sampleUrl: `${EL_BASE}/EXAVITQu4vr4xnSDxMaL/bella.mp3`,
  },
  {
    id: 8, name: 'Jefferson', lang: 'ENGLISH', gender: 'MALE', accent: 'british', type: 'GENERAL',
    desc: '부드럽게 말하면서도 자신감 넘치고 명확하며 유익한 영어 억양의 목소리. 과학, 자연, 역사 또는 모든 서사적 스토리텔링이나 서술적 다큐멘터리 목소리에 적합.',
    tags: ['#Clear', '#Polished', '#Trustworthy', '#Neutral'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jefferson%20English&size=96',
    sampleUrl: `${EL_BASE}/GBv7mTt0atIp3Br8iCZE/thomas.mp3`,
  },
  {
    id: 9, name: 'Peter', lang: 'ENGLISH', gender: 'MALE', accent: 'british', type: 'GENERAL',
    desc: 'Peter has a rich, clear, English RP accent. He specialises in clarity of expression, so his voice is perfect for a wide variety of projects.',
    tags: ['#Intellectual', '#Calm', '#Articulate'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Peter&size=96',
    sampleUrl: `${EL_BASE}/ODq5zmih8GrVes37Dizd/patrick.mp3`,
  },
  {
    id: 10, name: 'Steven', lang: 'ENGLISH', gender: 'MALE', accent: '', type: 'GENERAL',
    desc: 'Conversational AI - A smooth American English casual tone, perfect for conversation, podcasts, and more.',
    tags: ['#Clear', '#Polished', '#Trustworthy'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Steven&size=96',
    sampleUrl: `${EL_BASE}/yoZ06aMxZJJ28mfd3POQ/sam.mp3`,
  },
  {
    id: 11, name: 'Tim', lang: 'ENGLISH', gender: 'MALE', accent: 'british', type: 'GENERAL',
    desc: 'An intellectual, calm, and logical teaching style. 지적이고 차분하며 논리적인 느낌을 주는 교수 스타일.',
    tags: ['#Intellectual', '#Calm', '#Articulate', '#Dry'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Tim&size=96',
    sampleUrl: `${EL_BASE}/pNInz6obpgDQGcFmaJgB/adam.mp3`,
  },
  {
    id: 12, name: 'Tripti', lang: 'ENGLISH', gender: 'FEMALE', accent: 'Indian', type: 'GENERAL',
    desc: 'Calm, Experienced Voice for English AI Bots & Agents - A warm, professional voice designed for AI agents, IVRs, and customer support.',
    tags: ['#Calm', '#Experienced', '#professional'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Tripti&size=96',
    sampleUrl: `${EL_BASE}/MF3mGyEYCl7XYWbV9V6O/elli.mp3`,
  },
  {
    id: 13, name: '가란', lang: 'KOREAN', gender: 'MALE', accent: '', type: 'GENERAL',
    desc: '전장을 누비며 목소리마저 굳어버린 노련한 퇴역 장군.',
    tags: ['#거친', '#묵직한', '#연륜있는'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=가란&size=96',
    sampleUrl: `${EL_BASE}/VR6AewLTigWG4xSOukaG/arnold.mp3`,
  },
  {
    id: 14, name: '가야', lang: 'KOREAN', gender: 'FEMALE', accent: '', type: 'GENERAL',
    desc: '대지의 생명력을 관장하며 숲을 수호하는 거대한 자연의 여신.',
    tags: ['#장엄한', '#따뜻한', '#신비로운'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=가야&size=96',
    sampleUrl: `${EL_BASE}/EXAVITQu4vr4xnSDxMaL/bella.mp3`,
  },
  {
    id: 15, name: '강나영', lang: 'KOREAN', gender: 'FEMALE', accent: '', type: 'GENERAL',
    desc: '범죄자들을 때려잡는 거칠고 터프한 베테랑 강력계 여형사.',
    tags: ['#터프한', '#거친', '#위협적인'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=강나영&size=96',
    sampleUrl: `${EL_BASE}/jsCqWAovK2LkecY7zXl4/clyde.mp3`,
  },
  {
    id: 16, name: '강철', lang: 'KOREAN', gender: 'MALE', accent: '', type: 'GENERAL',
    desc: '신체의 절반을 기계로 개조한 냉혹한 사이버네틱 용병.',
    tags: ['#기계적인', '#묵직한', '#파괴적인'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=강철&size=96',
    sampleUrl: `${EL_BASE}/TxGEqnHWrfWFTfGW9XjX/josh.mp3`,
  },
  {
    id: 17, name: '건호', lang: 'KOREAN', gender: 'MALE', accent: '', type: 'GENERAL',
    desc: '깊이 있고 담백한 중저음 내레이터.',
    tags: ['#다큐멘터리', '#인문학'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=건호&size=96',
    sampleUrl: `${EL_BASE}/GBv7mTt0atIp3Br8iCZE/thomas.mp3`,
  },
  {
    id: 18, name: '기희', lang: 'KOREAN', gender: 'FEMALE', accent: '', type: 'GENERAL',
    desc: '럭셔리 & 프리미엄 성우 목소리.',
    tags: ['#잔잔한', '#라디오 성우', '#동화책'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=기희&size=96',
    sampleUrl: `${EL_BASE}/9BWtsMINqrJLrRacOk9x/aria.mp3`,
  },
  {
    id: 19, name: '나래', lang: 'KOREAN', gender: 'FEMALE', accent: '', type: 'GENERAL',
    desc: '나른한 오후, 방 안에서 일기를 쓰듯 읊조리는 감성적인 소녀.',
    tags: ['#감성', '#공기섞임', '#나른함'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=나래&size=96',
    sampleUrl: `${EL_BASE}/MF3mGyEYCl7XYWbV9V6O/elli.mp3`,
  },
  {
    id: 20, name: '다희', lang: 'KOREAN', gender: 'FEMALE', accent: '', type: 'GENERAL',
    desc: '화려한 조명 아래서 슬픈 사랑을 노래하는 재즈 바의 디바.',
    tags: ['#매혹적인', '#허스키한', '#감성적인'],
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=다희&size=96',
    sampleUrl: `${EL_BASE}/EXAVITQu4vr4xnSDxMaL/bella.mp3`,
  },
];
