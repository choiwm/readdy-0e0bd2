import { useState } from 'react';

const ratioOptions = [
  { id: '16:9', label: '16:9', sub: '유튜브, 데스크톱', icon: <div className="w-8 h-[18px] border-2 border-current rounded-sm" /> },
  { id: '1:1', label: '1:1', sub: '인스타그램, 소셜', icon: <div className="w-[18px] h-[18px] border-2 border-current rounded-sm" /> },
  { id: '3:4', label: '3:4', sub: '세로형 + 영상', icon: <div className="w-[14px] h-[19px] border-2 border-current rounded-sm" /> },
  { id: '9:16', label: '9:16', sub: '틱톡, 릴스, 쇼츠', icon: <div className="w-[11px] h-[20px] border-2 border-current rounded-sm" /> },
];

interface StyleOption {
  id: string;
  label: string;
  thumb: string;
}

const styleOptions: StyleOption[] = [
  { id: 'cartoon_studio', label: '카툰 스튜디오', thumb: 'https://readdy.ai/api/search-image?query=colorful%20cartoon%20animation%20studio%20style%20with%20bright%20bold%20colors%2C%20map%20with%20arrows%20and%20country%20flags%2C%20comic%20style%20illustration%20with%20vibrant%20flat%20colors%20and%20thick%20outlines%2C%20editorial%20explainer%20video%20aesthetic&width=160&height=100&seq=yt_s_cartoon_studio&orientation=landscape' },
  { id: 'cartoon', label: '카툰 해설', thumb: 'https://readdy.ai/api/search-image?query=cartoon%20explainer%20style%20with%20bold%20black%20outlines%20and%20flat%20colors%2C%20expressive%20round%20face%20character%20with%20shocked%20expression%2C%20red%20graph%20going%20up%20with%20Korean%20text%20overlay%2C%20news%20commentary%20illustration%20style&width=160&height=100&seq=yt_s_cartoon&orientation=landscape' },
  { id: 'sketch', label: '스케치 스타닥', thumb: 'https://readdy.ai/api/search-image?query=hand%20drawn%20pencil%20sketch%20storyboard%20style%20with%20rough%20gestural%20lines%20and%20minimal%20shading%2C%20monochrome%20drawing%20on%20cream%20paper%2C%20architectural%20and%20character%20sketches%20with%20loose%20artistic%20quality&width=160&height=100&seq=yt_s_sketch&orientation=landscape' },
  { id: 'mixed', label: '믹스미디어 콜라주', thumb: 'https://readdy.ai/api/search-image?query=mixed%20media%20collage%20with%20multiple%20diverse%20faces%20and%20newspaper%20magazine%20clippings%20layered%20together%2C%20vibrant%20colors%20with%20bold%20typography%20overlay%2C%20editorial%20photomontage%20style%20with%20cultural%20diversity%20theme&width=160&height=100&seq=yt_s_mixed&orientation=landscape' },
  { id: 'tonedown', label: '톤다운 믹스 콜라주', thumb: 'https://readdy.ai/api/search-image?query=muted%20toned%20down%20film%20collage%20with%20desaturated%20cinematic%20photographs%20layered%20together%2C%20dark%20moody%20atmosphere%20with%20film%20grain%20texture%2C%20sophisticated%20editorial%20mixed%20media%20collage&width=160&height=100&seq=yt_s_tonedown&orientation=landscape' },
  { id: 'photo', label: '포토 스타일', thumb: 'https://readdy.ai/api/search-image?query=realistic%20photography%20style%20classroom%20scene%20with%20students%20and%20teacher%2C%20natural%20warm%20lighting%2C%20shallow%20depth%20of%20field%2C%20documentary%20photo%20aesthetic%20with%20authentic%20candid%20moment&width=160&height=100&seq=yt_s_photo&orientation=landscape' },
  { id: 'film', label: '영화 스닥컷', thumb: 'https://readdy.ai/api/search-image?query=cinematic%20dark%20film%20still%20with%20woman%20in%20low%20key%20dramatic%20lighting%20looking%20down%2C%20deep%20shadows%20and%20moody%20atmosphere%2C%20Korean%20thriller%20movie%20aesthetic%20with%20high%20contrast%20black%20and%20white%20tones&width=160&height=100&seq=yt_s_film&orientation=landscape' },
  { id: 'news', label: '뉴스 스타일', thumb: 'https://readdy.ai/api/search-image?query=Korean%20drama%20office%20scene%20with%20suited%20businessmen%20in%20formal%20meeting%20room%2C%20television%20drama%20production%20quality%20lighting%2C%20corporate%20boardroom%20aesthetic%20with%20authoritative%20atmosphere&width=160&height=100&seq=yt_s_news&orientation=landscape' },
  { id: 'anime', label: '일본 애니메이션', thumb: 'https://readdy.ai/api/search-image?query=Japanese%20anime%20style%20cityscape%20at%20night%20with%20neon%20lights%20and%20rain%20reflections%2C%20vibrant%20cyberpunk%20city%20environment%20with%20detailed%20urban%20architecture%2C%20Makoto%20Shinkai%20inspired%20visual%20style&width=160&height=100&seq=yt_s_anime&orientation=landscape' },
  { id: '3d_anime', label: '3D 애니메이션', thumb: 'https://readdy.ai/api/search-image?query=3D%20animated%20Pixar%20style%20two%20young%20characters%20talking%20with%20expressive%20faces%2C%20soft%20warm%20lighting%20in%20cozy%20interior%20environment%2C%20high%20quality%20CGI%20rendering%20with%20subsurface%20scattering%20skin&width=160&height=100&seq=yt_s_3d_anime&orientation=landscape' },
  { id: 'webtoon', label: '웹툰 풀컷 일러스트', thumb: 'https://readdy.ai/api/search-image?query=Korean%20webtoon%20manhwa%20style%20full%20color%20illustration%20with%20clean%20line%20art%20and%20vibrant%20colors%2C%20office%20worker%20character%20with%20expressive%20emotions%2C%20detailed%20urban%20background%20with%20bright%20saturated%20palette&width=160&height=100&seq=yt_s_webtoon&orientation=landscape' },
  { id: 'flat_illust', label: '플랫 일러스트', thumb: 'https://readdy.ai/api/search-image?query=flat%20design%20illustration%20style%20with%20minimal%20geometric%20shapes%20and%20limited%20pastel%20color%20palette%2C%20clean%20modern%20infographic%20aesthetic%20with%20simple%20character%20and%20icon%20elements%2C%20Scandinavian%20inspired%20flat%20vector%20art&width=160&height=100&seq=yt_s_flat&orientation=landscape' },
  { id: 'korean_wild', label: '한국 야담', thumb: 'https://readdy.ai/api/search-image?query=traditional%20Korean%20folk%20tale%20illustration%20with%20ink%20wash%20painting%20style%2C%20fox%20spirit%20gumiho%20in%20hanbok%20with%20misty%20forest%20background%2C%20Joseon%20dynasty%20aesthetic%20with%20muted%20earthy%20tones%20and%20atmospheric%20depth&width=160&height=100&seq=yt_s_korean_wild&orientation=landscape' },
  { id: 'korean_webtoon', label: '한국 웹툰', thumb: 'https://readdy.ai/api/search-image?query=modern%20Korean%20webtoon%20romance%20style%20with%20beautiful%20character%20close%20up%20shot%2C%20soft%20pastel%20colors%20and%20detailed%20manga%20style%20illustration%2C%20cherry%20blossoms%20and%20dreamy%20bokeh%20background&width=160&height=100&seq=yt_s_korean_webtoon&orientation=landscape' },
  { id: 'retro_pixel', label: '레트로 픽셀 아트', thumb: 'https://readdy.ai/api/search-image?query=retro%20pixel%20art%20style%20with%2016-bit%20SNES%20era%20video%20game%20aesthetic%2C%20car%20driving%20on%20coastal%20road%20scene%20with%20chunky%20pixels%20and%20bright%20color%20palette%2C%20nostalgic%20RPG%20game%20screenshot%20style&width=160&height=100&seq=yt_s_pixel&orientation=landscape' },
  { id: 'us_cartoon', label: '미국 카툰', thumb: 'https://readdy.ai/api/search-image?query=American%20cartoon%20animation%20style%20with%20bold%20outlines%20and%20exaggerated%20expressions%2C%20angry%20young%20boy%20character%20with%20oversized%20head%2C%20Cartoon%20Network%20Adventure%20Time%20inspired%20flat%20colors%20and%20dynamic%20comic%20styling&width=160&height=100&seq=yt_s_us_cartoon&orientation=landscape' },
  { id: 'claymation', label: '클레이 애니메이션', thumb: 'https://readdy.ai/api/search-image?query=Aardman%20claymation%20stop%20motion%20style%20with%20textured%20clay%20sheep%20character%2C%20warm%20studio%20lighting%20and%20handmade%20feel%2C%20Shaun%20the%20Sheep%20inspired%20clay%20figure%20with%20visible%20fingerprints%20texture%20and%20woolly%20details&width=160&height=100&seq=yt_s_clay&orientation=landscape' },
  { id: 'pen_sketch', label: '펜 스케치', thumb: 'https://readdy.ai/api/search-image?query=detailed%20pen%20and%20ink%20architectural%20sketch%20with%20stacked%20boxes%20and%20crates%20illustration%2C%20fine%20line%20crosshatching%20technique%20on%20cream%20paper%20texture%2C%20precise%20technical%20pen%20drawing%20with%20dramatic%20shadows&width=160&height=100&seq=yt_s_pen&orientation=landscape' },
  { id: 'custom', label: '사용자 정의', thumb: '' },
];

