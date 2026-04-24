import WaveformCanvas from './WaveformCanvas';
import type { VoiceProfile } from './step3-voice-data';

interface AudioPlayer {
  playingId: string | null;
  elapsed: Record<string, number>;
  duration: Record<string, number>;
  toggle: (id: string, blobUrl: string, dur: number) => void;
  seekTo: (id: string, pct: number) => void;
}

interface CutPreviewRowProps {
  cut: { id: string; label: string; text: string };
  voice: VoiceProfile;
  player: AudioPlayer;
  blobUrl?: string;
  duration?: number;
  onDownload: () => void;
}

export default function CutPreviewRow({
  cut, voice, player, blobUrl, duration: dur, onDownload,
}: CutPreviewRowProps) {
  const isPlaying = player.playingId === cut.id;
  const el = player.elapsed[cut.id] ?? 0;
  const totalDur = dur ?? player.duration[cut.id] ?? 3;
  const pct = totalDur > 0 ? Math.min(1, el / totalDur) : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className={`rounded-xl border transition-all ${isPlaying ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/5 bg-zinc-900/60'}`}>
      <div className="flex items-start gap-2 p-2.5 md:p-3">
        <div className="flex-shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-md">{cut.label}</span>
        </div>
        <p className="flex-1 text-xs text-zinc-400 leading-relaxed line-clamp-2 min-w-0">{cut.text}</p>
        <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
          <button
            onClick={() => blobUrl && player.toggle(cut.id, blobUrl, totalDur)}
            disabled={!blobUrl}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isPlaying ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-zinc-700 hover:bg-zinc-600'
            }`}
          >
            <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-xs ${!isPlaying ? 'ml-0.5' : ''}`} />
          </button>
          {blobUrl && (
            <button
              onClick={onDownload}
              className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center cursor-pointer transition-colors"
              title="다운로드"
            >
              <i className="ri-download-line text-zinc-400 text-xs" />
            </button>
          )}
        </div>
      </div>

      {isPlaying && (
        <div className="px-2.5 md:px-3 pb-2.5 md:pb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <WaveformCanvas
                freqs={voice.freq}
                isPlaying={isPlaying}
                progress={pct}
                color={voice.bgColor}
                height={32}
                onClick={(p) => player.seekTo(cut.id, p)}
              />
            </div>
            <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">{fmt(el)}/{fmt(totalDur)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
