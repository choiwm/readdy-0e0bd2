import { useNavigate } from 'react-router-dom';
import { aiFeatures, BadgeType } from '@/mocks/aiFeatures';

const badgeStyles: Record<BadgeType, string> = {
  Image: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  Video: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  Avatar: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Edit: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const badgeRoutes: Record<BadgeType, string> = {
  Image: '/ai-create',
  Video: '/ai-create',
  Avatar: '/ai-create',
  Edit: '/ai-create',
};

export default function AllFeaturesSection() {
  const navigate = useNavigate();

  const handleFeatureClick = (badge: BadgeType, name: string) => {
    const route = badgeRoutes[badge];
    const typeMap: Record<BadgeType, string> = {
      Image: 'IMAGE',
      Video: 'VIDEO',
      Avatar: 'IMAGE',
      Edit: 'IMAGE',
    };
    navigate(`${route}?prompt=${encodeURIComponent(name + ' 스타일로 생성해줘')}&type=${typeMap[badge]}`);
  };

  return (
    <section className="py-16 md:py-20 relative">
      <div className="w-[90%] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 md:mb-10 gap-3">
          <div>
            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-400 mb-2 block">
              Everything You Need
            </span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight">
              All{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
                Features
              </span>{' '}
              ✨
            </h2>
          </div>
          <button
            onClick={() => navigate('/ai-create')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            전체 보기 <i className="ri-arrow-right-line" />
          </button>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-5 md:mb-6">
            <h3 className="text-lg md:text-xl font-black text-white">Get started with</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            {aiFeatures.map((feature) => (
              <button
                key={feature.id}
                onClick={() => handleFeatureClick(feature.badge, feature.name)}
                className="group flex items-center gap-2 pl-2.5 pr-3 md:pl-3 md:pr-4 py-1.5 md:py-2 rounded-full bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-300 hover:scale-[1.03] cursor-pointer"
              >
                <img
                  src={feature.iconSrc}
                  alt={feature.name}
                  className="w-4 h-4 md:w-5 md:h-5 rounded-full"
                  loading="lazy"
                />
                <span className="text-xs md:text-sm font-bold text-gray-200 group-hover:text-white transition-colors">
                  {feature.name}
                </span>
                <span
                  className={`text-[9px] md:text-[10px] font-black px-1.5 md:px-2 py-0.5 rounded-full border ${badgeStyles[feature.badge]}`}
                >
                  {feature.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
