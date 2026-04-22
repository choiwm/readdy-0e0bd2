import { useState, useRef, useCallback, useEffect } from 'react';
import CustomCharacterModal from './CustomCharacterModal';
import CharacterDetailModal from './CharacterDetailModal';
import type { AppliedCharacter } from '../page';

type GenderFilter = '전체' | '여자' | '남자';
type CategoryFilter = '전체' | '비즈니스' | '크리에이터' | '패션' | '스포츠' | '라이프스타일' | '아티스틱' | '내 캐릭터';
type ViewMode = 'grid' | 'list';

interface CharacterTemplate {
  id: string;
  name: string;
  gender: '여자' | '남자';
  tags: string[];
  img: string;
  category: CategoryFilter;
  age: string;
  style: string;
  personality: string;
  useCases: string[];
  voiceTone: string;
}

const characterTemplates: CharacterTemplate[] = [
  { id: 'f4',  name: '수진',   gender: '여자', category: '비즈니스',     age: '30대 초반', tags: ['프로','비즈니스','신뢰'],       style: '비즈니스 포멀',          personality: '프로페셔널하고 신뢰감 있는 비즈니스 캐릭터',       useCases: ['기업 홍보','금융/보험','교육 서비스'], voiceTone: '명확하고 신뢰감 있는 톤',    img: 'https://readdy.ai/api/search-image?query=professional%20Korean%20businesswoman%20formal%20attire%2C%20confident%20expression%2C%20clean%20office%20background%2C%20corporate%20portrait%2C%20polished%20appearance%2C%20studio%20lighting&width=400&height=533&seq=char_f4&orientation=portrait' },
  { id: 'f6',  name: '민지',   gender: '여자', category: '비즈니스',     age: '30대 초반', tags: ['세련','비즈니스','IT'],          style: '비즈니스 캐주얼',        personality: '세련되고 자연스러운 매력의 IT 전문가 캐릭터',       useCases: ['IT/테크','스타트업','마케팅'],         voiceTone: '전문적이고 친근한 톤',       img: 'https://readdy.ai/api/search-image?query=smart%20Korean%20woman%20business%20casual%20style%2C%20tech-savvy%20look%2C%20modern%20office%20background%2C%20approachable%20professional%20portrait%2C%20contemporary%20fashion&width=400&height=533&seq=char_f6&orientation=portrait' },
  { id: 'f7',  name: '서현',   gender: '여자', category: '비즈니스',     age: '30대 중반', tags: ['클래식','포멀','우아'],          style: '클래식 포멀',            personality: '클래식하고 우아한 분위기의 캐릭터',                 useCases: ['법률/금융','교육','공공기관'],         voiceTone: '격식 있고 신뢰감 있는 톤',     img: 'https://readdy.ai/api/search-image?query=classic%20Korean%20woman%20formal%20elegant%20attire%2C%20timeless%20style%2C%20neutral%20background%2C%20authoritative%20yet%20graceful%20portrait%2C%20traditional%20professional%20look&width=400&height=533&seq=char_f7&orientation=portrait' },
  { id: 'm1',  name: '준혁',   gender: '남자', category: '비즈니스',     age: '30대 초반', tags: ['지적','신뢰','전문가'],          style: '비즈니스 캐주얼',        personality: '지적이고 신뢰감 있는 전문가 이미지의 캐릭터',       useCases: ['IT/테크','교육','금융'],               voiceTone: '차분하고 신뢰감 있는 톤',    img: 'https://readdy.ai/api/search-image?query=intelligent%20Korean%20man%20business%20casual%20attire%2C%20trustworthy%20expression%2C%20clean%20office%20background%2C%20professional%20portrait%2C%20smart%20appearance%2C%20confident%20pose&width=400&height=533&seq=char_m1&orientation=portrait' },
  { id: 'm3',  name: '민준',   gender: '남자', category: '비즈니스',     age: '30대 초반', tags: ['모던','비즈니스','세련'],        style: '모던 비즈니스',          personality: '모던하고 세련된 비즈니스 감각의 캐릭터',            useCases: ['기업 홍보','금융','컨설팅'],           voiceTone: '전문적이고 세련된 톤',       img: 'https://readdy.ai/api/search-image?query=modern%20Korean%20businessman%20sleek%20style%2C%20confident%20expression%2C%20minimal%20dark%20background%2C%20contemporary%20professional%20portrait%2C%20sharp%20fashion%20sense&width=400&height=533&seq=char_m3&orientation=portrait' },
  { id: 'm5',  name: '성훈',   gender: '남자', category: '비즈니스',     age: '40대 초반', tags: ['클래식','포멀','권위'],          style: '클래식 포멀',            personality: '클래식하고 격식 있는 엘레강스 캐릭터',              useCases: ['법률/금융','럭셔리','공공기관'],       voiceTone: '격식 있고 권위 있는 톤',     img: 'https://readdy.ai/api/search-image?query=classic%20Korean%20man%20formal%20suit%2C%20authoritative%20presence%2C%20elegant%20background%2C%20distinguished%20portrait%2C%20mature%20professional%20appearance%2C%20high-end%20photography&width=400&height=533&seq=char_m5&orientation=portrait' },
  { id: 'm11', name: '알렉스', gender: '남자', category: '비즈니스',     age: '30대 초반', tags: ['글로벌','세련','국제적'],        style: '인터내셔널 비즈니스',    personality: '글로벌하고 세련된 인터내셔널 캐릭터',               useCases: ['글로벌 브랜드','항공/여행','럭셔리'],  voiceTone: '세련되고 국제적인 톤',       img: 'https://readdy.ai/api/search-image?query=global%20international%20Korean%20man%20sophisticated%20style%2C%20cosmopolitan%20look%2C%20clean%20minimal%20background%2C%20business%20international%20portrait%2C%20polished%20appearance&width=400&height=533&seq=char_m11&orientation=portrait' },
  { id: 'f2',  name: '지아',   gender: '여자', category: '크리에이터',   age: '20대 중반', tags: ['밝음','캐주얼','웜톤'],          style: '캐주얼 & 웜톤',          personality: '밝고 따뜻한 에너지로 친근감을 주는 캐릭터',         useCases: ['SNS 콘텐츠','음식 리뷰','여행 브이로그'], voiceTone: '밝고 활기찬 톤',           img: 'https://readdy.ai/api/search-image?query=cheerful%20young%20Korean%20woman%20bright%20smile%2C%20casual%20warm-toned%20outfit%2C%20friendly%20expression%2C%20clean%20white%20background%2C%20lifestyle%20portrait%20photography%2C%20natural%20light&width=400&height=533&seq=char_f2&orientation=portrait' },
  { id: 'f8',  name: '나연',   gender: '여자', category: '크리에이터',   age: '20대 초반', tags: ['트렌디','활발','젊음'],          style: '트렌디 캐주얼',          personality: '트렌디하고 생동감 넘치는 에너지의 캐릭터',           useCases: ['엔터테인먼트','SNS','게임'],           voiceTone: '활기차고 트렌디한 톤',       img: 'https://readdy.ai/api/search-image?query=young%20trendy%20Korean%20woman%20vibrant%20energy%2C%20colorful%20casual%20outfit%2C%20dynamic%20pose%2C%20bright%20background%2C%20youthful%20portrait%20photography%2C%20fun%20personality&width=400&height=533&seq=char_f8&orientation=portrait' },
  { id: 'f12', name: '레나',   gender: '여자', category: '크리에이터',   age: '20대 중반', tags: ['글로벌','화사','국제적'],        style: '글로벌 & 프레시',        personality: '글로벌하고 화사한 분위기의 캐릭터',                 useCases: ['글로벌 브랜드','여행','라이프스타일'], voiceTone: '밝고 국제적인 톤',           img: 'https://readdy.ai/api/search-image?query=global%20Korean%20woman%20fresh%20international%20style%2C%20bright%20cheerful%20expression%2C%20clean%20white%20background%2C%20multicultural%20appeal%2C%20modern%20portrait%20photography&width=400&height=533&seq=char_f12&orientation=portrait' },
  { id: 'm2',  name: '태양',   gender: '남자', category: '크리에이터',   age: '20대 후반', tags: ['친근','따뜻','캐주얼'],          style: '캐주얼 & 프렌들리',      personality: '친근하고 따뜻한 에너지의 캐주얼 캐릭터',            useCases: ['라이프스타일','SNS','음식'],           voiceTone: '친근하고 따뜻한 톤',         img: 'https://readdy.ai/api/search-image?query=friendly%20warm%20Korean%20man%20casual%20style%2C%20approachable%20smile%2C%20bright%20natural%20background%2C%20lifestyle%20portrait%2C%20relatable%20personality%2C%20natural%20light%20photography&width=400&height=533&seq=char_m2&orientation=portrait' },
  { id: 'm12', name: '유준',   gender: '남자', category: '크리에이터',   age: '20대 중반', tags: ['프레시','밝음','청년'],          style: '프레시 & 내추럴',        personality: '신선하고 밝은 에너지의 청년 캐릭터',                useCases: ['식품/음료','라이프스타일','SNS'],      voiceTone: '밝고 신선한 톤',             img: 'https://readdy.ai/api/search-image?query=fresh%20bright%20young%20Korean%20man%20cheerful%20smile%2C%20casual%20clean%20outfit%2C%20light%20background%2C%20energetic%20portrait%2C%20positive%20personality%2C%20natural%20lifestyle%20photography&width=400&height=533&seq=char_m12&orientation=portrait' },
  { id: 'f1',  name: '소연',   gender: '여자', category: '패션',         age: '20대 초반', tags: ['청순','내추럴','20대'],          style: '내추럴 & 미니멀',        personality: '청순하고 순수한 이미지로 신뢰감을 주는 캐릭터',     useCases: ['뷰티 콘텐츠','라이프스타일','교육 콘텐츠'], voiceTone: '부드럽고 차분한 톤',       img: 'https://readdy.ai/api/search-image?query=beautiful%20young%20Korean%20woman%20with%20natural%20makeup%2C%20soft%20smile%2C%20clean%20minimal%20background%2C%20studio%20portrait%2C%20elegant%20casual%20style%2C%20warm%20lighting%2C%20high%20quality%20photography&width=400&height=533&seq=char_f1&orientation=portrait' },
  { id: 'f3',  name: '하은',   gender: '여자', category: '패션',         age: '20대 후반', tags: ['트렌디','모던','세련'],          style: '모던 캐주얼',            personality: '세련되고 편안한 분위기의 트렌디한 캐릭터',           useCases: ['패션 콘텐츠','라이프스타일','인테리어'], voiceTone: '자연스럽고 편안한 톤',     img: 'https://readdy.ai/api/search-image?query=trendy%20Korean%20woman%20modern%20casual%20fashion%2C%20confident%20pose%2C%20neutral%20background%2C%20contemporary%20style%2C%20professional%20portrait%2C%20soft%20studio%20lighting&width=400&height=533&seq=char_f3&orientation=portrait' },
  { id: 'f5',  name: '유나',   gender: '여자', category: '패션',         age: '20대 후반', tags: ['엘레강스','고급','모던'],        style: '모던 엘레강스',          personality: '모던하고 고급스러운 엘레강스 캐릭터',               useCases: ['럭셔리 브랜드','뷰티','패션'],         voiceTone: '세련되고 우아한 톤',         img: 'https://readdy.ai/api/search-image?query=elegant%20Korean%20woman%20luxury%20fashion%2C%20sophisticated%20style%2C%20dark%20minimal%20background%2C%20high-end%20portrait%20photography%2C%20graceful%20pose%2C%20premium%20look&width=400&height=533&seq=char_f5&orientation=portrait' },
  { id: 'f11', name: '지수',   gender: '여자', category: '패션',         age: '20대 후반', tags: ['에디토리얼','패션','세련'],      style: '에디토리얼 패션',        personality: '모던하고 세련된 분위기의 에디토리얼 캐릭터',         useCases: ['패션 매거진','럭셔리','뷰티'],         voiceTone: '세련되고 트렌디한 톤',       img: 'https://readdy.ai/api/search-image?query=editorial%20fashion%20Korean%20woman%20high-end%20magazine%20style%2C%20sophisticated%20pose%2C%20dark%20moody%20background%2C%20luxury%20fashion%20portrait%2C%20model-like%20appearance&width=400&height=533&seq=char_f11&orientation=portrait' },
  { id: 'm4',  name: '재원',   gender: '남자', category: '패션',         age: '20대 초반', tags: ['트렌디','스트리트','젊음'],      style: '스트리트 패션',          personality: '트렌디하고 젊은 에너지의 스트리트 캐릭터',           useCases: ['패션','엔터테인먼트','게임'],          voiceTone: '트렌디하고 활기찬 톤',       img: 'https://readdy.ai/api/search-image?query=trendy%20young%20Korean%20man%20streetwear%20fashion%2C%20cool%20urban%20style%2C%20city%20background%2C%20dynamic%20portrait%2C%20youthful%20energy%2C%20contemporary%20look&width=400&height=533&seq=char_m4&orientation=portrait' },
  { id: 'm7',  name: '현우',   gender: '남자', category: '스포츠',       age: '20대 중반', tags: ['스포티','활동적','에너지'],      style: '스포티 & 액티브',        personality: '스포티하고 활동적인 에너지의 캐릭터',               useCases: ['스포츠','헬스/피트니스','아웃도어'],   voiceTone: '활기차고 에너지 넘치는 톤',  img: 'https://readdy.ai/api/search-image?query=sporty%20athletic%20Korean%20man%20activewear%2C%20energetic%20pose%2C%20gym%20or%20outdoor%20background%2C%20fitness%20portrait%2C%20healthy%20strong%20appearance%2C%20dynamic%20photography&width=400&height=533&seq=char_m7&orientation=portrait' },
  { id: 'm9',  name: '강민',   gender: '남자', category: '스포츠',       age: '30대 중반', tags: ['카리스마','강인','다크'],        style: '다크 & 카리스마',        personality: '강인하고 카리스마 있는 인상의 캐릭터',              useCases: ['액션/스릴러','자동차','스포츠'],       voiceTone: '강렬하고 카리스마 있는 톤',  img: 'https://readdy.ai/api/search-image?query=charismatic%20strong%20Korean%20man%20dark%20intense%20look%2C%20powerful%20presence%2C%20dark%20moody%20background%2C%20dramatic%20portrait%20photography%2C%20masculine%20energy%2C%20bold%20style&width=400&height=533&seq=char_m9&orientation=portrait' },
  { id: 'f10', name: '채원',   gender: '여자', category: '라이프스타일', age: '20대 초반', tags: ['귀여움','밝음','사랑스러움'],    style: '큐트 & 걸리시',          personality: '귀엽고 밝은 에너지의 사랑스러운 캐릭터',            useCases: ['키즈 콘텐츠','뷰티','식품'],          voiceTone: '귀엽고 밝은 톤',             img: 'https://readdy.ai/api/search-image?query=cute%20adorable%20Korean%20woman%20sweet%20smile%2C%20girly%20pastel%20outfit%2C%20soft%20pink%20background%2C%20lovely%20portrait%20photography%2C%20charming%20expression%2C%20kawaii%20style&width=400&height=533&seq=char_f10&orientation=portrait' },
  { id: 'm8',  name: '시우',   gender: '남자', category: '라이프스타일', age: '30대 초반', tags: ['내추럴','따뜻','라이프스타일'],  style: '내추럴 라이프스타일',    personality: '자연스럽고 따뜻한 매력의 라이프스타일 캐릭터',       useCases: ['여행','음식','라이프스타일'],          voiceTone: '따뜻하고 자연스러운 톤',     img: 'https://readdy.ai/api/search-image?query=natural%20warm%20Korean%20man%20lifestyle%20casual%2C%20relaxed%20smile%2C%20outdoor%20nature%20background%2C%20authentic%20portrait%2C%20genuine%20personality%2C%20soft%20natural%20lighting&width=400&height=533&seq=char_m8&orientation=portrait' },
  { id: 'm10', name: '이준',   gender: '남자', category: '라이프스타일', age: '20대 초반', tags: ['청순','순수','청년'],            style: '큐트 & 프레시',          personality: '청순하고 순수한 이미지의 청년 캐릭터',              useCases: ['키즈/청소년','교육','엔터테인먼트'],   voiceTone: '순수하고 밝은 톤',           img: 'https://readdy.ai/api/search-image?query=fresh%20innocent%20young%20Korean%20man%20pure%20smile%2C%20clean%20casual%20outfit%2C%20bright%20white%20background%2C%20youthful%20portrait%2C%20boy-next-door%20charm%2C%20natural%20expression&width=400&height=533&seq=char_m10&orientation=portrait' },
  { id: 'f9',  name: '아이린', gender: '여자', category: '아티스틱',     age: '20대 후반', tags: ['아티스틱','독특','강렬'],        style: '아방가르드',              personality: '독특하고 강렬한 인상의 아티스틱 캐릭터',            useCases: ['아트/디자인','패션','뮤직'],           voiceTone: '개성 있고 독창적인 톤',      img: 'https://readdy.ai/api/search-image?query=artistic%20Korean%20woman%20avant-garde%20fashion%2C%20unique%20strong%20impression%2C%20dark%20artistic%20background%2C%20editorial%20portrait%2C%20bold%20style%2C%20creative%20photography&width=400&height=533&seq=char_f9&orientation=portrait' },
  { id: 'm6',  name: '도현',   gender: '남자', category: '아티스틱',     age: '20대 후반', tags: ['아티스틱','크리에이티브','감성'],style: '아티스틱 & 크리에이티브', personality: '아티스틱하고 크리에이티브한 감성의 캐릭터',          useCases: ['아트/디자인','뮤직','영화'],           voiceTone: '감성적이고 창의적인 톤',     img: 'https://readdy.ai/api/search-image?query=artistic%20creative%20Korean%20man%20unique%20style%2C%20expressive%20face%2C%20artistic%20studio%20background%2C%20creative%20portrait%20photography%2C%20musician%20or%20artist%20vibe&width=400&height=533&seq=char_m6&orientation=portrait' },
];

