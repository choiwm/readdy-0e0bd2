import { useState, useCallback, useRef, useEffect } from 'react';
import { AutomationProject } from '@/mocks/automationProjects';
import VideoPreviewModal from './VideoPreviewModal';
import ResumeEditModal from './ResumeEditModal';
import { Toast } from '@/components/base/Toast';
import { downloadJson, downloadCsv, downloadText, buildSrtContent, safeFilename, dateStamp, PROJECT_CSV_HEADER, buildProjectCsvRow } from '@/utils/exportBackup';

interface ProjectCardProps {
  project: AutomationProject;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLike?: (id: string, liked: boolean) => void;
  isNew?: boolean;
  /** 선택 모드 활성화 여부 */
  selectionMode?: boolean;
  /** 현재 선택 여부 */
  selected?: boolean;
  /** 선택 토글 콜백 */
  onToggleSelect?: (id: string) => void;
  onEditProject?: (project: AutomationProject, resumeStep?: number) => void;
}

const statusConfig = {
  completed: { label: '완료', color: 'text-emerald-400', bg: 'bg-emerald-500/20', dot: 'bg-emerald-400' },
  generating: { label: '생성 중', color: 'text-indigo-400', bg: 'bg-indigo-500/20', dot: 'bg-indigo-400' },
  failed: { label: '실패', color: 'text-red-400', bg: 'bg-red-500/20', dot: 'bg-red-400' },
  draft: { label: '초안', color: 'text-zinc-400', bg: 'bg-zinc-700/50', dot: 'bg-zinc-500' },
};

