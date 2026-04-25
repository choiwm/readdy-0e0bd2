import { useState } from 'react';
import { getAuthorizationHeader, SUPABASE_URL } from '@/lib/env';

interface SweepResult {
  dry_run: boolean;
  scanned: number;
  referenced: number;
  orphans: string[];
  removed: number;
  errors: string[];
}

interface Props {
  isDark: boolean;
  onToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function OrphanSweepPanel({ isDark, onToast }: Props) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SweepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? 'bg-zinc-900/60' : 'bg-white';
  const subBg = isDark ? 'bg-zinc-800/60' : 'bg-slate-50';
  const border = isDark ? 'border-white/5' : 'border-slate-200';
  const text = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-zinc-400' : 'text-slate-600';
  const faintText = isDark ? 'text-zinc-500' : 'text-slate-500';

  const runSweep = async (dryRun: boolean) => {
    if (!dryRun) {
      const ok = window.confirm(
        `정말 ${report?.orphans.length ?? '?'}개의 orphan 파일을 삭제할까요?\n\n`
        + `이 작업은 되돌릴 수 없어요. 먼저 dry-run 으로 목록을 확인했는지 점검해주세요.`,
      );
      if (!ok) return;
    }

    setRunning(true);
    setError(null);
    if (dryRun) setReport(null);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/admin-storage-orphan-sweep`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: getAuthorizationHeader(),
          },
          body: JSON.stringify({ dry_run: dryRun }),
        },
      );
      const data = (await res.json()) as SweepResult;
      if (!res.ok) {
        const msg = (data as unknown as { error?: string }).error ?? `HTTP ${res.status}`;
        setError(msg);
        onToast?.(msg, 'error');
        return;
      }
      setReport(data);
      if (dryRun) {
        onToast?.(`스캔 완료 — orphan ${data.orphans.length}개`, 'info');
      } else {
        onToast?.(`삭제 완료 — ${data.removed}개 제거`, 'success');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`${cardBg} border ${border} rounded-2xl p-5 space-y-4`}>
      <div>
        <h3 className={`text-base font-bold ${text}`}>Orphan Storage 청소</h3>
        <p className={`text-xs ${subText} mt-1 leading-relaxed`}>
          PR #16 이전에 삭제된 갤러리/광고 작업물의 Storage 잔여 파일을 찾아 정리해요.
          기본 동작은 <span className="font-bold">dry-run</span> — 목록만 보여주고 실제 삭제는
          별도 확인을 받아요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => runSweep(true)}
          disabled={running}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? '스캔 중...' : '1. Dry-run 스캔'}
        </button>
        <button
          onClick={() => runSweep(false)}
          disabled={running || !report || report.orphans.length === 0}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          2. 실제 삭제 ({report?.orphans.length ?? 0}개)
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {report && (
        <div className={`${subBg} border ${border} rounded-xl p-3 space-y-2`}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className={text}>
              모드: <span className="font-bold">{report.dry_run ? 'Dry-run' : '실제 삭제'}</span>
            </span>
            <span className={subText}>스캔: {report.scanned}</span>
            <span className={subText}>참조됨: {report.referenced}</span>
            <span className="text-amber-400 font-bold">orphan: {report.orphans.length}</span>
            {!report.dry_run && (
              <span className="text-emerald-400 font-bold">삭제됨: {report.removed}</span>
            )}
          </div>
          {report.errors.length > 0 && (
            <div className="text-xs text-red-300">에러: {report.errors.join(' | ')}</div>
          )}
          {report.orphans.length > 0 && (
            <details className="text-xs">
              <summary className={`${faintText} cursor-pointer hover:opacity-80`}>
                Orphan 경로 보기 ({report.orphans.length}개)
              </summary>
              <div className="mt-2 max-h-64 overflow-y-auto font-mono text-[10px] space-y-0.5">
                {report.orphans.map((p) => (
                  <div key={p} className={faintText}>{p}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