const CATEGORY_COLORS: Record<string, string> = {
  '비즈니스':     'text-sky-400 bg-sky-500/10 border-sky-500/25',
  '크리에이터':   'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  '패션':         'text-rose-400 bg-rose-500/10 border-rose-500/25',
  '스포츠':       'text-orange-400 bg-orange-500/10 border-orange-500/25',
  '라이프스타일': 'text-teal-400 bg-teal-500/10 border-teal-500/25',
  '아티스틱':     'text-violet-400 bg-violet-500/10 border-violet-500/25',
  '내 캐릭터':    'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
};

const CATEGORY_ICONS: Record<string, string> = {
  '전체': 'ri-apps-2-line', '비즈니스': 'ri-briefcase-line', '크리에이터': 'ri-video-line',
  '패션': 'ri-t-shirt-line', '스포츠': 'ri-run-line', '라이프스타일': 'ri-sun-line',
  '아티스틱': 'ri-palette-line', '내 캐릭터': 'ri-user-star-line',
};

// ── Toast ──────────────────────────────────────────────────────────────────
function SaveToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2.5 bg-emerald-500/90 backdrop-blur-sm text-white text-sm font-bold rounded-xl">
      <i className="ri-checkbox-circle-fill text-base" />{message}
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 cursor-pointer"><i className="ri-close-line" /></button>
    </div>
  );
}

