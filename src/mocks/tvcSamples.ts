export const tvcSamples = [
  {
    id: 1,
    title: '원데이 촉촉 가습기',
    category: 'Beauty',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773719995006.mp4',
  },
  {
    id: 2,
    title: '신나는 조이틱 게임기',
    category: '전자기기',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773719807271.mp4',
  },
  {
    id: 3,
    title: '고성능 믹서기',
    category: '전자제품',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773714611693.mp4',
  },
  {
    id: 4,
    title: '고급스러운 전기밥솥',
    category: '전자제품',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773714447867.mp4',
  },
  {
    id: 5,
    title: '고급스러운 빌트인 전자레인지',
    category: 'Beauty',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773712608913.mp4',
  },
  {
    id: 6,
    title: '편안한 안마의자',
    category: '전자제품',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773710726073.mp4',
  },
  {
    id: 7,
    title: '퓨어하고 감각적인 선풍기',
    category: '전자제품',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773710298578.mp4',
  },
  {
    id: 8,
    title: '초강력 전동면도기',
    category: '전자제품',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773647697982.mp4',
  },
  {
    id: 9,
    title: '고양이도 반한 소파',
    category: '홈인테리어',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773645457746.mp4',
  },
  {
    id: 10,
    title: '강아지도 반한 침대',
    category: '홈인테리어',
    videoSrc: 'https://uyncfjzfumputmyodmlr.supabase.co/storage/v1/object/public/public-assets/admin/tvc-samples/temp-1773642604075.mp4',
  },
];

export interface TvcTemplate {
  id: number;
  title: string;
  subtitle: string;
  tags: string[];
  img: string;
}

