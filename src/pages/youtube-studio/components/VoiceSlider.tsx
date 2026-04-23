interface VoiceSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
  onReset: () => void;
  leftLabel: string;
  rightLabel: string;
}

export default function VoiceSlider({
  label, value, min, max, step, displayValue,
  onChange, onReset, leftLabel, rightLabel,
}: VoiceSliderProps) {
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
