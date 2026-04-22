import { useState, useCallback } from 'react';
import { AutomationProject } from '@/mocks/automationProjects';

interface BulkExportModalProps {
  projects: AutomationProject[];
  onClose: () => void;
}

type ExportFormat = 'json' | 'csv' | 'zip';
type ExportPhase = 'options' | 'exporting' | 'done';

interface ExportOption {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'thumbnails',
    label: '썸네일 이미지',
    desc: '각 프로젝트의 썸네일 JPG 파일',
    icon: 'ri-image-line',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    id: 'metadata',
    label: '프로젝트 메타데이터',
    desc: '제목, 주제, 설정값 등 JSON 형식',
    icon: 'ri-file-code-line',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  {
    id: 'report',
    label: '성과 리포트',
    desc: '조회수, 좋아요, 통계 CSV 파일',
    icon: 'ri-bar-chart-line',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    id: 'subtitles',
    label: '자막 파일 (SRT)',
    desc: '완료된 프로젝트의 자막 SRT 파일',
    icon: 'ri-closed-captioning-line',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
];

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function estimateSize(projects: AutomationProject[], options: Set<string>): number {
  let total = 0;
  if (options.has('thumbnails')) total += projects.length * 180 * 1024; // ~180KB per thumb
  if (options.has('metadata')) total += projects.length * 4 * 1024;    // ~4KB per JSON
  if (options.has('report')) total += projects.length * 1 * 1024;      // ~1KB per CSV row
  if (options.has('subtitles')) {
    const completed = projects.filter(p => p.status === 'completed').length;
    total += completed * 12 * 1024; // ~12KB per SRT
  }
  return total;
}

export default function BulkExportModal({ projects, onClose }: BulkExportModalProps) {
  const [phase, setPhase] = useState<ExportPhase>('options');
  const [format, setFormat] = useState<ExportFormat>('zip');
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set(['thumbnails', 'metadata']));
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [processedCount, setProcessedCount] = useState(0);

  const completedProjects = projects.filter(p => p.status === 'completed');
  const estimatedSize = estimateSize(projects, selectedOptions);

