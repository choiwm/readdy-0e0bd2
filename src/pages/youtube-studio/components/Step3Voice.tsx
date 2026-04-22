import { useState, useRef, useEffect, useCallback } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { VoiceData } from '../page';
import { useAuth } from '@/hooks/useAuth';

interface Step3VoiceProps {
  onNext: () => void;
  onBack: () => void;
  onVoiceGenerated?: (data: VoiceData) => void;
  initialVoiceData?: VoiceData | null;
  script?: string;
}

interface VoiceProfile {
  id: string;
  name: string;
  gender: 'MALE' | 'FEMALE';
  desc: string;
  tag: string;
  color: string;
  bgColor: string;
  pitchOffset: number;
  rateOffset: number;
  sampleText: string;
  freq: number[];
}

const voices: VoiceProfile[] = [
  {
    id: 'v1', name: '명수', gender: 'MALE', tag: '내레이션',
    desc: '수줍음 많은 소년처럼 꾸밈없고 순수한 목소리',
    color: 'bg-indigo-500', bgColor: '#6366f1',
    pitchOffset: 0.1, rateOffset: -0.05,
    sampleText: '안녕하세요. 저는 명수입니다. 꾸밈없고 순수한 목소리로 여러분께 이야기를 전해드릴게요.',
    freq: [0.4, 0.6, 0.5, 0.7, 0.4, 0.8, 0.5, 0.6, 0.7, 0.4, 0.6, 0.5, 0.8, 0.6, 0.5, 0.7, 0.4, 0.6, 0.5, 0.7],
  },
  {
    id: 'v2', name: '지수', gender: 'FEMALE', tag: '유튜브',
    desc: '밝고 친근한 에너지로 시청자를 사로잡는 목소리',
    color: 'bg-pink-500', bgColor: '#ec4899',
    pitchOffset: 0.3, rateOffset: 0.1,
    sampleText: '안녕하세요 여러분! 저는 지수예요. 오늘도 밝고 활기차게 함께해요!',
    freq: [0.7, 0.9, 0.6, 0.8, 0.9, 0.7, 1.0, 0.8, 0.6, 0.9, 0.7, 0.8, 0.6, 0.9, 0.7, 0.8, 0.9, 0.7, 0.8, 0.9],
  },
  {
    id: 'v3', name: '서연', gender: 'FEMALE', tag: '감성',
    desc: '따뜻하고 감성적인 나레이션에 최적화된 목소리',
    color: 'bg-purple-500', bgColor: '#a855f7',
    pitchOffset: 0.2, rateOffset: -0.1,
    sampleText: '안녕하세요. 저는 서연입니다. 따뜻하고 감성적인 이야기를 천천히 전해드릴게요.',
    freq: [0.5, 0.6, 0.7, 0.5, 0.6, 0.8, 0.6, 0.7, 0.5, 0.6, 0.7, 0.5, 0.6, 0.7, 0.6, 0.5, 0.7, 0.6, 0.5, 0.6],
  },
  {
    id: 'v4', name: '민준', gender: 'MALE', tag: '활기',
    desc: '활기차고 젊은 감성의 유튜브 특화 목소리',
    color: 'bg-emerald-500', bgColor: '#10b981',
    pitchOffset: 0.05, rateOffset: 0.15,
    sampleText: '안녕하세요! 민준입니다. 오늘 정말 흥미로운 내용을 가져왔어요. 같이 알아볼까요?',
    freq: [0.8, 0.6, 0.9, 0.7, 0.8, 0.6, 0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.7, 0.9, 0.8, 0.6, 0.9, 0.8, 0.7, 0.9],
  },
  {
    id: 'v5', name: '하은', gender: 'FEMALE', tag: '전문',
    desc: '차분하고 신뢰감 있는 전문 나레이터 목소리',
    color: 'bg-amber-500', bgColor: '#f59e0b',
    pitchOffset: 0.15, rateOffset: -0.15,
    sampleText: '안녕하세요. 저는 하은입니다. 신뢰감 있고 차분한 목소리로 정확한 정보를 전달해드리겠습니다.',
    freq: [0.4, 0.5, 0.4, 0.6, 0.5, 0.4, 0.6, 0.5, 0.4, 0.5, 0.6, 0.4, 0.5, 0.4, 0.5, 0.6, 0.4, 0.5, 0.6, 0.5],
  },
  {
    id: 'v6', name: '태민', gender: 'MALE', tag: '다큐',
    desc: '깊고 중후한 다큐멘터리 스타일 목소리',
    color: 'bg-cyan-500', bgColor: '#06b6d4',
    pitchOffset: -0.1, rateOffset: -0.2,
    sampleText: '안녕하세요. 태민입니다. 깊고 중후한 목소리로 여러분께 이야기를 전해드리겠습니다.',
    freq: [0.6, 0.5, 0.7, 0.5, 0.6, 0.5, 0.7, 0.6, 0.5, 0.7, 0.5, 0.6, 0.7, 0.5, 0.6, 0.7, 0.5, 0.6, 0.5, 0.7],
  },
];

