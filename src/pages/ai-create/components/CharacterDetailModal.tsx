import { useEffect } from 'react';

interface CharacterTemplate {
  id: string;
  name: string;
  gender: '여자' | '남자';
  tags: string[];
  img: string;
}

interface CharacterDetailModalProps {
  character: CharacterTemplate | null;
  isSelected: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onApplyAndGenerate?: (character: CharacterTemplate) => void;
  onApplyOnly?: (character: CharacterTemplate) => void;
}

const characterDetails: Record<string, {
  personality: string;
  style: string;
  useCases: string[];
  voiceTone: string;
  age: string;
}> = {
  f1: { personality: '청순하고 순수한 이미지로 신뢰감을 주는 캐릭터', style: '내추럴 & 미니멀', useCases: ['뷰티 콘텐츠', '라이프스타일', '교육 콘텐츠'], voiceTone: '부드럽고 차분한 톤', age: '20대 초반' },
  f2: { personality: '밝고 따뜻한 에너지로 친근감을 주는 캐릭터', style: '캐주얼 & 웜톤', useCases: ['SNS 콘텐츠', '음식 리뷰', '여행 브이로그'], voiceTone: '밝고 활기찬 톤', age: '20대 중반' },
  f3: { personality: '세련되고 편안한 분위기의 트렌디한 캐릭터', style: '모던 캐주얼', useCases: ['패션 콘텐츠', '라이프스타일', '인테리어'], voiceTone: '자연스럽고 편안한 톤', age: '20대 후반' },
  f4: { personality: '프로페셔널하고 신뢰감 있는 비즈니스 캐릭터', style: '비즈니스 포멀', useCases: ['기업 홍보', '금융/보험', '교육 서비스'], voiceTone: '명확하고 신뢰감 있는 톤', age: '30대 초반' },
  f5: { personality: '모던하고 고급스러운 엘레강스 캐릭터', style: '모던 엘레강스', useCases: ['럭셔리 브랜드', '뷰티', '패션'], voiceTone: '세련되고 우아한 톤', age: '20대 후반' },
  f6: { personality: '세련되고 자연스러운 매력의 캐릭터', style: '비즈니스 캐주얼', useCases: ['IT/테크', '스타트업', '마케팅'], voiceTone: '전문적이고 친근한 톤', age: '30대 초반' },
  f7: { personality: '클래식하고 우아한 분위기의 캐릭터', style: '클래식 포멀', useCases: ['법률/금융', '교육', '공공기관'], voiceTone: '격식 있고 신뢰감 있는 톤', age: '30대 중반' },
  f8: { personality: '트렌디하고 생동감 넘치는 에너지의 캐릭터', style: '트렌디 캐주얼', useCases: ['엔터테인먼트', 'SNS', '게임'], voiceTone: '활기차고 트렌디한 톤', age: '20대 초반' },
  f9: { personality: '독특하고 강렬한 인상의 아티스틱 캐릭터', style: '아방가르드', useCases: ['아트/디자인', '패션', '뮤직'], voiceTone: '개성 있고 독창적인 톤', age: '20대 후반' },
  f10: { personality: '귀엽고 밝은 에너지의 사랑스러운 캐릭터', style: '큐트 & 걸리시', useCases: ['키즈 콘텐츠', '뷰티', '식품'], voiceTone: '귀엽고 밝은 톤', age: '20대 초반' },
  f11: { personality: '모던하고 세련된 분위기의 에디토리얼 캐릭터', style: '에디토리얼 패션', useCases: ['패션 매거진', '럭셔리', '뷰티'], voiceTone: '세련되고 트렌디한 톤', age: '20대 후반' },
  f12: { personality: '글로벌하고 화사한 분위기의 캐릭터', style: '글로벌 & 프레시', useCases: ['글로벌 브랜드', '여행', '라이프스타일'], voiceTone: '밝고 국제적인 톤', age: '20대 중반' },
  m1: { personality: '지적이고 신뢰감 있는 전문가 이미지의 캐릭터', style: '비즈니스 캐주얼', useCases: ['IT/테크', '교육', '금융'], voiceTone: '차분하고 신뢰감 있는 톤', age: '30대 초반' },
  m2: { personality: '친근하고 따뜻한 에너지의 캐주얼 캐릭터', style: '캐주얼 & 프렌들리', useCases: ['라이프스타일', 'SNS', '음식'], voiceTone: '친근하고 따뜻한 톤', age: '20대 후반' },
  m3: { personality: '모던하고 세련된 비즈니스 감각의 캐릭터', style: '모던 비즈니스', useCases: ['기업 홍보', '금융', '컨설팅'], voiceTone: '전문적이고 세련된 톤', age: '30대 초반' },
  m4: { personality: '트렌디하고 젊은 에너지의 스트리트 캐릭터', style: '스트리트 패션', useCases: ['패션', '엔터테인먼트', '게임'], voiceTone: '트렌디하고 활기찬 톤', age: '20대 초반' },
  m5: { personality: '클래식하고 격식 있는 엘레강스 캐릭터', style: '클래식 포멀', useCases: ['법률/금융', '럭셔리', '공공기관'], voiceTone: '격식 있고 권위 있는 톤', age: '40대 초반' },
  m6: { personality: '아티스틱하고 크리에이티브한 감성의 캐릭터', style: '아티스틱 & 크리에이티브', useCases: ['아트/디자인', '뮤직', '영화'], voiceTone: '감성적이고 창의적인 톤', age: '20대 후반' },
  m7: { personality: '스포티하고 활동적인 에너지의 캐릭터', style: '스포티 & 액티브', useCases: ['스포츠', '헬스/피트니스', '아웃도어'], voiceTone: '활기차고 에너지 넘치는 톤', age: '20대 중반' },
  m8: { personality: '자연스럽고 따뜻한 매력의 라이프스타일 캐릭터', style: '내추럴 라이프스타일', useCases: ['여행', '음식', '라이프스타일'], voiceTone: '따뜻하고 자연스러운 톤', age: '30대 초반' },
  m9: { personality: '강인하고 카리스마 있는 인상의 캐릭터', style: '다크 & 카리스마', useCases: ['액션/스릴러', '자동차', '스포츠'], voiceTone: '강렬하고 카리스마 있는 톤', age: '30대 중반' },
  m10: { personality: '청순하고 순수한 이미지의 청년 캐릭터', style: '큐트 & 프레시', useCases: ['키즈/청소년', '교육', '엔터테인먼트'], voiceTone: '순수하고 밝은 톤', age: '20대 초반' },
  m11: { personality: '글로벌하고 세련된 인터내셔널 캐릭터', style: '인터내셔널 비즈니스', useCases: ['글로벌 브랜드', '항공/여행', '럭셔리'], voiceTone: '세련되고 국제적인 톤', age: '30대 초반' },
  m12: { personality: '신선하고 밝은 에너지의 청년 캐릭터', style: '프레시 & 내추럴', useCases: ['식품/음료', '라이프스타일', 'SNS'], voiceTone: '밝고 신선한 톤', age: '20대 중반' },
};

