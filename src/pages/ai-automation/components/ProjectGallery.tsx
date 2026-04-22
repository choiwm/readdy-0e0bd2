import { useState, useMemo, useCallback } from 'react';
import { AutomationProject, ProjectStatus } from '@/mocks/automationProjects';
import ProjectCard from './ProjectCard';
import ResumeEditModal from './ResumeEditModal';
import BulkExportModal from './BulkExportModal';
import EmptyState from '@/components/base/EmptyState';
import { downloadJson, downloadCsv, buildSrtContent, downloadText, safeFilename, dateStamp, PROJECT_CSV_HEADER, buildProjectCsvRow } from '@/utils/exportBackup';
import { Toast } from '@/components/base/Toast';

interface ProjectGalleryProps {
  projects: AutomationProject[];
  onProjectsChange: (projects: AutomationProject[]) => void;
  onNewProject: () => void;
  newlyAddedId?: string | null;
  onEditProject?: (project: AutomationProject, resumeStep?: number) => void;
}

type FilterType = 'all' | ProjectStatus;
type SortType = 'newest' | 'oldest' | 'views' | 'likes';

const filterTabs: { key: FilterType; label: string; icon: string }[] = [
  { key: 'all', label: '전체', icon: 'ri-apps-line' },
  { key: 'completed', label: '완료', icon: 'ri-checkbox-circle-line' },
  { key: 'generating', label: '생성 중', icon: 'ri-loader-4-line' },
  { key: 'draft', label: '초안', icon: 'ri-draft-line' },
  { key: 'failed', label: '실패', icon: 'ri-error-warning-line' },
];

const sortOptions: { key: SortType; label: string }[] = [
  { key: 'newest', label: '최신순' },
  { key: 'oldest', label: '오래된순' },
  { key: 'views', label: '조회수순' },
  { key: 'likes', label: '좋아요순' },
];

