import { useState, useEffect, useCallback } from 'react';
import PgCronPanel from './PgCronPanel';
import EmailAlertPanel from './EmailAlertPanel';
import SlackAlertPanel from './SlackAlertPanel';
import { getAuthorizationHeader } from '@/lib/env';

interface ScheduleRow {
  service_slug: string;
  service_name: string;
  healthcheck_enabled: boolean;
  healthcheck_interval_min: number;
  healthcheck_last_run_at: string | null;
  healthcheck_next_run_at: string | null;
  healthcheck_consecutive_failures: number;
  status: 'active' | 'inactive' | 'error';
}

interface HealthcheckLog {
  id: string;
  run_at: string;
  triggered_by: string;
  total_keys: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  duration_ms: number | null;
  results: Array<{
    service_slug: string;
    service_name: string;
    success: boolean;
    message: string;
    latency_ms: number;
    skipped: boolean;
    skip_reason?: string;
    consecutive_failures: number;
  }> | null;
}

interface RunResult {
  success: boolean;
  triggered_by: string;
  total: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  duration_ms: number;
  results: Array<{
    service_slug: string;
    service_name: string;
    success: boolean;
    message: string;
    latency_ms: number;
    skipped: boolean;
    skip_reason?: string;
    consecutive_failures: number;
  }>;
}