// ── 대본 → 컷 파싱 유틸 ──────────────────────────────────────────────────
const DEFAULT_SCRIPT_CUTS = [
  { id: 'c1', label: '컷 1', text: '아직도 인공지능을 먼 미래라고 생각하시나요?' },
  { id: 'c2', label: '컷 2', text: '이미 우리 일상은 AI 시스템으로 굴러가고 있습니다.' },
  { id: 'c3', label: '컷 3', text: '아침에 확인하는 맞춤형 뉴스부터 최적의 출근길을 찾는 네비게이션까지 모두 AI의 작품입니다.' },
  { id: 'c4', label: '컷 4', text: '기업의 현대 시스템은 더욱 놀랍니다. 방대한 데이터를 실시간으로 분석해 소비자의 마음을 읽고,' },
  { id: 'c5', label: '컷 5', text: '스마트 팩토리는 불량률을 제로에 가깝게 낮추며 생산성을 극대화하죠.' },
  { id: 'c6', label: '컷 6', text: '단순한 자동화를 넘어 스스로 상황을 판단하고 최적의 결정을 내리는 지능형 네트워크가 바로 현대 시스템의 핵심입니다.' },
  { id: 'c7', label: '컷 7', text: '이제 인공지능은 선택이 아닌 생존을 위한 필수 인프라입니다.' },
];

function parseScriptToCuts(script: string): Array<{ id: string; label: string; text: string }> {
  if (!script || !script.trim()) return DEFAULT_SCRIPT_CUTS;

  // 1) 줄바꿈 기준으로 분리 (빈 줄 제거)
  const lines = script
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return DEFAULT_SCRIPT_CUTS;

  // 2) 문장 기준으로 분리 (마침표/느낌표/물음표 뒤)
  const sentences: string[] = [];
  lines.forEach((line) => {
    const parts = line.split(/(?<=[.!?。！？])\s+/);
    parts.forEach((p) => {
      const trimmed = p.trim();
      if (trimmed.length > 0) sentences.push(trimmed);
    });
  });

  // 3) 문장이 너무 많으면 그룹핑 (최대 12컷)
  const MAX_CUTS = 12;
  const MIN_CUTS = 3;
  const raw = sentences.length > 0 ? sentences : lines;

  let cuts: string[] = raw;
  if (raw.length > MAX_CUTS) {
    // 그룹핑: 인접 문장 합치기
    const groupSize = Math.ceil(raw.length / MAX_CUTS);
    cuts = [];
    for (let i = 0; i < raw.length; i += groupSize) {
      cuts.push(raw.slice(i, i + groupSize).join(' '));
    }
  } else if (raw.length < MIN_CUTS && raw.length > 0) {
    // 너무 적으면 긴 문장 분리
    cuts = [];
    raw.forEach((s) => {
      if (s.length > 80) {
        const mid = Math.floor(s.length / 2);
        const splitIdx = s.indexOf(' ', mid);
        if (splitIdx > 0) {
          cuts.push(s.slice(0, splitIdx).trim());
          cuts.push(s.slice(splitIdx).trim());
        } else {
          cuts.push(s);
        }
      } else {
        cuts.push(s);
      }
    });
  }

  return cuts
    .filter((t) => t.trim().length > 0)
    .map((text, i) => ({
      id: `c${i + 1}`,
      label: `컷 ${i + 1}`,
      text: text.trim(),
    }));
}

// ── Canvas Waveform Visualizer ─────────────────────────────────────────────
function WaveformCanvas({
  freqs, isPlaying, progress, color, height = 48, onClick,
}: {
  freqs: number[]; isPlaying: boolean; progress: number;
  color: string; height?: number; onClick?: (pct: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const barCount = freqs.length;
      const barW = Math.floor(W / barCount) - 1;
      const gap = Math.floor(W / barCount);
      for (let i = 0; i < barCount; i++) {
        const x = i * gap + (gap - barW) / 2;
        const baseH = freqs[i] * (H * 0.85);
        const animH = isPlaying
          ? baseH * (0.6 + 0.4 * Math.sin(phaseRef.current + i * 0.45))
          : baseH * 0.35;
        const barH = Math.max(3, animH);
        const y = (H - barH) / 2;
        const filled = (i / barCount) < progress;
        ctx.fillStyle = filled ? color : `${color}44`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 2);
        ctx.fill();
      }
      if (isPlaying) {
        phaseRef.current += 0.12;
        animRef.current = requestAnimationFrame(draw);
      }
    };

    if (isPlaying) {
      animRef.current = requestAnimationFrame(draw);
    } else {
      draw();
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [freqs, isPlaying, progress, color]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onClick(Math.max(0, Math.min(1, pct)));
  };

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={height}
      className="w-full rounded-lg cursor-pointer"
      style={{ height: `${height}px` }}
      onClick={handleClick}
    />
  );
}

