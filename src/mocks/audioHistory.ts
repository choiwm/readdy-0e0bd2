export type AudioStatus = 'completed' | 'generating' | 'failed';
export type AudioType = 'tts' | 'clone' | 'effect' | 'music';

export interface AudioHistoryItem {
  id: string;
  title: string;
  text: string;
  voiceName: string;
  voiceAvatar: string;
  duration: number;
  status: AudioStatus;
  type: AudioType;
  createdAt: string;
  fileSize: string;
  lang: string;
  liked: boolean;
  progress?: number;
}

export const audioHistory: AudioHistoryItem[] = [
  {
    id: 'a1',
    title: '제품 소개 나레이션',
    text: '안녕하세요, AiMetaWOW의 새로운 기능을 소개합니다. 이번 업데이트에서는 더욱 자연스러운 음성 합성 기술이 탑재되었습니다.',
    voiceName: 'Ji-yeon',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=professional%20Korean%20female%20voice%20talent%20portrait%2C%20clean%20studio%20background%2C%20confident%20friendly%20expression%2C%20high%20quality%20headshot&width=48&height=48&seq=vh1&orientation=squarish',
    duration: 12,
    status: 'completed',
    type: 'tts',
    createdAt: '2026-04-09T14:20:00Z',
    fileSize: '1.2MB',
    lang: 'Korean',
    liked: true,
  },
  {
    id: 'a2',
    title: 'YouTube 인트로 멘트',
    text: 'Welcome back to our channel! Today we\'re going to explore the most exciting AI tools of 2026.',
    voiceName: 'James',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=professional%20American%20male%20voice%20actor%20portrait%2C%20clean%20studio%20background%2C%20warm%20friendly%20smile%2C%20broadcast%20quality%20headshot&width=48&height=48&seq=vh2&orientation=squarish',
    duration: 8,
    status: 'completed',
    type: 'tts',
    createdAt: '2026-04-09T12:05:00Z',
    fileSize: '0.8MB',
    lang: 'English',
    liked: false,
  },
  {
    id: 'a3',
    title: '광고 보이스오버',
    text: '지금 바로 시작하세요! 한정 기간 50% 할인 이벤트가 진행 중입니다. 놓치지 마세요.',
    voiceName: 'Min-jun',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=professional%20Korean%20male%20voice%20talent%20headshot%2C%20dark%20background%2C%20energetic%20expression%2C%20commercial%20advertisement%20style&width=48&height=48&seq=vh3&orientation=squarish',
    duration: 6,
    status: 'completed',
    type: 'tts',
    createdAt: '2026-04-08T18:33:00Z',
    fileSize: '0.6MB',
    lang: 'Korean',
    liked: true,
  },
  {
    id: 'a4',
    title: '팟캐스트 오프닝',
    text: 'こんにちは！今日のポッドキャストへようこそ。AIと未来の技術について深く掘り下げていきましょう。',
    voiceName: 'Yuki',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=professional%20Japanese%20female%20voice%20talent%20portrait%2C%20clean%20white%20background%2C%20professional%20podcast%20host%20style%2C%20clear%20sharp%20headshot&width=48&height=48&seq=vh4&orientation=squarish',
    duration: 15,
    status: 'completed',
    type: 'tts',
    createdAt: '2026-04-08T09:15:00Z',
    fileSize: '1.5MB',
    lang: 'Japanese',
    liked: false,
  },
  {
    id: 'a5',
    title: '내 목소리 클론 테스트',
    text: '이것은 AI가 복제한 제 목소리입니다. 매우 자연스럽게 들리죠?',
    voiceName: 'My Voice Clone',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=abstract%20sound%20wave%20visualization%20with%20glowing%20teal%20color%20on%20dark%20background%2C%20audio%20waveform%20digital%20art&width=48&height=48&seq=vh5&orientation=squarish',
    duration: 5,
    status: 'generating',
    progress: 78,
    type: 'clone',
    createdAt: '2026-04-09T15:00:00Z',
    fileSize: '-',
    lang: 'Korean',
    liked: false,
  },
  {
    id: 'a6',
    title: '교육 콘텐츠 내레이션',
    text: 'In this lesson, we will cover the fundamentals of machine learning. By the end, you\'ll understand supervised and unsupervised learning.',
    voiceName: 'Sarah',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=professional%20American%20female%20educator%20voice%20talent%20portrait%2C%20approachable%20teacher%20expression%2C%20clean%20academic%20background&width=48&height=48&seq=vh6&orientation=squarish',
    duration: 20,
    status: 'completed',
    type: 'tts',
    createdAt: '2026-04-07T14:40:00Z',
    fileSize: '2.0MB',
    lang: 'English',
    liked: true,
  },
  {
    id: 'a7',
    title: '뉴스 리딩 스타일',
    text: '오늘 오후 3시 기준으로 코스피는 전일 대비 1.2% 상승한 2,847포인트를 기록했습니다.',
    voiceName: 'Su-bin',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=Korean%20female%20news%20anchor%20voice%20talent%20portrait%2C%20professional%20broadcaster%20look%2C%20studio%20lighting%2C%20authoritative%20expression&width=48&height=48&seq=vh7&orientation=squarish',
    duration: 9,
    status: 'failed',
    type: 'tts',
    createdAt: '2026-04-07T11:00:00Z',
    fileSize: '-',
    lang: 'Korean',
    liked: false,
  },
  {
    id: 'a8',
    title: '명상 가이드 음성',
    text: '눈을 감고 천천히 숨을 들이쉬세요. 몸의 긴장을 내려놓고, 이 순간에 집중하세요. 평화롭고 고요한 상태로...',
    voiceName: 'Hana',
    voiceAvatar: 'https://readdy.ai/api/search-image?query=calm%20soothing%20Korean%20female%20voice%20talent%20portrait%2C%20gentle%20expression%2C%20soft%20studio%20lighting%2C%20meditation%20guide%20style&width=48&height=48&seq=vh8&orientation=squarish',
    duration: 30,
    status: 'completed',
    type: 'tts',
    createdAt: '2026-04-06T20:00:00Z',
    fileSize: '2.9MB',
    lang: 'Korean',
    liked: true,
  },
];
