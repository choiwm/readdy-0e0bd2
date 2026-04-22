import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceData } from '../page';

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

interface NarrationTimelineProps {
  cuts: VideoCut[];
  voiceData: VoiceData;
  selectedCut: number;
  onSelectCut: (id: number) => void;
  onActiveCutChange?: (id: number | null) => void;
}

export default function NarrationTimeline({
  cuts,
  voiceData,
  selectedCut,
  onSelectCut,
  onActiveCutChange,
}: NarrationTimelineProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeCutId, setActiveCutId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalDuration = voiceData.fullDuration ?? cuts[cuts.length - 1]?.end ?? 38;

  const stopAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
    setActiveCutId(null);
    onActiveCutChange?.(null);
  }, [onActiveCutChange]);

  const playCut = useCallback((cut: VideoCut) => {
    const cutKey = `c${cut.id}`;
    const audio = voiceData.cutAudios[cutKey];
    if (!audio) return;

    stopAll();
    const el = new Audio(audio.blobUrl);
    audioRef.current = el;
    setActiveCutId(cut.id);
    setCurrentTime(cut.start);
    setIsPlaying(true);
    onSelectCut(cut.id);
    onActiveCutChange?.(cut.id);

    el.play().catch(() => setIsPlaying(false));

    timerRef.current = setInterval(() => {
      if (el.ended || el.paused) {
        clearInterval(timerRef.current!);
        setIsPlaying(false);
        setActiveCutId(null);
        onActiveCutChange?.(null);
        return;
      }
      setCurrentTime(cut.start + el.currentTime);
    }, 80);

    el.onended = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
      setActiveCutId(null);
      onActiveCutChange?.(null);
    };
  }, [voiceData.cutAudios, stopAll, onSelectCut, onActiveCutChange]);

  const playFull = useCallback(() => {
    if (!voiceData.fullBlobUrl) return;
    stopAll();
    const el = new Audio(voiceData.fullBlobUrl);
    audioRef.current = el;
    setIsPlaying(true);
    setCurrentTime(0);

    el.play().catch(() => setIsPlaying(false));

    timerRef.current = setInterval(() => {
      if (el.ended || el.paused) {
        clearInterval(timerRef.current!);
        setIsPlaying(false);
        setActiveCutId(null);
        onActiveCutChange?.(null);
        return;
      }
      const t = el.currentTime;
      setCurrentTime(t);
      const active = cuts.find((c) => t >= c.start && t < c.end);
      if (active) {
        setActiveCutId(active.id);
        onSelectCut(active.id);
        onActiveCutChange?.(active.id);
      }
    }, 80);

    el.onended = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
      setActiveCutId(null);
      onActiveCutChange?.(null);
    };
  }, [voiceData.fullBlobUrl, cuts, stopAll, onSelectCut, onActiveCutChange]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex-shrink-0 border-t border-white/5 bg-[#0a0a0c] px-4 py-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: voiceData.voiceColor }}
          >
            <span className="text-white text-[9px] font-black">{voiceData.voiceName[0]}</span>
          </div>
          <span className="text-xs font-bold text-zinc-300">{voiceData.voiceName} 나레이션</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            연동됨
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={isPlaying ? stopAll : playFull}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
              isPlaying
                ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                : 'bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white hover:border-white/20'
            }`}
          >
            <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-xs`} />
            {isPlaying ? '정지' : '전체 재생'}
          </button>
          <span className="text-[10px] text-zinc-600 font-mono">{fmt(currentTime)} / {fmt(totalDuration)}</span>
        </div>
      </div>

      <div className="relative">
        <div className="flex items-center mb-1 relative h-3">
          {cuts.map((cut) => (
            <div
              key={cut.id}
              className="absolute text-[8px] text-zinc-700 font-mono"
              style={{ left: `${(cut.start / totalDuration) * 100}%` }}
            >
              {fmt(cut.start)}
            </div>
          ))}
          <div className="absolute text-[8px] text-zinc-700 font-mono" style={{ right: 0 }}>
            {fmt(totalDuration)}
          </div>
        </div>

        <div className="relative h-10 bg-zinc-900 rounded-lg overflow-hidden border border-white/5">
          {cuts.map((cut) => {
            const cutKey = `c${cut.id}`;
            const hasAudio = !!voiceData.cutAudios[cutKey];
            const isActive = activeCutId === cut.id;
            const isSelected = selectedCut === cut.id;
            const leftPct = (cut.start / totalDuration) * 100;
            const widthPct = ((cut.end - cut.start) / totalDuration) * 100;

            return (
              <div
                key={cut.id}
                className={`absolute top-0 bottom-0 flex items-center justify-center cursor-pointer transition-all border-r border-black/30 group ${
                  isActive ? 'opacity-100' : isSelected ? 'opacity-90' : 'opacity-60 hover:opacity-80'
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: isActive
                    ? `${voiceData.voiceColor}55`
                    : isSelected
                    ? `${voiceData.voiceColor}33`
                    : `${voiceData.voiceColor}22`,
                  borderLeft: isSelected || isActive
                    ? `2px solid ${voiceData.voiceColor}`
                    : '1px solid rgba(255,255,255,0.05)',
                }}
                onClick={() => onSelectCut(cut.id)}
              >
                <div className="absolute inset-0 flex items-center justify-around px-1 overflow-hidden">
                  {Array.from({ length: Math.max(3, Math.floor(widthPct / 3)) }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-px rounded-full transition-all ${isActive ? 'animate-pulse' : ''}`}
                      style={{
                        height: `${20 + Math.sin(i * 1.3 + cut.id) * 15}%`,
                        backgroundColor: isActive ? voiceData.voiceColor : `${voiceData.voiceColor}88`,
                        opacity: hasAudio ? 1 : 0.3,
                      }}
                    />
                  ))}
                </div>
                <div className="relative z-10 flex items-center gap-1">
                  <span className="text-[9px] font-bold text-white/80 whitespace-nowrap">C{cut.id}</span>
                  {hasAudio && (
                    <button
                      onClick={(e) => { e.stopPropagation(); playCut(cut); }}
                      className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <i className="ri-play-fill text-white text-[8px] ml-px" />
                    </button>
                  )}
                </div>
                {!hasAudio && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="ri-volume-mute-line text-zinc-600 text-xs" />
                  </div>
                )}
              </div>
            );
          })}

          {isPlaying && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none transition-all"
              style={{ left: `${progressPct}%` }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white" />
            </div>
          )}
        </div>

        <div className="mt-1.5 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{ width: `${progressPct}%`, backgroundColor: voiceData.voiceColor }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap overflow-x-auto scrollbar-none">
        {cuts.map((cut) => {
          const cutKey = `c${cut.id}`;
          const audio = voiceData.cutAudios[cutKey];
          const isActive = activeCutId === cut.id;
          return (
            <button
              key={cut.id}
              onClick={() => audio && playCut(cut)}
              disabled={!audio}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer disabled:cursor-default whitespace-nowrap ${
                isActive
                  ? 'text-white border'
                  : audio
                  ? 'bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 hover:border-white/15'
                  : 'bg-zinc-900 text-zinc-700 border border-white/3'
              }`}
              style={isActive ? { backgroundColor: `${voiceData.voiceColor}33`, borderColor: voiceData.voiceColor, color: voiceData.voiceColor } : {}}
            >
              <i className={`${isActive ? 'ri-pause-fill' : audio ? 'ri-play-fill' : 'ri-volume-mute-line'} text-[9px]`} />
              C{cut.id}
              {audio && <span className="text-[8px] opacity-60">{audio.duration.toFixed(1)}s</span>}
            </button>
          );
        })}
        <span className="text-[10px] text-zinc-600 ml-auto">
          {Object.keys(voiceData.cutAudios).length}/{cuts.length} 컷 오디오
        </span>
      </div>
    </div>
  );
}
