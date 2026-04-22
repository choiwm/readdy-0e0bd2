import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tvcSamples } from '@/mocks/tvcSamples';

const FEATURE_SHOWCASES = [
  {
    id: 'image',
    icon: 'ri-image-ai-line',
    label: 'AI 이미지',
    color: 'from-indigo-500/20 to-violet-500/20',
    borderColor: 'border-indigo-500/30',
    textColor: 'text-indigo-300',
    route: '/ai-create',
    items: [
      {
        id: 1,
        title: '사이버펑크 도시 야경',
        tag: 'Flux Pro Ultra',
        img: 'https://readdy.ai/api/search-image?query=cyberpunk%20neon%20city%20night%20scene%20with%20glowing%20signs%20and%20rain%20reflections%20on%20streets%2C%20ultra%20detailed%20cinematic%20photography%2C%20futuristic%20urban%20landscape%20with%20purple%20and%20cyan%20lights%2C%20dramatic%20atmosphere&width=400&height=300&seq=gc_img1&orientation=landscape',
      },
      {
        id: 2,
        title: '미니멀 제품 광고',
        tag: 'Flux Realism',
        img: 'https://readdy.ai/api/search-image?query=minimalist%20luxury%20perfume%20bottle%20on%20white%20marble%20surface%20with%20soft%20shadow%2C%20clean%20product%20photography%2C%20elegant%20simple%20background%2C%20high-end%20commercial%20advertisement%20style&width=400&height=300&seq=gc_img2&orientation=landscape',
      },
      {
        id: 3,
        title: '판타지 포트레이트',
        tag: 'Flux Pro',
        img: 'https://readdy.ai/api/search-image?query=beautiful%20korean%20woman%20with%20ethereal%20fantasy%20makeup%20and%20glowing%20magical%20particles%20around%20her%2C%20cinematic%20portrait%20photography%2C%20dark%20mystical%20background%20with%20soft%20bokeh%2C%20high%20fashion%20editorial&width=400&height=300&seq=gc_img3&orientation=landscape',
      },
      {
        id: 4,
        title: '건축 인테리어',
        tag: 'Flux Realism',
        img: 'https://readdy.ai/api/search-image?query=modern%20minimalist%20living%20room%20interior%20with%20floor%20to%20ceiling%20windows%2C%20natural%20light%20flooding%20in%2C%20neutral%20tones%20with%20warm%20wood%20accents%2C%20architectural%20photography%2C%20luxury%20home%20design&width=400&height=300&seq=gc_img4&orientation=landscape',
      },
      {
        id: 5,
        title: '음식 스타일링',
        tag: 'Flux Pro',
        img: 'https://readdy.ai/api/search-image?query=gourmet%20korean%20bibimbap%20bowl%20with%20colorful%20vegetables%20and%20egg%20on%20top%2C%20professional%20food%20photography%2C%20dark%20moody%20background%2C%20restaurant%20menu%20style%2C%20appetizing%20presentation&width=400&height=300&seq=gc_img5&orientation=landscape',
      },
    ],
  },
  {
    id: 'sound',
    icon: 'ri-music-ai-line',
    label: 'AI 사운드',
    color: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-300',
    route: '/ai-sound',
    items: [
      {
        id: 1,
        title: '광고 BGM — 에너지틱',
        tag: 'Suno AI',
        img: 'https://readdy.ai/api/search-image?query=dynamic%20energetic%20music%20wave%20visualization%20with%20bright%20orange%20and%20yellow%20colors%2C%20abstract%20sound%20wave%20art%2C%20music%20production%20studio%20concept%2C%20vibrant%20neon%20glow%20effect&width=400&height=300&seq=gc_snd1&orientation=landscape',
      },
      {
        id: 2,
        title: '감성 피아노 배경음',
        tag: 'Suno AI',
        img: 'https://readdy.ai/api/search-image?query=elegant%20piano%20keys%20with%20soft%20blue%20light%20and%20musical%20notes%20floating%2C%20emotional%20music%20concept%20art%2C%20dark%20background%20with%20gentle%20glow%2C%20classical%20music%20atmosphere&width=400&height=300&seq=gc_snd2&orientation=landscape',
      },
      {
        id: 3,
        title: 'AI 내레이션 TTS',
        tag: 'ElevenLabs',
        img: 'https://readdy.ai/api/search-image?query=microphone%20with%20sound%20wave%20visualization%20and%20glowing%20particles%2C%20professional%20voice%20recording%20studio%20concept%2C%20dark%20background%20with%20teal%20and%20green%20light%20effects%2C%20podcast%20recording&width=400&height=300&seq=gc_snd3&orientation=landscape',
      },
      {
        id: 4,
        title: '영화 효과음 SFX',
        tag: 'ElevenLabs',
        img: 'https://readdy.ai/api/search-image?query=cinematic%20sound%20effect%20explosion%20with%20dramatic%20light%20burst%20and%20particle%20effects%2C%20movie%20sound%20design%20concept%20art%2C%20dark%20dramatic%20background%20with%20orange%20and%20red%20glow&width=400&height=300&seq=gc_snd4&orientation=landscape',
      },
      {
        id: 5,
        title: '로파이 힙합 BGM',
        tag: 'Suno AI',
        img: 'https://readdy.ai/api/search-image?query=lofi%20hip%20hop%20aesthetic%20with%20vinyl%20record%20and%20headphones%20on%20wooden%20desk%2C%20warm%20cozy%20atmosphere%20with%20plants%20and%20city%20view%20at%20night%2C%20nostalgic%20music%20concept%20art&width=400&height=300&seq=gc_snd5&orientation=landscape',
      },
    ],
  },
];

