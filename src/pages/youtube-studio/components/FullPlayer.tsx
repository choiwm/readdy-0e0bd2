import { useState } from 'react';
import WaveformCanvas from './WaveformCanvas';
import { useRealAudioPlayer } from '../hooks/useRealAudioPlayer';
import type { VoiceProfile } from './step3-voice-data';

interface FullPlayerProps {
  voice: VoiceProfile;
  speed: number;
  blobUrl?: string;
  duration?: number;
  onDownload?: () => void;
  scriptLength?: number;
}

export default function FullPlayer({
  voice, speed, blobUrl, duration: dur, onDownload, scriptLength,
}: FullPlayerProps) {
  const player = useRealAudioPlayer();
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(speed);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const isPlaying = player.playingId === 'full';
  const el = player.elapsed['full'] ?? 0;
  const totalDur = dur ?? player.duration['full'] ?? Math.max(10, (scriptLength ?? 100) / (speed * 5));
  const pct = totalDur > 0 ? Math.min(1, el / totalDur) : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="bg-zinc-900/60 border border-indigo-500/20 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/5">
        <div className={`w-9 h-9 rounded-full ${voice.color} flex items-center justify-center flex-shrink-0`}>
          <span className="text-white text-sm font-black">{voice.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{voice.name} · 전체 나레이션</p>
          <p className="text-[10px] text-zinc-500">속도 {playbackRate.toFixed(1)}x · {scriptLength ?? 0}자</p>
        </div>
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
          생성 완료
        </span>
      </div>

      <div className="px-4 pt-3 pb-2">
        <WaveformCanvas
          freqs={[...voice.freq, ...voice.freq.slice().reverse(), ...voice.freq]}
          isPlaying={isPlaying}
          progress={pct}
          color={voice.bgColor}
          height={56}
          onClick={(p) => blobUrl && player.seekTo('full', p)}
        />
      </div>

      <div className="flex justify-between px-4 mb-2">
        <span className="text-[10px] text-zinc-500 font-mono">{fmt(el)}</span>
        <span className="text-[10px] text-zinc-500 font-mono">{fmt(totalDur)}</span>
      </div>

      <div className="flex items-center gap-3 px-4 pb-4">
        <button
          onClick={() => blobUrl && player.seekTo('full', Math.max(0, pct - 0.05))}
          className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
        >
          <i className="ri-skip-back-mini-fill text-base" />
        </button>

        <button
          onClick={() => blobUrl && player.toggle('full', blobUrl, totalDur)}
          disabled={!blobUrl}
          className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors"
        >
          <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-lg ${!isPlaying ? 'ml-0.5' : ''}`} />
        </button>

        <button
          onClick={() => blobUrl && player.seekTo('full', Math.min(1, pct + 0.05))}
          className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
        >
          <i className="ri-skip-forward-mini-fill text-base" />
        </button>

        <div className="flex items-center gap-1.5 flex-1">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 1)}
            className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
          >
            <i className={`${volume === 0 ? 'ri-volume-mute-line' : volume < 0.5 ? 'ri-volume-down-line' : 'ri-volume-up-line'} text-sm`} />
          </button>
          <div className="relative flex-1 h-3 flex items-center">
            <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${volume * 100}%` }} />
            </div>
            <input
              type="range" min={0} max={1} step={0.05} value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="text-[11px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-white/10 px-2 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
          >
            {playbackRate.toFixed(2)}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 bg-zinc-800 border border-white/10 rounded-xl overflow-hidden z-10">
              {speedOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPlaybackRate(s); setShowSpeedMenu(false); }}
                  className={`block w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors whitespace-nowrap ${
                    playbackRate === s ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {s.toFixed(2)}x
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onDownload}
          disabled={!blobUrl}
          className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="전체 나레이션 다운로드"
        >
          <i className="ri-download-line text-sm" />
        </button>
      </div>
    </div>
  );
}