export const tvcTemplates: TvcTemplate[] = [
  {
    id: 1,
    title: 'Old car on the European background',
    subtitle: '유럽배경에 클래식카',
    tags: ['자동차', '클래식', '유럽'],
    img: 'https://readdy.ai/api/search-image?query=elegant%20woman%20in%20vintage%20dress%20leaning%20on%20classic%20yellow%20car%20on%20European%20cobblestone%20street%2C%20warm%20golden%20hour%20lighting%2C%20cinematic%20advertisement%20photography%2C%20luxury%20lifestyle&width=240&height=160&seq=tvc1&orientation=landscape',
  },
  {
    id: 2,
    title: 'liquid background of a protein drink',
    subtitle: '프로틴 드링크 배경',
    tags: ['음료', '스포츠', '건강'],
    img: 'https://readdy.ai/api/search-image?query=athletic%20korean%20man%20drinking%20protein%20shake%20with%20liquid%20splash%20background%2C%20dynamic%20sports%20advertisement%20photography%2C%20dark%20dramatic%20studio%20lighting%2C%20fitness%20lifestyle&width=240&height=160&seq=tvc2&orientation=landscape',
  },
  {
    id: 3,
    title: 'chic black flower background',
    subtitle: '시크한 블랙 플라워 배경',
    tags: ['뷰티', '패션', '럭셔리'],
    img: 'https://readdy.ai/api/search-image?query=beautiful%20korean%20woman%20with%20elegant%20makeup%20surrounded%20by%20black%20flowers%2C%20luxury%20perfume%20advertisement%2C%20dark%20moody%20background%2C%20high%20fashion%20editorial%20photography&width=240&height=160&seq=tvc3&orientation=landscape',
  },
  {
    id: 4,
    title: 'powerful and chic razor shoot',
    subtitle: '강하고 세련된 면도기 촬영',
    tags: ['면도기', '남성', '그루밍'],
    img: 'https://readdy.ai/api/search-image?query=handsome%20korean%20man%20with%20razor%20blade%20shaving%2C%20water%20droplets%20splashing%2C%20powerful%20masculine%20advertisement%20photography%2C%20dark%20studio%20background%2C%20premium%20grooming%20product&width=240&height=160&seq=tvc4&orientation=landscape',
  },
  {
    id: 5,
    title: 'Santa and a big burger joint',
    subtitle: '산타와 대형 버거 매장',
    tags: ['식품', '크리스마스', '패스트푸드'],
    img: 'https://readdy.ai/api/search-image?query=Santa%20Claus%20holding%20giant%20delicious%20burger%20in%20festive%20Christmas%20restaurant%20setting%2C%20bright%20colorful%20holiday%20advertisement%2C%20cheerful%20food%20photography&width=240&height=160&seq=tvc5&orientation=landscape',
  },
  {
    id: 6,
    title: 'retro western-style pizza restaurant',
    subtitle: '레트로 서부스타일 피자 레스토랑',
    tags: ['식품', '레트로', '피자'],
    img: 'https://readdy.ai/api/search-image?query=beautiful%20woman%20holding%20pizza%20slice%20in%20retro%20western%20style%20restaurant%20with%20neon%20signs%20and%20checkered%20floor%2C%20vintage%20americana%20diner%20advertisement%20photography&width=240&height=160&seq=tvc6&orientation=landscape',
  },
  {
    id: 7,
    title: 'clean home',
    subtitle: '깨끗하고 편안한 가정',
    tags: ['홈', '라이프스타일', '가전'],
    img: 'https://readdy.ai/api/search-image?query=korean%20woman%20in%20cozy%20clean%20modern%20living%20room%20holding%20smartphone%2C%20bright%20natural%20light%2C%20lifestyle%20home%20advertisement%20photography%2C%20warm%20minimal%20interior&width=240&height=160&seq=tvc7&orientation=landscape',
  },
  {
    id: 8,
    title: 'Retro Pop Fish Eye Lenses',
    subtitle: '레트로 팝 어안렌즈',
    tags: ['스낵', '팝아트', '레트로'],
    img: 'https://readdy.ai/api/search-image?query=cheerful%20korean%20girl%20with%20fisheye%20lens%20effect%20holding%20colorful%20snack%20bag%2C%20retro%20pop%20art%20style%20advertisement%2C%20vibrant%20saturated%20colors%2C%20fun%20energetic%20photography&width=240&height=160&seq=tvc8&orientation=landscape',
  },
  {
    id: 9,
    title: 'Snacks Flying in Cozy and Vivid Home',
    subtitle: '코지하고 생동감 넘치는 스낵',
    tags: ['스낵', '홈', '생동감'],
    img: 'https://readdy.ai/api/search-image?query=various%20colorful%20snack%20packages%20flying%20in%20the%20air%20in%20cozy%20vivid%20home%20setting%2C%20dynamic%20food%20advertisement%20photography%2C%20bright%20cheerful%20atmosphere&width=240&height=160&seq=tvc9&orientation=landscape',
  },
  {
    id: 10,
    title: 'Studio in the background of Gravity Canvas',
    subtitle: '그라비티 캔버스 배경 스튜디오',
    tags: ['뷰티', '아트', '스튜디오'],
    img: 'https://readdy.ai/api/search-image?query=korean%20model%20sitting%20gracefully%20in%20artistic%20gravity%20canvas%20studio%20with%20paint%20splashes%20and%20abstract%20background%2C%20high%20fashion%20beauty%20advertisement%20photography&width=240&height=160&seq=tvc10&orientation=landscape',
  },
  {
    id: 11,
    title: 'Studio with a strong red color background',
    subtitle: '강렬한 레드 컬러 스튜디오',
    tags: ['뷰티', '패션', '레드'],
    img: 'https://readdy.ai/api/search-image?query=handsome%20korean%20man%20in%20red%20suit%20with%20skincare%20product%20on%20bold%20red%20studio%20background%2C%20luxury%20cosmetics%20advertisement%20photography%2C%20strong%20dramatic%20lighting&width=240&height=160&seq=tvc11&orientation=landscape',
  },
  {
    id: 12,
    title: 'luxurious marble studio',
    subtitle: '럭셔리 마블 스튜디오',
    tags: ['가구', '럭셔리', '마블'],
    img: 'https://readdy.ai/api/search-image?query=elegant%20person%20sitting%20on%20luxury%20massage%20chair%20in%20marble%20studio%2C%20premium%20furniture%20advertisement%20photography%2C%20sophisticated%20interior%2C%20soft%20warm%20lighting&width=240&height=160&seq=tvc12&orientation=landscape',
  },
  {
    id: 13,
    title: 'dreamy forest setting',
    subtitle: '몽환적인 숲 배경',
    tags: ['자동차', '자연', '몽환'],
    img: 'https://readdy.ai/api/search-image?query=luxury%20SUV%20car%20in%20dreamy%20misty%20forest%20with%20golden%20sunlight%20rays%2C%20cinematic%20automotive%20advertisement%20photography%2C%20ethereal%20nature%20background&width=240&height=160&seq=tvc13&orientation=landscape',
  },
  {
    id: 14,
    title: 'studio in the background of showwriting',
    subtitle: '쇼라이팅 배경 스튜디오',
    tags: ['뷰티', '스킨케어', '스튜디오'],
    img: 'https://readdy.ai/api/search-image?query=beautiful%20korean%20woman%20holding%20skincare%20product%20with%20light%20writing%20effects%20in%20dark%20studio%2C%20beauty%20advertisement%20photography%2C%20dramatic%20spotlight%20lighting&width=240&height=160&seq=tvc14&orientation=landscape',
  },
  {
    id: 15,
    title: 'classic and antique studio',
    subtitle: '클래식 앤틱 스튜디오',
    tags: ['패션', '클래식', '앤틱'],
    img: 'https://readdy.ai/api/search-image?query=elegant%20korean%20woman%20in%20red%20dress%20at%20classic%20antique%20dining%20table%20with%20candles%20and%20vintage%20decor%2C%20luxury%20lifestyle%20advertisement%20photography%2C%20warm%20golden%20tones&width=240&height=160&seq=tvc15&orientation=landscape',
  },
];