// ── Real Audio Player Hook ─────────────────────────────────────────────────
function useRealAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setPlayingId(null);
  }, []);

  const play = useCallback((id: string, blobUrl: string, dur: number) => {
    stop();
    const audio = new Audio(blobUrl);
    audioRef.current = audio;
    setDuration((prev) => ({ ...prev, [id]: dur }));
    setElapsed((prev) => ({ ...prev, [id]: 0 }));
    setPlayingId(id);

    audio.play().catch(() => setPlayingId(null));

    timerRef.current = setInterval(() => {
      if (audio.ended || audio.paused) {
        clearInterval(timerRef.current!);
        setPlayingId(null);
        return;
      }
      setElapsed((prev) => ({ ...prev, [id]: audio.currentTime }));
    }, 80);

    audio.onended = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlayingId(null);
    };
  }, [stop]);

  const toggle = useCallback((id: string, blobUrl: string, dur: number) => {
    if (playingId === id) {
      stop();
    } else {
      play(id, blobUrl, dur);
    }
  }, [playingId, play, stop]);

  const seekTo = useCallback((id: string, pct: number) => {
    const dur = duration[id] ?? 0;
    const t = dur * pct;
    if (audioRef.current && playingId === id) {
      audioRef.current.currentTime = t;
    }
    setElapsed((prev) => ({ ...prev, [id]: t }));
  }, [duration, playingId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { playingId, elapsed, duration, toggle, stop, seekTo };
}

// ── AI Sample Preview Player ───────────────────────────────────────────────
// 실제 TTS Edge Function을 호출해서 샘플 오디오를 생성하고 재생
interface SampleRecorder {
  sampleLoadingId: string | null;
  generateSampleAudio: (
    voiceId: string,
    voiceName: string,
    sampleText: string,
    speed: number,
    userId?: string | null
  ) => Promise<{ blobUrl: string; duration: number } | null>;
}

function useAiSamplePlayer(
  recorder: SampleRecorder,
  userId: string | null | undefined
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setPlayingId(null);
  }, []);

  const playBlobUrl = useCallback((id: string, blobUrl: string, dur: number) => {
    stop();
    const audio = new Audio(blobUrl);
    audioRef.current = audio;
    setDuration((prev) => ({ ...prev, [id]: dur }));
    setElapsed((prev) => ({ ...prev, [id]: 0 }));
    setPlayingId(id);

    audio.play().catch(() => setPlayingId(null));

    timerRef.current = setInterval(() => {
      if (audio.ended || audio.paused) {
        clearInterval(timerRef.current!);
        setPlayingId(null);
        return;
      }
      setElapsed((prev) => ({ ...prev, [id]: audio.currentTime }));
    }, 80);

    audio.onended = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setPlayingId(null);
    };
  }, [stop]);

  const toggle = useCallback(async (
    id: string,
    voice: VoiceProfile,
    speed: number,
  ) => {
    if (playingId === id) {
      stop();
      return;
    }
    // 이미 로딩 중이면 무시
    if (recorder.sampleLoadingId === id) return;

    // 샘플 생성 (캐시 있으면 즉시 반환)
    const result = await recorder.generateSampleAudio(
      id,
      voice.name,
      voice.sampleText,
      speed,
      userId
    );
    if (result) {
      playBlobUrl(id, result.blobUrl, result.duration);
    }
  }, [playingId, stop, recorder, userId, playBlobUrl]);

  const seekTo = useCallback((id: string, pct: number) => {
    const dur = duration[id] ?? 0;
    const t = dur * pct;
    if (audioRef.current && playingId === id) {
      audioRef.current.currentTime = t;
    }
    setElapsed((prev) => ({ ...prev, [id]: t }));
  }, [duration, playingId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { playingId, elapsed, duration, toggle, stop, seekTo };
}

// ── Slider ─────────────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step, displayValue,
  onChange, onReset, leftLabel, rightLabel,
}: {
  label: string; value: number; min: number; max: number; step: number;
  displayValue: string; onChange: (v: number) => void; onReset: () => void;
  leftLabel: string; rightLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md min-w-[44px] text-center">
            {displayValue}
          </span>
          <button onClick={onReset} className="text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors whitespace-nowrap">
            초기화
          </button>
        </div>
      </div>
      <div className="relative h-4 flex items-center">
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-indigo-500 pointer-events-none"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-zinc-600">{leftLabel}</span>
        <span className="text-[10px] text-zinc-600">{rightLabel}</span>
      </div>
    </div>
  );
}