function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ProjectCard({ project, onDelete, onRetry, onDuplicate, onLike, isNew, selectionMode = false, selected = false, onToggleSelect, onEditProject }: ProjectCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // liked 상태를 로컬에서 추적
  // project.id가 변경될 때만 liked 초기화 (다른 프로젝트로 교체 시)
  // project.likes 변경은 onLike 콜백으로 인한 것이므로 liked를 리셋하면 안 됨
  const [liked, setLiked] = useState(false);
  const prevProjectIdRef = useRef(project.id);
  useEffect(() => {
    // 프로젝트 자체가 바뀌면 liked 초기화
    if (project.id !== prevProjectIdRef.current) {
      prevProjectIdRef.current = project.id;
      setLiked(false);
    }
  }, [project.id]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showDeletedToast, setShowDeletedToast] = useState(false);
  const [showDuplicatedToast, setShowDuplicatedToast] = useState(false);
  const [showBackupToast, setShowBackupToast] = useState(false);
  const cfg = statusConfig[project.status];
  const isPortrait = project.ratio === '9:16';

  const handleEdit = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    // 항상 ResumeEditModal을 통해 단계 선택 후 편집 시작
    setShowResumeModal(true);
    setMenuOpen(false);
  }, []);

  const handleCardClick = useCallback(() => {
    if (selectionMode) {
      onToggleSelect?.(project.id);
      return;
    }
    if (project.status === 'completed') setShowPreviewModal(true);
  }, [selectionMode, onToggleSelect, project.id, project.status]);

  const handleDeleteConfirm = useCallback(() => {
    onDelete(project.id);
    setShowDeleteConfirm(false);
    setShowDeletedToast(true);
    setTimeout(() => setShowDeletedToast(false), 2800);
  }, [onDelete, project.id]);

  const handleDuplicate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(project.id);
    setMenuOpen(false);
    setShowDuplicatedToast(true);
    setTimeout(() => setShowDuplicatedToast(false), 2800);
  }, [onDuplicate, project.id]);

  const handleBackup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    const stamp = dateStamp();
    const fname = safeFilename(project.title);
    // JSON 메타데이터
    downloadJson({
      id: project.id, title: project.title, topic: project.topic,
      status: project.status, duration: project.duration, ratio: project.ratio,
      style: project.style, model: project.model, mode: project.mode,
      cuts: project.cuts, views: project.views, likes: project.likes,
      createdAt: project.createdAt, thumbnail: project.thumbnail,
    }, `${fname}_${stamp}.json`);
    // CSV 리포트
    setTimeout(() => {
      downloadCsv(`${PROJECT_CSV_HEADER}\n${buildProjectCsvRow(project)}`, `${fname}_${stamp}.csv`);
    }, 200);
    // SRT 자막 (완료 프로젝트만)
    if (project.status === 'completed') {
      setTimeout(() => {
        downloadText(buildSrtContent(project.title, project.topic, project.duration), `${fname}_${stamp}.srt`);
      }, 400);
    }
    setShowBackupToast(true);
    setTimeout(() => setShowBackupToast(false), 3000);
  }, [project]);

  return (
    <>
      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thumbnail preview */}
            <div className="w-full h-24 rounded-xl overflow-hidden mb-4 bg-zinc-800">
              <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <i className="ri-delete-bin-line text-red-400 text-lg" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">프로젝트 삭제</p>
                <p className="text-zinc-500 text-xs mt-0.5">이 작업은 되돌릴 수 없습니다</p>
              </div>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3 mb-4">
              <p className="text-zinc-300 text-xs font-semibold line-clamp-2">{project.title}</p>
              <p className="text-zinc-600 text-[10px] mt-1">{project.topic}</p>
            </div>
            <p className="text-zinc-500 text-xs mb-5 leading-relaxed">
              삭제된 프로젝트는 복구할 수 없습니다. 정말 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {showDeletedToast && (
        <Toast message="프로젝트가 삭제되었습니다" type="error" onClose={() => setShowDeletedToast(false)} />
      )}
      {showDuplicatedToast && (
        <Toast message="프로젝트가 복제되었습니다" type="success" onClose={() => setShowDuplicatedToast(false)} />
      )}
      {showBackupToast && (
        <Toast message="백업 파일이 다운로드되었습니다 (JSON + CSV + SRT)" type="success" onClose={() => setShowBackupToast(false)} />
      )}

      {!selectionMode && showPreviewModal && (
        <VideoPreviewModal
          project={project}
          onClose={() => setShowPreviewModal(false)}
          onEdit={() => { setShowPreviewModal(false); setShowResumeModal(true); }}
          onDuplicate={(id) => { onDuplicate(id); setShowPreviewModal(false); }}
          onDelete={(id) => { onDelete(id); setShowPreviewModal(false); }}
          onEditProject={onEditProject}
        />
      )}

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
        className={`relative group rounded-2xl overflow-hidden bg-zinc-900 border transition-all duration-300 cursor-pointer ${isPortrait ? 'row-span-2' : ''} ${
          selectionMode && selected
            ? 'border-indigo-500 ring-2 ring-indigo-500/40'
            : isNew
              ? 'border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : 'border-white/5 hover:border-indigo-500/30'
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
        onClick={handleCardClick}
      >
        {/* Selection checkbox overlay */}
        {selectionMode && (
          <div className="absolute top-2.5 left-2.5 z-20">
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selected
                ? 'bg-indigo-500 border-indigo-500'
                : 'bg-black/50 border-white/50 backdrop-blur-sm'
            }`}>
              {selected && <i className="ri-check-line text-white text-[10px]" />}
            </div>
          </div>
        )}

        {/* Selection dim overlay */}
        {selectionMode && !selected && (
          <div className="absolute inset-0 bg-black/20 z-10 pointer-events-none" />
        )}

        {/* Thumbnail */}
        <div className={`relative overflow-hidden ${isPortrait ? 'h-56 md:h-72' : 'h-36 md:h-44'}`}>
          <img
            src={project.thumbnail}
            alt={project.title}
            className={`w-full h-full object-cover transition-transform duration-500 ${hovered ? 'scale-105' : 'scale-100'}`}
          />

          {/* Overlay on hover — 선택 모드가 아닐 때만 */}
          {!selectionMode && (
            <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
              {project.status === 'completed' && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowPreviewModal(true); }}
                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors cursor-pointer"
                  >
                    <i className="ri-play-fill text-white text-xl ml-0.5" />
                  </button>
                  <button
                    onClick={(e) => handleEdit(e)}
                    className="flex items-center gap-1.5 bg-indigo-500/80 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line text-xs" /> 이어서 편집
                  </button>
                </div>
              )}
              {project.status === 'generating' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
                  <span className="text-indigo-400 text-xs font-bold">{project.progress}%</span>
                  <button
                    onClick={(e) => handleEdit(e)}
                    className="flex items-center gap-1.5 bg-indigo-500/80 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line text-xs" /> 이어서 편집
                  </button>
                </div>
              )}
              {project.status === 'failed' && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRetry(project.id); }}
                    className="flex items-center gap-2 bg-red-500/80 hover:bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-refresh-line" /> 재시도
                  </button>
                  <button
                    onClick={(e) => handleEdit(e)}
                    className="flex items-center gap-1.5 bg-zinc-700/80 hover:bg-zinc-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line text-xs" /> 편집으로 이동
                  </button>
                </div>
              )}
              {project.status === 'draft' && (
                <button
                  onClick={(e) => handleEdit(e)}
                  className="flex items-center gap-2 bg-indigo-500/80 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-edit-line" /> 이어서 편집
                </button>
              )}
            </div>
          )}

          {/* Status badge */}
          <div className={`absolute top-2 ${selectionMode ? 'left-9' : 'left-2'} flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${project.status === 'generating' ? 'animate-pulse' : ''}`} />
            {cfg.label}
            {project.status === 'generating' && project.progress !== undefined && ` ${project.progress}%`}
          </div>

          {/* Mode badge */}
          <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-bold ${
            project.mode === 'AutoPilot' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700/80 text-zinc-300'
          }`}>
            {project.mode === 'AutoPilot' ? '🤖 AutoPilot' : '✏️ Manual'}
          </div>

          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            {project.duration}s
          </div>
        </div>

        {/* Info */}
        <div className="p-2.5 md:p-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-white text-xs md:text-sm font-bold leading-tight line-clamp-2 flex-1">{project.title}</h3>
            {!selectionMode && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <i className="ri-more-2-fill text-sm" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-7 bg-zinc-800 border border-white/10 rounded-xl shadow-xl z-20 w-44 overflow-hidden">
                    <button
                      onClick={(e) => handleEdit(e)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-indigo-300 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                    >
                      <i className="ri-edit-line" /> 이어서 편집
                    </button>
                    {project.status === 'completed' && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
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
                            window.open(project.thumbnail, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                      >
                        <i className="ri-download-line" /> 다운로드
                      </button>
                    )}
                    {project.status === 'completed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(project.title)}&url=${encodeURIComponent(project.thumbnail)}`;
                          window.open(shareUrl, '_blank', 'noopener,noreferrer');
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                      >
                        <i className="ri-share-line" /> 공유
                      </button>
                    )}
                    <button
                      onClick={handleDuplicate}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                    >
                      <i className="ri-file-copy-line" /> 복제
                    </button>
                    <button
                      onClick={handleBackup}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
                    >
                      <i className="ri-save-3-line" /> 로컬 백업
                    </button>
                    <div className="border-t border-white/5" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <i className="ri-delete-bin-line" /> 삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-zinc-500 text-[10px] md:text-[11px] mb-2 line-clamp-1">{project.topic}</p>

          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="text-[9px] md:text-[10px] bg-zinc-800 text-zinc-400 px-1.5 md:px-2 py-0.5 rounded-full">{project.model}</span>
            <span className="text-[9px] md:text-[10px] bg-zinc-800 text-zinc-400 px-1.5 md:px-2 py-0.5 rounded-full">{project.ratio}</span>
            <span className="hidden sm:inline text-[9px] md:text-[10px] bg-zinc-800 text-zinc-400 px-1.5 md:px-2 py-0.5 rounded-full">{project.cuts}컷</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {project.status === 'completed' && !selectionMode && (
                <>
                  <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                    <i className="ri-eye-line text-xs" /> {formatViews(project.views)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newLiked = !liked;
                      setLiked(newLiked);
                      onLike?.(project.id, newLiked);
                    }}
                    className={`flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${liked ? 'text-red-400' : 'text-zinc-500 hover:text-red-400'}`}
                  >
                    <i className={liked ? 'ri-heart-fill' : 'ri-heart-line'} />
                    {formatViews(project.likes + (liked ? 1 : 0))}
                  </button>
                </>
              )}
              {(project.status === 'draft' || project.status === 'generating') && !selectionMode && (
                <button
                  onClick={(e) => handleEdit(e)}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <i className="ri-edit-line text-xs" /> 이어서 편집
                </button>
              )}
            </div>
            <span className="text-[10px] text-zinc-600">{formatDate(project.createdAt)}</span>
          </div>

          {project.status === 'generating' && project.progress !== undefined && (
            <div className="mt-2">
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
