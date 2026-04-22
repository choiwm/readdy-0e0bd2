import { Step4ImageData } from './Step4Image';

interface VideoCut {
  id: number;
  start: number;
  end: number;
  text: string;
  thumb: string;
  thumbPrompt: string;
  videoPrompt: string;
  hasVideo: boolean;
  videoUrl?: string;
}

interface ImageTimelineProps {
  step4Images: Step4ImageData[];
  cuts: VideoCut[];
  selectedCut: number;
  onSelectCut: (id: number) => void;
  generatingId: number | null;
  onGenerateCut: (id: number) => void;
}

export default function ImageTimeline({
  step4Images,
  cuts,
  selectedCut,
  onSelectCut,
  generatingId,
  onGenerateCut,
}: ImageTimelineProps) {
  const totalDuration = cuts[cuts.length - 1]?.end ?? 38;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const imagesWithData = cuts.map((cut) => {
    const img = step4Images.find((i) => i.id === cut.id);
    return { cut, imageUrl: img?.image ?? null, prompt: img?.prompt ?? '' };
  });
  const imageCount = imagesWithData.filter((i) => i.imageUrl).length;

  const calcWidth = (dur: number) => {
    const widthRatio = dur / totalDuration;
    return Math.max(100, Math.min(220, Math.round(widthRatio * 700)));
  };

  return (
    <div className="flex-shrink-0 border-t border-white/5 bg-[#0a0a0c]">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <i className="ri-image-line text-indigo-400 text-[10px]" />
          </div>
          <span className="text-xs font-bold text-zinc-300">이미지 타임라인</span>
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
            imageCount === cuts.length
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : imageCount > 0
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-zinc-800 border-white/5 text-zinc-500'
          }`}>
            {imageCount}/{cuts.length} 이미지
          </span>
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-zinc-600 font-mono">{fmt(totalDuration)}</span>
      </div>

      <div className="overflow-x-auto scrollbar-none px-4 py-3">
        <div className="relative mb-2" style={{ minWidth: `${Math.max(cuts.length * 120, 600)}px` }}>
          <div className="flex items-center h-4 relative">
            {cuts.map((cut) => (
              <div
                key={cut.id}
                className="absolute flex items-center"
                style={{ left: `${(cut.start / totalDuration) * 100}%` }}
              >
                <div className="w-px h-2 bg-zinc-700" />
                <span className="text-[8px] text-zinc-600 font-mono ml-0.5">{fmt(cut.start)}</span>
              </div>
            ))}
            <div className="absolute right-0 flex items-center">
              <div className="w-px h-2 bg-zinc-700" />
              <span className="text-[8px] text-zinc-600 font-mono ml-0.5">{fmt(totalDuration)}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-800" />
          </div>
        </div>

        <div className="flex gap-1.5 items-stretch" style={{ minWidth: `${Math.max(cuts.length * 120, 600)}px` }}>
          {imagesWithData.map(({ cut, imageUrl }) => {
            const dur = cut.end - cut.start;
            const w = calcWidth(dur);
            const isSelected = selectedCut === cut.id;
            const isGen = generatingId === cut.id;
            const hasVideo = cuts.find((c) => c.id === cut.id)?.hasVideo ?? false;

            return (
              <div
                key={cut.id}
                onClick={() => onSelectCut(cut.id)}
                className={`relative flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all group border-2 ${
                  isSelected ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-transparent hover:border-white/20'
                }`}
                style={{ width: `${w}px`, height: '72px' }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt={`Cut ${cut.id}`} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <i className="ri-image-line text-zinc-600 text-lg" />
                  </div>
                )}
                <div className={`absolute inset-0 transition-all ${isSelected ? 'bg-indigo-500/10' : 'bg-black/20 group-hover:bg-black/10'}`} />
                {isGen && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded-full">C{cut.id}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white ${
                    dur < 5 ? 'bg-red-500/80' : dur < 7 ? 'bg-orange-500/80' : 'bg-emerald-600/80'
                  }`}>
                    {dur.toFixed(1)}s
                  </span>
                </div>
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1">
                  {imageUrl ? (
                    <span className="text-[8px] font-bold bg-indigo-500/70 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <i className="ri-image-fill text-[7px]" /> 이미지
                    </span>
                  ) : (
                    <span className="text-[8px] font-bold bg-zinc-700/80 text-zinc-400 px-1.5 py-0.5 rounded-full">미생성</span>
                  )}
                  {hasVideo && (
                    <span className="text-[8px] font-bold bg-emerald-500/70 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <i className="ri-film-fill text-[7px]" /> 영상
                    </span>
                  )}
                  {!isGen && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onGenerateCut(cut.id); }}
                      className="ml-auto w-5 h-5 rounded-full bg-indigo-500/80 hover:bg-indigo-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="영상 생성"
                    >
                      <i className="ri-play-fill text-white text-[8px] ml-px" />
                    </button>
                  )}
                </div>
                {isSelected && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500" />}
              </div>
            );
          })}
        </div>

        <div className="flex items-center mt-1.5 gap-1.5" style={{ minWidth: `${Math.max(cuts.length * 120, 600)}px` }}>
          {imagesWithData.map(({ cut, imageUrl }, idx) => {
            const dur = cut.end - cut.start;
            const w = calcWidth(dur);
            const isLast = idx === imagesWithData.length - 1;
            return (
              <div key={cut.id} className="flex items-center flex-shrink-0" style={{ width: `${w}px` }}>
                <div className={`flex-1 h-px ${imageUrl ? 'bg-indigo-500/40' : 'bg-zinc-700'}`} />
                {!isLast && (
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${imageUrl ? 'bg-indigo-500/60' : 'bg-zinc-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-1.5 mt-1.5" style={{ minWidth: `${Math.max(cuts.length * 120, 600)}px` }}>
          {imagesWithData.map(({ cut }) => {
            const dur = cut.end - cut.start;
            const w = calcWidth(dur);
            const isSelected = selectedCut === cut.id;
            return (
              <div
                key={cut.id}
                className={`flex-shrink-0 rounded-lg px-2 py-1.5 cursor-pointer transition-all ${
                  isSelected ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-zinc-900/60 border border-white/5 hover:border-white/10'
                }`}
                style={{ width: `${w}px` }}
                onClick={() => onSelectCut(cut.id)}
              >
                <p className={`text-[9px] leading-relaxed line-clamp-2 ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {cut.text.replace(/\n/g, ' ')}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
