import { useState, useEffect } from 'react';
import {
  downloadJson,
  downloadCsv,
  downloadText,
  buildSrtContent,
  safeFilename,
  dateStamp,
  PROJECT_CSV_HEADER,
  buildProjectCsvRow,
} from '@/utils/exportBackup';

export { type SubtitleSegment, TOTAL_DURATION } from './step6-modals-shared';
export { default as SplitModal } from './SplitModal';
export { default as SaveToGalleryModal } from './SaveToGalleryModal';
export { default as RenderModal } from './RenderModal';

// ─── UnsavedExitDialog ────────────────────────────────────────────────────────
export function UnsavedExitDialog({
  onConfirm,
  onCancel,
  onSaveFirst,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  onSaveFirst: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm animate-[slideDown_0.25s_ease-out]">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />

        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <i className="ri-error-warning-line text-amber-400 text-lg" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">저장하지 않고 나가시겠어요?</p>
              <p className="text-zinc-500 text-xs mt-0.5">렌더링된 영상이 갤러리에 저장되지 않습니다</p>
            </div>
          </div>

          {/* Warning detail */}
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 mb-5 space-y-1.5">
            {[
              { icon: 'ri-film-line', text: '렌더링 결과물이 사라집니다' },
              { icon: 'ri-closed-captioning-line', text: '자막 편집 내용이 저장되지 않습니다' },
              { icon: 'ri-image-line', text: 'AI 썸네일이 저장되지 않습니다' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2">
                <i className={`${item.icon} text-amber-400/70 text-xs flex-shrink-0`} />
                <span className="text-xs text-amber-300/70">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={onSaveFirst}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-folder-video-line" /> 갤러리에 저장 후 나가기
            </button>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
              >
                계속 작업하기
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/8 text-zinc-300 text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap"
              >
                그냥 나가기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CompletionToast ──────────────────────────────────────────────────────────
export function CompletionToast({ title, onClose }: { title: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-[slideDown_0.4s_ease-out]">
      <div className="flex items-center gap-3 bg-zinc-900 border border-emerald-500/40 rounded-2xl px-4 py-3 shadow-2xl min-w-[280px] max-w-[420px]">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <i className="ri-checkbox-circle-fill text-emerald-400 text-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm">영상 완성!</p>
          <p className="text-zinc-400 text-xs mt-0.5 truncate">&quot;{title}&quot; 갤러리에 저장됨</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
            갤러리 이동 중...
          </span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── ProjectBackupModal ───────────────────────────────────────────────────────
interface BackupOptions {
  json: boolean;
  csv: boolean;
  srt: boolean;
}

export function ProjectBackupModal({
  onClose,
  title,
  topic,
  duration,
  thumbnailUrl,
}: {
  onClose: () => void;
  title: string;
  topic: string;
  duration: number;
  thumbnailUrl: string;
}) {
  const [options, setOptions] = useState<BackupOptions>({ json: true, csv: true, srt: true });
  const [step, setStep] = useState<'options' | 'done'>('options');
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);

  const toggle = (key: keyof BackupOptions) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleBackup = () => {
    const base = safeFilename(title);
    const stamp = dateStamp();
    const files: string[] = [];

    if (options.json) {
      const meta = {
        title,
        topic,
        duration,
        thumbnailUrl,
        exportedAt: new Date().toISOString(),
        tool: 'YouTube Studio',
        status: 'completed',
      };
      downloadJson(meta, `${base}_${stamp}.json`);
      files.push(`${base}_${stamp}.json`);
    }
    if (options.csv) {
      const row = buildProjectCsvRow({
        id: `yt_${stamp}`,
        title,
        topic,
        status: 'completed',
        duration,
        ratio: '16:9',
        style: 'YouTube Studio',
        model: 'GoAPI',
        mode: 'manual',
        cuts: 6,
        views: 0,
        likes: 0,
        createdAt: new Date().toISOString(),
      });
      downloadCsv(`${PROJECT_CSV_HEADER}\n${row}`, `${base}_${stamp}_report.csv`);
      files.push(`${base}_${stamp}_report.csv`);
    }
    if (options.srt) {
      const srt = buildSrtContent(title, topic, duration);
      downloadText(srt, `${base}_${stamp}.srt`, 'text/plain');
      files.push(`${base}_${stamp}.srt`);
    }

    setDownloadedFiles(files);
    setStep('done');
  };

  const fileIcons: Record<string, string> = {
    json: 'ri-code-s-slash-line',
    csv: 'ri-table-line',
    srt: 'ri-closed-captioning-line',
  };
  const fileColors: Record<string, string> = {
    json: 'text-amber-400',
    csv: 'text-emerald-400',
    srt: 'text-sky-400',
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
              <i className="ri-archive-drawer-line text-teal-400 text-sm" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">프로젝트 백업</p>
              <p className="text-zinc-500 text-xs mt-0.5">로컬에 파일로 저장합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
          >
            <i className="ri-close-line" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {step === 'options' ? (
            <>
              <div className="relative rounded-xl overflow-hidden">
                <img src={thumbnailUrl} alt={title} className="w-full h-28 object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end px-3 py-2">
                  <p className="text-white text-xs font-bold truncate">{title}</p>
                </div>
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                  {duration}초
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">백업할 파일 선택</p>
                <div className="space-y-2">
                  {(
                    [
                      {
                        key: 'json' as const,
                        label: '프로젝트 메타데이터',
                        desc: 'JSON 형식 · 제목, 주제, 설정 정보',
                        icon: 'ri-code-s-slash-line',
                        color: 'text-amber-400',
                        bg: 'bg-amber-500/10',
                      },
                      {
                        key: 'csv' as const,
                        label: '성과 리포트',
                        desc: 'CSV 형식 · Excel 호환',
                        icon: 'ri-table-line',
                        color: 'text-emerald-400',
                        bg: 'bg-emerald-500/10',
                      },
                      {
                        key: 'srt' as const,
                        label: '자막 파일',
                        desc: 'SRT 형식 · 타임코드 포함',
                        icon: 'ri-closed-captioning-line',
                        color: 'text-sky-400',
                        bg: 'bg-sky-500/10',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => toggle(item.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                        options[item.key]
                          ? 'border-teal-500/40 bg-teal-500/8'
                          : 'border-white/6 bg-zinc-800/40 hover:border-white/12'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.bg}`}>
                        <i className={`${item.icon} ${item.color} text-sm`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-200">{item.label}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{item.desc}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          options[item.key] ? 'border-teal-500 bg-teal-500' : 'border-zinc-600'
                        }`}
                      >
                        {options[item.key] && <i className="ri-check-line text-white text-[9px]" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {!options.json && !options.csv && !options.srt && (
                <p className="text-[11px] text-amber-400/80 text-center">최소 하나 이상의 파일을 선택해주세요</p>
              )}
              <button
                onClick={handleBackup}
                disabled={!options.json && !options.csv && !options.srt}
                className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-download-2-line" /> 백업 다운로드
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-14 h-14 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
                <i className="ri-checkbox-circle-fill text-teal-400 text-3xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">백업 완료!</p>
                <p className="text-zinc-500 text-xs mt-1">{downloadedFiles.length}개 파일이 다운로드되었습니다</p>
              </div>
              <div className="w-full bg-zinc-800/60 rounded-xl p-3 space-y-2">
                {downloadedFiles.map((f) => {
                  const ext = f.split('.').pop() ?? '';
                  return (
                    <div key={f} className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                        <i className={`${fileIcons[ext] ?? 'ri-file-line'} ${fileColors[ext] ?? 'text-zinc-400'} text-sm`} />
                      </div>
                      <span className="text-[11px] text-zinc-300 font-mono truncate">{f}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-sm cursor-pointer transition-colors whitespace-nowrap"
              >
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PremiereExportModal ──────────────────────────────────────────────────────
export function PremiereExportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'options' | 'exporting' | 'done'>('options');
  const [progress, setProgress] = useState(0);
  const [includeSubtitles, setIncludeSubtitles] = useState(true);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeMotion, setIncludeMotion] = useState(false);
  const [fps, setFps] = useState('30');

  const handleExport = () => {
    setStep('exporting');
    setProgress(0);
    const steps = [
      { target: 20 }, { target: 40 }, { target: 65 }, { target: 85 }, { target: 100 },
    ];
    let i = 0;
    const go = () => {
      if (i >= steps.length) { setStep('done'); return; }
      const target = steps[i].target;
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= target) { clearInterval(interval); i++; setTimeout(go, 200); return target; }
          return Math.min(p + 3, target);
        });
      }, 60);
    };
    go();
  };

  const handleDownload = () => {
    const blob = new Blob(['Premiere Pro Export Package'], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'premiere_export.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl overflow-hidden w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <i className="ri-film-line text-indigo-400 text-sm" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">프리미어 프로 내보내기</p>
              <p className="text-zinc-500 text-xs mt-0.5">ZIP 패키지로 내보내기</p>
            </div>
          </div>
          {step !== 'exporting' && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 cursor-pointer transition-colors"
            >
              <i className="ri-close-line" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-4">
          {step === 'options' && (
            <>
              <div className="space-y-3">
                <p className="text-xs font-bold text-zinc-300">포함할 항목</p>
                {[
                  { label: '자막 (SRT + XML)', desc: '타임코드 포함 자막 파일', val: includeSubtitles, set: setIncludeSubtitles, icon: 'ri-closed-captioning-line' },
                  { label: '오디오 트랙', desc: '나레이션 + 배경음악', val: includeAudio, set: setIncludeAudio, icon: 'ri-music-line' },
                  { label: '모션 그래픽 템플릿', desc: '.mogrt 파일 포함', val: includeMotion, set: setIncludeMotion, icon: 'ri-magic-line' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between bg-zinc-800/60 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center">
                        <i className={`${item.icon} text-zinc-400 text-xs`} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{item.label}</p>
                        <p className="text-[10px] text-zinc-500">{item.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => item.set(!item.val)}
                      className={`relative w-10 h-5 rounded-full transition-all cursor-pointer ${item.val ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${item.val ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-300 mb-2">프레임 레이트</p>
                <div className="flex gap-2">
                  {['24', '30', '60'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFps(f)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${fps === f ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {f} fps
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm py-3 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-download-line" /> ZIP 내보내기 시작
              </button>
            </>
          )}
          {step === 'exporting' && (
            <div className="flex flex-col items-center gap-5 py-4">
              <div className="relative w-16 h-16">
                <div className="w-16 h-16 rounded-full border-2 border-zinc-700" />
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{progress}%</span>
                </div>
              </div>
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">패키지 생성 중...</span>
                  <span className="text-xs text-zinc-400">{progress}%</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <i className="ri-check-line text-emerald-400 text-2xl" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">패키지 생성 완료!</p>
                <p className="text-zinc-500 text-xs mt-1">premiere_export.zip 파일이 준비되었습니다</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm font-semibold hover:bg-white/5 cursor-pointer transition-colors whitespace-nowrap"
                >
                  닫기
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <i className="ri-download-line" /> 다운로드
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


