import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ShortcutTool } from '@/mocks/aiShortcuts';

interface SortableToolCardProps {
  tool: ShortcutTool & { isCustom?: boolean };
  onRemove?: () => void;
  isDragOverlay?: boolean;
}

export default function SortableToolCard({
  tool,
  onRemove,
  isDragOverlay = false,
}: SortableToolCardProps) {
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tool.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-drag-handle]')) return;
    setClicked(true);
    setTimeout(() => setClicked(false), 600);
    window.open(tool.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      className={`group relative flex items-center gap-2 md:gap-3 bg-zinc-900/60 border rounded-2xl p-2.5 md:p-3.5 cursor-pointer transition-all duration-200 select-none ${
        isDragOverlay
          ? 'border-indigo-500/50 bg-indigo-500/10 shadow-xl shadow-indigo-500/20 scale-105'
          : isDragging
          ? 'border-white/5 bg-zinc-900/30'
          : clicked
          ? 'border-emerald-500/40 bg-emerald-500/5 scale-95'
          : hovered
          ? 'border-indigo-500/40 bg-indigo-500/5 -translate-y-0.5'
          : 'border-white/[0.06] hover:border-white/10'
      }`}
    >
      {/* Custom badge */}
      {tool.isCustom && (
        <div className="absolute top-2 left-2 w-1.5 h-1.5 rounded-full bg-indigo-400" title="직접 추가한 서비스" />
      )}

      {/* Drag handle — always visible on mobile, hover-only on desktop */}
      <div
        data-drag-handle
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-grab active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100 hover:bg-white/10 touch-none ${
          isDragOverlay ? 'opacity-100' : 'opacity-60 sm:opacity-0'
        }`}
        title="드래그하여 순서 변경"
      >
        <i className="ri-draggable text-zinc-500 text-xs" />
      </div>

      {/* Icon */}
      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl overflow-hidden flex-shrink-0 border transition-all ${
        hovered ? 'border-indigo-500/30' : 'border-white/10'
      }`}>
        {tool.icon.startsWith('http') ? (
          <img src={tool.icon} alt={tool.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <i className={`${tool.icon} text-zinc-400 text-sm md:text-lg`} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 pr-2 md:pr-4">
        <p className={`text-[11px] md:text-sm font-bold truncate transition-colors ${hovered ? 'text-white' : 'text-zinc-300'}`}>
          {tool.name}
        </p>
        <p className="text-[9px] md:text-[10px] text-zinc-600 truncate mt-0.5 hidden sm:block">{tool.desc}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {onRemove && hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="w-5 h-5 flex items-center justify-center rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors"
            title="제거"
          >
            <i className="ri-close-line text-red-400 text-[10px]" />
          </button>
        )}
        <div className={`w-5 h-5 flex items-center justify-center transition-all ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          {clicked
            ? <i className="ri-check-line text-emerald-400 text-sm" />
            : <i className="ri-arrow-right-up-line text-indigo-400 text-sm" />
          }
        </div>
      </div>
    </div>
  );
}
