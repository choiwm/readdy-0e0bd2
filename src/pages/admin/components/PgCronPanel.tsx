import { useState, useEffect, useCallback } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

// ── Types ──────────────────────────────────────────────────────────────────
interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
}

interface CronRun {
  runid: number;
  jobid: number;
  status: string;
  return_message: string;
  start_time: string;
  end_time: string;
  command: string;
}

interface StatusData {
  pg_cron_enabled: boolean;
  pg_cron_version: string | null;
  pg_net_enabled: boolean;
  pg_net_version: string | null;
  jobs: CronJob[];
  recent_runs: CronRun[];
  supabase_url: string;
}

interface SetupSqlData {
  setup_sql: string;
  per_service_sql: string;
  cron_expr: string;
  description: string;
  interval_min: number;
}

interface Props {
  isDark: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// ── Constants ──────────────────────────────────────────────────────────────
const INTERVAL_OPTIONS = [
  { value: 30,   label: '30분',   cron: '*/30 * * * *' },
  { value: 60,   label: '1시간',  cron: '0 * * * *' },
  { value: 120,  label: '2시간',  cron: '0 */2 * * *' },
  { value: 360,  label: '6시간',  cron: '0 */6 * * *' },
  { value: 720,  label: '12시간', cron: '0 */12 * * *' },
  { value: 1440, label: '24시간', cron: '0 0 * * *' },
];

const SETUP_STEPS = [
  {
    step: 1,
    title: 'pg_cron 익스텐션 확인',
    desc: 'Supabase 프로젝트에 pg_cron이 활성화되어 있어야 합니다.',
    icon: 'ri-plug-line',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
  {
    step: 2,
    title: 'pg_net 익스텐션 확인',
    desc: 'HTTP 요청을 위한 pg_net이 필요합니다.',
    icon: 'ri-global-line',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
  },
  {
    step: 3,
    title: 'SQL 스크립트 실행',
    desc: '아래 SQL을 Supabase SQL Editor에서 실행하면 자동화가 완성됩니다.',
    icon: 'ri-terminal-line',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    step: 4,
    title: '실행 확인',
    desc: '등록 후 이 패널에서 실행 이력을 실시간으로 확인할 수 있습니다.',
    icon: 'ri-checkbox-circle-line',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
];

// ── Helper ─────────────────────────────────────────────────────────────────
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function durationMs(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Copy Button ────────────────────────────────────────────────────────────
function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${
        copied
          ? 'bg-emerald-500/15 text-emerald-400'
          : isDark ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      }`}
    >
      <i className={`${copied ? 'ri-checkbox-circle-line' : 'ri-clipboard-line'} text-xs`} />
      {copied ? '복사됨!' : '복사'}
    </button>
  );
}

// ── SQL Code Block ─────────────────────────────────────────────────────────
function SqlBlock({ sql, isDark, label }: { sql: string; isDark: boolean; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = sql.split('\n');
  const preview = lines.slice(0, 8).join('\n');
  const hasMore = lines.length > 8;

  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/5 bg-zinc-950' : 'border-gray-200 bg-gray-950'}`}>
      <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-white/5 bg-zinc-900/60' : 'border-gray-200 bg-gray-100'}`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          {label && <span className="text-[10px] text-zinc-500 font-mono">{label}</span>}
        </div>
        <div className="flex items-center gap-2">
          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
            >
              {expanded ? '접기' : `+${lines.length - 8}줄 더 보기`}
            </button>
          )}
          <CopyButton text={sql} isDark={isDark} />
        </div>
      </div>
      <pre className="px-4 py-3 text-[10px] font-mono text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre">
        {expanded ? sql : preview}
        {!expanded && hasMore && (
          <span className="text-zinc-600">{'\n'}...</span>
        )}
      </pre>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PgCronPanel({ isDark, onToast }: Props) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [setupSql, setSetupSql] = useState<SetupSqlData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState(60);
  const [activeTab, setActiveTab] = useState<'setup' | 'jobs' | 'runs'>('setup');
  const [showPerService, setShowPerService] = useState(false);
  const [togglingJob, setTogglingJob] = useState<string | null>(null);
  const [deletingJob, setDeletingJob] = useState<string | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
    const cronBase = `${SUPABASE_URL}/functions/v1/cron-manager`;
  const headers = { 'Authorization': getAuthorizationHeader() };

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'         : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'        : 'bg-gray-50',
    border:    isDark ? 'border-white/5'        : 'border-gray-200',
    text:      isDark ? 'text-white'            : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'         : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'         : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900',
    inputBg2:  isDark ? 'bg-zinc-800'           : 'bg-gray-100',
    divider:   isDark ? 'divide-white/[0.03]'   : 'divide-gray-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50',
  };

  // 상태 조회
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${cronBase}?action=check_status`, { headers });
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.warn('cron status load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // SQL 스크립트 생성
  const loadSetupSql = useCallback(async (intervalMin: number) => {
    setSqlLoading(true);
    try {
      const res = await fetch(`${cronBase}?action=get_setup_sql&interval_min=${intervalMin}`, { headers });
      const data = await res.json();
      setSetupSql(data);
    } catch (e) {
      console.warn('setup sql load failed:', e);
    } finally {
      setSqlLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadSetupSql(selectedInterval);
  }, [loadStatus, loadSetupSql]);

  useEffect(() => {
    loadSetupSql(selectedInterval);
  }, [selectedInterval, loadSetupSql]);

  // job 토글
  const handleToggleJob = async (jobname: string, active: boolean) => {
    setTogglingJob(jobname);
    try {
      const res = await fetch(`${cronBase}?action=toggle_job`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobname, active }),
      });
      const data = await res.json();
      if (data.success) {
        onToast(`${jobname} ${active ? '활성화' : '비활성화'} 완료`, 'success');
        await loadStatus();
      } else {
        onToast(data.error ?? '변경 실패', 'error');
      }
    } catch (e) {
      onToast(`오류: ${String(e)}`, 'error');
    } finally {
      setTogglingJob(null);
    }
  };

  // job 삭제
  const handleDeleteJob = async (jobname: string) => {
    setDeletingJob(jobname);
    try {
      const res = await fetch(`${cronBase}?action=delete_job`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobname }),
      });
      const data = await res.json();
      if (data.success) {
        onToast(`${jobname} 삭제 완료`, 'success');
        await loadStatus();
      } else {
        onToast(data.error ?? '삭제 실패', 'error');
      }
    } catch (e) {
      onToast(`오류: ${String(e)}`, 'error');
    } finally {
      setDeletingJob(null);
    }
  };

  const pgCronOk = status?.pg_cron_enabled ?? false;
  const pgNetOk = status?.pg_net_enabled ?? false;
  const jobCount = status?.jobs?.length ?? 0;
  const activeJobCount = status?.jobs?.filter((j) => j.active).length ?? 0;

  return (
    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
      {/* Header */}
      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-black ${t.text}`}>pg_cron 완전 자동화</p>
            {/* 상태 배지 */}
            {pgCronOk && pgNetOk ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse inline-block" />
                준비 완료
              </span>
            ) : (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <i className="ri-alert-line mr-0.5" />설정 필요
              </span>
            )}
            {activeJobCount > 0 && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                <i className="ri-timer-line mr-0.5" />{activeJobCount}개 실행 중
              </span>
            )}
          </div>
          <p className={`text-xs ${t.textSub} mt-0.5`}>
            관리자 패널 없이도 DB 레벨에서 헬스체크를 자동 실행합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
          <button
            onClick={() => { loadStatus(); loadSetupSql(selectedInterval); }}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
          >
            <i className={`ri-refresh-line text-sm ${t.textSub}`} />
          </button>
        </div>
      </div>

      {/* 익스텐션 상태 바 */}
      <div className={`px-5 py-3 border-b ${t.border} grid grid-cols-2 gap-3`}>
        {[
          {
            name: 'pg_cron',
            ok: pgCronOk,
            version: status?.pg_cron_version,
            desc: 'DB 레벨 스케줄러',
            icon: 'ri-timer-2-line',
          },
          {
            name: 'pg_net',
            ok: pgNetOk,
            version: status?.pg_net_version,
            desc: 'HTTP 요청 실행',
            icon: 'ri-global-line',
          },
        ].map((ext) => (
          <div
            key={ext.name}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
              ext.ok
                ? isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                : isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ext.ok ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
              <i className={`${ext.icon} text-sm ${ext.ok ? 'text-emerald-400' : 'text-amber-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-black font-mono ${t.text}`}>{ext.name}</span>
                {ext.ok && ext.version && (
                  <span className={`text-[9px] ${t.textFaint}`}>v{ext.version}</span>
                )}
              </div>
              <p className={`text-[10px] ${ext.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                {ext.ok ? `활성화됨 — ${ext.desc}` : '비활성화 — 설정 필요'}
              </p>
            </div>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ext.ok ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          </div>
        ))}
      </div>

      {/* Tab Nav */}
      <div className={`px-5 py-2.5 border-b ${t.border} flex items-center gap-1`}>
        {[
          { id: 'setup' as const, label: '설정 가이드', icon: 'ri-guide-line' },
          { id: 'jobs' as const,  label: `등록된 Job (${jobCount})`, icon: 'ri-timer-line' },
          { id: 'runs' as const,  label: '실행 이력', icon: 'ri-history-line' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25'
                : `${t.inputBg2} ${t.textSub} hover:opacity-80`
            }`}
          >
            <i className={`${tab.icon} text-xs`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ 설정 가이드 탭 ══════════════════════════════════════════ */}
      {activeTab === 'setup' && (
        <div className="p-5 space-y-5">
          {/* 단계 설명 */}
          <div className="grid grid-cols-2 gap-3">
            {SETUP_STEPS.map((s) => (
              <div key={s.step} className={`${t.cardBg2} rounded-xl p-3 border ${t.border} flex items-start gap-3`}>
                <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <i className={`${s.icon} ${s.color} text-sm`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[9px] font-black ${t.textFaint}`}>STEP {s.step}</span>
                  </div>
                  <p className={`text-[11px] font-bold ${t.text}`}>{s.title}</p>
                  <p className={`text-[10px] ${t.textFaint} mt-0.5 leading-relaxed`}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 실행 주기 선택 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-timer-2-line text-indigo-400 text-xs" />
              <p className={`text-xs font-black ${t.textSub}`}>헬스체크 실행 주기 선택</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedInterval(opt.value)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                    selectedInterval === opt.value
                      ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      : `${t.inputBg2} ${t.textSub} border-transparent hover:opacity-80`
                  }`}
                >
                  {opt.label}
                  <span className={`block text-[9px] font-mono mt-0.5 ${selectedInterval === opt.value ? 'text-indigo-300' : t.textFaint}`}>
                    {opt.cron}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* SQL 스크립트 */}
          {sqlLoading ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <i className="ri-loader-4-line animate-spin text-indigo-400" />
              <span className={`text-xs ${t.textFaint}`}>SQL 생성 중...</span>
            </div>
          ) : setupSql ? (
            <div className="space-y-4">
              {/* 메인 설정 SQL */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <i className="ri-terminal-line text-emerald-400 text-xs" />
                    <p className={`text-xs font-black ${t.textSub}`}>
                      전체 헬스체크 자동화 SQL
                      <span className="ml-2 text-[10px] font-normal text-emerald-400">
                        ({setupSql.description})
                      </span>
                    </p>
                  </div>
                </div>
                <SqlBlock sql={setupSql.setup_sql} isDark={isDark} label="setup.sql" />
              </div>

              {/* 실행 방법 안내 */}
              <div className={`${isDark ? 'bg-indigo-500/5 border-indigo-500/15' : 'bg-indigo-50 border-indigo-200'} border rounded-xl p-4`}>
                <p className="text-xs font-black text-indigo-400 mb-2 flex items-center gap-1.5">
                  <i className="ri-lightbulb-line" />실행 방법
                </p>
                <ol className={`space-y-1.5 text-[11px] ${t.textSub}`}>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    <span>위 SQL을 복사합니다</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    <span>
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 underline"
                      >
                        Supabase 대시보드
                      </a>
                      {' '}→ SQL Editor로 이동합니다
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    <span>SQL을 붙여넣고 <strong>Run</strong>을 클릭합니다</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[9px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                    <span>이 패널의 <strong>등록된 Job</strong> 탭에서 확인합니다</span>
                  </li>
                </ol>
              </div>

              {/* 서비스별 개별 SQL (토글) */}
              <div>
                <button
                  onClick={() => setShowPerService((v) => !v)}
                  className={`flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors ${t.textSub} hover:opacity-80`}
                >
                  <i className={`${showPerService ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-sm`} />
                  서비스별 개별 헬스체크 SQL (선택사항)
                </button>
                {showPerService && (
                  <div className="mt-3">
                    <p className={`text-[10px] ${t.textFaint} mb-2`}>
                      각 서비스마다 별도 cron job을 등록하면 서비스별로 다른 주기를 설정할 수 있습니다.
                    </p>
                    <SqlBlock sql={setupSql.per_service_sql} isDark={isDark} label="per-service.sql" />
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* pg_net 없을 때 경고 */}
          {!pgNetOk && (
            <div className={`${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'} border rounded-xl p-4`}>
              <p className="text-xs font-black text-amber-400 mb-1.5 flex items-center gap-1.5">
                <i className="ri-alert-line" />pg_net 활성화 필요
              </p>
              <p className={`text-[11px] ${t.textSub} mb-2`}>
                pg_cron에서 HTTP 요청을 보내려면 pg_net 익스텐션이 필요합니다.
              </p>
              <SqlBlock
                sql={`-- pg_net 활성화\nCREATE EXTENSION IF NOT EXISTS pg_net;`}
                isDark={isDark}
                label="enable-pg-net.sql"
              />
            </div>
          )}
        </div>
      )}

      {/* ══ 등록된 Job 탭 ══════════════════════════════════════════ */}
      {activeTab === 'jobs' && (
        <div>
          {status?.jobs?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className={`w-12 h-12 rounded-2xl ${t.cardBg2} flex items-center justify-center`}>
                <i className={`ri-timer-line text-xl ${t.textFaint}`} />
              </div>
              <div className="text-center">
                <p className={`text-sm font-bold ${t.text}`}>등록된 cron job 없음</p>
                <p className={`text-xs ${t.textFaint} mt-1`}>설정 가이드 탭의 SQL을 실행하면 여기에 표시됩니다</p>
              </div>
              <button
                onClick={() => setActiveTab('setup')}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-guide-line mr-1.5" />설정 가이드로 이동
              </button>
            </div>
          ) : (
            <div className={`divide-y ${t.divider}`}>
              {status?.jobs?.map((job) => {
                const isToggling = togglingJob === job.jobname;
                const isDeleting = deletingJob === job.jobname;
                const isHealthcheck = job.jobname.includes('healthcheck') || job.jobname.includes('readdy');

                return (
                  <div key={job.jobid} className={`px-5 py-4 ${t.rowHover} transition-colors`}>
                    <div className="flex items-start gap-3">
                      {/* 상태 dot */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                        job.active ? 'bg-emerald-400' : isDark ? 'bg-zinc-600' : 'bg-gray-300'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-black font-mono ${t.text}`}>{job.jobname}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
                            job.active
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                              : isDark ? 'bg-zinc-700/60 text-zinc-500' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {job.active ? '실행 중' : '일시 중지'}
                          </span>
                          {isHealthcheck && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25">
                              <i className="ri-heart-pulse-line mr-0.5" />헬스체크
                            </span>
                          )}
                        </div>

                        {/* 스케줄 */}
                        <div className="flex items-center gap-2 mb-2">
                          <i className={`ri-timer-line text-xs ${t.textFaint}`} />
                          <code className={`text-[10px] font-mono ${t.textSub}`}>{job.schedule}</code>
                        </div>

                        {/* 커맨드 (축약) */}
                        <div className={`text-[9px] font-mono ${t.textFaint} truncate max-w-md`}>
                          {job.command.replace(/\s+/g, ' ').trim().slice(0, 100)}...
                        </div>
                      </div>

                      {/* 액션 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* 활성/비활성 토글 */}
                        <button
                          onClick={() => handleToggleJob(job.jobname, !job.active)}
                          disabled={isToggling || isDeleting}
                          className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative flex-shrink-0 disabled:opacity-50 ${
                            job.active ? 'bg-emerald-500' : isDark ? 'bg-zinc-700' : 'bg-gray-300'
                          }`}
                          title={job.active ? '일시 중지' : '재개'}
                        >
                          {isToggling ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <i className="ri-loader-4-line animate-spin text-white text-[8px]" />
                            </div>
                          ) : (
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${job.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          )}
                        </button>

                        {/* 삭제 */}
                        <button
                          onClick={() => handleDeleteJob(job.jobname)}
                          disabled={isDeleting || isToggling}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors disabled:opacity-50 ${
                            isDark ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-500 hover:bg-red-100'
                          }`}
                          title="job 삭제"
                        >
                          {isDeleting
                            ? <i className="ri-loader-4-line animate-spin text-xs" />
                            : <i className="ri-delete-bin-line text-xs" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 수동 SQL 삭제 안내 */}
          {(status?.jobs?.length ?? 0) > 0 && (
            <div className={`px-5 py-3 border-t ${t.border}`}>
              <p className={`text-[10px] ${t.textFaint}`}>
                <i className="ri-information-line mr-1 text-indigo-400" />
                job 삭제가 안 될 경우 SQL Editor에서{' '}
                <code className={`px-1 py-0.5 rounded text-[9px] ${t.inputBg2}`}>
                  SELECT cron.unschedule(&apos;job이름&apos;);
                </code>
                을 실행하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══ 실행 이력 탭 ══════════════════════════════════════════ */}
      {activeTab === 'runs' && (
        <div>
          {(!status?.recent_runs || status.recent_runs.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <i className={`ri-history-line text-2xl ${t.textFaint}`} />
              <p className={`text-sm font-bold ${t.text}`}>실행 이력 없음</p>
              <p className={`text-xs ${t.textFaint}`}>
                {pgCronOk ? 'cron job이 실행되면 여기에 기록됩니다' : 'pg_cron 설정 후 이력이 표시됩니다'}
              </p>
            </div>
          ) : (
            <div className={`divide-y ${t.divider}`}>
              {status.recent_runs.map((run) => {
                const isSuccess = run.status === 'succeeded';
                const dur = run.start_time && run.end_time ? durationMs(run.start_time, run.end_time) : null;

                return (
                  <div key={run.runid} className={`px-5 py-3 flex items-start gap-3 ${t.rowHover} transition-colors`}>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSuccess ? 'bg-emerald-500/15' : 'bg-red-500/15'
                    }`}>
                      <i className={`text-xs ${isSuccess ? 'ri-checkbox-circle-line text-emerald-400' : 'ri-close-circle-line text-red-400'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[11px] font-semibold ${t.text}`}>
                          {run.start_time ? formatDateTime(run.start_time) : '-'}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          isSuccess
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {isSuccess ? '성공' : '실패'}
                        </span>
                        {run.start_time && (
                          <span className={`text-[9px] ${t.textFaint}`}>{relativeTime(run.start_time)}</span>
                        )}
                        {dur && (
                          <span className={`text-[9px] font-mono ${t.textFaint}`}>{dur}</span>
                        )}
                      </div>
                      {run.return_message && (
                        <p className={`text-[10px] font-mono ${isSuccess ? t.textFaint : 'text-red-400'} truncate`}>
                          {run.return_message}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* pg_cron 이력 조회 안내 */}
          <div className={`px-5 py-3 border-t ${t.border}`}>
            <p className={`text-[10px] ${t.textFaint}`}>
              <i className="ri-information-line mr-1 text-indigo-400" />
              전체 이력은 SQL Editor에서{' '}
              <code className={`px-1 py-0.5 rounded text-[9px] ${t.inputBg2}`}>
                SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;
              </code>
              로 조회할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`px-5 py-3 border-t ${t.border} flex items-center gap-2 ${isDark ? 'bg-zinc-900/30' : 'bg-gray-50'}`}>
        <i className="ri-shield-check-line text-xs text-emerald-400 flex-shrink-0" />
        <p className={`text-[10px] ${t.textFaint}`}>
          pg_cron은 DB 레벨에서 실행되므로 관리자 패널이 닫혀 있어도 자동으로 헬스체크가 실행됩니다.
          연속 3회 실패 시 notifications 테이블에 알림이 기록됩니다.
        </p>
      </div>
    </div>
  );
}