interface Props {
  isDark: boolean;
  onToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const INTERVAL_OPTIONS = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
  { value: 360, label: '6시간' },
  { value: 720, label: '12시간' },
  { value: 1440, label: '24시간' },
];

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function timeUntil(isoStr: string): string {
  const diff = new Date(isoStr).getTime() - Date.now();
  if (diff <= 0) return '곧 실행';
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}분 후`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 ${m % 60}분 후`;
  return `${Math.floor(h / 24)}일 후`;
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── 실행 결과 드롭다운 ────────────────────────────────────────────────────────
function RunResultDropdown({
  log, isDark, onClose,
}: {
  log: HealthcheckLog;
  isDark: boolean;
  onClose: () => void;
}) {
  const t = {
    bg: isDark ? 'bg-[#0f0f13] border-white/10' : 'bg-white border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textFaint: isDark ? 'text-zinc-500' : 'text-gray-400',
    rowBg: isDark ? 'bg-zinc-900/60' : 'bg-gray-50',
    divider: isDark ? 'divide-white/5' : 'divide-gray-100',
  };

  const results = log.results ?? [];

  return (
    <div className={`absolute right-0 top-full mt-1 z-50 w-96 border rounded-xl shadow-xl overflow-hidden ${t.bg}`}>
      <div className={`px-4 py-3 border-b ${isDark ? 'border-white/5' : 'border-gray-100'} flex items-center justify-between`}>
        <div>
          <p className={`text-xs font-black ${t.text}`}>
            {log.triggered_by === 'manual' ? '수동 실행' : '스케줄 실행'} 결과
          </p>
          <p className={`text-[10px] ${t.textFaint} mt-0.5`}>
            {formatTime(log.run_at)} · {log.duration_ms ? `${log.duration_ms}ms` : '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-emerald-400">{log.success_count}성공</span>
            {log.failure_count > 0 && <span className="text-[10px] font-bold text-red-400">{log.failure_count}실패</span>}
            {log.skipped_count > 0 && <span className={`text-[10px] font-bold ${t.textFaint}`}>{log.skipped_count}스킵</span>}
          </div>
          <button onClick={onClose} className={`w-5 h-5 flex items-center justify-center ${t.textFaint} cursor-pointer`}>
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      </div>

      <div className={`divide-y ${t.divider} max-h-64 overflow-y-auto`}>
        {results.length === 0 ? (
          <div className={`flex flex-col items-center py-6 ${t.textFaint}`}>
            <p className="text-[11px]">결과 없음</p>
          </div>
        ) : (
          results.map((r, i) => (
            <div key={i} className={`px-4 py-2.5 flex items-start gap-2.5 ${t.rowBg}`}>
              {r.skipped ? (
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${isDark ? 'bg-zinc-600' : 'bg-gray-300'}`} />
              ) : (
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${r.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[11px] font-semibold ${t.text} truncate`}>{r.service_name}</p>
                  {!r.skipped && r.latency_ms > 0 && (
                    <span className={`text-[10px] font-mono flex-shrink-0 ${r.latency_ms < 1000 ? 'text-emerald-400' : r.latency_ms < 3000 ? 'text-amber-400' : 'text-red-400'}`}>
                      {r.latency_ms}ms
                    </span>
                  )}
                </div>
                <p className={`text-[10px] mt-0.5 ${r.skipped ? t.textFaint : r.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {r.skipped ? `스킵 — ${r.skip_reason ?? ''}` : r.message}
                </p>
                {!r.success && !r.skipped && r.consecutive_failures > 1 && (
                  <p className="text-[9px] text-red-400/70 mt-0.5">{r.consecutive_failures}회 연속 실패</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function HealthCheckScheduler({ isDark, onToast }: Props) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [logs, setLogs] = useState<HealthcheckLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [openLogId, setOpenLogId] = useState<string | null>(null);
  const [globalInterval, setGlobalInterval] = useState(60);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'manual' | 'pgcron' | 'email' | 'slack'>('manual');

  const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
    const headers = { 'Authorization': getAuthorizationHeader() };
  const schedulerBase = `${SUPABASE_URL}/functions/v1/healthcheck-scheduler`;

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'         : 'bg-white',
    border:    isDark ? 'border-white/5'        : 'border-gray-200',
    text:      isDark ? 'text-white'            : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'         : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'         : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900',
    inputBg2:  isDark ? 'bg-zinc-800'           : 'bg-gray-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50/80',
    divider:   isDark ? 'divide-white/[0.03]'   : 'divide-gray-100',
    rowBg:     isDark ? 'bg-zinc-900/40'        : 'bg-gray-50',
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, logsRes] = await Promise.allSettled([
        fetch(`${schedulerBase}?action=get_schedule`, { headers }),
        fetch(`${schedulerBase}?action=get_logs&limit=10`, { headers }),
      ]);
      if (schedRes.status === 'fulfilled') {
        const data = await schedRes.value.json();
        if (data.schedules) setSchedules(data.schedules);
      }
      if (logsRes.status === 'fulfilled') {
        const data = await logsRes.value.json();
        if (data.logs) setLogs(data.logs);
      }
    } catch (e) {
      console.warn('HealthCheck load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 개별 스케줄 토글
  const handleToggle = async (slug: string, enabled: boolean) => {
    setSavingSlug(slug);
    try {
      await fetch(`${schedulerBase}?action=update_schedule`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_slug: slug, healthcheck_enabled: enabled }),
      });
      setSchedules((prev) => prev.map((s) => s.service_slug === slug ? { ...s, healthcheck_enabled: enabled } : s));
    } catch (e) {
      console.warn('Toggle failed:', e);
    } finally {
      setSavingSlug(null);
    }
  };

  // 개별 인터벌 변경
  const handleIntervalChange = async (slug: string, intervalMin: number) => {
    setSavingSlug(slug);
    try {
      await fetch(`${schedulerBase}?action=update_schedule`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_slug: slug, healthcheck_interval_min: intervalMin }),
      });
      setSchedules((prev) => prev.map((s) => s.service_slug === slug ? { ...s, healthcheck_interval_min: intervalMin } : s));
    } catch (e) {
      console.warn('Interval change failed:', e);
    } finally {
      setSavingSlug(null);
    }
  };

  // 전체 일괄 설정
  const handleApplyAll = async (enabled: boolean) => {
    try {
      await fetch(`${schedulerBase}?action=update_all_schedules`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ healthcheck_enabled: enabled, healthcheck_interval_min: globalInterval }),
      });
      setSchedules((prev) => prev.map((s) => ({
        ...s,
        healthcheck_enabled: enabled,
        healthcheck_interval_min: globalInterval,
      })));
    } catch (e) {
      console.warn('Apply all failed:', e);
    }
  };

  // 수동 전체 실행
  const handleRunAll = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`${schedulerBase}?action=run_manual`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data: RunResult = await res.json();
      setRunResult(data);
      // 결과 반영: 스케줄 목록 새로고침
      await loadData();
    } catch (e) {
      console.warn('Run all failed:', e);
    } finally {
      setRunning(false);
    }
  };

  // 단일 서비스 수동 실행
  const handleRunSingle = async (slug: string) => {
    setSavingSlug(slug);
    try {
      const res = await fetch(`${schedulerBase}?action=run_manual&slug=${slug}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        setSchedules((prev) => prev.map((s) => s.service_slug === slug ? {
          ...s,
          healthcheck_last_run_at: new Date().toISOString(),
          healthcheck_consecutive_failures: r.consecutive_failures ?? 0,
          status: r.success ? 'active' : 'error',
        } : s));
      }
      await loadData();
    } catch (e) {
      console.warn('Run single failed:', e);
    } finally {
      setSavingSlug(null);
    }
  };

  const enabledCount = schedules.filter((s) => s.healthcheck_enabled).length;
  const failingCount = schedules.filter((s) => s.healthcheck_consecutive_failures > 0).length;

  return (
    <div className="space-y-4">
      {/* ── 모드 전환 탭 ── */}
      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-3`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('manual')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border flex-shrink-0 ${
              viewMode === 'manual'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-heart-pulse-line text-sm" />
            </div>
            수동 헬스체크
          </button>
          <button
            onClick={() => setViewMode('pgcron')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border flex-shrink-0 ${
              viewMode === 'pgcron'
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-timer-2-line text-sm" />
            </div>
            pg_cron 자동화
          </button>
          <button
            onClick={() => setViewMode('email')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border flex-shrink-0 ${
              viewMode === 'email'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-mail-send-line text-sm" />
            </div>
            이메일 알림
          </button>
          <button
            onClick={() => setViewMode('slack')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border flex-shrink-0 ${
              viewMode === 'slack'
                ? 'bg-[#E01E5A]/10 text-[#E01E5A] border-[#E01E5A]/30'
                : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
            }`}
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <i className="ri-slack-line text-sm" />
            </div>
            슬랙 알림
          </button>
          <div className={`ml-auto text-[10px] ${t.textFaint} flex items-center gap-1`}>
            <i className="ri-information-line text-xs" />
            {viewMode === 'manual' ? '관리자 패널 접속 시 실행' : viewMode === 'pgcron' ? 'DB 레벨 자동 실행' : viewMode === 'email' ? '실패 시 이메일 자동 발송' : '실패 시 슬랙 자동 발송'}
          </div>
        </div>
      </div>

      {/* ── pg_cron 자동화 패널 ── */}
      {viewMode === 'pgcron' && (
        <PgCronPanel
          isDark={isDark}
          onToast={onToast ?? ((msg, type) => console.log(type, msg))}
        />
      )}

      {/* ── 이메일 알림 패널 ── */}
      {viewMode === 'email' && (
        <EmailAlertPanel
          isDark={isDark}
          onToast={onToast ?? ((msg, type) => console.log(type, msg))}
        />
      )}

      {/* ── 슬랙 알림 패널 ── */}
      {viewMode === 'slack' && (
        <SlackAlertPanel
          isDark={isDark}
          onToast={onToast ?? ((msg, type) => console.log(type, msg))}
        />
      )}

      {/* ── 수동 헬스체크 패널 ── */}
      {viewMode === 'manual' && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
          {/* Header */}
          <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-black ${t.text}`}>헬스체크 스케줄러</p>
                {enabledCount > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    {enabledCount}개 활성
                  </span>
                )}
                {failingCount > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                    <i className="ri-error-warning-line mr-0.5" />연속 실패 {failingCount}개
                  </span>
                )}
              </div>
              <p className={`text-xs ${t.textSub} mt-0.5`}>주기적으로 API 키 연결 상태를 자동 테스트합니다. 연속 3회 실패 시 알림 발송.</p>
            </div>
            <div className="flex items-center gap-2">
              {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
              <button
                onClick={loadData}
                className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
              >
                <i className={`ri-refresh-line text-sm ${t.textSub}`} />
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                  expanded
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                    : `${t.inputBg2} ${t.textSub} hover:opacity-80`
                }`}
              >
                <i className={`${expanded ? 'ri-arrow-up-s-line' : 'ri-settings-3-line'} mr-1`} />
                {expanded ? '접기' : '스케줄 설정'}
              </button>
            </div>
          </div>

          {/* 전체 제어 바 */}
          <div className={`px-5 py-3 border-b ${t.border} flex items-center gap-3 flex-wrap`}>
            {/* 전체 인터벌 선택 */}
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold ${t.textSub} whitespace-nowrap`}>전체 주기:</span>
              <div className="flex items-center gap-1">
                {INTERVAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGlobalInterval(opt.value)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                      globalInterval === opt.value
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        : `${t.inputBg2} ${t.textFaint} hover:opacity-80`
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className={`w-px h-4 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

            {/* 전체 활성화/비활성화 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplyAll(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold hover:bg-emerald-500/25 cursor-pointer transition-colors whitespace-nowrap border border-emerald-500/25"
              >
                <i className="ri-play-circle-line mr-1" />전체 활성화
              </button>
              <button
                onClick={() => handleApplyAll(false)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${t.inputBg2} ${t.textSub} hover:opacity-80`}
              >
                <i className="ri-pause-circle-line mr-1" />전체 비활성화
              </button>
            </div>

            <div className="flex-1" />

            {/* 지금 전체 실행 */}
            <button
              onClick={handleRunAll}
              disabled={running}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                running
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                  : 'bg-indigo-500 text-white hover:bg-indigo-400'
              }`}
            >
              {running ? (
                <><i className="ri-loader-4-line animate-spin mr-1" />실행 중...</>
              ) : (
                <><i className="ri-play-fill mr-1" />지금 전체 실행</>
              )}
            </button>
          </div>

          {/* 마지막 실행 결과 요약 */}
          {runResult && (
            <div className={`px-5 py-3 border-b ${t.border} ${runResult.failure_count === 0 ? isDark ? 'bg-emerald-500/5' : 'bg-emerald-50/50' : isDark ? 'bg-amber-500/5' : 'bg-amber-50/50'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0 ${runResult.failure_count === 0 ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                  <i className={`text-sm ${runResult.failure_count === 0 ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-alert-line text-amber-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold ${runResult.failure_count === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    수동 실행 완료 — {runResult.total}개 키 테스트 ({runResult.duration_ms}ms)
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-emerald-400">성공 {runResult.success_count}</span>
                    {runResult.failure_count > 0 && <span className="text-[10px] text-red-400">실패 {runResult.failure_count}</span>}
                    {runResult.skipped_count > 0 && <span className={`text-[10px] ${t.textFaint}`}>스킵 {runResult.skipped_count}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setRunResult(null)}
                  className={`w-5 h-5 flex items-center justify-center ${t.textFaint} cursor-pointer flex-shrink-0`}
                >
                  <i className="ri-close-line text-sm" />
                </button>
              </div>

              {/* 실패 항목 인라인 표시 */}
              {runResult.failure_count > 0 && (
                <div className="mt-2 space-y-1">
                  {runResult.results.filter((r) => !r.success && !r.skipped).map((r) => (
                    <div key={r.service_slug} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${t.rowBg}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      <span className={`text-[11px] font-semibold ${t.text}`}>{r.service_name}</span>
                      <span className="text-[10px] text-red-400 flex-1 truncate">{r.message}</span>
                      {r.consecutive_failures > 1 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 flex-shrink-0">
                          {r.consecutive_failures}회 연속
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 스케줄 설정 목록 (expanded 시) */}
          {expanded && (
            <div className={`divide-y ${t.divider}`}>
              {schedules.length === 0 && !loading && (
                <div className={`flex flex-col items-center justify-center py-8 ${t.textFaint}`}>
                  <i className="ri-timer-line text-2xl mb-2" />
                  <p className="text-xs">등록된 API 키가 없습니다</p>
                </div>
              )}

              {schedules.map((s) => {
                const isSaving = savingSlug === s.service_slug;
                const hasFailures = s.healthcheck_consecutive_failures > 0;

                return (
                  <div
                    key={s.service_slug}
                    className={`px-5 py-3.5 transition-all ${t.rowHover} ${hasFailures ? isDark ? 'bg-red-500/[0.02]' : 'bg-red-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* 상태 dot */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        s.healthcheck_enabled
                          ? s.healthcheck_consecutive_failures > 0
                            ? 'bg-red-400 animate-pulse'
                            : 'bg-emerald-400'
                          : isDark ? 'bg-zinc-600' : 'bg-gray-300'
                      }`} />

                      {/* 서비스명 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${t.text}`}>{s.service_name}</p>
                          {hasFailures && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                              <i className="ri-error-warning-line mr-0.5" />{s.healthcheck_consecutive_failures}회 연속 실패
                            </span>
                          )}
                          {s.healthcheck_enabled && !hasFailures && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              자동 실행 중
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {s.healthcheck_last_run_at && (
                            <span className={`text-[10px] ${t.textFaint}`}>
                              마지막: <span className={`font-semibold ${t.textSub}`}>{timeAgo(s.healthcheck_last_run_at)}</span>
                            </span>
                          )}
                          {s.healthcheck_enabled && s.healthcheck_next_run_at && (
                            <span className={`text-[10px] ${t.textFaint}`}>
                              다음: <span className="font-semibold text-indigo-400">{timeUntil(s.healthcheck_next_run_at)}</span>
                            </span>
                          )}
                          {!s.healthcheck_last_run_at && (
                            <span className={`text-[10px] ${t.textFaint}`}>아직 실행 안 됨</span>
                          )}
                        </div>
                      </div>

                      {/* 인터벌 선택 */}
                      <select
                        value={s.healthcheck_interval_min}
                        onChange={(e) => handleIntervalChange(s.service_slug, parseInt(e.target.value))}
                        disabled={isSaving}
                        className={`border rounded-lg px-2 py-1.5 text-[11px] font-semibold focus:outline-none cursor-pointer disabled:opacity-50 ${t.inputBg}`}
                      >
                        {INTERVAL_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}마다</option>
                        ))}
                      </select>

                      {/* 단일 실행 버튼 */}
                      <button
                        onClick={() => handleRunSingle(s.service_slug)}
                        disabled={isSaving}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 disabled:opacity-50 ${t.inputBg2} ${t.textSub} hover:opacity-80`}
                      >
                        {isSaving ? (
                          <i className="ri-loader-4-line animate-spin" />
                        ) : (
                          <><i className="ri-play-line mr-1" />지금 실행</>
                        )}
                      </button>

                      {/* 활성화 토글 */}
                      <button
                        onClick={() => handleToggle(s.service_slug, !s.healthcheck_enabled)}
                        disabled={isSaving}
                        className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 disabled:opacity-50 ${s.healthcheck_enabled ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'}`}
                        title={s.healthcheck_enabled ? '자동 실행 비활성화' : '자동 실행 활성화'}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${s.healthcheck_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 실행 로그 */}
          <div className={`border-t ${t.border}`}>
            <div className={`px-5 py-3 flex items-center justify-between border-b ${t.border}`}>
              <p className={`text-xs font-bold ${t.text}`}>최근 실행 로그</p>
              <span className={`text-[10px] ${t.textFaint}`}>최근 10건</span>
            </div>

            {logs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-8 ${t.textFaint}`}>
                <i className="ri-history-line text-xl mb-2" />
                <p className="text-xs">실행 이력이 없습니다</p>
                <p className="text-[10px] mt-1">수동 실행 또는 스케줄 실행 후 여기에 기록됩니다</p>
              </div>
            ) : (
              <div className={`divide-y ${t.divider}`}>
                {logs.map((log) => {
                  const isOpen = openLogId === log.id;
                  const allSuccess = log.failure_count === 0;

                  return (
                    <div key={log.id} className={`px-5 py-3 transition-all ${t.rowHover}`}>
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* 결과 아이콘 */}
                        <div className={`w-6 h-6 flex items-center justify-center rounded-lg flex-shrink-0 ${allSuccess ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                          <i className={`text-xs ${allSuccess ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-close-circle-line text-red-400'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] font-semibold ${t.text}`}>{formatTime(log.run_at)}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              log.triggered_by === 'manual'
                                ? isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-500'
                                : isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {log.triggered_by === 'manual' ? '수동' : '자동'}
                            </span>
                            <span className={`text-[10px] ${t.textFaint}`}>{timeAgo(log.run_at)}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className={`text-[10px] ${t.textFaint}`}>총 {log.total_keys}개</span>
                            <span className="text-[10px] text-emerald-400">성공 {log.success_count}</span>
                            {log.failure_count > 0 && <span className="text-[10px] text-red-400">실패 {log.failure_count}</span>}
                            {log.skipped_count > 0 && <span className={`text-[10px] ${t.textFaint}`}>스킵 {log.skipped_count}</span>}
                            {log.duration_ms && <span className={`text-[10px] font-mono ${t.textFaint}`}>{log.duration_ms}ms</span>}
                          </div>
                        </div>

                        {/* 성공률 바 */}
                        {log.total_keys > 0 && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className={`w-16 h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                              <div
                                className={`h-full rounded-full ${allSuccess ? 'bg-emerald-400' : 'bg-red-400'}`}
                                style={{ width: `${(log.success_count / log.total_keys) * 100}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-bold ${allSuccess ? 'text-emerald-400' : 'text-red-400'}`}>
                              {Math.round((log.success_count / log.total_keys) * 100)}%
                            </span>
                          </div>
                        )}

                        {/* 상세 보기 */}
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={() => setOpenLogId(isOpen ? null : log.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                              isOpen
                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                                : `${t.inputBg2} ${t.textFaint} hover:opacity-80`
                            }`}
                          >
                            상세 <i className={isOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />
                          </button>
                          {isOpen && (
                            <RunResultDropdown
                              log={log}
                              isDark={isDark}
                              onClose={() => setOpenLogId(null)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 안내 푸터 */}
          <div className={`px-5 py-3 border-t ${t.border} flex items-start gap-2 ${isDark ? 'bg-indigo-500/5' : 'bg-indigo-50/50'}`}>
            <i className="ri-information-line text-indigo-400 text-xs flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-indigo-400 mb-0.5">자동 실행 안내</p>
              <p className={`text-[10px] ${t.textFaint}`}>
                헬스체크는 관리자 패널 접속 시 또는 &quot;지금 전체 실행&quot; 버튼으로 수동 트리거됩니다.
                완전 자동화를 원하시면 Supabase 대시보드 → Database → Extensions에서 <strong className={t.textSub}>pg_cron</strong>을 활성화하고,
                <code className={`mx-1 px-1 py-0.5 rounded text-[10px] ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                  SELECT cron.schedule(&apos;healthcheck&apos;, &apos;0 * * * *&apos;, ...)
                </code>
                으로 1시간마다 Edge Function을 호출하도록 설정하세요.
                연속 3회 실패 시 관리자 알림이 자동 발송됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