const stylePreviewImages: Record<string, string> = {
  cartoon_studio: 'https://readdy.ai/api/search-image?query=colorful%20cartoon%20animation%20studio%20AI%20technology%20concept%20with%20bright%20bold%20colors%2C%20robot%20character%20explaining%20data%20charts%2C%20vibrant%20flat%20illustration%20explainer%20video%20style&width=480&height=270&seq=prev_cartoon_studio&orientation=landscape',
  cartoon: 'https://readdy.ai/api/search-image?query=cartoon%20explainer%20AI%20technology%20concept%20bold%20black%20outlines%20flat%20colors%2C%20shocked%20character%20looking%20at%20AI%20robot%2C%20news%20commentary%20illustration%20style%20bright%20colors&width=480&height=270&seq=prev_cartoon&orientation=landscape',
  sketch: 'https://readdy.ai/api/search-image?query=hand%20drawn%20pencil%20sketch%20AI%20technology%20concept%20rough%20gestural%20lines%20minimal%20shading%2C%20monochrome%20drawing%20cream%20paper%2C%20robot%20and%20human%20interaction%20sketch&width=480&height=270&seq=prev_sketch&orientation=landscape',
  mixed: 'https://readdy.ai/api/search-image?query=mixed%20media%20collage%20AI%20technology%20concept%20newspaper%20magazine%20clippings%20layered%20together%2C%20vibrant%20colors%20bold%20typography%20overlay%2C%20digital%20transformation%20editorial%20photomontage&width=480&height=270&seq=prev_mixed&orientation=landscape',
  tonedown: 'https://readdy.ai/api/search-image?query=muted%20toned%20down%20film%20collage%20AI%20technology%20concept%20desaturated%20cinematic%20photographs%20layered%2C%20dark%20moody%20atmosphere%20film%20grain%20texture%2C%20sophisticated%20editorial&width=480&height=270&seq=prev_tonedown&orientation=landscape',
  photo: 'https://readdy.ai/api/search-image?query=realistic%20photography%20AI%20technology%20concept%20natural%20warm%20lighting%20shallow%20depth%20of%20field%2C%20person%20working%20with%20AI%20interface%2C%20documentary%20photo%20aesthetic%20authentic&width=480&height=270&seq=prev_photo&orientation=landscape',
  film: 'https://readdy.ai/api/search-image?query=cinematic%20dark%20film%20AI%20technology%20concept%20low%20key%20dramatic%20lighting%20deep%20shadows%20moody%20atmosphere%2C%20futuristic%20server%20room%20thriller%20aesthetic%20high%20contrast&width=480&height=270&seq=prev_film&orientation=landscape',
  news: 'https://readdy.ai/api/search-image?query=news%20broadcast%20style%20AI%20technology%20concept%20suited%20presenter%20formal%20studio%20setting%2C%20television%20production%20quality%20lighting%20corporate%20authoritative%20atmosphere&width=480&height=270&seq=prev_news&orientation=landscape',
  anime: 'https://readdy.ai/api/search-image?query=Japanese%20anime%20style%20AI%20technology%20concept%20cityscape%20night%20neon%20lights%20rain%20reflections%2C%20cyberpunk%20city%20environment%20detailed%20urban%20architecture%20Makoto%20Shinkai%20inspired&width=480&height=270&seq=prev_anime&orientation=landscape',
  '3d_anime': 'https://readdy.ai/api/search-image?query=3D%20animated%20Pixar%20style%20AI%20technology%20concept%20expressive%20characters%20soft%20warm%20lighting%20cozy%20interior%2C%20high%20quality%20CGI%20rendering%20subsurface%20scattering&width=480&height=270&seq=prev_3d&orientation=landscape',
  webtoon: 'https://readdy.ai/api/search-image?query=Korean%20webtoon%20manhwa%20style%20AI%20technology%20concept%20full%20color%20illustration%20clean%20line%20art%20vibrant%20colors%2C%20office%20worker%20AI%20robot%20interaction%20bright%20saturated%20palette&width=480&height=270&seq=prev_webtoon&orientation=landscape',
  flat_illust: 'https://readdy.ai/api/search-image?query=flat%20design%20illustration%20AI%20technology%20concept%20minimal%20geometric%20shapes%20limited%20pastel%20color%20palette%2C%20clean%20modern%20infographic%20simple%20character%20icon%20elements%20Scandinavian&width=480&height=270&seq=prev_flat&orientation=landscape',
  korean_wild: 'https://readdy.ai/api/search-image?query=traditional%20Korean%20folk%20tale%20illustration%20ink%20wash%20painting%20style%20AI%20concept%2C%20misty%20forest%20background%20Joseon%20dynasty%20aesthetic%20muted%20earthy%20tones%20atmospheric%20depth&width=480&height=270&seq=prev_korean_wild&orientation=landscape',
  korean_webtoon: 'https://readdy.ai/api/search-image?query=modern%20Korean%20webtoon%20romance%20style%20AI%20technology%20concept%20beautiful%20character%20close%20up%20soft%20pastel%20colors%20detailed%20manga%20illustration%20cherry%20blossoms%20dreamy%20bokeh&width=480&height=270&seq=prev_korean_webtoon&orientation=landscape',
  retro_pixel: 'https://readdy.ai/api/search-image?query=retro%20pixel%20art%20style%20AI%20technology%20concept%2016-bit%20SNES%20era%20video%20game%20aesthetic%20chunky%20pixels%20bright%20color%20palette%20nostalgic%20RPG%20game%20screenshot&width=480&height=270&seq=prev_pixel&orientation=landscape',
  us_cartoon: 'https://readdy.ai/api/search-image?query=American%20cartoon%20animation%20style%20AI%20technology%20concept%20bold%20outlines%20exaggerated%20expressions%20oversized%20head%20character%2C%20Cartoon%20Network%20Adventure%20Time%20inspired%20flat%20colors%20dynamic&width=480&height=270&seq=prev_us_cartoon&orientation=landscape',
  claymation: 'https://readdy.ai/api/search-image?query=Aardman%20claymation%20stop%20motion%20style%20AI%20technology%20concept%20textured%20clay%20characters%20warm%20studio%20lighting%20handmade%20feel%20visible%20fingerprints%20texture&width=480&height=270&seq=prev_clay&orientation=landscape',
  pen_sketch: 'https://readdy.ai/api/search-image?query=detailed%20pen%20and%20ink%20AI%20technology%20concept%20fine%20line%20crosshatching%20technique%20cream%20paper%20texture%20precise%20technical%20pen%20drawing%20dramatic%20shadows%20robot%20human&width=480&height=270&seq=prev_pen&orientation=landscape',
};