// ── Character Card (Grid) ──────────────────────────────────────────────────
function CharCard({ char, isSelected, isApplied, isSaved, onSelect, onSave, onDetail, onApplyAndGenerate }: {
  char: CharacterTemplate; isSelected: boolean; isApplied: boolean; isSaved: boolean;
  onSelect: () => void; onSave: () => void; onDetail: () => void; onApplyAndGenerate: () => void;
}) {
  const catColor = CATEGORY_COLORS[char.category] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25';
  return (
    <div
      onClick={onDetail}
      className="relative flex flex-col cursor-pointer group rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
    >
      <div className="w-full aspect-[3/4] overflow-hidden rounded-2xl relative">
        <img src={char.img} alt={char.name} className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
        <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${char.gender === '여자' ? 'bg-rose-500/80 text-white' : 'bg-sky-500/80 text-white'}`}>{char.gender}</div>
        <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold border ${catColor} backdrop-blur-sm`}>{char.category}</div>
        {isSaved && <div className="absolute top-8 right-2 w-5 h-5 rounded-full bg-amber-500/90 flex items-center justify-center z-10 mt-1"><i className="ri-bookmark-fill text-white text-[9px]" /></div>}
        {isApplied && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-[9px] font-bold flex items-center gap-1 z-20 whitespace-nowrap"><i className="ri-sparkling-2-fill text-[9px]" /> 적용 중</div>}

        {/* 우측 상단 액션 버튼들 (호버 시) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 mt-6">
          <button onClick={(e) => { e.stopPropagation(); onSave(); }} className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${isSaved ? 'bg-amber-500/90' : 'bg-black/60 hover:bg-amber-500'}`} title={isSaved ? '저장됨' : '저장'}><i className={`${isSaved ? 'ri-bookmark-fill' : 'ri-bookmark-line'} text-white text-[10px]`} /></button>
        </div>

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/90 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2.5"><p className="text-xs font-bold text-white">{char.name}</p><p className="text-[9px] text-zinc-400 mt-0.5">{char.age}</p></div>

        {/* 호버 시 하단 버튼 영역 */}
        <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 flex items-center gap-1.5">
          {/* 좌측 하단: 선택 버튼 */}
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              isSelected
                ? 'bg-indigo-500/90 text-white'
                : 'bg-black/70 hover:bg-indigo-500/80 text-white border border-white/20'
            }`}
          >
            <i className={`${isSelected ? 'ri-check-line' : 'ri-user-add-line'} text-[9px]`} />
            {isSelected ? '선택됨' : '선택'}
          </button>
          {/* 우측: 생성 버튼 */}
          <button
            onClick={(e) => { e.stopPropagation(); onApplyAndGenerate(); }}
            className="flex-1 py-1.5 rounded-xl bg-indigo-500/90 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-sparkling-2-fill text-[9px]" />이 캐릭터로 생성
          </button>
        </div>

        {/* 선택됨 표시 (링 효과) */}
        {isSelected && (
          <div className="absolute inset-0 ring-2 ring-indigo-500 ring-inset rounded-2xl pointer-events-none" />
        )}
      </div>
    </div>
  );
}

// ── Character Row (List) ───────────────────────────────────────────────────
function CharRow({ char, isSelected, isApplied, isSaved, onSelect, onSave, onDetail, onApplyAndGenerate }: {
  char: CharacterTemplate; isSelected: boolean; isApplied: boolean; isSaved: boolean;
  onSelect: () => void; onSave: () => void; onDetail: () => void; onApplyAndGenerate: () => void;
}) {
  const catColor = CATEGORY_COLORS[char.category] ?? 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25';
  return (
    <div
      onClick={onDetail}
      className={`flex items-center gap-4 p-3 rounded-2xl border cursor-pointer transition-all group ${
        isSelected
          ? 'border-indigo-500/50 bg-indigo-500/8'
          : 'border-white/5 bg-zinc-900/40 hover:border-white/15 hover:bg-zinc-900/70'
      }`}
    >
      <div className="w-14 h-[74px] rounded-xl overflow-hidden flex-shrink-0 relative">
        <img src={char.img} alt={char.name} className="w-full h-full object-cover object-top" />
        {isApplied && <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center"><i className="ri-check-line text-white text-sm" /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white">{char.name}</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${char.gender === '여자' ? 'bg-rose-500/15 text-rose-400 border-rose-500/25' : 'bg-sky-500/15 text-sky-400 border-sky-500/25'}`}>{char.gender}</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${catColor}`}>{char.category}</span>
          {isSelected && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-0.5"><i className="ri-check-line text-[8px]" />선택됨</span>}
        </div>
        <p className="text-[11px] text-zinc-500 truncate">{char.personality}</p>
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">{char.tags.map((tag, i) => <span key={i} className="text-[9px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-md">{tag}</span>)}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
        {/* 선택 버튼 */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            isSelected
              ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
              : 'bg-zinc-800 border border-white/10 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/30'
          }`}
        >
          <i className={`${isSelected ? 'ri-check-line' : 'ri-user-add-line'} text-[9px]`} />
          {isSelected ? '선택됨' : '선택'}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onSave(); }} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isSaved ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10'}`} title={isSaved ? '저장됨' : '저장'}><i className={isSaved ? 'ri-bookmark-fill text-xs' : 'ri-bookmark-line text-xs'} /></button>
        <button onClick={(e) => { e.stopPropagation(); onApplyAndGenerate(); }} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-[10px] font-bold hover:bg-indigo-500/25 transition-all cursor-pointer whitespace-nowrap"><i className="ri-sparkling-2-fill text-[9px]" />적용</button>
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────
interface CharacterViewProps {
  onApplyCharacter?: (character: AppliedCharacter) => void;
  onApplyCharacterAndGenerate?: (character: AppliedCharacter) => void;
  appliedCharacterId?: string | null;
  activeCategory?: string;
  onCategoryChange?: (cat: string) => void;
  externalCustomChars?: AppliedCharacter[];
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CharacterView({
  onApplyCharacter,
  onApplyCharacterAndGenerate,
  appliedCharacterId,
  activeCategory: externalCategory,
  onCategoryChange,
  externalCustomChars = [],
}: CharacterViewProps) {
  const [internalCategory, setInternalCategory] = useState<CategoryFilter>('전체');
  const activeCategory = (externalCategory as CategoryFilter) ?? internalCategory;
  const setActiveCategory = useCallback((cat: CategoryFilter) => {
    setInternalCategory(cat);
    onCategoryChange?.(cat);
  }, [onCategoryChange]);

  const [genderFilter, setGenderFilter] = useState<GenderFilter>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  // 상세 팝업 (모달)
  const [detailModalCharId, setDetailModalCharId] = useState<string | null>(null);
  const [savedCharIds, setSavedCharIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customCharacters, setCustomCharacters] = useState<AppliedCharacter[]>([]);
  const photoUploadRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoChar, setPendingPhotoChar] = useState<AppliedCharacter | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allCustomChars = [...externalCustomChars, ...customCharacters];

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const isMyCharTab = activeCategory === '내 캐릭터';