  const toggleOption = (id: string) => {
    setSelectedOptions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildMetadataJson = useCallback(() => {
    return JSON.stringify(
      projects.map(p => ({
        id: p.id,
        title: p.title,
        topic: p.topic,
        status: p.status,
        duration: p.duration,
        ratio: p.ratio,
        style: p.style,
        model: p.model,
        mode: p.mode,
        cuts: p.cuts,
        views: p.views,
        likes: p.likes,
        createdAt: p.createdAt,
        thumbnail: p.thumbnail,
      })),
      null,
      2
    );
  }, [projects]);

  const buildCsvReport = useCallback(() => {
    const header = 'ID,제목,주제,상태,길이(초),비율,스타일,모델,모드,컷수,조회수,좋아요,생성일';
    const rows = projects.map(p =>
      [
        p.id,
        `"${p.title.replace(/"/g, '""')}"`,
        `"${p.topic.replace(/"/g, '""')}"`,
        p.status,
        p.duration,
        p.ratio,
        p.style,
        p.model,
        p.mode,
        p.cuts,
        p.views,
        p.likes,
        new Date(p.createdAt).toLocaleDateString('ko-KR'),
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }, [projects]);

  const buildSrtContent = useCallback((project: AutomationProject) => {
    // Generate mock SRT based on project duration
    const lines: string[] = [];
    const segCount = Math.max(3, Math.floor(project.duration / 5));
    const segDur = project.duration / segCount;
    const sampleTexts = [
      `${project.title}`,
      `주제: ${project.topic}`,
      '지금 바로 시작해보세요',
      'AI가 만든 영상입니다',
      '구독과 좋아요 부탁드립니다',
    ];
    for (let i = 0; i < segCount; i++) {
      const start = i * segDur;
      const end = (i + 1) * segDur;
      const toSrt = (s: number) => {
        const h = Math.floor(s / 3600).toString().padStart(2, '0');
        const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        const ms = Math.floor((s % 1) * 1000).toString().padStart(3, '0');
        return `${h}:${m}:${sec},${ms}`;
      };
      lines.push(`${i + 1}`);
      lines.push(`${toSrt(start)} --> ${toSrt(end)}`);
      lines.push(sampleTexts[i % sampleTexts.length]);
      lines.push('');
    }
    return lines.join('\n');
  }, []);

  const handleExport = useCallback(async () => {
    setPhase('exporting');
    setProgress(0);
    setProcessedCount(0);

    const totalSteps = projects.length * selectedOptions.size + 2;
    let step = 0;

    const advance = async (label: string, delay = 120) => {
      setCurrentFile(label);
      await new Promise(r => setTimeout(r, delay));
      step++;
      setProgress(Math.round((step / totalSteps) * 100));
    };

    // Simulate processing each project
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (selectedOptions.has('thumbnails')) {
        await advance(`썸네일 처리 중: ${p.title.slice(0, 20)}...`);
      }
      if (selectedOptions.has('metadata')) {
        await advance(`메타데이터 생성: ${p.title.slice(0, 20)}...`);
      }
      if (selectedOptions.has('report')) {
        await advance(`리포트 생성: ${p.title.slice(0, 20)}...`);
      }
      if (selectedOptions.has('subtitles') && p.status === 'completed') {
        await advance(`자막 변환: ${p.title.slice(0, 20)}...`);
      }
      setProcessedCount(i + 1);
    }

    await advance('ZIP 패키지 압축 중...', 300);
    await advance('파일 준비 완료!', 200);

    // Actually trigger downloads
    if (format === 'zip' || format === 'json') {
      if (selectedOptions.has('metadata')) {
        const blob = new Blob([buildMetadataJson()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `projects_metadata_${projects.length}items.json`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 200));
      }
      if (selectedOptions.has('report')) {
        const blob = new Blob([buildCsvReport()], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `projects_report_${projects.length}items.csv`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 200));
      }
      if (selectedOptions.has('subtitles')) {
        for (const p of completedProjects) {
          const blob = new Blob([buildSrtContent(p)], { type: 'text/plain;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${p.title.replace(/\s+/g, '_').slice(0, 30)}.srt`;
          a.click();
          URL.revokeObjectURL(url);
          await new Promise(r => setTimeout(r, 150));
        }
      }
    }

    setProgress(100);
    setPhase('done');
  }, [projects, selectedOptions, format, buildMetadataJson, buildCsvReport, buildSrtContent, completedProjects]);

  const fileCount = (() => {
    let n = 0;
    if (selectedOptions.has('thumbnails')) n += projects.length;
    if (selectedOptions.has('metadata')) n += 1;
    if (selectedOptions.has('report')) n += 1;
    if (selectedOptions.has('subtitles')) n += completedProjects.length;
    return n;
  })();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={phase !== 'exporting' ? onClose : undefined}
    >
      <div
        className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <i className="ri-archive-drawer-line text-indigo-400 text-base" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">일괄 내보내기</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                {projects.length}개 프로젝트 선택됨
              </p>
            </div>
          </div>
          {phase !== 'exporting' && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
            >
              <i className="ri-close-line text-sm" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Options phase ── */}
          {phase === 'options' && (
            <div className="p-5 space-y-5">

              {/* Selected projects preview */}
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">선택된 프로젝트</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                  {projects.slice(0, 8).map(p => (
                    <div key={p.id} className="flex-shrink-0 relative">
                      <img
                        src={p.thumbnail}
                        alt={p.title}
                        className="w-14 h-10 rounded-lg object-cover border border-white/10"
                      />
                      <div className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border border-[#111113] flex items-center justify-center ${
                        p.status === 'completed' ? 'bg-emerald-500' :
                        p.status === 'generating' ? 'bg-indigo-500' :
                        p.status === 'failed' ? 'bg-red-500' : 'bg-zinc-500'
                      }`}>
                        <i className={`text-white text-[7px] ${
                          p.status === 'completed' ? 'ri-check-line' :
                          p.status === 'generating' ? 'ri-loader-4-line' :
                          p.status === 'failed' ? 'ri-close-line' : 'ri-draft-line'
                        }`} />
                      </div>
                    </div>
                  ))}
                  {projects.length > 8 && (
                    <div className="flex-shrink-0 w-14 h-10 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center">
                      <span className="text-zinc-400 text-xs font-bold">+{projects.length - 8}</span>
                    </div>
                  )}
                </div>
                {/* Status breakdown */}
                <div className="flex items-center gap-3 mt-2.5 flex-wrap">
                  {[
                    { status: 'completed', label: '완료', color: 'text-emerald-400', dot: 'bg-emerald-400' },
                    { status: 'generating', label: '생성 중', color: 'text-indigo-400', dot: 'bg-indigo-400' },
                    { status: 'draft', label: '초안', color: 'text-zinc-400', dot: 'bg-zinc-500' },
                    { status: 'failed', label: '실패', color: 'text-red-400', dot: 'bg-red-400' },
                  ].map(s => {
                    const cnt = projects.filter(p => p.status === s.status).length;
                    if (cnt === 0) return null;
                    return (
                      <div key={s.status} className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        <span className={`text-[11px] font-semibold ${s.color}`}>{s.label} {cnt}개</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="w-full h-px bg-white/5" />

              {/* Export content options */}
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">내보낼 항목</p>
                <div className="space-y-2">
                  {EXPORT_OPTIONS.map(opt => {
                    const isSelected = selectedOptions.has(opt.id);
                    const isDisabled = opt.id === 'subtitles' && completedProjects.length === 0;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => !isDisabled && toggleOption(opt.id)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer text-left ${
                          isDisabled ? 'opacity-40 cursor-not-allowed border-white/5 bg-zinc-900/30' :
                          isSelected
                            ? `${opt.bg} ${opt.border} border`
                            : 'bg-zinc-900/40 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${isSelected ? opt.bg : 'bg-zinc-800/60'}`}>
                          <i className={`${opt.icon} ${isSelected ? opt.color : 'text-zinc-500'} text-sm`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{opt.label}</span>
                            {opt.id === 'subtitles' && completedProjects.length > 0 && (
                              <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-full">{completedProjects.length}개</span>
                            )}
                            {isDisabled && (
                              <span className="text-[9px] bg-zinc-800 text-zinc-600 px-1.5 py-0.5 rounded-full">완료 프로젝트 없음</span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</p>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                          isSelected ? `${opt.border} border-2 ${opt.bg}` : 'border-zinc-700'
                        }`}>
                          {isSelected && <i className={`${opt.color} text-[9px] ri-check-line`} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="w-full h-px bg-white/5" />

              {/* Format */}
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">패키지 형식</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'zip', label: 'ZIP 패키지', icon: 'ri-folder-zip-line', desc: '모든 파일 묶음' },
                    { id: 'json', label: 'JSON + CSV', icon: 'ri-file-code-line', desc: '데이터 파일만' },
                    { id: 'csv', label: 'CSV만', icon: 'ri-table-line', desc: '스프레드시트' },
                  ] as { id: ExportFormat; label: string; icon: string; desc: string }[]).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                        format === f.id
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                          : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:border-white/15'
                      }`}
                    >
                      <i className={`${f.icon} text-lg`} />
                      <span className="text-[10px] font-bold whitespace-nowrap">{f.label}</span>
                      <span className="text-[9px] text-zinc-600 whitespace-nowrap">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-3.5">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2.5">내보내기 요약</p>
                <div className="space-y-1.5">
                  {[
                    { label: '선택된 프로젝트', val: `${projects.length}개` },
                    { label: '생성될 파일 수', val: `${fileCount}개` },
                    { label: '예상 파일 크기', val: formatFileSize(estimatedSize) },
                    { label: '패키지 형식', val: format.toUpperCase() },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{item.label}</span>
                      <span className="text-[11px] text-zinc-200 font-semibold">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Exporting phase ── */}
          {phase === 'exporting' && (
            <div className="p-5 flex flex-col items-center gap-5">
              {/* Animated export visual */}
              <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                <div className="absolute inset-0 flex items-center justify-center gap-3">
                  {projects.slice(0, 5).map((p, i) => (
                    <div
                      key={p.id}
                      className="relative flex-shrink-0 transition-all duration-500"
                      style={{
                        opacity: i < processedCount ? 0.4 : 1,
                        transform: i < processedCount ? 'scale(0.85)' : 'scale(1)',
                      }}
                    >
                      <img src={p.thumbnail} alt="" className="w-14 h-10 rounded-lg object-cover" />
                      {i < processedCount && (
                        <div className="absolute inset-0 bg-emerald-500/30 rounded-lg flex items-center justify-center">
                          <i className="ri-check-line text-emerald-400 text-sm" />
                        </div>
                      )}
                    </div>
                  ))}
                  {projects.length > 5 && (
                    <div className="w-14 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-zinc-500 text-xs font-bold">+{projects.length - 5}</span>
                    </div>
                  )}
                </div>
                {/* Scanning line animation */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-indigo-400 to-transparent opacity-80 transition-all duration-300"
                  style={{ left: `${progress}%` }}
                />
              </div>

              <div className="w-full space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">{progress}% 완료</span>
                  <span className="text-xs text-zinc-400">{processedCount}/{projects.length} 프로젝트</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 bg-zinc-900/60 rounded-xl px-3 py-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
                  <span className="text-[11px] text-zinc-400 truncate">{currentFile}</span>
                </div>
              </div>

              {/* Step indicators */}
              <div className="w-full grid grid-cols-4 gap-2">
                {EXPORT_OPTIONS.filter(o => selectedOptions.has(o.id)).map((opt, i) => {
                  const isDone = processedCount >= projects.length && i < selectedOptions.size;
                  const isActive = !isDone && progress > (i / selectedOptions.size) * 100;
                  return (
                    <div key={opt.id} className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      isDone ? 'bg-emerald-500/10 border-emerald-500/20' :
                      isActive ? `${opt.bg} ${opt.border} border` :
                      'bg-zinc-900/40 border-white/5'
                    }`}>
                      <div className={`w-7 h-7 flex items-center justify-center rounded-lg ${isDone ? 'bg-emerald-500/20' : isActive ? opt.bg : 'bg-zinc-800'}`}>
                        {isDone
                          ? <i className="ri-check-line text-emerald-400 text-sm" />
                          : <i className={`${opt.icon} ${isActive ? opt.color : 'text-zinc-600'} text-sm`} />
                        }
                      </div>
                      <span className={`text-[9px] font-semibold text-center leading-tight ${isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-zinc-600'}`}>
                        {opt.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Done phase ── */}
          {phase === 'done' && (
            <div className="p-5 flex flex-col items-center gap-5">
              {/* Success animation */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <i className="ri-checkbox-circle-fill text-emerald-400 text-4xl" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                  <i className="ri-download-line text-white text-xs" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-white font-black text-lg">내보내기 완료!</p>
                <p className="text-zinc-500 text-sm mt-1">{projects.length}개 프로젝트가 성공적으로 내보내졌습니다</p>
              </div>

              {/* Result summary */}
              <div className="w-full bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-2">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-3">내보내기 결과</p>
                {[
                  { label: '처리된 프로젝트', val: `${projects.length}개`, icon: 'ri-folder-video-line', color: 'text-indigo-400' },
                  { label: '생성된 파일', val: `${fileCount}개`, icon: 'ri-file-line', color: 'text-amber-400' },
                  { label: '총 파일 크기', val: formatFileSize(estimatedSize), icon: 'ri-hard-drive-line', color: 'text-emerald-400' },
                  { label: '패키지 형식', val: format.toUpperCase(), icon: 'ri-archive-drawer-line', color: 'text-violet-400' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 flex-shrink-0">
                      <i className={`${item.icon} ${item.color} text-sm`} />
                    </div>
                    <span className="text-xs text-zinc-400 flex-1">{item.label}</span>
                    <span className="text-xs text-zinc-200 font-bold">{item.val}</span>
                  </div>
                ))}
              </div>

              {/* Downloaded files list */}
              <div className="w-full">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">다운로드된 파일</p>
                <div className="space-y-1.5">
                  {selectedOptions.has('metadata') && (
                    <div className="flex items-center gap-2 bg-zinc-900/40 rounded-lg px-3 py-2">
                      <i className="ri-file-code-line text-indigo-400 text-xs" />
                      <span className="text-[11px] text-zinc-300 font-mono flex-1">projects_metadata_{projects.length}items.json</span>
                      <i className="ri-check-line text-emerald-400 text-xs" />
                    </div>
                  )}
                  {selectedOptions.has('report') && (
                    <div className="flex items-center gap-2 bg-zinc-900/40 rounded-lg px-3 py-2">
                      <i className="ri-table-line text-emerald-400 text-xs" />
                      <span className="text-[11px] text-zinc-300 font-mono flex-1">projects_report_{projects.length}items.csv</span>
                      <i className="ri-check-line text-emerald-400 text-xs" />
                    </div>
                  )}
                  {selectedOptions.has('subtitles') && completedProjects.slice(0, 3).map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-zinc-900/40 rounded-lg px-3 py-2">
                      <i className="ri-closed-captioning-line text-violet-400 text-xs" />
                      <span className="text-[11px] text-zinc-300 font-mono flex-1 truncate">{p.title.replace(/\s+/g, '_').slice(0, 25)}.srt</span>
                      <i className="ri-check-line text-emerald-400 text-xs" />
                    </div>
                  ))}
                  {selectedOptions.has('thumbnails') && (
                    <div className="flex items-center gap-2 bg-zinc-900/40 rounded-lg px-3 py-2">
                      <i className="ri-image-line text-amber-400 text-xs" />
                      <span className="text-[11px] text-zinc-400 flex-1">썸네일 {projects.length}개 (브라우저 보안 정책으로 개별 다운로드)</span>
                      <i className="ri-information-line text-zinc-500 text-xs" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-white/5 flex-shrink-0">
          {phase === 'options' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={handleExport}
                disabled={selectedOptions.size === 0}
                className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <i className="ri-archive-drawer-line text-sm" />
                {fileCount}개 파일 내보내기
              </button>
            </>
          )}
          {phase === 'done' && (
            <>
              <button
                onClick={() => { setPhase('options'); setProgress(0); setProcessedCount(0); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
              >
                다시 내보내기
              </button>
              <button
                onClick={onClose}
                className="flex-[2] py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
