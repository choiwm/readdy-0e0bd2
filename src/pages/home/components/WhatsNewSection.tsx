import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { whatsNewItems } from '@/mocks/whatsNew';

export default function WhatsNewSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const navigate = useNavigate();

  const scroll = (dir: 'prev' | 'next') => {
    if (!scrollRef.current) return;
    const cardWidth = 380;
    const newIndex = dir === 'next'
      ? Math.min(currentIndex + 1, whatsNewItems.length - 1)
      : Math.max(currentIndex - 1, 0);
    setCurrentIndex(newIndex);
    scrollRef.current.scrollTo({ left: newIndex * cardWidth, behavior: 'smooth' });
  };

  const handleMouseEnter = (id: number) => {
    setHoveredId(id);
    videoRefs.current[id]?.play();
  };

  const handleMouseLeave = (id: number) => {
    setHoveredId(id);
    const v = videoRefs.current[id];
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    setHoveredId(null);
  };

  const newCount = whatsNewItems.filter((i) => i.isNew).length;

  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      {/* subtle bg glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-indigo-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="w-[90%] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 md:mb-10 gap-4">
          <div>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-400 mb-2 block">
              Hot &amp; Trending
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
              What&apos;s{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                New
              </span>
              <span className="text-2xl">🔥</span>
              {newCount > 0 && (
                <span className="text-xs font-black bg-emerald-500 text-white px-2.5 py-1 rounded-full tracking-wide">
                  {newCount} NEW
                </span>
              )}
            </h2>
            <p className="text-gray-400 text-sm font-medium mt-2">
              최신 AI 모델을 가장 먼저 만나보세요
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => scroll('prev')}
              disabled={currentIndex === 0}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
                currentIndex === 0
                  ? 'bg-white/[0.02] border border-white/5 text-gray-600 cursor-not-allowed'
                  : 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-105'
              }`}
            >
              <i className="ri-arrow-left-s-line" />
            </button>
            <span className="text-xs text-gray-400 font-bold tabular-nums w-12 text-center">
              {currentIndex + 1} / {whatsNewItems.length}
            </span>
            <button
              onClick={() => scroll('next')}
              disabled={currentIndex === whatsNewItems.length - 1}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 cursor-pointer ${
                currentIndex === whatsNewItems.length - 1
                  ? 'bg-white/[0.02] border border-white/5 text-gray-600 cursor-not-allowed'
                  : 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:scale-105'
              }`}
            >
              <i className="ri-arrow-right-s-line" />
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="relative">
          <div className="absolute right-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-l from-[#0a0a0b] to-transparent z-10 pointer-events-none" />
          <div
            ref={scrollRef}
            className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {whatsNewItems.map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-[80vw] sm:w-[320px] md:w-[360px] snap-start cursor-pointer group"
                onMouseEnter={() => handleMouseEnter(item.id)}
                onMouseLeave={() => handleMouseLeave(item.id)}
                onClick={() => navigate('/ai-create')}
              >
                {/* Video Thumbnail */}
                <div className="relative aspect-video rounded-xl md:rounded-2xl overflow-hidden border border-white/[0.06] group-hover:border-white/[0.16] transition-all duration-500 bg-black/40">
                  <video
                    ref={(el) => { videoRefs.current[item.id] = el; }}
                    src={item.videoSrc}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    loop
                    muted
                    playsInline
                    preload="metadata"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  {/* Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`${item.badgeColor} text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-wider`}>
                      {item.badge}
                    </span>
                    <span className="bg-black/50 backdrop-blur-sm text-white/70 text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10">
                      {item.tag}
                    </span>
                  </div>

                  {/* Hover CTA */}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${hoveredId === item.id ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-4 py-2 rounded-full">
                      <i className="ri-sparkling-2-fill text-indigo-300" />
                      지금 사용해보기
                    </div>
                  </div>

                  {/* Bottom info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                    <p className="text-white font-black text-sm leading-tight">{item.title}</p>
                  </div>

                  {/* Top shimmer on hover */}
                  <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent transition-opacity duration-500 ${hoveredId === item.id ? 'opacity-100' : 'opacity-0'}`} />
                </div>

                {/* Card Info */}
                <div className="mt-2 md:mt-3 px-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-black text-white group-hover:text-indigo-300 transition-colors truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] md:text-[11px] text-gray-400 font-medium mt-0.5 leading-relaxed line-clamp-2">
                        {item.subtitle}
                      </p>
                    </div>
                    {(item.isNew || item.isHot) && (
                      <div className="flex-shrink-0 flex flex-col gap-1 items-end">
                        {item.isNew && (
                          <span className="text-[9px] font-black text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            NEW
                          </span>
                        )}
                        {item.isHot && (
                          <span className="text-[9px] font-black text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            HOT
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1.5 mt-5 md:mt-6">
          {whatsNewItems.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentIndex(i);
                scrollRef.current?.scrollTo({ left: i * 380, behavior: 'smooth' });
              }}
              className={`transition-all duration-300 rounded-full cursor-pointer ${
                i === currentIndex
                  ? 'w-6 h-1.5 bg-indigo-400'
                  : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
