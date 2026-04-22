export interface WhatsNewItem {
  id: number;
  title: string;
  subtitle: string;
  videoSrc: string;
  badge: string;
  badgeColor: string;
  tag: string;
  isNew?: boolean;
  isHot?: boolean;
}

export const whatsNewItems: WhatsNewItem[] = [
  {
    id: 1,
    title: 'Seedance 2.0',
    subtitle: '업계 최고 수준의 영상 생성 모델. 자연스러운 움직임과 고해상도 출력.',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/landing-banners/whats_new/1774486521152.mp4',
    badge: 'NEW',
    badgeColor: 'bg-emerald-500',
    tag: '영상 생성',
    isNew: true,
    isHot: true,
  },
  {
    id: 2,
    title: 'Seedream 5.0 Lite',
    subtitle: '빠르고 가벼운 이미지 생성. 실시간 프리뷰로 즉각적인 결과 확인.',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/landing-banners/whats_new/1773718449063.mp4',
    badge: 'NEW',
    badgeColor: 'bg-indigo-500',
    tag: '이미지 생성',
    isNew: true,
  },
  {
    id: 3,
    title: 'Kling 3.0 Motion Control',
    subtitle: '사진 속 캐릭터를 영상에 맞춰서 자유롭게 움직이게 해보세요.',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/landing-banners/whats_new/1773723012936.mp4',
    badge: 'HOT',
    badgeColor: 'bg-rose-500',
    tag: '모션 컨트롤',
    isHot: true,
  },
  {
    id: 4,
    title: 'Kling 3.0',
    subtitle: '자연스러운 연기와 멀티컷으로 영화 같은 씬을 만들어보세요.',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/landing-banners/whats_new/1773725394969.mp4',
    badge: 'HOT',
    badgeColor: 'bg-rose-500',
    tag: '영상 생성',
    isHot: true,
  },
  {
    id: 5,
    title: 'Runway Aleph',
    subtitle: '영상 속 캐릭터나 배경을 원하는 대로 교체하는 혁신적인 편집 기능.',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/landing-banners/whats_new/1773724401046.mp4',
    badge: 'UPDATE',
    badgeColor: 'bg-amber-500',
    tag: '영상 편집',
  },
  {
    id: 6,
    title: 'Vidu Q3',
    subtitle: '멀티컷 기능으로 연속적이고 자연스러운 씬 전환을 구현해보세요.',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/landing-banners/whats_new/1773724778641.mp4',
    badge: 'UPDATE',
    badgeColor: 'bg-violet-500',
    tag: '멀티컷',
  },
  {
    id: 7,
    title: 'InfiniteTalk',
    subtitle: '캐릭터 이미지를 업로드하면 음성에 맞춰 자연스럽게 말하게 해드립니다.',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/landing-banners/whats_new/1773725286311.mp4',
    badge: 'NEW',
    badgeColor: 'bg-teal-500',
    tag: 'AI 립싱크',
    isNew: true,
  },
];
