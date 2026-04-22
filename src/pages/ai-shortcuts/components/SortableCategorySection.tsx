import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { ShortcutTool } from '@/mocks/aiShortcuts';
import SortableToolCard from './SortableToolCard';

interface SortableCategorySectionProps {
  categoryId: string;
  label: string;
  tools: (ShortcutTool & { isCustom?: boolean })[];
  searchQuery: string;
  isDragOverlay?: boolean;
  onToolsReorder: (categoryId: string, tools: (ShortcutTool & { isCustom?: boolean })[]) => void;
  onRemoveTool: (name: string) => void;
  onAddClick: () => void;
}

export default function SortableCategorySection({
  categoryId,
  label,
  tools,
  searchQuery,
  isDragOverlay = false,
  onToolsReorder,
  onRemoveTool,
  onAddClick,
}: SortableCategorySectionProps) {
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: categoryId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  // TouchSensor for mobile drag support
  const toolSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleToolDragStart = (event: DragStartEvent) => {
    setActiveToolId(event.active.id as string);
  };

  const handleToolDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveToolId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = tools.findIndex((t) => t.name === active.id);
    const newIndex = tools.findIndex((t) => t.name === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tools, oldIndex, newIndex);
    onToolsReorder(categoryId, reordered);
  };

  const activeDragTool = activeToolId
    ? tools.find((t) => t.name === activeToolId)
    : null;

  const filteredTools = searchQuery
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.desc.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tools;

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`transition-all duration-200 ${isDragOverlay ? 'opacity-90' : ''}`}
    >
      {/* Category Header */}
      <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-5 group/header">
        {/* Category drag handle — always visible on mobile, hover-only on desktop */}
        {!searchQuery && (
          <div
            {...attributes}
            {...listeners}
            className={`flex items-center justify-center w-7 h-7 rounded-md cursor-grab active:cursor-grabbing transition-all touch-none flex-shrink-0 ${
              isDragOverlay
                ? 'opacity-100 text-indigo-400 bg-indigo-500/10'
                : 'opacity-60 sm:opacity-0 sm:group-hover/header:opacity-100 text-zinc-600 hover:text-zinc-400 hover:bg-white/5'
            }`}
            title="카테고리 순서 변경"
          >
            <i className="ri-draggable text-sm" />
          </div>
        )}

        <div className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full flex-shrink-0" />
        <h2 className="text-sm md:text-base font-bold text-white">{label}</h2>
        <span className="text-xs text-zinc-600 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0">
          {filteredTools.length}
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-white/5 to-transparent" />
        {!searchQuery && (
          <span className="hidden md:flex text-[10px] text-zinc-700 items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity whitespace-nowrap">
            <i className="ri-drag-move-line text-xs" /> 드래그로 순서 변경
          </span>
        )}
      </div>

      {/* Tools Grid with inner DnD */}
      <DndContext
        sensors={toolSensors}
        collisionDetection={closestCenter}
        onDragStart={handleToolDragStart}
        onDragEnd={handleToolDragEnd}
      >
        <SortableContext
          items={filteredTools.map((t) => t.name)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 md:gap-3">
            {filteredTools.map((tool) => (
              <SortableToolCard
                key={tool.name}
                tool={tool}
                onRemove={tool.isCustom ? () => onRemoveTool(tool.name) : undefined}
              />
            ))}

            {/* Add button — only when not searching */}
            {!searchQuery && (
              <div
                onClick={onAddClick}
                className="flex items-center gap-2 md:gap-3 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl p-2.5 md:p-3.5 cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group active:scale-95"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl border border-dashed border-zinc-700 group-hover:border-indigo-500/40 flex items-center justify-center flex-shrink-0 transition-colors">
                  <i className="ri-add-line text-zinc-600 group-hover:text-indigo-400 text-base md:text-lg transition-colors" />
                </div>
                <div>
                  <p className="text-[11px] md:text-sm font-bold text-zinc-600 group-hover:text-zinc-300 transition-colors">추가</p>
                  <p className="text-[9px] md:text-[10px] text-zinc-700 mt-0.5 group-hover:text-zinc-500 transition-colors hidden sm:block">서비스 연동</p>
                </div>
              </div>
            )}
          </div>
        </SortableContext>

        {/* Tool drag overlay */}
        <DragOverlay>
          {activeDragTool ? (
            <SortableToolCard tool={activeDragTool} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
