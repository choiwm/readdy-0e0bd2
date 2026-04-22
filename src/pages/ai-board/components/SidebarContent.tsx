import { useCallback } from 'react';
import PageHeader from '@/components/feature/PageHeader';
import { SfxItem } from '@/hooks/useSfxStore';

interface Project {
  id: string;
  title: string;
  aspectRatio: string;
  model: string;
  resolution: string;
  outputMode: 'image' | 'video';
  shots: unknown[];
  refSlots: unknown[];
}

interface SidebarContentProps {
  projects: Project[];
  activeProjectId: string;
  projectTitle: string;
  sfxItems: SfxItem[];
  selectedBgm: SfxItem | null;
  bgmPlaying: boolean;
  bgmVolume: number;
  onNewProject: () => void;
  onSwitchProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onToggleBgm: () => void;
  onVolumeChange: (v: number) => void;
  onSelectBgm: (sfx: SfxItem | null) => void;
  onShowSfxPicker: () => void;
  onCollapse?: () => void;
  onCloseMobile?: () => void;
}

export default function SidebarContent({
  projects,
  activeProjectId,
  projectTitle,
  sfxItems,
  selectedBgm,
  bgmPlaying,
  bgmVolume,
  onNewProject,
  onSwitchProject,
  onDeleteProject,
  onToggleBgm,
  onVolumeChange,
  onSelectBgm,
  onShowSfxPicker,
  onCollapse,
  onCloseMobile,
}: SidebarContentProps) {
  const handleNewProject = useCallback(() => {
    onNewProject();
    onCloseMobile?.();
  }, [onNewProject, onCloseMobile]);

  const handleSwitchProject = useCallback((id: string) => {
    onSwitchProject(id);
    onCloseMobile?.();
  }, [onSwitchProject, onCloseMobile]);

  return (
    <>
      <PageHeader
        icon="ri-folder-line"
        title="Projects"
        subtitle="Storyboard & Shot List"
        badgeColor="indigo"
        actions={
          onCollapse ? (
            <button
              onClick={onCollapse}
              className="hidden md:flex w-6 h-6 items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <i className="ri-arrow-left-s-line text-sm" />
            </button>
          ) : undefined
        }
      />
      <div className="p-2">
        <button
          onClick={handleNewProject}
          className="w-full flex items-center gap-2 bg-zinc-900/60 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 text-zinc-300 text-xs font-bold px-3 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line text-indigo-400" /> 새 스토리보드
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {projects.map((p) => (
          <div
            key={p.id}
            className={`group flex items-center gap-1 rounded-lg transition-colors ${
              activeProjectId === p.id
                ? 'bg-indigo-500/15 border border-indigo-500/25'
                : 'border border-transparent hover:bg-white/5'
            }`}
          >
            <button
              onClick={() => handleSwitchProject(p.id)}
              className={`flex-1 text-left px-3 py-2 text-xs transition-colors cursor-pointer truncate ${
                activeProjectId === p.id ? 'text-indigo-300' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {p.id === activeProjectId ? projectTitle : p.title}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex-shrink-0 mr-1"
            >
              <i className="ri-delete-bin-line text-[10px]" />
            </button>
          </div>
        ))}
      </div>

      {/* 배경음 섹션 */}
      <div className="flex-shrink-0 border-t border-white/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <i className="ri-music-2-line text-zinc-500 text-xs" />
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">배경음</span>
            {sfxItems.length > 0 && (
              <span className="text-[9px] bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded-full font-bold">
                {sfxItems.length}
              </span>
            )}
          </div>
          <button
            onClick={onShowSfxPicker}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer transition-colors whitespace-nowrap"
          >
            {selectedBgm ? '변경' : '선택'}
          </button>
        </div>
        {selectedBgm ? (
          <div
            className={`rounded-xl bg-zinc-900/60 border p-2.5 ${
              selectedBgm.type === 'music' ? 'border-indigo-500/20' : 'border-emerald-500/20'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  selectedBgm.type === 'music'
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}
              >
                {selectedBgm.type === 'music' ? 'Music' : 'SFX'}
              </span>
            </div>
            {selectedBgm.title && (
              <p className="text-[10px] font-bold text-zinc-300 truncate mb-0.5">{selectedBgm.title}</p>
            )}
            <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mb-2">{selectedBgm.prompt}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleBgm}
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${
                  bgmPlaying
                    ? selectedBgm.type === 'music'
                      ? 'bg-indigo-500 hover:bg-indigo-400'
                      : 'bg-emerald-500 hover:bg-emerald-400'
                    : 'bg-zinc-700 hover:bg-zinc-600'
                }`}
              >
                <i
                  className={`${bgmPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-[9px] ${!bgmPlaying ? 'ml-px' : ''}`}
                />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={bgmVolume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className={`flex-1 h-1 cursor-pointer ${
                  selectedBgm.type === 'music' ? 'accent-indigo-500' : 'accent-emerald-500'
                }`}
              />
              <button
                onClick={() => onSelectBgm(null)}
                className="text-zinc-600 hover:text-red-400 cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line text-xs" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onShowSfxPicker}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-zinc-700/60 hover:border-emerald-500/30 text-zinc-600 hover:text-emerald-400 text-[10px] transition-all cursor-pointer"
          >
            <i className="ri-add-line text-xs" /> 배경음 추가
          </button>
        )}
      </div>
    </>
  );
}
