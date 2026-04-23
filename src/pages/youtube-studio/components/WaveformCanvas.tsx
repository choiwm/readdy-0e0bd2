import { useRef, useEffect } from 'react';

interface WaveformCanvasProps {
  freqs: number[];
  isPlaying: boolean;
  progress: number;
  color: string;
  height?: number;
  onClick?: (pct: number) => void;
}

export default function WaveformCanvas({
  freqs, isPlaying, progress, color, height = 48, onClick,
}: WaveformCanvasProps) {
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
