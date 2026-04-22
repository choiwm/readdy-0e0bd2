import { useNavigate } from 'react-router-dom';

export default function FeaturedBanner() {
  const navigate = useNavigate();
  return (
    <section className="py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="group relative overflow-hidden rounded-3xl cursor-pointer border border-white/[0.06] hover:border-indigo-500/20 transition-all duration-700">
          {/* Background */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[#08080f]" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/15 via-transparent to-violet-600/10" />
            <div className="absolute bottom-0 right-0 w-[60%] h-[60%] bg-gradient-to-tl from-purple-500/10 via-transparent to-transparent rounded-full blur-3xl" />
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-indigo-400/50 animate-pulse"
                style={{ top: `${20 + i * 15}%`, left: `${10 + i * 18}%`, animationDelay: `${i * 0.4}s` }}
              />
            ))}
          </div>

          {/* Content */}
          <div className="relative z-10 p-10 md:p-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 mb-6">
                <span className="text-[10px] font-black text-indigo-300 tracking-widest uppercase">NEW</span>
              </div>
              <h3 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-4">
                SEEDANCE
                <br />
                <span
                  className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400"
                  style={{ backgroundSize: '200% auto', animation: 'shine 4s linear infinite' }}
                >
                  2.0
                </span>
              </h3>
              <p className="text-gray-400 text-sm md:text-base leading-relaxed font-medium">
                차세대 AI 영상 생성 모델 Seedance 2.0이 들어왔습니다.
                <br />
                더욱 정교하고 자연스러운 모션으로 새로운 기준을 제시합니다.
              </p>
              <div className="flex items-center gap-6 mt-8">
                {[
                  { value: '2X', label: 'Quality' },
                  { value: '1080', label: 'Resolution' },
                  { value: '15s', label: 'Max Duration' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-xl font-black text-white">{stat.value}</div>
                    <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => navigate('/ai-create')}
                className="relative group/btn overflow-hidden rounded-2xl transition-all hover:scale-105 cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 group-hover/btn:opacity-90 transition-opacity" />
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 blur-xl opacity-50 group-hover/btn:opacity-70 transition-opacity" />
                <span className="relative flex items-center gap-2 px-8 py-4 text-white font-bold text-base">
                  지금 시작하기
                </span>
              </button>
              <span className="text-[10px] text-gray-600 font-semibold">AiMetaWOW에서 지금 바로 만나보세요</span>
            </div>
          </div>
        </div>
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