export default function ProjectGallery({ projects, onProjectsChange, onNewProject, newlyAddedId, onEditProject }: ProjectGalleryProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('newest');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ── Selection mode state ──────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkExport, setShowBulkExport] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showAllBackupToast, setShowAllBackupToast] = useState(false);

  const handleDelete = (id: string) => onProjectsChange(projects.filter((p) => p.id !== id));
  const handleRetry = (id: string) => onProjectsChange(
    projects.map((p) => (p.id === id ? { ...p, status: 'generating' as ProjectStatus, progress: 0 } : p))
  );
  const handleLike = (id: string, liked: boolean) => {
    onProjectsChange(
      projects.map((p) => p.id === id ? { ...p, likes: liked ? p.likes + 1 : Math.max(0, p.likes - 1) } : p)
    );
  };
  const handleDuplicate = (id: string) => {
    const original = projects.find((p) => p.id === id);
    if (!original) return;
    const clone: AutomationProject = {
      ...original,
      id: `clone_${Date.now()}`,
      title: `${original.title} (복제)`,
      status: 'draft',
      progress: undefined,
      views: 0,
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    onProjectsChange([clone, ...projects]);
  };

  // ── filtered 먼저 선언 (selectAll이 참조하므로 앞에 위치해야 함) ──────────
  const filtered = useMemo(() => {
    let list = [...projects];
    if (filter !== 'all') list = list.filter((p) => p.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === 'views') return b.views - a.views;
      if (sort === 'likes') return b.likes - a.likes;
      return 0;
    });
    return list;
  }, [projects, filter, sort, search]);

  // ── Selection handlers ────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filtered.map(p => p.id)));
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleAllBackup = useCallback(async () => {
    const stamp = dateStamp();
    // 전체 JSON
    downloadJson(projects.map(p => ({
      id: p.id, title: p.title, topic: p.topic, status: p.status,
      duration: p.duration, ratio: p.ratio, style: p.style, model: p.model,
      mode: p.mode, cuts: p.cuts, views: p.views, likes: p.likes,
      createdAt: p.createdAt, thumbnail: p.thumbnail,
    })), `all_projects_${stamp}.json`);
    // 전체 CSV
    await new Promise(r => setTimeout(r, 200));
    const rows = projects.map(p => buildProjectCsvRow(p));
    downloadCsv(`${PROJECT_CSV_HEADER}\n${rows.join('\n')}`, `all_projects_${stamp}.csv`);
    // 완료 프로젝트 SRT
    const completed = projects.filter(p => p.status === 'completed');
    for (let i = 0; i < completed.length; i++) {
      await new Promise(r => setTimeout(r, 150 * (i + 1)));
      const p = completed[i];
      downloadText(buildSrtContent(p.title, p.topic, p.duration), `${safeFilename(p.title)}_${stamp}.srt`);
    }
    setShowAllBackupToast(true);
    setTimeout(() => setShowAllBackupToast(false), 3500);
  }, [projects]);

  const handleBulkDelete = useCallback(() => {
    onProjectsChange(projects.filter(p => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    setSelectionMode(false);
  }, [projects, selectedIds, onProjectsChange]);

  const selectedProjects = useMemo(
    () => projects.filter(p => selectedIds.has(p.id)),
    [projects, selectedIds]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    projects.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [projects]);

  const totalViews = projects.filter((p) => p.status === 'completed').reduce((s, p) => s + p.views, 0);
  const totalCompleted = projects.filter((p) => p.status === 'completed').length;
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selectedIds.has(p.id));

  return (
    <div className="flex flex-col h-full">

      {showAllBackupToast && (
        <Toast message={`전체 ${projects.length}개 프로젝트 백업 완료 (JSON + CSV + SRT)`} type="success" onClose={() => setShowAllBackupToast(false)} />
      )}

      {/* ── Bulk Export Modal ── */}
      {showBulkExport && (
        <BulkExportModal
          projects={selectedProjects}
          onClose={() => setShowBulkExport(false)}
        />
      )}

      {/* ── Bulk Delete Confirm ── */}
      {showBulkDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowBulkDeleteConfirm(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <i className="ri-delete-bin-line text-red-400 text-lg" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">{selectedIds.size}개 프로젝트 삭제</p>
                <p className="text-zinc-500 text-xs mt-0.5">이 작업은 되돌릴 수 없습니다</p>
              </div>
            </div>
            {/* Thumbnail strip */}
            <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none">
              {selectedProjects.slice(0, 6).map(p => (
                <img key={p.id} src={p.thumbnail} alt={p.title} className="w-12 h-9 rounded-lg object-cover flex-shrink-0 border border-white/10" />
              ))}
              {selectedProjects.length > 6 && (
                <div className="w-12 h-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-white/10">
                  <span className="text-zinc-500 text-[10px] font-bold">+{selectedProjects.length - 6}</span>
                </div>
              )}
            </div>
            <p className="text-zinc-500 text-xs mb-5 leading-relaxed">
              선택된 <strong className="text-white">{selectedIds.size}개</strong> 프로젝트를 모두 삭제합니다. 삭제된 프로젝트는 복구할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                {selectedIds.size}개 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
        {[
          { label: '전체 프로젝트', value: projects.length, icon: 'ri-folder-video-line', color: 'text-zinc-300' },
          { label: '완료된 영상', value: totalCompleted, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400' },
          { label: '총 조회수', value: totalViews >= 10000 ? `${(totalViews / 10000).toFixed(1)}만` : totalViews, icon: 'ri-eye-line', color: 'text-indigo-400' },
          { label: '생성 중', value: counts['generating'] || 0, icon: 'ri-loader-4-line', color: 'text-violet-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 md:p-3 flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-lg bg-white/5 flex-shrink-0">
              <i className={`${stat.icon} ${stat.color} text-base md:text-lg`} />
            </div>
            <div>
              <p className={`text-base md:text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-[9px] md:text-[10px] text-zinc-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 mb-4">
        {/* 필터 탭 — 모바일 가로 스크롤 */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 bg-zinc-900 border border-white/5 rounded-xl p-1 w-max min-w-full">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filter === tab.key
                    ? 'bg-indigo-500 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <i className={tab.icon} />
                {tab.label}
                {counts[tab.key] !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === tab.key ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 검색 + 정렬 + 뷰 모드 + 선택 버튼 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="프로젝트 검색..."
              className="w-full bg-zinc-900 border border-white/5 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortType)}
            className="bg-zinc-900 border border-white/5 rounded-xl px-2 md:px-3 py-2 text-xs md:text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/40 cursor-pointer flex-shrink-0"
          >
            {sortOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-zinc-900 border border-white/5 rounded-xl p-1 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              <i className="ri-grid-line text-sm" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              <i className="ri-list-check text-sm" />
            </button>
          </div>

          {/* 전체 백업 버튼 */}
          <button
            onClick={handleAllBackup}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-white/5 text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
            title="전체 프로젝트 로컬 백업"
          >
            <i className="ri-save-3-line" />
            <span className="hidden sm:inline">전체 백업</span>
          </button>

          {/* 선택 모드 토글 버튼 */}
          <button
            onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
              selectionMode
                ? 'bg-indigo-500 text-white'
                : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
            }`}
          >
            <i className={selectionMode ? 'ri-close-line' : 'ri-checkbox-multiple-line'} />
            <span className="hidden sm:inline">{selectionMode ? '취소' : '선택'}</span>
          </button>
        </div>
      </div>

      {/* ── Selection Action Bar ── */}
      {selectionMode && (
        <div className={`mb-4 rounded-2xl border transition-all duration-300 overflow-hidden ${
          selectedIds.size > 0
            ? 'bg-indigo-500/10 border-indigo-500/30'
            : 'bg-zinc-900/60 border-white/5'
        }`}>
          <div className="flex items-center gap-3 px-4 py-3">
            {/* 전체 선택 체크박스 */}
            <button
              onClick={() => allFilteredSelected ? clearSelection() : selectAll()}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                allFilteredSelected
                  ? 'bg-indigo-500 border-indigo-500'
                  : selectedIds.size > 0
                    ? 'bg-indigo-500/30 border-indigo-500/60'
                    : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
              }`}
            >
              {allFilteredSelected
                ? <i className="ri-check-line text-white text-[10px]" />
                : selectedIds.size > 0
                  ? <i className="ri-subtract-line text-indigo-300 text-[10px]" />
                  : null
              }
            </button>

            <div className="flex-1 min-w-0">
              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{selectedIds.size}개 선택됨</span>
                  <div className="flex gap-1 overflow-x-auto scrollbar-none">
                    {selectedProjects.slice(0, 4).map(p => (
                      <img key={p.id} src={p.thumbnail} alt="" className="w-7 h-5 rounded object-cover flex-shrink-0 border border-white/20" />
                    ))}
                    {selectedProjects.length > 4 && (
                      <div className="w-7 h-5 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] text-zinc-400 font-bold">+{selectedProjects.length - 4}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-sm text-zinc-400">프로젝트를 클릭해 선택하세요</span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={clearSelection}
                    className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors whitespace-nowrap hidden sm:block"
                  >
                    선택 해제
                  </button>
                  <button
                    onClick={() => setShowBulkExport(true)}
                    className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-archive-drawer-line text-xs" />
                    <span className="hidden sm:inline">내보내기</span>
                    <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{selectedIds.size}</span>
                  </button>
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line text-xs" />
                    <span className="hidden sm:inline">삭제</span>
                  </button>
                </>
              )}
              <button
                onClick={exitSelectionMode}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                <i className="ri-close-line text-sm" />
              </button>
            </div>
          </div>

          {/* Quick select shortcuts */}
          {selectedIds.size === 0 && (
            <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
              <span className="text-[10px] text-zinc-600 whitespace-nowrap flex-shrink-0">빠른 선택:</span>
              {[
                { label: '전체', action: () => setSelectedIds(new Set(filtered.map(p => p.id))) },
                { label: '완료만', action: () => setSelectedIds(new Set(filtered.filter(p => p.status === 'completed').map(p => p.id))) },
                { label: '초안만', action: () => setSelectedIds(new Set(filtered.filter(p => p.status === 'draft').map(p => p.id))) },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={s.action}
                  className="text-[10px] text-zinc-400 hover:text-indigo-400 bg-zinc-800/60 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 px-2.5 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap flex-shrink-0"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex-1">
          <EmptyState
            icon={search.trim() ? 'ri-search-line' : 'ri-folder-video-line'}
            title={search.trim() ? '검색 결과가 없습니다' : filter !== 'all' ? '해당 상태의 프로젝트가 없습니다' : '프로젝트가 없습니다'}
            description={search.trim() ? '다른 키워드로 검색해보세요' : '새 프로젝트를 만들어 시작해보세요'}
            size="md"
            actions={[
              ...(search.trim() || filter !== 'all' ? [{ label: '필터 초기화', onClick: () => { setSearch(''); setFilter('all'); }, icon: 'ri-close-line', variant: 'ghost' as const }] : []),
              { label: '새 프로젝트', onClick: onNewProject, icon: 'ri-add-line' },
            ]}
          />
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 auto-rows-auto">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onDuplicate={handleDuplicate}
              onLike={handleLike}
              isNew={newlyAddedId === project.id}
              selectionMode={selectionMode}
              selected={selectedIds.has(project.id)}
              onToggleSelect={toggleSelect}
              onEditProject={onEditProject}
            />
          ))}
          {!selectionMode && (
            <div
              onClick={onNewProject}
              className="rounded-2xl border-2 border-dashed border-white/10 hover:border-indigo-500/40 flex flex-col items-center justify-center gap-3 p-8 cursor-pointer transition-all group min-h-[160px] md:min-h-[200px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 group-hover:bg-indigo-500/10 border border-white/10 group-hover:border-indigo-500/30 flex items-center justify-center transition-all">
                <i className="ri-add-line text-2xl text-zinc-500 group-hover:text-indigo-400 transition-colors" />
              </div>
              <p className="text-zinc-500 group-hover:text-zinc-300 text-sm font-bold transition-colors">새 프로젝트</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((project) => (
            <ListRow
              key={project.id}
              project={project}
              onDelete={handleDelete}
              onRetry={handleRetry}
              onDuplicate={handleDuplicate}
              selectionMode={selectionMode}
              selected={selectedIds.has(project.id)}
              onToggleSelect={toggleSelect}
              onEditProject={onEditProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ListRowProps {
  project: AutomationProject;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onDuplicate: (id: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEditProject?: (project: AutomationProject, resumeStep?: number) => void;
}

function ListRow({ project, onDelete, onRetry, onDuplicate, selectionMode = false, selected = false, onToggleSelect, onEditProject }: ListRowProps) {
  const [showResumeModal, setShowResumeModal] = useState(false);

  const cfg = {
    completed: { label: '완료', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    generating: { label: '생성 중', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    failed: { label: '실패', color: 'text-red-400', bg: 'bg-red-500/10' },
    draft: { label: '초안', color: 'text-zinc-400', bg: 'bg-zinc-700/30' },
  }[project.status];

  const handleRowClick = () => {
    if (selectionMode) {
      onToggleSelect?.(project.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditProject) {
      // ResumeEditModal을 통해 단계 선택 후 편집 시작
      setShowResumeModal(true);
    } else {
      setShowResumeModal(true);
    }
  };

  return (
    <>
      {!selectionMode && showResumeModal && (
        <ResumeEditModal
          project={project}
          onClose={() => setShowResumeModal(false)}
          onEditInAutomation={(proj, step) => {
            setShowResumeModal(false);
            onEditProject?.(proj, step);
          }}
        />
      )}
      <div
        className={`flex items-center gap-3 border rounded-xl p-3 transition-all cursor-pointer group ${
          selectionMode && selected
            ? 'bg-indigo-500/10 border-indigo-500/40'
            : 'bg-zinc-900/60 border-white/5 hover:border-indigo-500/20'
        }`}
        onClick={handleRowClick}
      >
        {/* Selection checkbox */}
        {selectionMode && (
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            selected ? 'bg-indigo-500 border-indigo-500' : 'bg-zinc-800 border-zinc-600'
          }`}>
            {selected && <i className="ri-check-line text-white text-[10px]" />}
          </div>
        )}

        <img src={project.thumbnail} alt={project.title} className="w-16 h-11 md:w-20 md:h-14 rounded-lg object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-white text-sm font-bold truncate">{project.title}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
          </div>
          <p className="text-zinc-500 text-xs truncate">{project.topic}</p>
        </div>
        {/* 메타 정보 — 모바일 숨김 */}
        <div className="hidden md:flex items-center gap-4 flex-shrink-0 text-xs text-zinc-500">
          <span>{project.model}</span>
          <span>{project.ratio}</span>
          <span>{project.duration}s</span>
          {project.status === 'completed' && <span className="flex items-center gap-1"><i className="ri-eye-line" />{project.views.toLocaleString()}</span>}
        </div>
        {/* 모바일 간략 메타 */}
        <div className="flex md:hidden items-center gap-1.5 flex-shrink-0 text-[10px] text-zinc-600">
          <span>{project.ratio}</span>
          <span>·</span>
          <span>{project.duration}s</span>
        </div>

        {/* Action buttons — 선택 모드가 아닐 때만 */}
        {!selectionMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleEdit}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 cursor-pointer"
              title="이어서 편집"
            >
              <i className="ri-edit-line text-sm" />
            </button>
            {project.status === 'failed' && (
              <button onClick={(e) => { e.stopPropagation(); onRetry(project.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer">
                <i className="ri-refresh-line text-sm" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(project.id); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
              title="복제"
            >
              <i className="ri-file-copy-line text-sm" />
            </button>
            {project.status === 'completed' && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const filename = `${project.title.replace(/\s+/g, '_')}.jpg`;
                  try {
                    const res = await fetch(project.thumbnail, { mode: 'cors' });
                    const blob = await res.blob();
                    const objUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = objUrl;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(objUrl);
                  } catch {
                    const a = document.createElement('a');
                    a.href = project.thumbnail;
                    a.download = filename;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                className="hidden sm:flex w-7 h-7 items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:text-white cursor-pointer"
                title="다운로드"
              >
                <i className="ri-download-line text-sm" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-zinc-400 hover:text-red-400 cursor-pointer">
              <i className="ri-delete-bin-line text-sm" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