// ── Cut Preview Row (Real Audio) ───────────────────────────────────────────
function CutPreviewRow({
  cut, voice, player, blobUrl, duration: dur, onDownload,
}: {
  cut: { id: string; label: string; text: string };
  voice: VoiceProfile;
  player: ReturnType<typeof useRealAudioPlayer>;
  blobUrl?: string;
  duration?: number;
  onDownload: () => void;
}) {
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

// ── Full Generated Player ──────────────────────────────────────────────────
function FullPlayer({
  voice, speed, blobUrl, duration: dur, onDownload, scriptLength,
}: {
  voice: VoiceProfile; speed: number;
  blobUrl?: string; duration?: number; onDownload?: () => void;
  scriptLength?: number;
}) {
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function Step3Voice({ onNext, onBack, onVoiceGenerated, initialVoiceData, script }: Step3VoiceProps) {
  const [selectedVoice, setSelectedVoice] = useState(initialVoiceData?.voiceName ? (voices.find((v) => v.name === initialVoiceData.voiceName)?.id ?? 'v1') : 'v1');
  const [speed, setSpeed] = useState(initialVoiceData?.speed ?? 1.0);
  const [pitch, setPitch] = useState(0);

  // ── 대본 → 컷 파싱 ──────────────────────────────────────────────────────
  const scriptCuts = parseScriptToCuts(script ?? '');
  const fullScript = scriptCuts.map((c) => c.text).join(' ');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(!!initialVoiceData);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'cuts' | 'full'>('cuts');
  const [fullBlobUrl, setFullBlobUrl] = useState<string | undefined>(initialVoiceData?.fullBlobUrl);
  const [fullDuration, setFullDuration] = useState<number | undefined>(initialVoiceData?.fullDuration);
  // Mobile panel tab
  const [mobilePanelTab, setMobilePanelTab] = useState<'script' | 'voice' | 'preview'>('voice');
  // 목소리 추가 모달
  const [showAddVoiceModal, setShowAddVoiceModal] = useState(false);
  const [addVoiceName, setAddVoiceName] = useState('');
  const [addVoiceGender, setAddVoiceGender] = useState<'MALE' | 'FEMALE'>('FEMALE');
  const [addVoiceTag, setAddVoiceTag] = useState('커스텀');
  const [addVoiceAdded, setAddVoiceAdded] = useState(false);

  const realPlayer = useRealAudioPlayer();
  const recorder = useVoiceRecorder();
  const { user } = useAuth();
  const samplePlayer = useAiSamplePlayer(recorder, user?.id);

  const currentVoice = voices.find((v) => v.id === selectedVoice)!;

  // 속도 변경 시 샘플 캐시 초기화 (다른 속도로 새로 생성)
  const handleSpeedChange = useCallback((v: number) => {
    setSpeed(v);
    samplePlayer.stop();
    recorder.clearSampleCache();
  }, [samplePlayer, recorder]);

  const generatingSteps = [
    '텍스트 분석 중',
    'AI 음성 모델 로딩',
    'AI TTS 음성 합성 중',
    '컷별 오디오 생성 중',
    '후처리 & 노이즈 제거',
    '전체 나레이션 생성 중',
    '오디오 파일 완성',
  ];

  const handleGenerate = async () => {
    samplePlayer.stop();
    realPlayer.stop();
    setIsGenerating(true);
    setGenerated(false);
    setGeneratingStep(0);
    setFullBlobUrl(undefined);
    setFullDuration(undefined);
    recorder.clearError();

    const userId = user?.id ?? null;

    try {
      // Step 1~2: 텍스트 분석 + 모델 로딩
      setGeneratingStep(1);
      await new Promise((r) => setTimeout(r, 300));
      setGeneratingStep(2);

      // Step 3~5: 컷별 AI 음성 생성 (실제 TTS API)
      const cutResults = await recorder.generateAllAudios(
        scriptCuts.map((c) => ({ id: c.id, text: c.text })),
        currentVoice,
        speed,
        pitch,
        (idx) => setGeneratingStep(Math.min(idx + 3, 5)),
        userId
      );

      // Step 6: 전체 나레이션 AI 음성 생성
      setGeneratingStep(6);
      const { blobUrl: fUrl, duration: fDur } = await recorder.generateFullNarration(
        fullScript,
        currentVoice,
        speed,
        pitch,
        userId
      );

      setFullBlobUrl(fUrl);
      setFullDuration(fDur);
      setGeneratingStep(7);

      setTimeout(() => {
        setIsGenerating(false);
        setGenerated(true);
        setActiveTab('cuts');

        onVoiceGenerated?.({
          voiceName: currentVoice.name,
          voiceColor: currentVoice.bgColor,
          cutAudios: cutResults,
          fullBlobUrl: fUrl,
          fullDuration: fDur,
          speed,
          scriptCuts,
        });
      }, 400);
    } catch (err) {
      setIsGenerating(false);
      const e = err as Error & { code?: string };
      if (e.code !== 'INSUFFICIENT_CREDITS') {
        // 크레딧 부족 외 에러는 recorder.ttsError에 이미 세팅됨
        console.error('[Step3] 음성 생성 오류:', e.message);
      }
    }
  };

  const speedDisplay = `${speed.toFixed(1)}x`;
  const pitchDisplay = pitch === 0 ? '0' : pitch > 0 ? `+${pitch}` : `${pitch}`;

  return (
    <>
      <style>{`@keyframes waveAnim { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }`}</style>

      {/* 목소리 추가 모달 */}
      {showAddVoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAddVoiceModal(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <i className="ri-mic-line text-indigo-400 text-sm" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">목소리 추가</p>
                  <p className="text-zinc-500 text-xs mt-0.5">커스텀 보이스 프로필 생성</p>
                </div>
              </div>
              <button onClick={() => setShowAddVoiceModal(false)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors">
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {addVoiceAdded ? (
                <div className="flex flex-col items-center gap-4 py-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <i className="ri-checkbox-circle-fill text-emerald-400 text-3xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">목소리 추가 완료!</p>
                    <p className="text-zinc-500 text-xs mt-1">&quot;{addVoiceName}&quot; 보이스가 목록에 추가되었습니다</p>
                  </div>
                  <button onClick={() => setShowAddVoiceModal(false)} className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm cursor-pointer transition-colors whitespace-nowrap">확인</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 mb-2 block">보이스 이름</label>
                    <input
                      type="text"
                      value={addVoiceName}
                      onChange={(e) => setAddVoiceName(e.target.value)}
                      placeholder="예: 수진, 철수..."
                      className="w-full bg-zinc-800 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 mb-2 block">성별</label>
                    <div className="flex gap-2">
                      {(['FEMALE', 'MALE'] as const).map((g) => (
                        <button key={g} onClick={() => setAddVoiceGender(g)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${addVoiceGender === g ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                          {g === 'FEMALE' ? '여성' : '남성'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 mb-2 block">태그</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['커스텀', '내레이션', '유튜브', '감성', '전문', '활기'].map((t) => (
                        <button key={t} onClick={() => setAddVoiceTag(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${addVoiceTag === t ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-zinc-800/60 rounded-xl p-3 flex items-start gap-2">
                    <i className="ri-information-line text-zinc-500 text-xs mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-zinc-500 leading-relaxed">커스텀 보이스는 시스템 TTS 엔진을 기반으로 생성됩니다. 실제 음성 클로닝은 추후 지원 예정입니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowAddVoiceModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap">취소</button>
                    <button
                      onClick={() => { if (addVoiceName.trim()) setAddVoiceAdded(true); }}
                      disabled={!addVoiceName.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
                    >
                      추가하기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto px-3 md:px-8 py-2.5 md:py-4">
          <div className="max-w-5xl mx-auto">

            <div className="mb-3 md:mb-4 flex items-center gap-3">
              <h2 className="text-sm font-black text-white">AI 보이스오버</h2>
              <p className="text-zinc-500 text-xs hidden sm:block">음성을 선택하고 ▶ 버튼으로 샘플을 미리 들어보세요.</p>
            </div>

            {/* Mobile tab switcher */}
            <div className="flex md:hidden items-center gap-1 bg-zinc-900/60 border border-white/5 rounded-xl p-1 mb-4">
              {([
                { id: 'voice' as const, label: '음성 선택', icon: 'ri-mic-line' },
                { id: 'script' as const, label: '대본', icon: 'ri-file-text-line' },
                { id: 'preview' as const, label: '미리듣기', icon: 'ri-headphone-line' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMobilePanelTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                    mobilePanelTab === tab.id
                      ? 'bg-indigo-500/20 border border-indigo-500/25 text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <i className={`${tab.icon} text-xs`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Desktop: 3-column grid */}
            <div className="hidden md:grid grid-cols-[1fr_1.1fr_0.9fr] gap-5">

              {/* ── Col 1: 대본 + 슬라이더 ── */}
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-file-text-line text-zinc-400 text-sm" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">확정 대본</span>
                  </div>
                  <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 h-[220px] overflow-y-auto">
                    <div className="space-y-2">
                      {scriptCuts.map((cut) => (
                        <div key={cut.id} className="flex gap-2">
                          <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded h-fit mt-0.5 whitespace-nowrap">{cut.label}</span>
                          <p className="text-xs text-zinc-400 leading-relaxed">{cut.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-[10px] text-zinc-600">{fullScript.length}자 · {scriptCuts.length}컷</span>
                    <span className="text-[10px] text-zinc-600">~{Math.ceil(fullScript.length / (speed * 5))}초 예상</span>
                  </div>
                </div>

                <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 space-y-5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-equalizer-line text-zinc-400 text-sm" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">음성 조절</span>
                  </div>
                  <Slider
                    label="재생 속도" value={speed} min={0.5} max={2.0} step={0.1}
                    displayValue={speedDisplay} onChange={handleSpeedChange} onReset={() => handleSpeedChange(1.0)}
                    leftLabel="0.5x 느리게" rightLabel="2.0x 빠르게"
                  />
                  <Slider
                    label="음성 피치" value={pitch} min={-5} max={5} step={1}
                    displayValue={pitchDisplay} onChange={setPitch} onReset={() => setPitch(0)}
                    leftLabel="-5 낮게" rightLabel="+5 높게"
                  />
                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <i className="ri-information-line text-zinc-600 text-xs" />
                    <p className="text-[10px] text-zinc-600">
                      속도 <span className="text-indigo-400 font-bold">{speedDisplay}</span> · 피치{' '}
                      <span className="text-indigo-400 font-bold">{pitchDisplay}</span> 적용 후 생성됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Col 2: 음성 선택 ── */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-mic-line text-zinc-400 text-sm" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">음성 선택</span>
                  </div>
                  <button
                    onClick={() => { setAddVoiceAdded(false); setAddVoiceName(''); setShowAddVoiceModal(true); }}
                    className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 text-[11px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-add-line text-xs" />
                    목소리 추가
                  </button>
                </div>

                <div className="space-y-2">
                  {voices.map((v) => {
                    const isSelected = selectedVoice === v.id;
                    const isPreviewing = samplePlayer.playingId === v.id;
                    const el = samplePlayer.elapsed[v.id] ?? 0;
                    const dur = samplePlayer.duration[v.id] ?? 1;
                    const pct = Math.min(1, el / dur);

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVoice(v.id)}
                        className={`w-full p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500/60 bg-indigo-500/10'
                            : 'border-white/5 bg-zinc-900/60 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${v.color} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-xs font-black">{v.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{v.name}</span>
                              <span className="text-[9px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded-full">{v.gender}</span>
                              <span className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">{v.tag}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 truncate">{v.desc}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              samplePlayer.toggle(v.id, v, speed);
                            }}
                            disabled={recorder.sampleLoadingId === v.id}
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer disabled:cursor-wait ${
                              isPreviewing
                                ? 'bg-indigo-500 hover:bg-indigo-400'
                                : recorder.sampleLoadingId === v.id
                                ? 'bg-zinc-700'
                                : isSelected
                                ? 'bg-indigo-500/30 hover:bg-indigo-500/50 border border-indigo-500/40'
                                : 'bg-zinc-700 hover:bg-zinc-600'
                            }`}
                          >
                            {recorder.sampleLoadingId === v.id ? (
                              <i className="ri-loader-4-line animate-spin text-zinc-400 text-xs" />
                            ) : (
                              <i className={`${isPreviewing ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-xs ${!isPreviewing ? 'ml-0.5' : ''}`} />
                            )}
                          </button>
                        </div>

                        {isPreviewing && (
                          <div className="mt-2.5">
                            <WaveformCanvas
                              freqs={v.freq}
                              isPlaying={isPreviewing}
                              progress={pct}
                              color={v.bgColor}
                              height={28}
                              onClick={(p) => samplePlayer.seekTo(v.id, p)}
                            />
                          </div>
                        )}

                        {recorder.sampleLoadingId === v.id && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <i className="ri-loader-4-line animate-spin text-indigo-400 text-xs" />
                            <span className="text-[10px] text-zinc-500">AI 샘플 생성 중...</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Col 3: 미리듣기 + 생성 + 결과 ── */}
              <div className="flex flex-col gap-4">
                <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className="ri-headphone-line text-zinc-400 text-sm" />
                    </div>
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">샘플 미리듣기</span>
                  </div>

                  <div className="flex items-center gap-3 mb-3 p-3 bg-zinc-800/60 rounded-xl">
                    <div className={`w-10 h-10 rounded-full ${currentVoice.color} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-sm font-black">{currentVoice.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{currentVoice.name}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{currentVoice.desc}</p>
                    </div>
                  </div>

                  <div className="bg-zinc-800/40 rounded-xl p-3 mb-3">
                    <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{currentVoice.sampleText}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-zinc-500 mb-1">재생 속도</p>
                      <p className="text-sm font-black text-indigo-400">{speedDisplay}</p>
                    </div>
                    <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-zinc-500 mb-1">피치</p>
                      <p className="text-sm font-black text-indigo-400">{pitchDisplay}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => samplePlayer.toggle(currentVoice.id, currentVoice, speed)}
                    disabled={recorder.sampleLoadingId === currentVoice.id}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all cursor-pointer disabled:cursor-wait ${
                      samplePlayer.playingId === currentVoice.id
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : recorder.sampleLoadingId === currentVoice.id
                        ? 'bg-zinc-800/60 border-white/8 text-zinc-500'
                        : 'bg-zinc-800/60 border-white/8 text-zinc-300 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {recorder.sampleLoadingId === currentVoice.id ? (
                      <><i className="ri-loader-4-line animate-spin text-indigo-400" />AI 샘플 생성 중...</>
                    ) : samplePlayer.playingId === currentVoice.id ? (
                      <><i className="ri-pause-fill text-base" />재생 중... (클릭하여 정지)</>
                    ) : (
                      <><i className="ri-play-circle-line text-base" />▶ AI 샘플 미리듣기</>
                    )}
                  </button>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm py-3 rounded-2xl transition-all cursor-pointer"
                >
                  {isGenerating ? (
                    <><i className="ri-loader-4-line animate-spin" />AI 음성 생성 중...</>
                  ) : (
                    <>
                      <i className="ri-sparkling-2-line" />
                      {generated ? '재생성' : 'AI 나레이션 생성'}
                      <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs whitespace-nowrap">크레딧 사용</span>
                    </>
                  )}
                </button>

                {/* TTS 에러 배너 */}
                {recorder.ttsError && (
                  <div className={`rounded-xl border p-3 flex items-start gap-2 ${
                    recorder.isInsufficientCredits
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <i className={`text-sm flex-shrink-0 mt-0.5 ${
                      recorder.isInsufficientCredits ? 'ri-coin-line text-amber-400' : 'ri-error-warning-line text-red-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${recorder.isInsufficientCredits ? 'text-amber-300' : 'text-red-300'}`}>
                        {recorder.isInsufficientCredits ? '크레딧 부족' : '음성 생성 오류'}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{recorder.ttsError}</p>
                      {recorder.isInsufficientCredits && (
                        <p className="text-[10px] text-amber-400/70 mt-1">크레딧을 충전하거나 &apos;음성없이 진행&apos;을 선택하세요.</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!recorder.isInsufficientCredits && (
                        <button
                          onClick={() => { recorder.clearError(); handleGenerate(); }}
                          className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <i className="ri-refresh-line text-[11px]" /> 재시도
                        </button>
                      )}
                      <button onClick={recorder.clearError} className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                        <i className="ri-close-line text-sm" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Generating progress */}
                {isGenerating && (
                  <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <i className="ri-loader-4-line animate-spin text-indigo-400 text-sm" />
                      <span className="text-xs text-zinc-400">AI TTS 음성 생성 중... (실제 AI 음성)</span>
                    </div>
                    <div className="space-y-2">
                      {generatingSteps.map((label, i) => (
                        <div key={label} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                            i < generatingStep ? 'bg-emerald-500' : i === generatingStep ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-800'
                          }`}>
                            {i < generatingStep && <i className="ri-check-line text-white text-[9px]" />}
                            {i === generatingStep && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className={`text-[11px] ${
                            i < generatingStep ? 'text-zinc-500 line-through' : i === generatingStep ? 'text-zinc-200' : 'text-zinc-700'
                          }`}>{label}</span>
                          {i === generatingStep && <span className="text-[10px] text-indigo-400 ml-auto">진행 중...</span>}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                        style={{ width: `${(generatingStep / generatingSteps.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Download all button */}
                {generated && (
                  <button
                    onClick={() => recorder.downloadAllAudios(currentVoice.name)}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-download-cloud-line" />
                    전체 WAV 다운로드
                  </button>
                )}
              </div>
            </div>

            {/* Mobile: single panel based on tab */}
            <div className="md:hidden">
              {mobilePanelTab === 'script' && (
                <div className="space-y-4">
                  <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 max-h-[280px] overflow-y-auto">
                    <div className="space-y-2">
                      {scriptCuts.map((cut) => (
                        <div key={cut.id} className="flex gap-2">
                          <span className="text-[9px] font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded h-fit mt-0.5 whitespace-nowrap">{cut.label}</span>
                          <p className="text-xs text-zinc-400 leading-relaxed">{cut.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4 space-y-4">
                    <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">음성 조절</span>
                    <Slider
                      label="재생 속도" value={speed} min={0.5} max={2.0} step={0.1}
                      displayValue={speedDisplay} onChange={handleSpeedChange} onReset={() => handleSpeedChange(1.0)}
                      leftLabel="0.5x" rightLabel="2.0x"
                    />
                    <Slider
                      label="음성 피치" value={pitch} min={-5} max={5} step={1}
                      displayValue={pitchDisplay} onChange={setPitch} onReset={() => setPitch(0)}
                      leftLabel="-5" rightLabel="+5"
                    />
                  </div>
                </div>
              )}

              {mobilePanelTab === 'voice' && (
                <div className="space-y-2">
                  {voices.map((v) => {
                    const isSelected = selectedVoice === v.id;
                    const isPreviewing = samplePlayer.playingId === v.id;
                    const el = samplePlayer.elapsed[v.id] ?? 0;
                    const dur = samplePlayer.duration[v.id] ?? 1;
                    const pct = Math.min(1, el / dur);

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVoice(v.id)}
                        className={`w-full p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-500/60 bg-indigo-500/10'
                            : 'border-white/5 bg-zinc-900/60 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${v.color} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-xs font-black">{v.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{v.name}</span>
                              <span className="text-[9px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded-full">{v.tag}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 truncate">{v.desc}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              samplePlayer.toggle(v.id, v, speed);
                            }}
                            disabled={recorder.sampleLoadingId === v.id}
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer disabled:cursor-wait ${
                              isPreviewing ? 'bg-indigo-500' : recorder.sampleLoadingId === v.id ? 'bg-zinc-700' : isSelected ? 'bg-indigo-500/30 border border-indigo-500/40' : 'bg-zinc-700'
                            }`}
                          >
                            {recorder.sampleLoadingId === v.id ? (
                              <i className="ri-loader-4-line animate-spin text-zinc-400 text-xs" />
                            ) : (
                              <i className={`${isPreviewing ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-xs ${!isPreviewing ? 'ml-0.5' : ''}`} />
                            )}
                          </button>
                        </div>
                        {isPreviewing && (
                          <div className="mt-2.5">
                            <WaveformCanvas freqs={v.freq} isPlaying={isPreviewing} progress={pct} color={v.bgColor} height={28} onClick={(p) => samplePlayer.seekTo(v.id, p)} />
                          </div>
                        )}
                        {recorder.sampleLoadingId === v.id && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <i className="ri-loader-4-line animate-spin text-indigo-400 text-xs" />
                            <span className="text-[10px] text-zinc-500">AI 샘플 생성 중...</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {mobilePanelTab === 'preview' && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3 p-3 bg-zinc-800/60 rounded-xl">
                      <div className={`w-10 h-10 rounded-full ${currentVoice.color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-sm font-black">{currentVoice.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white">{currentVoice.name}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{currentVoice.desc}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-zinc-500 mb-1">속도</p>
                        <p className="text-sm font-black text-indigo-400">{speedDisplay}</p>
                      </div>
                      <div className="bg-zinc-800/60 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] text-zinc-500 mb-1">피치</p>
                        <p className="text-sm font-black text-indigo-400">{pitchDisplay}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => samplePlayer.toggle(currentVoice.id, currentVoice, speed)}
                      disabled={recorder.sampleLoadingId === currentVoice.id}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all cursor-pointer disabled:cursor-wait ${
                        samplePlayer.playingId === currentVoice.id
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                          : recorder.sampleLoadingId === currentVoice.id
                          ? 'bg-zinc-800/60 border-white/8 text-zinc-500'
                          : 'bg-zinc-800/60 border-white/8 text-zinc-300 hover:border-white/20'
                      }`}
                    >
                      {recorder.sampleLoadingId === currentVoice.id ? (
                        <><i className="ri-loader-4-line animate-spin text-indigo-400" />AI 샘플 생성 중...</>
                      ) : samplePlayer.playingId === currentVoice.id ? (
                        <><i className="ri-pause-fill text-base" />정지</>
                      ) : (
                        <><i className="ri-play-circle-line text-base" />▶ AI 샘플 미리듣기</>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-60 text-white font-bold text-sm py-3 rounded-2xl transition-all cursor-pointer"
                  >
                    {isGenerating ? (
                      <><i className="ri-loader-4-line animate-spin" />AI 생성 중...</>
                    ) : (
                      <>
                        <i className="ri-sparkling-2-line" />
                        {generated ? '재생성' : 'AI 나레이션 생성'}
                        <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs whitespace-nowrap">크레딧</span>
                      </>
                    )}
                  </button>

                  {/* 모바일 TTS 에러 배너 */}
                  {recorder.ttsError && (
                    <div className={`rounded-xl border p-3 flex items-start gap-2 ${
                      recorder.isInsufficientCredits
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <i className={`text-sm flex-shrink-0 mt-0.5 ${
                        recorder.isInsufficientCredits ? 'ri-coin-line text-amber-400' : 'ri-error-warning-line text-red-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${recorder.isInsufficientCredits ? 'text-amber-300' : 'text-red-300'}`}>
                          {recorder.isInsufficientCredits ? '크레딧 부족' : '음성 생성 오류'}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{recorder.ttsError}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!recorder.isInsufficientCredits && (
                          <button
                            onClick={() => { recorder.clearError(); handleGenerate(); }}
                            className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-refresh-line text-[11px]" /> 재시도
                          </button>
                        )}
                        <button onClick={recorder.clearError} className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                          <i className="ri-close-line text-sm" />
                        </button>
                      </div>
                    </div>
                  )}

                  {isGenerating && (
                    <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-2xl p-4">
                      <div className="space-y-2">
                        {generatingSteps.map((label, i) => (
                          <div key={label} className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                              i < generatingStep ? 'bg-emerald-500' : i === generatingStep ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-800'
                            }`}>
                              {i < generatingStep && <i className="ri-check-line text-white text-[9px]" />}
                              {i === generatingStep && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <span className={`text-[11px] ${i < generatingStep ? 'text-zinc-500 line-through' : i === generatingStep ? 'text-zinc-200' : 'text-zinc-700'}`}>{label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300" style={{ width: `${(generatingStep / generatingSteps.length) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  {generated && (
                    <button
                      onClick={() => recorder.downloadAllAudios(currentVoice.name)}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 font-semibold text-sm py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-download-cloud-line" />
                      전체 WAV 다운로드
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── Generated Result Panel ── */}
            {generated && (
              <div className="mt-5 md:mt-6 bg-zinc-900/60 border border-emerald-500/20 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-3 md:px-5 py-3 border-b border-white/5 bg-emerald-500/5 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <i className="ri-checkbox-circle-fill text-emerald-400 text-base" />
                    <span className="text-sm font-bold text-white">음성 생성 완료</span>
                    <span className="hidden sm:block text-[10px] text-zinc-500">{currentVoice.name} · {scriptCuts.length}컷 · WAV 파일</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      AI 음성
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setActiveTab('cuts')}
                      className={`px-2 md:px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none border ${
                        activeTab === 'cuts' ? 'bg-indigo-500/20 border-indigo-500/25 text-white' : 'text-zinc-500 hover:text-zinc-300 border-transparent'
                      }`}
                    >
                      컷별
                    </button>
                    <button
                      onClick={() => setActiveTab('full')}
                      className={`px-2 md:px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap outline-none focus:outline-none border ${
                        activeTab === 'full' ? 'bg-indigo-500/20 border-indigo-500/25 text-white' : 'text-zinc-500 hover:text-zinc-300 border-transparent'
                      }`}
                    >
                      전체
                    </button>
                  </div>
                </div>

                <div className="p-3 md:p-5">
                  {activeTab === 'cuts' && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-3">
                        각 컷의 ▶ 버튼을 눌러 AI가 생성한 실제 음성을 재생하세요.
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {scriptCuts.map((cut) => {
                          const audio = recorder.generatedAudios[cut.id];
                          return (
                            <CutPreviewRow
                              key={cut.id}
                              cut={cut}
                              voice={currentVoice}
                              player={realPlayer}
                              blobUrl={audio?.blobUrl}
                              duration={audio?.duration}
                              onDownload={() => recorder.downloadAudio(cut.id, currentVoice.name)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeTab === 'full' && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-3">
                        전체 나레이션 WAV 파일을 재생합니다.
                      </p>
                      <FullPlayer
                        voice={currentVoice}
                        speed={speed}
                        blobUrl={fullBlobUrl}
                        duration={fullDuration}
                        scriptLength={fullScript.length}
                        onDownload={() => {
                          if (!fullBlobUrl) return;
                          const a = document.createElement('a');
                          a.href = fullBlobUrl;
                          a.download = `voice_${currentVoice.name}_full.wav`;
                          a.click();
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex-shrink-0 border-t border-white/5 bg-[#0f0f11] px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-medium cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-arrow-left-line" />
            이전
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={onNext}
              className="flex items-center gap-1.5 md:gap-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-bold text-xs md:text-sm px-3 md:px-5 py-2 md:py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-volume-mute-line" />
              <span className="hidden sm:inline">음성없이 진행</span>
              <span className="sm:hidden">건너뛰기</span>
            </button>
            <button
              onClick={onNext}
              disabled={!generated}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm px-4 md:px-6 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              다음
              <i className="ri-arrow-right-line" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