export default function CharacterDetailModal({
  character,
  isSelected,
  onClose,
  onSelect,
  onApplyAndGenerate,
  onApplyOnly,
}: CharacterDetailModalProps) {
  useEffect(() => {
    if (!character) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [character, onClose]);

  if (!character) return null;

  const detail = characterDetails[character.id] ?? {
    personality: '다양한 콘텐츠에 활용 가능한 AI 캐릭터',
    style: '멀티 스타일',
    useCases: ['다양한 콘텐츠'],
    voiceTone: '자연스러운 톤',
    age: '20대',
  };

  const isGirl = character.gender === '여자';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-[680px] max-h-[90vh] overflow-hidden rounded-3xl bg-[#111114] border border-white/10 shadow-2xl flex"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left — large photo */}
        <div className="w-[260px] flex-shrink-0 relative overflow-hidden">
          <img
            src={character.img}
            alt={character.name}
            className="w-full h-full object-cover object-top"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111114]/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111114]/80 via-transparent to-transparent" />

          {/* Gender badge */}
          <div className={`absolute top-4 left-4 px-2.5 py-1 rounded-full text-xs font-bold ${
            isGirl ? 'bg-rose-500/90 text-white' : 'bg-sky-500/90 text-white'
          }`}>
            {character.gender}
          </div>

          {/* Name on photo */}
          <div className="absolute bottom-5 left-5">
            <p className="text-2xl font-black text-white tracking-tight">{character.name}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{detail.age} · {detail.style}</p>
          </div>
        </div>

        {/* Right — details */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
          >
            <i className="ri-close-line text-white text-sm" />
          </button>

          {/* Header */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isGirl ? 'bg-rose-500/20' : 'bg-sky-500/20'
              }`}>
                <i className={`ri-user-fill text-sm ${
                  isGirl ? 'text-rose-400' : 'text-sky-400'
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{character.name}</h3>
                <p className="text-[11px] text-zinc-500">AI 캐릭터 템플릿 · ID: {character.id.toUpperCase()}</p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {character.tags.map((tag, i) => (
                <span
                  key={i}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    isGirl
                      ? 'bg-rose-500/15 text-rose-300'
                      : 'bg-sky-500/15 text-sky-300'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-white/5 mb-5" />

          {/* Info sections */}
          <div className="space-y-4 flex-1">
            {/* Personality */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-sparkling-2-fill text-indigo-400 text-sm" />
                </div>
                <p className="text-xs font-bold text-zinc-300">캐릭터 특성</p>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed pl-6">{detail.personality}</p>
            </div>

            {/* Voice tone */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-mic-2-fill text-violet-400 text-sm" />
                </div>
                <p className="text-xs font-bold text-zinc-300">보이스 톤</p>
              </div>
              <p className="text-sm text-zinc-400 pl-6">{detail.voiceTone}</p>
            </div>

            {/* Style */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-palette-fill text-amber-400 text-sm" />
                </div>
                <p className="text-xs font-bold text-zinc-300">스타일</p>
              </div>
              <p className="text-sm text-zinc-400 pl-6">{detail.style}</p>
            </div>

            {/* Use cases */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-film-fill text-emerald-400 text-sm" />
                </div>
                <p className="text-xs font-bold text-zinc-300">추천 활용 분야</p>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                {detail.useCases.map((uc, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800/80 text-zinc-300 text-[11px] font-medium border border-white/5"
                  >
                    {uc}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: '해상도', value: '4K UHD', icon: 'ri-hd-fill' },
                { label: '표정 다양성', value: '32가지', icon: 'ri-emotion-fill' },
                { label: '의상 변경', value: '지원', icon: 'ri-t-shirt-fill' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-zinc-900/60 border border-white/5"
                >
                  <div className="w-6 h-6 flex items-center justify-center">
                    <i className={`${stat.icon} text-indigo-400 text-base`} />
                  </div>
                  <p className="text-xs font-bold text-white">{stat.value}</p>
                  <p className="text-[10px] text-zinc-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 mt-5 pt-4 border-t border-white/5">
            {/* 이미지 생성 버튼 — 메인 CTA */}
            {onApplyAndGenerate && (
              <button
                onClick={() => {
                  onApplyAndGenerate(character);
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
              >
                <i className="ri-sparkling-2-fill text-base" />
                이 캐릭터로 이미지 생성하기
                <span className="text-xs opacity-70 ml-1">→ 생성 탭</span>
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
              >
                닫기
              </button>
              {/* 선택만 하기 — 생성 탭 이동 없이 캐릭터만 적용 */}
              <button
                onClick={() => {
                  if (onApplyOnly) {
                    onApplyOnly(character);
                  } else {
                    onSelect(character.id);
                  }
                  onClose();
                }}
                className={`flex-[2] py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 ${
                  isSelected
                    ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30'
                    : 'bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 hover:text-white'
                }`}
              >
                {isSelected ? (
                  <>
                    <i className="ri-check-line text-indigo-400" />
                    적용 중 · 해제하기
                  </>
                ) : (
                  <>
                    <i className="ri-user-add-line" />
                    생성 탭에 적용
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
