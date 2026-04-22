export interface StoryboardShot {
  id: number;
  index: number;
  imageUrl: string;
  direction: string;
  dialogue: string;
  duration: string;
}

export interface StoryboardProject {
  id: string;
  title: string;
  scenario: string;
  shotCount: number;
  resolution: string;
  createdAt: string;
  status: 'done' | 'generating';
  shots: StoryboardShot[];
}

export const storyboardProjects: StoryboardProject[] = [
  {
    id: 'sb-001',
    title: '새벽 카페 바리스타',
    scenario: '새벽 카페에서 바리스타가 첫 손님을 맞이하며 하루를 시작하는 이야기.',
    shotCount: 10,
    resolution: '1280×720 (16:9)',
    createdAt: '2026.04.08',
    status: 'done',
    shots: [
      {
        id: 1, index: 1,
        imageUrl: 'https://readdy.ai/api/search-image?query=empty%20cafe%20interior%20at%20dawn%2C%20warm%20amber%20lighting%2C%20wooden%20tables%20and%20chairs%2C%20coffee%20machine%20on%20counter%2C%20soft%20morning%20light%20through%20windows%2C%20cinematic%20photography&width=320&height=180&seq=sb1s1&orientation=landscape',
        direction: '와이드샷 — 새벽 카페 전경. 아직 손님이 없는 조용한 공간.',
        dialogue: '(내레이션) 하루가 시작되기 전, 이 공간은 오롯이 나의 것이다.',
        duration: '4s',
      },
      {
        id: 2, index: 2,
        imageUrl: 'https://readdy.ai/api/search-image?query=barista%20hands%20grinding%20coffee%20beans%20close%20up%2C%20dark%20roasted%20beans%2C%20professional%20espresso%20grinder%2C%20warm%20kitchen%20light%2C%20shallow%20depth%20of%20field&width=320&height=180&seq=sb1s2&orientation=landscape',
        direction: '클로즈업 — 원두를 그라인더에 넣는 바리스타의 손.',
        dialogue: '',
        duration: '3s',
      },
      {
        id: 3, index: 3,
        imageUrl: 'https://readdy.ai/api/search-image?query=espresso%20machine%20brewing%20coffee%2C%20steam%20rising%2C%20golden%20crema%20forming%20in%20cup%2C%20professional%20barista%20equipment%2C%20dark%20moody%20cafe%20atmosphere&width=320&height=180&seq=sb1s3&orientation=landscape',
        direction: '미디엄샷 — 에스프레소 머신에서 커피가 추출되는 장면.',
        dialogue: '(소리) 에스프레소 머신 작동음, 커피 향이 퍼지는 느낌.',
        duration: '5s',
      },
      {
        id: 4, index: 4,
        imageUrl: 'https://readdy.ai/api/search-image?query=cafe%20door%20opening%20with%20morning%20light%20streaming%20in%2C%20silhouette%20of%20customer%20entering%2C%20warm%20golden%20hour%20light%2C%20cozy%20coffee%20shop%20entrance&width=320&height=180&seq=sb1s4&orientation=landscape',
        direction: '미디엄 와이드 — 카페 문이 열리며 첫 손님이 들어오는 장면.',
        dialogue: '(소리) 문 열리는 소리, 벨 소리.',
        duration: '3s',
      },
      {
        id: 5, index: 5,
        imageUrl: 'https://readdy.ai/api/search-image?query=friendly%20barista%20smiling%20at%20customer%20across%20counter%2C%20warm%20cafe%20interior%2C%20apron%20wearing%2C%20professional%20and%20welcoming%20expression%2C%20soft%20lighting&width=320&height=180&seq=sb1s5&orientation=landscape',
        direction: '투샷 — 바리스타와 손님이 처음 눈을 마주치는 장면.',
        dialogue: '바리스타: "어서 오세요. 오늘도 같은 걸로 드릴까요?"',
        duration: '4s',
      },
      {
        id: 6, index: 6,
        imageUrl: 'https://readdy.ai/api/search-image?query=customer%20face%20close%20up%20smiling%20warmly%2C%20morning%20light%2C%20casual%20clothing%2C%20looking%20at%20menu%20board%2C%20cozy%20cafe%20atmosphere&width=320&height=180&seq=sb1s6&orientation=landscape',
        direction: '클로즈업 — 손님의 얼굴. 잠시 메뉴를 고민하는 표정.',
        dialogue: '손님: "오늘은... 새로운 걸 시도해볼게요."',
        duration: '3s',
      },
      {
        id: 7, index: 7,
        imageUrl: 'https://readdy.ai/api/search-image?query=latte%20art%20being%20poured%20into%20coffee%20cup%2C%20heart%20pattern%20forming%2C%20barista%20skilled%20hands%2C%20white%20foam%20on%20dark%20espresso%2C%20artistic%20coffee%20making&width=320&height=180&seq=sb1s7&orientation=landscape',
        direction: '클로즈업 — 라떼 아트를 그리는 바리스타의 손.',
        dialogue: '(내레이션) 작은 정성이 하루를 특별하게 만든다.',
        duration: '5s',
      },
      {
        id: 8, index: 8,
        imageUrl: 'https://readdy.ai/api/search-image?query=coffee%20cup%20being%20handed%20over%20cafe%20counter%2C%20two%20hands%20exchanging%20cup%2C%20warm%20lighting%2C%20steam%20rising%20from%20coffee%2C%20intimate%20moment&width=320&height=180&seq=sb1s8&orientation=landscape',
        direction: '미디엄샷 — 커피를 건네는 장면. 두 사람의 손이 잠깐 스친다.',
        dialogue: '바리스타: "맛있게 드세요."',
        duration: '3s',
      },
      {
        id: 9, index: 9,
        imageUrl: 'https://readdy.ai/api/search-image?query=person%20sitting%20alone%20at%20cafe%20window%20table%20with%20coffee%20cup%2C%20morning%20city%20view%20outside%2C%20peaceful%20solitude%2C%20warm%20interior%20light%20contrast%20with%20blue%20morning%20outside&width=320&height=180&seq=sb1s9&orientation=landscape',
        direction: '와이드샷 — 손님이 창가 자리에 앉아 커피를 마시는 장면.',
        dialogue: '(소리) 잔잔한 재즈 음악, 커피잔 소리.',
        duration: '6s',
      },
      {
        id: 10, index: 10,
        imageUrl: 'https://readdy.ai/api/search-image?query=cafe%20exterior%20at%20dawn%20with%20warm%20light%20glowing%20from%20windows%2C%20quiet%20street%2C%20morning%20atmosphere%2C%20cozy%20coffee%20shop%20facade%2C%20cinematic%20wide%20shot&width=320&height=180&seq=sb1s10&orientation=landscape',
        direction: '아웃 — 카페 외관. 하루가 시작되는 거리.',
        dialogue: '(내레이션) 오늘도, 이렇게 하루가 시작된다.',
        duration: '5s',
      },
    ],
  },
  {
    id: 'sb-002',
    title: '2026 AI 트렌드 리포트',
    scenario: 'AI 기술이 일상을 바꾸는 2026년의 모습을 담은 정보성 영상.',
    shotCount: 5,
    resolution: '1920×1080 (16:9)',
    createdAt: '2026.04.07',
    status: 'done',
    shots: [
      {
        id: 1, index: 1,
        imageUrl: 'https://readdy.ai/api/search-image?query=futuristic%20digital%20interface%20with%20AI%20data%20visualization%2C%20glowing%20neural%20network%20patterns%2C%20dark%20background%20with%20blue%20and%20purple%20light%20effects%2C%20technology%20concept&width=320&height=180&seq=sb2s1&orientation=landscape',
        direction: '타이틀 — AI 데이터 시각화 배경 위에 타이틀 텍스트.',
        dialogue: '(내레이션) 2026년, AI는 더 이상 미래가 아닙니다.',
        duration: '5s',
      },
      {
        id: 2, index: 2,
        imageUrl: 'https://readdy.ai/api/search-image?query=person%20using%20holographic%20AI%20assistant%20interface%2C%20futuristic%20home%20office%2C%20transparent%20display%20screens%2C%20smart%20home%20technology%2C%20modern%20lifestyle&width=320&height=180&seq=sb2s2&orientation=landscape',
        direction: '미디엄샷 — 홀로그래픽 AI 어시스턴트를 사용하는 사람.',
        dialogue: '(내레이션) 개인 AI 어시스턴트가 일상의 모든 결정을 돕습니다.',
        duration: '6s',
      },
      {
        id: 3, index: 3,
        imageUrl: 'https://readdy.ai/api/search-image?query=AI%20generated%20art%20gallery%20exhibition%2C%20digital%20artworks%20on%20walls%2C%20visitors%20looking%20at%20AI%20created%20paintings%2C%20modern%20gallery%20space%2C%20creative%20technology%20showcase&width=320&height=180&seq=sb2s3&orientation=landscape',
        direction: '와이드샷 — AI 생성 아트 전시회 장면.',
        dialogue: '(내레이션) 창작의 경계가 무너지고, 누구나 예술가가 됩니다.',
        duration: '5s',
      },
      {
        id: 4, index: 4,
        imageUrl: 'https://readdy.ai/api/search-image?query=autonomous%20vehicles%20and%20smart%20city%20infrastructure%2C%20aerial%20view%20of%20organized%20traffic%20flow%2C%20connected%20transportation%20system%2C%20urban%20technology%20future&width=320&height=180&seq=sb2s4&orientation=landscape',
        direction: '에어리얼 — 자율주행 차량이 가득한 스마트 시티.',
        dialogue: '(내레이션) 이동의 방식도, 도시의 모습도 달라집니다.',
        duration: '6s',
      },
      {
        id: 5, index: 5,
        imageUrl: 'https://readdy.ai/api/search-image?query=diverse%20group%20of%20people%20collaborating%20with%20AI%20technology%2C%20teamwork%20and%20innovation%2C%20bright%20modern%20office%2C%20screens%20showing%20AI%20interfaces%2C%20positive%20future%20vision&width=320&height=180&seq=sb2s5&orientation=landscape',
        direction: '그룹샷 — 다양한 사람들이 AI와 협업하는 장면.',
        dialogue: '(내레이션) AI와 함께, 우리는 더 나은 내일을 만들어갑니다.',
        duration: '7s',
      },
    ],
  },
  {
    id: 'sb-003',
    title: '건강한 아침 루틴',
    scenario: '바쁜 현대인을 위한 15분 아침 루틴 가이드 영상.',
    shotCount: 5,
    resolution: '1080×1920 (9:16)',
    createdAt: '2026.04.06',
    status: 'done',
    shots: [
      {
        id: 1, index: 1,
        imageUrl: 'https://readdy.ai/api/search-image?query=alarm%20clock%20showing%206am%20on%20bedside%20table%2C%20morning%20sunlight%20through%20curtains%2C%20cozy%20bedroom%2C%20soft%20warm%20light%2C%20peaceful%20morning%20atmosphere&width=180&height=320&seq=sb3s1&orientation=portrait',
        direction: '클로즈업 — 오전 6시 알람. 아침이 시작된다.',
        dialogue: '(내레이션) 단 15분으로 하루가 달라집니다.',
        duration: '3s',
      },
      {
        id: 2, index: 2,
        imageUrl: 'https://readdy.ai/api/search-image?query=person%20drinking%20glass%20of%20water%20in%20morning%20light%2C%20healthy%20morning%20routine%2C%20kitchen%20background%2C%20fresh%20start%2C%20hydration%20concept%2C%20vertical%20composition&width=180&height=320&seq=sb3s2&orientation=portrait',
        direction: '미디엄샷 — 기상 후 물 한 잔 마시는 장면.',
        dialogue: '(내레이션) 첫 번째, 기상 직후 물 한 잔.',
        duration: '4s',
      },
      {
        id: 3, index: 3,
        imageUrl: 'https://readdy.ai/api/search-image?query=person%20doing%20morning%20stretching%20yoga%20poses%20by%20window%2C%20sunrise%20light%2C%20peaceful%20exercise%20routine%2C%20healthy%20lifestyle%2C%20vertical%20phone%20video%20style&width=180&height=320&seq=sb3s3&orientation=portrait',
        direction: '풀샷 — 창가에서 스트레칭하는 장면.',
        dialogue: '(내레이션) 두 번째, 5분 스트레칭으로 몸을 깨운다.',
        duration: '5s',
      },
      {
        id: 4, index: 4,
        imageUrl: 'https://readdy.ai/api/search-image?query=healthy%20breakfast%20preparation%2C%20fruits%20and%20vegetables%20on%20cutting%20board%2C%20fresh%20smoothie%20ingredients%2C%20bright%20kitchen%20morning%20light%2C%20nutritious%20meal%20prep&width=180&height=320&seq=sb3s4&orientation=portrait',
        direction: '클로즈업 — 건강한 아침 식사 준비 장면.',
        dialogue: '(내레이션) 세 번째, 간단하지만 영양 가득한 아침 식사.',
        duration: '5s',
      },
      {
        id: 5, index: 5,
        imageUrl: 'https://readdy.ai/api/search-image?query=confident%20person%20leaving%20home%20in%20morning%2C%20bright%20sunlight%2C%20ready%20for%20the%20day%2C%20positive%20energy%2C%20urban%20street%20background%2C%20vertical%20composition&width=180&height=320&seq=sb3s5&orientation=portrait',
        direction: '와이드샷 — 활기차게 집을 나서는 장면.',
        dialogue: '(내레이션) 15분의 루틴이 하루 전체를 바꿉니다.',
        duration: '4s',
      },
    ],
  },
];
