export interface VoiceProfile {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  desc: string;
  tag: string;
  color: string;
  bgColor: string;
  pitchOffset: number;
  rateOffset: number;
  sampleText: string;
  freq: number[];
}

export const voices: VoiceProfile[] = [
  {
    id: 'v1', name: '명수', gender: 'MALE', tag: '내레이션',
    desc: '수줍음 많은 소년처럼 꾸밈없고 순수한 목소리',
    color: 'bg-indigo-500', bgColor: '#6366f1',
    pitchOffset: 0.1, rateOffset: -0.05,
    sampleText: '안녕하세요. 저는 명수입니다. 꾸밈없고 순수한 목소리로 여러분께 이야기를 전해드릴게요.',
    freq: [0.4, 0.6, 0.5, 0.7, 0.4, 0.8, 0.5, 0.6, 0.7, 0.4, 0.6, 0.5, 0.8, 0.6, 0.5, 0.7, 0.4, 0.6, 0.5, 0.7],
  },
  {
    id: 'v2', name: '지수', gender: 'FEMALE', tag: '유튜브',
    desc: '밝고 친근한 에너지로 시청자를 사로잡는 목소리',
    color: 'bg-pink-500', bgColor: '#ec4899',
    pitchOffset: 0.3, rateOffset: 0.1,
    sampleText: '안녕하세요 여러분! 저는 지수예요. 오늘도 밝고 활기차게 함께해요!',
    freq: [0.7, 0.9, 0.6, 0.8, 0.9, 0.7, 1.0, 0.8, 0.6, 0.9, 0.7, 0.8, 0.6, 0.9, 0.7, 0.8, 0.9, 0.7, 0.8, 0.9],
  },
  {
    id: 'v3', name: '서연', gender: 'FEMALE', tag: '감성',
    desc: '따뜻하고 감성적인 나레이션에 최적화된 목소리',
    color: 'bg-purple-500', bgColor: '#a855f7',
    pitchOffset: 0.2, rateOffset: -0.1,
    sampleText: '안녕하세요. 저는 서연입니다. 따뜻하고 감성적인 이야기를 천천히 전해드릴게요.',
    freq: [0.5, 0.6, 0.7, 0.5, 0.6, 0.8, 0.6, 0.7, 0.5, 0.6, 0.7, 0.5, 0.6, 0.7, 0.6, 0.5, 0.7, 0.6, 0.5, 0.6],
  },
  {
    id: 'v4', name: '민준', gender: 'MALE', tag: '활기',
    desc: '활기차고 젊은 감성의 유튜브 특화 목소리',
    color: 'bg-emerald-500', bgColor: '#10b981',
    pitchOffset: 0.05, rateOffset: 0.15,
    sampleText: '안녕하세요! 민준입니다. 오늘 정말 흥미로운 내용을 가져왔어요. 같이 알아볼까요?',
    freq: [0.8, 0.6, 0.9, 0.7, 0.8, 0.6, 0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.7, 0.9, 0.8, 0.6, 0.9, 0.8, 0.7, 0.9],
  },
  {
    id: 'v5', name: '하은', gender: 'FEMALE', tag: '전문',
    desc: '차분하고 신뢰감 있는 전문 나레이터 목소리',
    color: 'bg-amber-500', bgColor: '#f59e0b',
    pitchOffset: 0.15, rateOffset: -0.15,
    sampleText: '안녕하세요. 저는 하은입니다. 신뢰감 있고 차분한 목소리로 정확한 정보를 전달해드리겠습니다.',
    freq: [0.4, 0.5, 0.4, 0.6, 0.5, 0.4, 0.6, 0.5, 0.4, 0.5, 0.6, 0.4, 0.5, 0.4, 0.5, 0.6, 0.4, 0.5, 0.6, 0.5],
  },
  {
    id: 'v6', name: '태민', gender: 'MALE', tag: '다큐',
    desc: '깊고 중후한 다큐멘터리 스타일 목소리',
    color: 'bg-cyan-500', bgColor: '#06b6d4',
    pitchOffset: -0.1, rateOffset: -0.2,
    sampleText: '안녕하세요. 태민입니다. 깊고 중후한 목소리로 여러분께 이야기를 전해드리겠습니다.',
    freq: [0.6, 0.5, 0.7, 0.5, 0.6, 0.5, 0.7, 0.6, 0.5, 0.7, 0.5, 0.6, 0.7, 0.5, 0.6, 0.7, 0.5, 0.6, 0.5, 0.7],
  },
];

export const DEFAULT_SCRIPT_CUTS = [
  { id: 'c1', label: '컷 1', text: '아직도 인공지능을 먼 미래라고 생각하시나요?' },
  { id: 'c2', label: '컷 2', text: '이미 우리 일상은 AI 시스템으로 굴러가고 있습니다.' },
  { id: 'c3', label: '컷 3', text: '아침에 확인하는 맞춤형 뉴스부터 최적의 출근길을 찾는 네비게이션까지 모두 AI의 작품입니다.' },
  { id: 'c4', label: '컷 4', text: '기업의 현대 시스템은 더욱 놀랍니다. 방대한 데이터를 실시간으로 분석해 소비자의 마음을 읽고,' },
  { id: 'c5', label: '컷 5', text: '스마트 팩토리는 불량률을 제로에 가깝게 낮추며 생산성을 극대화하죠.' },
  { id: 'c6', label: '컷 6', text: '단순한 자동화를 넘어 스스로 상황을 판단하고 최적의 결정을 내리는 지능형 네트워크가 바로 현대 시스템의 핵심입니다.' },
  { id: 'c7', label: '컷 7', text: '이제 인공지능은 선택이 아닌 생존을 위한 필수 인프라입니다.' },
];

export function parseScriptToCuts(script: string): Array<{ id: string; label: string; text: string }> {
  if (!script || !script.trim()) return DEFAULT_SCRIPT_CUTS;

  const lines = script
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return DEFAULT_SCRIPT_CUTS;

  const sentences: string[] = [];
  lines.forEach((line) => {
    const parts = line.split(/(?<=[.!?。！？])\s+/);
    parts.forEach((p) => {
      const trimmed = p.trim();
      if (trimmed.length > 0) sentences.push(trimmed);
    });
  });

  const MAX_CUTS = 12;
  const MIN_CUTS = 3;
  const raw = sentences.length > 0 ? sentences : lines;

  let cuts: string[] = raw;
  if (raw.length > MAX_CUTS) {
    const groupSize = Math.ceil(raw.length / MAX_CUTS);
    cuts = [];
    for (let i = 0; i < raw.length; i += groupSize) {
      cuts.push(raw.slice(i, i + groupSize).join(' '));
    }
  } else if (raw.length < MIN_CUTS && raw.length > 0) {
    cuts = [];
    raw.forEach((s) => {
      if (s.length > 80) {
        const mid = Math.floor(s.length / 2);
        const splitIdx = s.indexOf(' ', mid);
        if (splitIdx > 0) {
          cuts.push(s.slice(0, splitIdx).trim());
          cuts.push(s.slice(splitIdx).trim());
        } else {
          cuts.push(s);
        }
      } else {
        cuts.push(s);
      }
    });
  }

  return cuts
    .filter((t) => t.trim().length > 0)
    .map((text, i) => ({
      id: `c${i + 1}`,
      label: `컷 ${i + 1}`,
      text: text.trim(),
    }));
}