export default function GetCreativeSection() {
  const navigate = useNavigate();
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const [activeTab, setActiveTab] = useState<'tvc' | 'image' | 'sound'>('tvc');

  const handleMouseEnter = (id: number) => {
    videoRefs.current[id]?.play();
  };

  const handleMouseLeave = (id: number) => {
    const v = videoRefs.current[id];
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };

  const activeShowcase = FEATURE_SHOWCASES.find((f) => f.id === activeTab);

  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-violet-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="w-[90%] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 md:mb-10 gap-3">
          <div>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-400 mb-2 block">
              Curated Collections
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Get{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                Creative
              </span>{' '}
              <span className="text-2xl">🎨</span>
            </h2>
            <p className="text-gray-600 text-sm font-medium mt-2">
              AiMetaWOW로 만든 실제 결과물들을 확인해보세요
            </p>
          </div>
          <button
            onClick={() => navigate(activeTab === 'tvc' ? '/automation-studio' : activeShowcase?.route ?? '/ai-create')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            {activeTab === 'tvc' ? '광고 만들기' : activeTab === 'image' ? '이미지 생성하기' : '사운드 만들기'}
            <i className="ri-arrow-right-line" />
          </button>
        </div>

        {/* Tab Switcher — scrollable on mobile */}
        <div className="overflow-x-auto pb-1 mb-6 md:mb-8 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1.5 w-fit min-w-full sm:min-w-0">
            {[
              { id: 'tvc', icon: 'ri-movie-ai-line', label: 'TVC 광고' },
              { id: 'image', icon: 'ri-image-ai-line', label: 'AI 이미지' },
              { id: 'sound', icon: 'ri-music-ai-line', label: 'AI 사운드' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'tvc' | 'image' | 'sound')}
                className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-200 whitespace-nowrap cursor-pointer flex-1 sm:flex-none justify-center sm:justify-start ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className={tab.icon} />
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TVC Tab */}
        {activeTab === 'tvc' && (
          <div>
            <div className="flex items-center gap-3 mb-5 md:mb-6 flex-wrap">
              <span className="text-xl">📺</span>
              <h3 className="text-base font-black text-white">AI 광고 영상 샘플</h3>
              <div className="h-px w-16 bg-gradient-to-r from-white/15 to-transparent hidden sm:block" />
              <span className="text-xs text-zinc-500 hidden sm:block">마우스를 올리면 영상이 재생됩니다</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {tvcSamples.map((item) => (
                <div
                  key={item.id}
                  className="group cursor-pointer"
                  onMouseEnter={() => handleMouseEnter(item.id)}
                  onMouseLeave={() => handleMouseLeave(item.id)}
                  onClick={() => navigate('/automation-studio')}
                >
                  <div className="relative rounded-xl md:rounded-2xl overflow-hidden border border-white/[0.06] group-hover:border-indigo-500/40 transition-all duration-500 group-hover:-translate-y-1">
                    <div className="overflow-hidden">
                      <video
                        ref={(el) => { videoRefs.current[item.id] = el; }}
                        src={item.videoSrc}
                        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        loop
                        muted
                        playsInline
                        preload="metadata"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex items-center gap-1.5 bg-indigo-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                        <i className="ri-sparkling-2-fill text-xs" /> 이 스타일로 만들기
                      </div>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-black/60 backdrop-blur-sm text-white/70 text-[9px] font-bold px-2 py-0.5 rounded-full border border-white/10">
                        {item.category}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 md:mt-3 text-xs md:text-sm font-bold text-gray-300 group-hover:text-white transition-colors truncate">
                    {item.title}
                  </p>
                  <p className="text-[10px] md:text-[11px] text-gray-600 group-hover:text-gray-500 transition-colors truncate mt-0.5">
                    {item.category}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 md:mt-8 flex justify-center">
              <button
                onClick={() => navigate('/ai-ad')}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 hover:from-indigo-500/30 hover:to-violet-500/30 border border-indigo-500/30 text-indigo-300 font-bold text-sm px-5 md:px-6 py-3 rounded-2xl transition-all cursor-pointer whitespace-nowrap hover:scale-[1.02]"
              >
                <i className="ri-movie-ai-line" />
                AI 광고 영상 만들기
                <i className="ri-arrow-right-line" />
              </button>
            </div>
          </div>
        )}

        {/* Image / Sound Tab */}
        {(activeTab === 'image' || activeTab === 'sound') && activeShowcase && (
          <div>
            <div className="flex items-center gap-3 mb-5 md:mb-6 flex-wrap">
              <span className="w-6 h-6 flex items-center justify-center text-xl">
                <i className={activeShowcase.icon} />
              </span>
              <h3 className="text-base font-black text-white">
                {activeTab === 'image' ? 'AI 이미지 생성 샘플' : 'AI 사운드 생성 샘플'}
              </h3>
              <div className="h-px w-16 bg-gradient-to-r from-white/15 to-transparent hidden sm:block" />
              <span className="text-xs text-zinc-500 hidden sm:block">
                {activeTab === 'image' ? '클릭하면 직접 생성해볼 수 있어요' : '클릭하면 직접 만들어볼 수 있어요'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
              {activeShowcase.items.map((item) => (
                <div
                  key={item.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(activeShowcase.route)}
                >
                  <div className="relative rounded-xl md:rounded-2xl overflow-hidden border border-white/[0.06] group-hover:border-white/[0.2] transition-all duration-500 group-hover:-translate-y-1 aspect-[4/3]">
                    <img
                      src={item.img}
                      alt={item.title}
                      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.06]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className={`flex items-center gap-1.5 bg-gradient-to-r ${activeShowcase.color} backdrop-blur-sm border ${activeShowcase.borderColor} ${activeShowcase.textColor} text-xs font-bold px-3 py-1.5 rounded-full`}>
                        <i className="ri-sparkling-2-fill text-xs" /> 지금 만들기
                      </div>
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className={`bg-black/60 backdrop-blur-sm ${activeShowcase.textColor} text-[9px] font-black px-2 py-0.5 rounded-full border ${activeShowcase.borderColor}`}>
                        {item.tag}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 md:mt-3 text-xs md:text-sm font-bold text-gray-300 group-hover:text-white transition-colors truncate">
                    {item.title}
                  </p>
                  <p className={`text-[10px] md:text-[11px] font-medium mt-0.5 truncate ${activeShowcase.textColor} opacity-70`}>
                    {item.tag}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 md:mt-8 flex justify-center">
              <button
                onClick={() => navigate(activeShowcase.route)}
                className={`flex items-center gap-2 bg-gradient-to-r ${activeShowcase.color} hover:opacity-80 border ${activeShowcase.borderColor} ${activeShowcase.textColor} font-bold text-sm px-5 md:px-6 py-3 rounded-2xl transition-all cursor-pointer whitespace-nowrap hover:scale-[1.02]`}
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  <i className={activeShowcase.icon} />
                </span>
                {activeTab === 'image' ? 'AI 이미지 생성하기' : 'AI 사운드 만들기'}
                <i className="ri-arrow-right-line" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
