import { useState, useEffect, useRef } from 'react';
import PageHeader from '@/components/feature/PageHeader';
import { AutomationProject } from '@/mocks/automationProjects';

interface VideoPreviewModalProps {
  project: AutomationProject;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onEditProject?: (project: AutomationProject) => void;
}

const mockScenes = [
  { time: '0:00', label: '인트로', active: true },
  { time: '0:08', label: '주제 소개', active: false },
  { time: '0:18', label: '핵심 내용 1', active: false },
  { time: '0:28', label: '핵심 내용 2', active: false },
  { time: '0:40', label: '핵심 내용 3', active: false },
  { time: '0:52', label: '아웃트로', active: false },
];

function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function VideoPreviewModal({ project, onClose, onEdit, onDuplicate, onDelete, onEditProject: _onEditProject }: VideoPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [liked, setLiked] = useState(false);
  const [activeScene, setActiveScene] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tab, setTab] = useState<'preview' | 'info' | 'scenes'>('preview');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPortrait = project.ratio === '9:16';

  // Simulate playback progress
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.5;
          if (next >= project.duration) {
            setIsPlaying(false);
            return 0;
          }
          setProgress((next / project.duration) * 100);
          // Update active scene
          const sceneInterval = project.duration / mockScenes.length;
          setActiveScene(Math.min(Math.floor(next / sceneInterval), mockScenes.length - 1));
          return next;
        });
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, project.duration]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newTime = ratio * project.duration;
    setCurrentTime(newTime);
    setProgress(ratio * 100);
  };

  const handleDeleteConfirm = () => {
    onDelete(project.id);
    onClose();
  };

  // Thumbnail grid for scene strip
  const sceneCount = Math.min(project.cuts, 6);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-[#0f0f11] border border-white/10 rounded-2xl overflow-hidden flex ${isPortrait ? 'flex-row w-full max-w-4xl' : 'flex-col w-full max-w-3xl'}`}
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Video area ── */}
        <div className={`relative bg-black flex-shrink-0 ${isPortrait ? 'w-[320px]' : 'w-full'}`}>
          {/* Thumbnail as video placeholder */}
          <div
            className={`relative overflow-hidden ${isPortrait ? 'h-full min-h-[480px]' : 'h-[340px]'}`}
            style={isPortrait ? { aspectRatio: '9/16' } : {}}
          >
            <img
              src={project.thumbnail}
              alt={project.title}
              className="w-full h-full object-cover"
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30" />

            {/* Center play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  isPlaying
                    ? 'bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20'
                    : 'bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30'
                }`}
              >
                <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white text-2xl ${!isPlaying ? 'ml-1' : ''}`} />
              </button>
            </div>

            {/* Playing indicator */}
            {isPlaying && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-500/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-[10px] font-bold">LIVE</span>
              </div>
            )}

            {/* Duration badge */}
            <div className="absolute bottom-14 right-3 bg-black/80 text-white text-xs font-bold px-2 py-0.5 rounded-md">
              {formatTime(currentTime)} / {formatTime(project.duration)}
            </div>

            {/* Mode badge */}
            <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold ${
              project.mode === 'AutoPilot' ? 'bg-emerald-500/80 text-white' : 'bg-zinc-700/80 text-zinc-300'
            }`}>
              {project.mode === 'AutoPilot' ? 'AutoPilot' : 'Manual'}
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
              <div
                className="h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Controls bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-zinc-950/80 border-t border-white/5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex-shrink-0"
            >
              <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-sm ${!isPlaying ? 'ml-0.5' : ''}`} />
            </button>

            <button
              onClick={() => { setCurrentTime(0); setProgress(0); setIsPlaying(false); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
            >
              <i className="ri-skip-back-fill text-sm" />
            </button>

            <div className="flex-1 mx-1">
              <div
                className="h-1 bg-zinc-700 rounded-full overflow-hidden cursor-pointer"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Volume */}
            <div className="relative flex-shrink-0" onMouseLeave={() => setShowVolumeSlider(false)}>
              <button
                onMouseEnter={() => setShowVolumeSlider(true)}
                onClick={() => setVolume(volume > 0 ? 0 : 80)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <i className={`text-sm ${volume === 0 ? 'ri-volume-mute-line' : volume < 50 ? 'ri-volume-down-line' : 'ri-volume-up-line'}`} />
              </button>
              {showVolumeSlider && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-zinc-800 border border-white/10 rounded-xl p-3 flex flex-col items-center gap-2 z-10">
                  <input
                    type="range" min={0} max={100} value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="h-20 cursor-pointer accent-indigo-500"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                  />
                  <span className="text-[10px] text-zinc-400">{volume}%</span>
                </div>
              )}
            </div>

            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0">
              <i className="ri-fullscreen-line text-sm" />
            </button>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className={`flex flex-col flex-1 min-w-0 ${isPortrait ? 'overflow-y-auto' : ''}`}>
          {/* Header */}
          <PageHeader
            icon="ri-film-line"
            title={project.title}
            statusLabel={project.topic}
            badgeColor="indigo"
            className="px-5 pt-5 pb-3"
            actions={
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors flex-shrink-0"
              >
                <i className="ri-close-line text-lg" />
              </button>
            }
          />

          {/* Stats row */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <i className="ri-eye-line text-zinc-500" />
              <span className="font-semibold">{formatViews(project.views)}</span>
              <span className="text-zinc-600">조회</span>
            </div>
            <button
              onClick={() => setLiked(!liked)}
              className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${liked ? 'text-red-400' : 'text-zinc-400 hover:text-red-400'}`}
            >
              <i className={liked ? 'ri-heart-fill' : 'ri-heart-line'} />
              <span className="font-semibold">{formatViews(project.likes + (liked ? 1 : 0))}</span>
            </button>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <i className="ri-film-line text-zinc-500" />
              <span className="font-semibold">{project.cuts}컷</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <i className="ri-time-line text-zinc-500" />
              <span className="font-semibold">{project.duration}초</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-5 py-2 border-b border-white/5 flex-shrink-0">
            {(['preview', 'info', 'scenes'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  tab === t ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'preview' ? '미리보기' : t === 'info' ? '프로젝트 정보' : '씬 목록'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">

            {/* Preview tab - thumbnail strip */}
            {tab === 'preview' && (
              <div className="flex flex-col gap-4">
                {/* Large thumbnail */}
                <div className="relative rounded-xl overflow-hidden">
                  <img
                    src={project.thumbnail}
                    alt={project.title}
                    className="w-full h-40 object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div>
                      <p className="text-white text-xs font-bold line-clamp-1">{project.title}</p>
                      <p className="text-zinc-400 text-[10px]">{project.ratio} · {project.style}</p>
                    </div>
                    <span className="text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-md font-bold">{project.duration}s</span>
                  </div>
                </div>

                {/* Scene thumbnail strip */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">씬 미리보기</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: sceneCount }).map((_, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          const t = (i / sceneCount) * project.duration;
                          setCurrentTime(t);
                          setProgress((t / project.duration) * 100);
                          setActiveScene(i);
                        }}
                        className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${activeScene === i ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-white/30'}`}
                      >
                        <img
                          src={`${project.thumbnail}&seq=scene_${project.id}_${i}`}
                          alt={`씬 ${i + 1}`}
                          className="w-full h-14 object-cover"
                        />
                        <div className={`absolute inset-0 transition-colors ${activeScene === i ? 'bg-indigo-500/20' : 'bg-black/20'}`} />
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {formatTime((i / sceneCount) * project.duration)}
                        </div>
                        {activeScene === i && (
                          <div className="absolute top-1 right-1 w-3 h-3 bg-indigo-500 rounded-full flex items-center justify-center">
                            <i className="ri-play-fill text-white text-[7px] ml-px" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">태그</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[project.style, project.model, project.ratio, project.mode, `${project.duration}초`].map((tag) => (
                      <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Info tab */}
            {tab === 'info' && (
              <div className="flex flex-col gap-3">
                {[
                  { label: '제목', value: project.title, icon: 'ri-text' },
                  { label: '주제', value: project.topic, icon: 'ri-lightbulb-line' },
                  { label: '스타일', value: project.style, icon: 'ri-palette-line' },
                  { label: '이미지 모델', value: project.model, icon: 'ri-image-ai-line' },
                  { label: '화면 비율', value: project.ratio, icon: 'ri-aspect-ratio-line' },
                  { label: '영상 길이', value: `${project.duration}초`, icon: 'ri-time-line' },
                  { label: '씬 수', value: `${project.cuts}컷`, icon: 'ri-film-line' },
                  { label: '생성 방식', value: project.mode, icon: 'ri-robot-2-line' },
                  { label: '생성일', value: new Date(project.createdAt).toLocaleDateString('ko-KR'), icon: 'ri-calendar-line' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 bg-zinc-900/60 rounded-xl px-3 py-2.5">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 flex-shrink-0">
                      <i className={`${item.icon} text-zinc-500 text-sm`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-zinc-600">{item.label}</p>
                      <p className="text-xs text-zinc-300 font-semibold truncate">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Scenes tab */}
            {tab === 'scenes' && (
              <div className="flex flex-col gap-2">
                {mockScenes.map((scene, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      const t = (i / mockScenes.length) * project.duration;
                      setCurrentTime(t);
                      setProgress((t / project.duration) * 100);
                      setActiveScene(i);
                    }}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all ${
                      activeScene === i
                        ? 'bg-indigo-500/10 border border-indigo-500/30'
                        : 'bg-zinc-900/40 border border-transparent hover:border-white/10'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activeScene === i ? 'bg-indigo-500/20' : 'bg-zinc-800'}`}>
                      {activeScene === i && isPlaying ? (
                        <i className="ri-equalizer-line text-indigo-400 text-sm" />
                      ) : (
                        <span className={`text-xs font-bold ${activeScene === i ? 'text-indigo-400' : 'text-zinc-500'}`}>{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${activeScene === i ? 'text-white' : 'text-zinc-300'}`}>{scene.label}</p>
                      <p className="text-[10px] text-zinc-600">{scene.time}</p>
                    </div>
                    <div className="relative w-16 h-10 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={`${project.thumbnail}&seq=sc_${project.id}_${i}`}
                        alt={scene.label}
                        className="w-full h-full object-cover"
                      />
                      {activeScene === i && (
                        <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center">
                          <i className="ri-play-fill text-white text-xs" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 px-5 py-4 border-t border-white/5 flex-shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer flex-shrink-0"
            >
              <i className="ri-delete-bin-line text-sm" />
            </button>
            <button
              onClick={() => onDuplicate(project.id)}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-zinc-500 hover:text-white hover:border-white/20 transition-colors cursor-pointer flex-shrink-0"
            >
              <i className="ri-file-copy-line text-sm" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-zinc-500 hover:text-white hover:border-white/20 transition-colors cursor-pointer flex-shrink-0">
              <i className="ri-share-line text-sm" />
            </button>
            <button
              onClick={async () => {
                const filename = `${project.title.replace(/\s+/g, '_')}_thumbnail.jpg`;
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
                  // CORS fallback: 새 탭으로 열기
                  window.open(project.thumbnail, '_blank', 'noopener,noreferrer');
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-download-line text-sm" /> 썸네일 저장
            </button>
            <button
              onClick={() => {
                // ResumeEditModal을 통해 단계 선택 후 편집 시작
                onEdit();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white text-sm font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-edit-line text-sm" /> 편집기에서 열기
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <i className="ri-delete-bin-line text-red-400 text-lg" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">프로젝트 삭제</p>
                <p className="text-zinc-500 text-xs mt-0.5">이 작업은 되돌릴 수 없습니다</p>
              </div>
            </div>
            <p className="text-zinc-500 text-xs mb-5">삭제된 프로젝트는 복구할 수 없습니다. 정말 삭제하시겠습니까?</p>
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
    </div>
  );
}
