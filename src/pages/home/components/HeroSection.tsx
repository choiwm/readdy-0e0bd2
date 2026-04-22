import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

type Tab = 'Image' | 'Video' | 'Assist';

const TAB_CONFIG: Record<Tab, { label: string; icon: string; to: string; placeholder: string }> = {
  Image: { label: '이미지', icon: 'ri-image-ai-line', to: '/ai-create', placeholder: '이미지를 묘사해보세요...' },
  Video: { label: '영상', icon: 'ri-video-ai-line', to: '/ai-create', placeholder: '영상 장면을 묘사해보세요...' },
  Assist: { label: '어시스트', icon: 'ri-robot-2-line', to: '/ai-shortcuts', placeholder: 'AI에게 무엇이든 물어보세요...' },
};

const EXAMPLE_PROMPTS: Record<Tab, string[]> = {
  Image: [
    '네온 불빛이 가득한 미래 도시의 야경',
    '우주복을 입은 귀여운 고양이',
    '가을의 미니멀한 일본 정원',
  ],
  Video: [
    '꽃이 피어나는 타임랩스 영상',
    '노을 지는 해변에 파도가 부서지는 장면',
    '빗속의 도시 거리, 시네마틱 스타일',
  ],
  Assist: [
    '제품 소개 문구를 작성해줘',
    '내 사진에 어울리는 SNS 캡션 만들어줘',
    '브랜드에 맞는 컬러 팔레트를 추천해줘',
  ],
};

