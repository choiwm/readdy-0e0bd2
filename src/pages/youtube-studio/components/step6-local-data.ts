import type { SubtitleSegment } from './step6-modals-shared';

// ─── Step5 컷 타입 ────────────────────────────────────────────────────────────
export interface Step5CutData {
  id: number;
  start: number;
  end: number;
  text: string;
  thumb: string;
  videoUrl?: string;
  hasVideo: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
export const INITIAL_SUBTITLE_SEGMENTS: SubtitleSegment[] = [
  { id: 's1', text: '아직도 인공지능을 먼 미래라고 생각하시나요?', startTime: 0, endTime: 4.2, trackId: 'T1' },
  { id: 's2', text: '이미 우리 일상은 AI 시스템으로 굴러가고 있습니다.', startTime: 4.2, endTime: 9.5, trackId: 'T1' },
  { id: 's3', text: '아침에 확인하는 맞춤형 뉴스부터', startTime: 9.5, endTime: 13.0, trackId: 'T1' },
  { id: 's4', text: '최적의 출근길을 안내하는 내비게이션까지', startTime: 13.0, endTime: 17.8, trackId: 'T1' },
  { id: 's5', text: 'AI는 이미 당신의 일상 깊숙이 들어와 있습니다.', startTime: 17.8, endTime: 23.0, trackId: 'T1' },
  { id: 's6', text: '그렇다면 우리는 어떻게 준비해야 할까요?', startTime: 23.0, endTime: 27.5, trackId: 'T1' },
  { id: 's7', text: '지금 바로 AI 시대를 살아가는 법을 알아봅시다.', startTime: 27.5, endTime: 33.0, trackId: 'T1' },
  { id: 's8', text: '함께 미래를 준비하는 첫 걸음을 내딛어 보세요.', startTime: 33.0, endTime: 38.0, trackId: 'T1' },
];

// ─── step5Cuts 기반 자막 세그먼트 생성 헬퍼 ──────────────────────────────────
export function buildSubtitleSegmentsFromCuts(cuts: Step5CutData[]): SubtitleSegment[] {
  if (cuts.length === 0) return INITIAL_SUBTITLE_SEGMENTS;
  return cuts.map((c, i) => ({
    id: `s${i + 1}`,
    text: c.text.replace(/\n/g, ' ').trim() || `컷 ${c.id} 자막`,
    startTime: c.start,
    endTime: c.end,
    trackId: 'T1',
  }));
}

export const OTHER_TRACKS = [
  {
    id: 'V1', label: 'Visuals', color: 'bg-indigo-500/80',
    segments: [
      { text: '아직도 인공지능을 먼 미래라고 생각하시나요? 이미 우리', w: 28 },
      { text: '아침에 확인하는 맞춤형 뉴스부터 최적의 출근길을...', w: 22 },
    ],
  },
  {
    id: 'A1', label: 'Audio', color: 'bg-emerald-500/80',
    segments: [{ text: 'Background Audio ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~', w: 100 }],
  },
  {
    id: 'M1', label: 'Music', color: 'bg-amber-500/60',
    segments: [{ text: '+ BGM 추가', w: 100, empty: true }],
  },
];

export const SUBTITLE_TEMPLATES = [
  { id: 'clean', name: '클린', desc: '심플한 흰색 텍스트', category: '기본', preview: { bg: 'transparent', text: '#ffffff', shadow: true, border: false, blur: false, fontSize: 16, fontWeight: 'bold', padding: '6px 14px', borderRadius: 6 } },
  { id: 'dark-box', name: '다크 박스', desc: '반투명 검정 배경', category: '기본', preview: { bg: 'rgba(0,0,0,0.72)', text: '#ffffff', shadow: false, border: false, blur: false, fontSize: 15, fontWeight: 'bold', padding: '6px 16px', borderRadius: 8 } },
  { id: 'neon', name: '네온', desc: '형광 노란 강조', category: '스타일', preview: { bg: 'rgba(0,0,0,0.6)', text: '#ffe600', shadow: true, border: true, borderColor: '#ffe600', blur: false, fontSize: 15, fontWeight: 'bold', padding: '5px 14px', borderRadius: 6 } },
  { id: 'blur-glass', name: '글래스', desc: '블러 유리 효과', category: '스타일', preview: { bg: 'rgba(255,255,255,0.12)', text: '#ffffff', shadow: false, border: true, borderColor: 'rgba(255,255,255,0.25)', blur: true, fontSize: 15, fontWeight: '600', padding: '6px 16px', borderRadius: 12 } },
  { id: 'gradient', name: '그라디언트', desc: '컬러 그라디언트 배경', category: '스타일', preview: { bg: 'linear-gradient(90deg,rgba(99,102,241,0.85),rgba(168,85,247,0.85))', text: '#ffffff', shadow: false, border: false, blur: false, fontSize: 15, fontWeight: 'bold', padding: '6px 18px', borderRadius: 20 } },
  { id: 'outline', name: '아웃라인', desc: '텍스트 외곽선만', category: '기본', preview: { bg: 'transparent', text: '#ffffff', shadow: false, border: false, blur: false, fontSize: 16, fontWeight: '900', padding: '4px 12px', borderRadius: 4, stroke: true } },
  { id: 'red-bold', name: '레드 볼드', desc: '강렬한 빨간 배경', category: '강조', preview: { bg: 'rgba(220,38,38,0.85)', text: '#ffffff', shadow: false, border: false, blur: false, fontSize: 15, fontWeight: 'bold', padding: '6px 16px', borderRadius: 8 } },
  { id: 'white-box', name: '화이트 박스', desc: '흰 배경 검정 텍스트', category: '강조', preview: { bg: 'rgba(255,255,255,0.92)', text: '#111111', shadow: false, border: false, blur: false, fontSize: 15, fontWeight: 'bold', padding: '6px 16px', borderRadius: 8 } },
  { id: 'pill', name: '필 태그', desc: '둥근 알약 모양', category: '강조', preview: { bg: 'rgba(0,0,0,0.75)', text: '#ffffff', shadow: false, border: true, borderColor: 'rgba(255,255,255,0.3)', blur: false, fontSize: 14, fontWeight: '600', padding: '5px 20px', borderRadius: 999 } },
];

export const FONT_OPTIONS = ['Pretendard', 'Noto Sans KR', 'Nanum Gothic', 'Black Han Sans', 'Nanum Myeongjo'];
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

export interface SubtitleStyle {
  templateId: string;
  font: string;
  fontSize: number;
  fontWeight: string;
  color: string;
  opacity: number;
  shadow: boolean;
  shadowColor: string;
  bgColor: string;
  bgOpacity: number;
  bgBlur: boolean;
  bgBorderRadius: number;
  borderEnabled: boolean;
  borderColor: string;
  paddingX: number;
  paddingY: number;
}

export const DEFAULT_STYLE: SubtitleStyle = {
  templateId: 'dark-box', font: 'Pretendard', fontSize: 16, fontWeight: 'bold',
  color: '#ffffff', opacity: 100, shadow: false, shadowColor: '#000000',
  bgColor: '#000000', bgOpacity: 72, bgBlur: false, bgBorderRadius: 8,
  borderEnabled: false, borderColor: '#ffffff', paddingX: 16, paddingY: 6,
};
