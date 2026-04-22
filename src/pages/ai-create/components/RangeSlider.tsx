// Shared range slider component for ai-create module.
// Replaces the repeated custom track+fill+thumb pattern across
// PromptBar, Sidebar (Angle + Look panels), AngleView, LookView, GalleryGrid.

interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Tailwind gradient classes for the filled track, e.g. "from-indigo-500 to-violet-500" */
  gradient?: string;
  /** Tailwind border-color class for the thumb, e.g. "border-indigo-400" */
  thumbColor?: string;
  /** Height of the container div (affects hit area). Default: "h-5" */
  height?: string;
  /** Thumb size. Default: "w-4 h-4" */
  thumbSize?: string;
}

/**
 * RangeSlider
 *
 * Renders a custom-styled range input with:
 *  - a dark track
 *  - a gradient-filled progress bar
 *  - a white circular thumb with colored border
 *
 * The `pct` (fill width) is derived automatically from value/min/max.
 */
export default function RangeSlider({
  value,
  min,
  max,
  onChange,
  gradient = 'from-indigo-500 to-violet-500',
  thumbColor = 'border-indigo-400',
  height = 'h-5',
  thumbSize = 'w-4 h-4',
}: RangeSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  // Thumb offset: half of thumb width in px (default 8px for w-4)
  const thumbHalfPx = thumbSize === 'w-3 h-3' ? 6 : thumbSize === 'w-3.5 h-3.5' ? 7 : 8;

  return (
    <div className={`relative ${height} flex items-center`}>
      {/* Track */}
      <div className="absolute inset-x-0 h-[3px] bg-zinc-800 rounded-full" />
      {/* Fill */}
      <div
        className={`absolute left-0 h-[3px] bg-gradient-to-r ${gradient} rounded-full`}
        style={{ width: `${pct}%` }}
      />
      {/* Native input (invisible, handles interaction) */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer"
      />
      {/* Thumb */}
      <div
        className={`absolute ${thumbSize} rounded-full bg-white border-2 ${thumbColor} shadow pointer-events-none`}
        style={{ left: `calc(${pct}% - ${thumbHalfPx}px)` }}
      />
    </div>
  );
}
