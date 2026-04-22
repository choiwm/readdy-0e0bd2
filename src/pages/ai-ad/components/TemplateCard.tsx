import { useState } from 'react';
import { TvcTemplate } from '@/mocks/tvcSamples';

interface TemplateCardProps {
  tpl: TvcTemplate;
  onSelect: (t: TvcTemplate) => void;
}

export default function TemplateCard({ tpl, onSelect }: TemplateCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group cursor-pointer rounded-2xl overflow-hidden bg-zinc-900/80 border border-zinc-800/60 hover:border-rose-500/40 transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(tpl)}
    >
      <div className="relative w-full h-[140px] overflow-hidden">
        <img
          src={tpl.img}
          alt={tpl.title}
          className={`w-full h-full object-cover object-top transition-transform duration-700 ${hovered ? 'scale-110' : 'scale-100'}`}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Hover overlay */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <button className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs font-black px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap">
            <i className="ri-sparkling-2-fill text-xs" /> 이 스타일 사용
          </button>
        </div>

        {/* Tags */}
        <div className="absolute top-2.5 left-2.5 flex gap-1 flex-wrap">
          {tpl.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-zinc-300 border border-white/10">
              {tag}
            </span>
          ))}
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5">
          <p className="text-[11px] font-black text-white leading-tight line-clamp-1">{tpl.title}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{tpl.subtitle}</p>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className={`flex items-center justify-between px-3 py-2 border-t border-white/[0.05] transition-all duration-200 ${hovered ? 'bg-rose-500/5' : ''}`}>
        <div className="flex items-center gap-1.5">
          <i className="ri-movie-ai-line text-zinc-500 text-xs" />
          <span className="text-[10px] text-zinc-500">이미지 + 동영상</span>
        </div>
        <div className={`w-5 h-5 flex items-center justify-center rounded-full transition-all duration-200 ${hovered ? 'bg-rose-500/20' : 'bg-zinc-800'}`}>
          <i className={`ri-arrow-right-line text-[10px] transition-colors ${hovered ? 'text-rose-400' : 'text-zinc-600'}`} />
        </div>
      </div>
    </div>
  );
}