const QUICK_LINKS = [
  { icon: 'ri-image-ai-line', label: 'AI 이미지', to: '/ai-create', color: 'from-indigo-500/20 to-violet-500/20', border: 'border-indigo-500/20', text: 'text-indigo-300' },
  { icon: 'ri-video-ai-line', label: 'AI 영상', to: '/ai-create', color: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/20', text: 'text-violet-300' },
  { icon: 'ri-music-ai-line', label: 'AI 사운드', to: '/ai-sound', color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/20', text: 'text-purple-300' },
  { icon: 'ri-robot-2-line', label: 'AI 자동화', to: '/ai-automation', color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/20', text: 'text-emerald-300' },
];

export default function HeroSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('Image');
  const [prompt, setPrompt] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tabs: Tab[] = ['Image', 'Video', 'Assist'];

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const { to } = TAB_CONFIG[activeTab];
    navigate(`${to}?prompt=${encodeURIComponent(prompt.trim())}&type=${activeTab.toUpperCase()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    textareaRef.current?.focus();
  };

  const handleMagicPrompt = () => {
    const examples = EXAMPLE_PROMPTS[activeTab];
    const random = examples[Math.floor(Math.random() * examples.length)];
    setPrompt(random);
    textareaRef.current?.focus();
  };

  return (
    <section className="relative min-h-[70vh] flex flex-col items-center justify-center pt-24 md:pt-28 pb-16 md:pb-20 px-4">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/15 blur-[160px] animate-pulse" />
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-violet-600/12 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-purple-600/10 blur-[180px]" />
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-indigo-400/40 animate-pulse"
            style={{ top: `${15 + i * 13}%`, left: `${10 + i * 15}%`, animationDelay: `${i * 0.5}s` }}
          />
        ))}
      </div>

      {/* Badge */}
      <Link to="/ai-create" className="relative z-10 mb-8 group cursor-pointer">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 rounded-full blur-sm opacity-40 group-hover:opacity-70 transition-opacity" />
        <div className="relative flex items-center gap-2 px-5 py-2 bg-[#0a0a0b]/80 backdrop-blur-xl rounded-full border border-white/10 group-hover:border-indigo-500/40 transition-colors">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
          </span>
          <span className="text-xs font-bold text-gray-300 tracking-wide">
            40+ AI 모델{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              지금 바로 사용 가능
            </span>
          </span>
        </div>
      </Link>

      {/* Headline */}
      <h1 className="relative z-10 text-center mb-3">
        <span className="block text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tight leading-[0.95]">
          Creator
        </span>
        <strong
          className="block text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 pb-2"
          style={{ backgroundSize: '200% auto', animation: 'shine 3s linear infinite' }}
        >
          Everything.
        </strong>
      </h1>

      <p className="relative z-10 text-gray-400 text-sm md:text-base text-center mb-8 md:mb-12 max-w-md font-medium">
        <strong className="text-gray-300">AI 이미지 생성</strong>, <strong className="text-gray-300">AI 영상 제작</strong>, <strong className="text-gray-300">AI 음성 합성</strong>까지.
        <br className="hidden sm:block" />
        프롬프트 하나로 크리에이터가 되어보세요.
      </p>

      {/* Prompt Box */}
      <div className="relative z-10 w-full max-w-2xl">
        <div className={`absolute -inset-px rounded-[1.4rem] bg-gradient-to-r from-indigo-500/30 via-violet-500/20 to-purple-500/20 blur-sm transition-opacity ${isFocused ? 'opacity-100' : 'opacity-60'}`} />
        <div className="relative bg-[#111114]/90 backdrop-blur-2xl border border-white/[0.08] rounded-[1.3rem] overflow-hidden shadow-[0_20px_60px_-15px_rgba(99,102,241,0.15)]">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={TAB_CONFIG[activeTab].placeholder}
            rows={2}
            className="w-full bg-transparent text-white placeholder-gray-600 px-4 md:px-6 pt-4 md:pt-5 pb-2 text-sm md:text-base resize-none outline-none font-medium"
          />
          <div className="flex items-center justify-between px-3 md:px-4 pb-3 pt-0.5 gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {activeTab === tab && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 opacity-20" />
                  )}
                  <span className="w-3.5 h-3.5 flex items-center justify-center relative z-10">
                    <i className={`${TAB_CONFIG[tab].icon} text-xs`} />
                  </span>
                  <span className="relative z-10">{TAB_CONFIG[tab].label}</span>
                </button>
              ))}
              <div className="w-px h-5 bg-white/10 mx-1" />
              <button
                onClick={handleMagicPrompt}
                title="랜덤 프롬프트 추천"
                className="p-2 rounded-xl text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer"
              >
                <i className="ri-magic-line text-sm" />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {prompt.trim() && (
                <span className="text-[10px] text-zinc-400 hidden sm:block">⌘+Enter</span>
              )}
              {/* 개선된 Generate 버튼 */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="group relative flex items-center gap-2 px-4 h-10 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 hover:scale-[1.03] whitespace-nowrap"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 transition-opacity group-hover:opacity-90" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400" />
                <i className="ri-sparkling-2-fill text-white text-sm relative z-10 group-hover:rotate-12 transition-transform duration-300" />
                <span className="text-white text-xs font-bold relative z-10 tracking-wide">생성하기</span>
              </button>
            </div>
          </div>
        </div>

        {/* Example prompts */}
        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#111114]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl z-50">
            <div className="px-4 py-2.5 border-b border-white/5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">예시 프롬프트</span>
            </div>
            <div className="p-2">
              {EXAMPLE_PROMPTS[activeTab].map((example) => (
                <button
                  key={example}
                  onMouseDown={() => handleExampleClick(example)}
                  className="w-full text-left px-3 py-2.5 rounded-xl text-xs md:text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-sparkling-2-line text-indigo-400/60 text-xs flex-shrink-0" />
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Start CTA Buttons */}
      <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3">
        <span className="text-xs text-zinc-400 font-medium mr-1">바로 시작하기</span>
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`group flex items-center gap-2 px-4 py-2 rounded-full border ${item.border} bg-gradient-to-r ${item.color} hover:border-white/20 transition-all duration-300 hover:scale-105 cursor-pointer`}
          >
            <span className={`w-4 h-4 flex items-center justify-center ${item.text}`}>
              <i className={`${item.icon} text-sm`} />
            </span>
            <span className={`text-xs font-semibold ${item.text} whitespace-nowrap`}>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Social proof */}
      <div className="relative z-10 mt-6 flex items-center gap-3">
        <div className="flex -space-x-2">
          {['https://readdy.ai/api/search-image?query=young%20asian%20woman%20professional%20headshot%20portrait%20clean%20white%20background%20studio%20lighting%20high%20quality%20photo%20realistic&width=40&height=40&seq=sp1&orientation=squarish',
            'https://readdy.ai/api/search-image?query=young%20man%20creative%20professional%20headshot%20portrait%20clean%20background%20studio%20lighting%20high%20quality%20photo%20realistic&width=40&height=40&seq=sp2&orientation=squarish',
            'https://readdy.ai/api/search-image?query=woman%20designer%20headshot%20portrait%20clean%20background%20studio%20lighting%20high%20quality%20photo%20realistic&width=40&height=40&seq=sp3&orientation=squarish',
          ].map((src, i) => (
            <div key={i} className="w-7 h-7 rounded-full border-2 border-[#0a0a0b] overflow-hidden flex-shrink-0">
              <img src={src} alt="user" className="w-full h-full object-cover object-top" />
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-300">
          <span className="text-white font-semibold">12,000+</span> 크리에이터가 이미 사용 중
        </p>
      </div>

      <style>{`
        @keyframes shine {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </section>
  );
}