  const filteredTemplates = characterTemplates.filter((c) => {
    if (activeCategory !== '전체' && !isMyCharTab && c.category !== activeCategory) return false;
    if (genderFilter !== '전체' && c.gender !== genderFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.tags.some((t) => t.toLowerCase().includes(q)) || c.category.toLowerCase().includes(q) || c.style.toLowerCase().includes(q);
    }
    return true;
  });

  const displayList = isMyCharTab ? [] : filteredTemplates;

  // 상세 팝업용 캐릭터
  const detailModalChar = detailModalCharId
    ? (characterTemplates.find((c) => c.id === detailModalCharId) ?? null)
    : null;

  const handleSave = useCallback((charId: string, name: string) => {
    setSavedCharIds((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) { next.delete(charId); showToast(`${name} 저장이 해제되었습니다`); }
      else { next.add(charId); showToast(`${name} 캐릭터가 저장되었습니다`); }
      return next;
    });
  }, [showToast]);

  const handleApplyOnly = useCallback((char: CharacterTemplate | AppliedCharacter) => {
    if (onApplyCharacter) { onApplyCharacter({ id: char.id, name: char.name, gender: char.gender, tags: char.tags, img: char.img }); showToast(`${char.name} 캐릭터가 생성 탭에 적용되었습니다`); }
  }, [onApplyCharacter, showToast]);

  const handleApplyAndGenerate = useCallback((char: CharacterTemplate | AppliedCharacter) => {
    const cb = onApplyCharacterAndGenerate ?? onApplyCharacter;
    if (cb) { cb({ id: char.id, name: char.name, gender: char.gender, tags: char.tags, img: char.img }); showToast(`${char.name} 캐릭터로 이미지 생성을 시작합니다`); }
  }, [onApplyCharacterAndGenerate, onApplyCharacter, showToast]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPendingPhotoChar({ id: `photo_${Date.now()}`, name: file.name.replace(/\.[^/.]+$/, '') || '내 사진', gender: '여자', tags: ['사진 등록', '커스텀'], img: url });
    }
    e.target.value = '';
  };

  const handleConfirmPhotoGender = (gender: '여자' | '남자') => {
    if (!pendingPhotoChar) return;
    const finalChar: AppliedCharacter = { ...pendingPhotoChar, gender };
    setCustomCharacters((prev) => [finalChar, ...prev]);
    handleApplyAndGenerate(finalChar);
    showToast(`"${finalChar.name}" 사진이 등록되어 적용되었습니다`);
    setPendingPhotoChar(null);
  };

  const handleDeleteCustomChar = (id: string, name: string) => {
    setCustomCharacters((prev) => prev.filter((c) => c.id !== id));
    showToast(`${name} 캐릭터가 삭제되었습니다`);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#0a0a0b]">
      <input ref={photoUploadRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 border-b border-white/5 bg-[#0d0d0f] px-3 md:px-5 py-2.5 md:py-3 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[140px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-sm" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="이름, 태그 검색..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900/60 border border-white/5 text-xs text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/40 transition-colors"
          />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors"><i className="ri-close-line text-xs" /></button>}
        </div>

        {/* Gender filter */}
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 rounded-xl p-1 flex-shrink-0">
          {(['전체', '여자', '남자'] as GenderFilter[]).map((g) => (
            <button key={g} onClick={() => setGenderFilter(g)} className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${genderFilter === g ? g === '여자' ? 'bg-rose-500/20 text-rose-300' : g === '남자' ? 'bg-sky-500/20 text-sky-300' : 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{g}</button>
          ))}
        </div>

        <span className="text-[11px] text-zinc-600 whitespace-nowrap hidden sm:inline">{isMyCharTab ? `${allCustomChars.length}개` : `${displayList.length}개`}</span>

        {/* View mode */}
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 rounded-xl p-1 ml-auto flex-shrink-0">
          <button onClick={() => setViewMode('grid')} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-600 hover:text-zinc-300'}`} title="그리드 뷰"><i className="ri-grid-fill text-sm" /></button>
          <button onClick={() => setViewMode('list')} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-600 hover:text-zinc-300'}`} title="리스트 뷰"><i className="ri-list-check-2 text-sm" /></button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3 md:p-4">

          {/* My Characters */}
          {isMyCharTab ? (
            allCustomChars.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-zinc-500">{allCustomChars.length}개의 내 캐릭터</p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowCustomModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-[10px] font-bold cursor-pointer hover:bg-indigo-500/25 transition-all whitespace-nowrap"><i className="ri-sparkling-2-fill text-[9px]" />AI 생성</button>
                    <button onClick={() => photoUploadRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-[10px] font-bold cursor-pointer hover:border-zinc-500 hover:text-white transition-all whitespace-nowrap"><i className="ri-upload-2-line text-[9px]" />사진 등록</button>
                  </div>
                </div>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3' : 'flex flex-col gap-2'}>
                  {allCustomChars.map((cc) => (
                    viewMode === 'grid' ? (
                      <div key={cc.id} className="relative group cursor-pointer rounded-2xl overflow-hidden" onClick={() => handleApplyAndGenerate(cc)}>
                        <div className="w-full aspect-[3/4] overflow-hidden rounded-2xl relative">
                          <img src={cc.img} alt={cc.name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" />
                          <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${cc.gender === '여자' ? 'bg-rose-500/80 text-white' : 'bg-sky-500/80 text-white'}`}>{cc.gender}</div>
                          <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${cc.id.startsWith('photo_') ? 'bg-emerald-500/80 text-white' : 'bg-indigo-500/80 text-white'}`}>{cc.id.startsWith('photo_') ? '사진' : '커스텀'}</div>
                          {!cc.id.startsWith('ext_') && <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomChar(cc.id, cc.name); }} className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-red-500 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer z-10"><i className="ri-delete-bin-line text-white text-[10px]" /></button>}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-2"><p className="text-xs font-bold text-white truncate">{cc.name}</p></div>
                        </div>
                      </div>
                    ) : (
                      <div key={cc.id} className="flex items-center gap-3 md:gap-4 p-2.5 md:p-3 rounded-2xl border border-white/5 bg-zinc-900/40 hover:border-white/15 cursor-pointer group" onClick={() => handleApplyAndGenerate(cc)}>
                        <div className="w-12 h-[62px] md:w-14 md:h-[74px] rounded-xl overflow-hidden flex-shrink-0"><img src={cc.img} alt={cc.name} className="w-full h-full object-cover object-top" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-white">{cc.name}</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${cc.gender === '여자' ? 'bg-rose-500/15 text-rose-400' : 'bg-sky-500/15 text-sky-400'}`}>{cc.gender}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">{cc.tags.map((t, i) => <span key={i} className="text-[9px] text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded-md">{t}</span>)}</div>
                        </div>
                        {!cc.id.startsWith('ext_') && <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomChar(cc.id, cc.name); }} className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer flex-shrink-0"><i className="ri-delete-bin-line text-xs" /></button>}
                      </div>
                    )
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/8 flex items-center justify-center"><i className="ri-user-add-line text-xl text-zinc-600" /></div>
                <div><p className="text-sm font-bold text-zinc-400">내 캐릭터가 없습니다</p><p className="text-xs text-zinc-600 mt-1">AI 생성 또는 사진을 등록해보세요</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowCustomModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap"><i className="ri-sparkling-2-fill" />AI로 생성</button>
                  <button onClick={() => photoUploadRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white bg-zinc-900 text-xs font-bold cursor-pointer whitespace-nowrap transition-all"><i className="ri-upload-2-line" />사진 등록</button>
                </div>
              </div>
            )
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/8 flex items-center justify-center"><i className="ri-search-line text-xl text-zinc-600" /></div>
              <div><p className="text-sm font-bold text-zinc-400">검색 결과가 없습니다</p><p className="text-xs text-zinc-600 mt-1">다른 키워드나 필터를 시도해보세요</p></div>
              <button onClick={() => { setSearchQuery(''); setGenderFilter('전체'); }} className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors">필터 초기화</button>
            </div>
          ) : (
            <>
              {/* Category header */}
              {activeCategory !== '전체' && (
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${CATEGORY_COLORS[activeCategory] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                    <i className={`${CATEGORY_ICONS[activeCategory] ?? 'ri-apps-2-line'} text-sm`} />{activeCategory}
                  </div>
                  <span className="text-xs text-zinc-600">{displayList.length}개의 캐릭터</span>
                </div>
              )}

              {/* Saved section */}
              {savedCharIds.size > 0 && activeCategory === '전체' && !searchQuery && (
                <div className="mb-5 md:mb-6">
                  <div className="flex items-center gap-2 mb-3"><i className="ri-bookmark-fill text-amber-400 text-sm" /><span className="text-xs font-bold text-amber-300">저장된 캐릭터</span><span className="text-[10px] text-zinc-600">{savedCharIds.size}개</span></div>
                  <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3' : 'flex flex-col gap-2'}>
                    {characterTemplates.filter((c) => savedCharIds.has(c.id)).map((char) =>
                      viewMode === 'grid' ? (
                        <CharCard key={`saved_${char.id}`} char={char} isSelected={selectedCharId === char.id} isApplied={appliedCharacterId === char.id} isSaved={savedCharIds.has(char.id)}
                          onSelect={() => setSelectedCharId(selectedCharId === char.id ? null : char.id)}
                          onSave={() => handleSave(char.id, char.name)}
                          onDetail={() => setDetailModalCharId(char.id)}
                          onApplyAndGenerate={() => handleApplyAndGenerate(char)} />
                      ) : (
                        <CharRow key={`saved_${char.id}`} char={char} isSelected={selectedCharId === char.id} isApplied={appliedCharacterId === char.id} isSaved={savedCharIds.has(char.id)}
                          onSelect={() => setSelectedCharId(selectedCharId === char.id ? null : char.id)}
                          onSave={() => handleSave(char.id, char.name)}
                          onDetail={() => setDetailModalCharId(char.id)}
                          onApplyAndGenerate={() => handleApplyAndGenerate(char)} />
                      )
                    )}
                  </div>
                  <div className="w-full h-px bg-white/5 my-4 md:my-5" />
                </div>
              )}

              {/* Main grid */}
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3' : 'flex flex-col gap-2'}>
                {displayList.map((char) =>
                  viewMode === 'grid' ? (
                    <CharCard key={char.id} char={char} isSelected={selectedCharId === char.id} isApplied={appliedCharacterId === char.id} isSaved={savedCharIds.has(char.id)}
                      onSelect={() => setSelectedCharId(selectedCharId === char.id ? null : char.id)}
                      onSave={() => handleSave(char.id, char.name)}
                      onDetail={() => setDetailModalCharId(char.id)}
                      onApplyAndGenerate={() => handleApplyAndGenerate(char)} />
                  ) : (
                    <CharRow key={char.id} char={char} isSelected={selectedCharId === char.id} isApplied={appliedCharacterId === char.id} isSaved={savedCharIds.has(char.id)}
                      onSelect={() => setSelectedCharId(selectedCharId === char.id ? null : char.id)}
                      onSave={() => handleSave(char.id, char.name)}
                      onDetail={() => setDetailModalCharId(char.id)}
                      onApplyAndGenerate={() => handleApplyAndGenerate(char)} />
                  )
                )}
              </div>
            </>
          )}
        </div>
        {/* 우측 사이드 패널 완전 제거 — 팝업 모달로 대체 */}
      </div>

      {/* ── 캐릭터 상세 팝업 모달 (카드 클릭 시) ── */}
      {detailModalChar && (
        <CharacterDetailModal
          character={detailModalChar}
          isSelected={appliedCharacterId === detailModalChar.id}
          onClose={() => setDetailModalCharId(null)}
          onSelect={(id) => setSelectedCharId(selectedCharId === id ? null : id)}
          onApplyOnly={(char) => {
            handleApplyOnly(char);
            setDetailModalCharId(null);
          }}
          onApplyAndGenerate={(char) => {
            handleApplyAndGenerate(char);
            setDetailModalCharId(null);
          }}
        />
      )}

      {/* Modals */}
      {showCustomModal && <CustomCharacterModal onClose={() => setShowCustomModal(false)} onGenerate={(char) => { setCustomCharacters((prev) => [char, ...prev]); handleApplyAndGenerate(char); showToast(`${char.name} 커스텀 캐릭터가 생성되었습니다`); }} />}

      {/* Photo gender confirm */}
      {pendingPhotoChar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" onClick={() => setPendingPhotoChar(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-[360px] bg-[#111114] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 flex-shrink-0"><img src={pendingPhotoChar.img} alt="등록된 사진" className="w-full h-full object-cover object-top" /></div>
              <div><p className="text-sm font-bold text-white">사진이 등록되었습니다</p><p className="text-xs text-zinc-500 mt-0.5">캐릭터 성별을 선택해주세요</p></div>
            </div>
            <div className="mb-4">
              <p className="text-[11px] text-zinc-400 font-bold mb-1.5">캐릭터 이름 <span className="text-zinc-600 font-normal">(선택)</span></p>
              <input type="text" defaultValue={pendingPhotoChar.name} onChange={(e) => setPendingPhotoChar((prev) => prev ? { ...prev, name: e.target.value || prev.name } : null)} placeholder="이름을 입력하세요" maxLength={20} className="w-full px-3 py-2 rounded-xl bg-zinc-900/60 border border-white/8 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/50 transition-colors" />
            </div>
            <p className="text-[11px] text-zinc-400 font-bold mb-2">성별 선택</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[{ value: '여자' as const, icon: 'ri-women-line', color: 'rose', label: '여자' }, { value: '남자' as const, icon: 'ri-men-line', color: 'sky', label: '남자' }].map((g) => (
                <button key={g.value} onClick={() => handleConfirmPhotoGender(g.value)} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${g.color === 'rose' ? 'border-rose-500/30 bg-rose-500/8 hover:bg-rose-500/15 hover:border-rose-500/50' : 'border-sky-500/30 bg-sky-500/8 hover:bg-sky-500/15 hover:border-sky-500/50'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${g.color === 'rose' ? 'bg-rose-500/20' : 'bg-sky-500/20'}`}><i className={`${g.icon} text-lg ${g.color === 'rose' ? 'text-rose-400' : 'text-sky-400'}`} /></div>
                  <span className={`text-sm font-bold ${g.color === 'rose' ? 'text-rose-300' : 'text-sky-300'}`}>{g.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPendingPhotoChar(null)} className="w-full py-2 rounded-xl border border-zinc-700 text-zinc-500 hover:text-zinc-300 text-xs font-bold transition-colors cursor-pointer">취소</button>
          </div>
        </div>
      )}

      {toast && <SaveToast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