interface Step1SettingsProps {
  onNext: (keywords?: string[], channelName?: string) => void;
  onBack: () => void;
  selectedStyle: string | null;
  selectedRatio: string;
  onStyleChange: (style: string | null) => void;
  onRatioChange: (ratio: string) => void;
  initialKeywords?: string[];
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Step1Settings({
  onNext,
  onBack,
  selectedStyle,
  selectedRatio,
  onStyleChange,
  onRatioChange,
  initialKeywords = [],
}: Step1SettingsProps) {
  const [cutSpeed, setCutSpeed] = useState<'fast' | 'slow'>('fast');
  const [generatingStyle, setGeneratingStyle] = useState<string | null>(null);
  const [generatedStyles, setGeneratedStyles] = useState<Set<string>>(new Set(['cartoon']));
  const [previewModalStyle, setPreviewModalStyle] = useState<string | null>(null);

  // Keyword state
  const [keywords, setKeywords] = useState<string[]>(initialKeywords.length > 0 ? initialKeywords : []);
  const [keywordInput, setKeywordInput] = useState('');
  const [channelName, setChannelName] = useState('');
  const [keywordError, setKeywordError] = useState(false);

  const addKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (keywords.length >= 5) return;
    if (keywords.includes(trimmed)) { setKeywordInput(''); return; }
    setKeywords((prev) => [...prev, trimmed]);
    setKeywordInput('');
    setKeywordError(false);
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addKeyword(); }
    if (e.key === 'Backspace' && keywordInput === '' && keywords.length > 0) {
      setKeywords((prev) => prev.slice(0, -1));
    }
  };

  const handleNext = () => {
    if (keywords.length === 0) {
      setKeywordError(true);
      return;
    }
    setKeywordError(false);
    onNext(keywords, channelName || undefined);
  };

  // Mobile drawer state
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  const handleStyleSelect = (styleId: string) => {
    if (selectedStyle === styleId) { onStyleChange(null); return; }
    onStyleChange(styleId);
    if (!generatedStyles.has(styleId) && styleId !== 'custom') {
      setGeneratingStyle(styleId);
      setTimeout(() => {
        setGeneratedStyles((prev) => new Set([...prev, styleId]));
        setGeneratingStyle(null);
      }, 1400);
    }
  };

  const handlePreviewClick = (e: React.MouseEvent, styleId: string) => {
    e.stopPropagation();
    if (generatedStyles.has(styleId)) setPreviewModalStyle(styleId);
  };

  const currentStyle = styleOptions.find((s) => s.id === selectedStyle);

  // Settings panel content (shared between desktop sidebar and mobile drawer)
  const SettingsPanelContent = () => (
    <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

      {/* Keywords */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">영상 키워드</p>
          <span className={`text-[10px] font-bold ${keywords.length >= 5 ? 'text-amber-400' : 'text-zinc-600'}`}>{keywords.length}/5</span>
        </div>

        {/* Tag input box */}
        <div className={`flex flex-wrap gap-1.5 min-h-[44px] bg-zinc-900/60 border rounded-xl px-3 py-2 transition-colors ${keywordError ? 'border-red-500/50' : 'border-zinc-800 focus-within:border-indigo-500/50'}`}>
          {keywords.map((kw) => (
            <span key={kw} className="flex items-center gap-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
              #{kw}
              <button
                onClick={() => removeKeyword(kw)}
                className="w-3.5 h-3.5 flex items-center justify-center text-indigo-400 hover:text-white cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line text-[10px]" />
              </button>
            </span>
          ))}
          {keywords.length < 5 && (
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => { setKeywordInput(e.target.value); setKeywordError(false); }}
              onKeyDown={handleKeywordKeyDown}
              placeholder={keywords.length === 0 ? '키워드 입력 후 Enter' : '추가 키워드...'}
              className="flex-1 min-w-[100px] bg-transparent text-xs text-white placeholder-zinc-600 focus:outline-none"
            />
          )}
        </div>

        {keywordError && (
          <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
            <i className="ri-error-warning-line text-[10px]" />
            키워드를 1개 이상 입력해주세요
          </p>
        )}

        {/* Quick keyword suggestions */}
        <div className="mt-2.5">
          <p className="text-[9px] text-zinc-600 mb-1.5">빠른 선택</p>
          <div className="flex flex-wrap gap-1">
            {['AI 트렌드', '건강 정보', '재테크', '여행 브이로그', '요리 레시피', '운동 루틴', '자기계발'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  if (keywords.length >= 5 || keywords.includes(suggestion)) return;
                  setKeywords((prev) => [...prev, suggestion]);
                  setKeywordError(false);
                }}
                disabled={keywords.includes(suggestion) || keywords.length >= 5}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                  keywords.includes(suggestion)
                    ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 cursor-default'
                    : keywords.length >= 5
                    ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
                    : 'border-zinc-700 text-zinc-500 hover:border-indigo-500/40 hover:text-indigo-400'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Channel Name */}
      <div>
        <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-3">채널명 (선택)</p>
        <input
          type="text"
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          placeholder="예: 테크인사이트, 일상브이로그..."
          className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {/* Ratio */}
      <div>
        <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-3">화면 비율</p>
        <div className="grid grid-cols-2 gap-2">
          {ratioOptions.map((r) => (
            <button
              key={r.id}
              onClick={() => onRatioChange(r.id)}
              className={`relative flex flex-col items-center justify-center gap-2.5 py-4 px-2 rounded-xl border transition-all cursor-pointer ${
                selectedRatio === r.id
                  ? 'border-indigo-500/60 bg-indigo-500/8'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60'
              }`}
            >
              {selectedRatio === r.id && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                  <i className="ri-check-line text-white text-[9px]" />
                </div>
              )}
              <div className={`flex items-center justify-center w-8 h-8 ${selectedRatio === r.id ? 'text-indigo-400' : 'text-zinc-500'}`}>
                {r.icon}
              </div>
              <div className="text-center">
                <p className={`text-sm font-black leading-none ${selectedRatio === r.id ? 'text-indigo-300' : 'text-zinc-300'}`}>{r.label}</p>
                <p className="text-[9px] text-zinc-600 mt-1 leading-tight">{r.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cut speed */}
      <div>
        <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-3">컷전환 속도</p>
        <div className="space-y-2">
          {[
            { id: 'fast', label: '빠르게', sub: '~5초마다 컷 전환', icon: 'ri-flashlight-line' },
            { id: 'slow', label: '느리게', sub: '~3-4문장마다 컷 전환', icon: 'ri-time-line' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setCutSpeed(opt.id as 'fast' | 'slow')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                cutSpeed === opt.id
                  ? 'border-indigo-500/60 bg-indigo-500/8'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${cutSpeed === opt.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-zinc-800 text-zinc-500'}`}>
                <i className={`${opt.icon} text-sm`} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className={`text-sm font-bold ${cutSpeed === opt.id ? 'text-indigo-300' : 'text-zinc-300'}`}>{opt.label}</p>
                <p className="text-[10px] text-zinc-600">{opt.sub}</p>
              </div>
              {cutSpeed === opt.id && (
                <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="ri-check-line text-white text-[9px]" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected style preview */}
      {selectedStyle && currentStyle && (
        <div>
          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-3">선택된 스타일</p>
          <div className="rounded-xl overflow-hidden border border-indigo-500/30 relative">
            {generatingStyle === selectedStyle ? (
              <div className="w-full h-[90px] bg-zinc-800 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-zinc-500">AI 이미지 생성 중...</span>
              </div>
            ) : generatedStyles.has(selectedStyle) ? (
              <>
                <img
                  src={stylePreviewImages[selectedStyle] || currentStyle.thumb}
                  alt={currentStyle.label}
                  className="w-full h-[90px] object-cover object-top"
                />
                <div className="absolute top-1.5 left-1.5 bg-emerald-500/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                  <i className="ri-sparkling-2-line text-[9px]" /> AI 생성됨
                </div>
              </>
            ) : (
              <img src={currentStyle.thumb} alt={currentStyle.label} className="w-full h-[90px] object-cover object-top" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
              <p className="text-xs font-bold text-white">{currentStyle.label}</p>
              <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                <i className="ri-check-line text-white text-[9px]" />
              </div>
            </div>
          </div>
          {generatedStyles.has(selectedStyle) && (
            <button
              onClick={(e) => handlePreviewClick(e, selectedStyle)}
              className="mt-2 w-full text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <i className="ri-zoom-in-line text-xs" /> 크게 보기
            </button>
          )}
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3.5 py-3">
        <i className="ri-alert-line text-amber-400 text-xs mt-0.5 flex-shrink-0" />
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          AI 안전 정책이 적용된 모델을 사용합니다. 정치적 인물, 군사/지정학적 갈등, 폭력적 상황 등의 콘텐츠는 안전 필터에 의해 이미지 생성이 거부될 수 있습니다.
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* ── Preview Modal ── */}
      {previewModalStyle && (() => {
        const s = styleOptions.find((o) => o.id === previewModalStyle);
        if (!s) return null;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={() => setPreviewModalStyle(null)}
          >
            <div
              className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div>
                  <p className="text-white font-bold text-sm">{s.label}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">AI 생성 미리보기</p>
                </div>
                <button
                  onClick={() => setPreviewModalStyle(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
              <div className="p-5">
                <img
                  src={stylePreviewImages[previewModalStyle] || s.thumb}
                  alt={s.label}
                  className="w-full rounded-xl object-cover object-top"
                  style={{ height: '300px' }}
                />
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-zinc-400">AI 생성 완료</span>
                  </div>
                  <button
                    onClick={() => { onStyleChange(previewModalStyle); setPreviewModalStyle(null); }}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-check-line" /> 이 스타일 선택
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Mobile Settings Drawer ── */}
      <div className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${showMobileSettings ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${showMobileSettings ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setShowMobileSettings(false)}
        />
        <div className={`absolute bottom-0 left-0 right-0 bg-[#0f0f11] border-t border-white/10 rounded-t-2xl max-h-[85vh] flex flex-col transition-transform duration-300 ease-out ${showMobileSettings ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <i className="ri-settings-3-line text-zinc-400 text-sm" />
              <span className="text-sm font-bold text-white">영상 설정</span>
            </div>
            <button
              onClick={() => setShowMobileSettings(false)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line" />
            </button>
          </div>
          <SettingsPanelContent />
          <div className="flex-shrink-0 border-t border-white/5 px-5 py-4 flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-arrow-left-line text-xs" />
              뒤로
            </button>
            <button
              onClick={() => {
                if (keywords.length === 0) { setKeywordError(true); return; }
                setShowMobileSettings(false);
                handleNext();
              }}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              다음
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Left Settings Panel (Desktop only) ── */}
      <div className="hidden md:flex w-[300px] flex-shrink-0 border-r border-white/5 bg-[#0f0f11] flex-col overflow-hidden">
        <SettingsPanelContent />
        {/* Bottom nav */}
        <div className="flex-shrink-0 border-t border-white/5 px-5 py-4 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-xs" />
            뒤로
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
          >
            다음
            <i className="ri-arrow-right-line text-sm" />
          </button>
        </div>
      </div>

      {/* ── Right Panel (Style Grid) ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0d0d0f]">

        {/* Header */}
        <div className="flex-shrink-0 px-3 md:px-6 pt-2.5 md:pt-3 pb-2 md:pb-2.5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-black text-white">스타일 선택</p>
            <p className="text-xs text-zinc-500 hidden md:block">스타일을 선택하면 AI가 샘플 이미지를 자동 생성합니다</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedStyle && (
              <span className="text-[10px] md:text-[11px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 md:px-3 py-1 rounded-full">
                {styleOptions.find((s) => s.id === selectedStyle)?.label}
              </span>
            )}
            {/* Mobile settings button */}
            <button
              onClick={() => setShowMobileSettings(true)}
              className="md:hidden flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-settings-3-line text-xs" />
              설정
              {selectedStyle && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
            </button>
          </div>
        </div>

        {/* Style grid */}
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
            {styleOptions.map((s) => {
              const isSelected = selectedStyle === s.id;
              const isGenerating = generatingStyle === s.id;
              const isGenerated = generatedStyles.has(s.id);

              return (
                <button
                  key={s.id}
                  onClick={() => handleStyleSelect(s.id)}
                  className={`relative rounded-xl overflow-hidden cursor-pointer transition-all group text-left ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-[#0d0d0f]'
                      : 'ring-1 ring-white/5 hover:ring-white/15'
                  }`}
                >
                  {s.thumb ? (
                    <div className="relative w-full h-[70px] md:h-[80px]">
                      <img
                        src={isGenerated ? (stylePreviewImages[s.id] || s.thumb) : s.thumb}
                        alt={s.label}
                        className="w-full h-full object-cover object-top"
                      />
                      {isGenerating && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-1">
                          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[9px] text-indigo-300 font-semibold">생성 중...</span>
                        </div>
                      )}
                      {isGenerated && !isGenerating && (
                        <div className="absolute top-1 left-1 bg-emerald-500/80 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <i className="ri-sparkling-2-line text-[8px]" /> AI
                        </div>
                      )}
                      {isGenerated && !isGenerating && (
                        <div
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={(e) => handlePreviewClick(e, s.id)}
                        >
                          <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <i className="ri-zoom-in-line text-white text-sm" />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-[70px] md:h-[80px] bg-zinc-800/60 flex flex-col items-center justify-center gap-1.5">
                      <i className="ri-sparkling-2-line text-zinc-500 text-xl" />
                      <span className="text-[9px] text-zinc-600">커스텀</span>
                    </div>
                  )}
                  <div className={`absolute inset-0 transition-all pointer-events-none ${
                    isSelected ? 'bg-indigo-500/15' : 'bg-black/20 group-hover:bg-black/5'
                  }`} />
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center z-10">
                      <i className="ri-check-line text-white text-[10px]" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pt-6 pb-1.5 md:pb-2 px-1.5 md:px-2">
                    <p className="text-[9px] md:text-[10px] text-white font-bold leading-tight truncate">{s.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden flex-shrink-0 border-t border-white/5 px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-arrow-left-line text-xs" />
            뒤로
          </button>
          <div className="flex items-center gap-2">
            {selectedStyle && (
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-full font-semibold whitespace-nowrap">
                {styleOptions.find((s) => s.id === selectedStyle)?.label}
              </span>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              다음
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
