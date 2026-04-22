import { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
interface FailureLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_plan: string;
  service_slug: string;
  action: string;
  credits_deducted: number;
  status: string;
  error_message: string | null;
  model_used: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ErrorType {
  error: string;
  count: number;
}

interface DailyFailures {
  [date: string]: number;
}

interface FailureLogsData {
  logs: FailureLog[];
  total: number;
  failed_count: number;
  error_types: ErrorType[];
  daily_failures: DailyFailures;
  days: number;
}

interface Props {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
  initialSlug?: string | null;
  initialDays?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────
const SLUG_LABELS: Record<string, string> = {
  fal: 'fal.ai',
  goapi: 'GoAPI',
  elevenlabs: 'ElevenLabs',
  suno: 'Suno',
  openai: 'OpenAI',
  lalalai: 'LALAL.AI',
};

const ACTION_LABELS: Record<string, string> = {
  image_generate: '이미지 생성',
  video_generate: '영상 생성',
  audio_generate: '오디오 생성',
  music_generate: '음악 생성',
  tts: 'TTS 변환',
  sfx: 'SFX 생성',
  transcribe: '음성 인식',
  stem_separate: '스템 분리',
  chat: 'AI 채팅',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-zinc-700/60 text-zinc-400',
  basic: 'bg-indigo-500/15 text-indigo-400',
  pro: 'bg-amber-500/15 text-amber-400',
  enterprise: 'bg-emerald-500/15 text-emerald-400',
};

const DAY_OPTIONS = [
  { value: 1, label: '오늘' },
  { value: 3, label: '3일' },
  { value: 7, label: '7일' },
  { value: 14, label: '14일' },
  { value: 30, label: '30일' },
];

const SLUG_OPTIONS = [
  { value: '', label: '전체 서비스' },
  { value: 'fal', label: 'fal.ai' },
  { value: 'goapi', label: 'GoAPI' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'suno', label: 'Suno' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'lalalai', label: 'LALAL.AI' },
];

// ── Helper ─────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function truncate(str: string, max = 60): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Mini Bar Chart ─────────────────────────────────────────────────────────
function MiniBarChart({ data, isDark }: { data: DailyFailures; isDark: boolean }) {
  const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="flex items-end gap-1 h-12">
      {entries.map(([date, count]) => {
        const pct = (count / max) * 100;
        const label = date.slice(5); // MM-DD
        return (
          <div key={date} className="flex flex-col items-center gap-0.5 flex-1 min-w-0" title={`${date}: ${count}건`}>
            <div className="w-full flex items-end justify-center" style={{ height: '36px' }}>
              <div
                className="w-full rounded-t-sm bg-red-500/70 transition-all"
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <span className={`text-[8px] ${isDark ? 'text-zinc-600' : 'text-gray-400'} truncate w-full text-center`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Log Row ────────────────────────────────────────────────────────────────
function LogRow({
  log, isDark, isExpanded, onToggle,
}: {
  log: FailureLog;
  isDark: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const t = {
    text: isDark ? 'text-white' : 'text-gray-900',
    textSub: isDark ? 'text-zinc-400' : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600' : 'text-gray-400',
    inputBg2: isDark ? 'bg-zinc-800' : 'bg-gray-100',
    border: isDark ? 'border-white/5' : 'border-gray-200',
    rowHover: isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50',
    codeBg: isDark ? 'bg-zinc-900' : 'bg-gray-100',
  };

  const actionLabel = ACTION_LABELS[log.action] ?? log.action;
  const serviceLabel = SLUG_LABELS[log.service_slug] ?? log.service_slug;
  const planCls = PLAN_COLORS[log.user_plan] ?? PLAN_COLORS.free;

  return (
    <>
      <div
        className={`px-4 py-3 flex items-start gap-3 cursor-pointer ${t.rowHover} transition-colors`}
        onClick={onToggle}
      >
        {/* 상태 dot */}
        <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />

        {/* 메인 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {/* 유저 */}
            <span className={`text-xs font-semibold ${t.text} truncate max-w-[140px]`}>
              {log.user_email ?? log.user_name ?? (log.user_id ? `uid:${log.user_id.slice(0, 8)}` : '익명')}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${planCls}`}>
              {log.user_plan}
            </span>
            {/* 서비스 */}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-700/60 ${t.textSub}`}>
              {serviceLabel}
            </span>
            {/* 작업 */}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400`}>
              {actionLabel}
            </span>
          </div>

          {/* 에러 메시지 */}
          <p className={`text-[10px] text-red-400/80 font-mono leading-relaxed`}>
            {log.error_message ? truncate(log.error_message, 80) : '에러 메시지 없음'}
          </p>

          {/* 메타 */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {log.model_used && (
              <span className={`text-[9px] font-mono ${t.textFaint}`}>{truncate(log.model_used, 30)}</span>
            )}
            {log.duration_ms != null && (
              <span className={`text-[9px] ${t.textFaint}`}>{log.duration_ms}ms</span>
            )}
            {log.credits_deducted > 0 && (
              <span className={`text-[9px] ${t.textFaint}`}>
                <i className="ri-coin-line mr-0.5" />{log.credits_deducted} CR
              </span>
            )}
          </div>
        </div>

        {/* 시간 + 펼치기 */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[9px] ${t.textFaint}`}>{relativeTime(log.created_at)}</span>
          {isExpanded
            ? <i className={`ri-arrow-up-s-line text-xs ${t.textFaint}`} />
            : <i className={`ri-arrow-down-s-line text-xs ${t.textFaint}`} />
          }
        </div>
      </div>

      {/* 확장 상세 */}
      {isExpanded && (
        <div className={`px-4 pb-3 border-t ${t.border}`}>
          <div className={`mt-2 rounded-xl ${t.codeBg} p-3 space-y-2`}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                { label: '로그 ID', value: log.id.slice(0, 16) + '…' },
                { label: '발생 시각', value: formatDateTime(log.created_at) },
                { label: '유저 ID', value: log.user_id ? log.user_id.slice(0, 16) + '…' : '-' },
                { label: '이메일', value: log.user_email ?? '-' },
                { label: '플랜', value: log.user_plan },
                { label: '서비스', value: serviceLabel },
                { label: '작업', value: actionLabel },
                { label: '모델', value: log.model_used ?? '-' },
                { label: '소요 시간', value: log.duration_ms != null ? `${log.duration_ms}ms` : '-' },
                { label: '크레딧 차감', value: log.credits_deducted > 0 ? `${log.credits_deducted} CR` : '없음' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className={`text-[9px] ${t.textFaint} block`}>{label}</span>
                  <span className={`text-[10px] font-mono ${t.text}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* 에러 전문 */}
            {log.error_message && (
              <div>
                <span className={`text-[9px] ${t.textFaint} block mb-1`}>에러 메시지 전문</span>
                <p className="text-[10px] font-mono text-red-400 break-all leading-relaxed">
                  {log.error_message}
                </p>
              </div>
            )}

            {/* metadata raw */}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <span className={`text-[9px] ${t.textFaint} block mb-1`}>메타데이터 (raw)</span>
                <pre className={`text-[9px] font-mono ${t.textSub} overflow-x-auto whitespace-pre-wrap break-all`}>
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FailureLogsDrawer({ isDark, isOpen, onClose, initialSlug, initialDays = 7 }: Props) {
  const [data, setData] = useState<FailureLogsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(initialSlug ?? '');
  const [selectedDays, setSelectedDays] = useState(initialDays);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'logs' | 'errors' | 'chart'>('logs');

  const t = {
    bg: isDark ? 'bg-[#0f0f13]' : 'bg-white',
    cardBg2: isDark ? 'bg-zinc-900/60' : 'bg-gray-50',
    border: isDark ? 'border-white/5' : 'border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    textSub: isDark ? 'text-zinc-400' : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600' : 'text-gray-400',
    inputBg: isDark ? 'bg-zinc-800 border-white/5' : 'bg-gray-100 border-gray-200',
    inputBg2: isDark ? 'bg-zinc-800' : 'bg-gray-100',
    divider: isDark ? 'divide-white/[0.03]' : 'divide-gray-100',
    overlay: isDark ? 'bg-black/60' : 'bg-black/30',
  };

  const fetchLogs = useCallback(async (slug: string, days: number) => {
    setLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-api-keys`;
      const headers = { 'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}` };
      const params = new URLSearchParams({ action: 'failed_logs', days: String(days), limit: '100', status: 'failed' });
      if (slug) params.set('slug', slug);
      const res = await fetch(`${base}?${params}`, { headers });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      console.error('Failed to fetch failure logs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedSlug(initialSlug ?? '');
      setSelectedDays(initialDays);
      fetchLogs(initialSlug ?? '', initialDays);
    }
  }, [isOpen, initialSlug, initialDays, fetchLogs]);

  const handleFilter = () => {
    fetchLogs(selectedSlug, selectedDays);
    setExpandedId(null);
  };

  // 검색 필터링
  const filteredLogs = (data?.logs ?? []).filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.user_email ?? '').toLowerCase().includes(q) ||
      (log.user_name ?? '').toLowerCase().includes(q) ||
      (log.error_message ?? '').toLowerCase().includes(q) ||
      (log.action ?? '').toLowerCase().includes(q) ||
      (log.service_slug ?? '').toLowerCase().includes(q) ||
      (log.model_used ?? '').toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className={`flex-1 ${t.overlay} backdrop-blur-sm`} onClick={onClose} />

      {/* Drawer */}
      <div className={`w-full max-w-2xl ${t.bg} border-l ${t.border} flex flex-col h-full overflow-hidden`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b ${t.border} flex items-center gap-3 flex-shrink-0`}>
          <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <i className="ri-error-warning-line text-red-400 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black ${t.text}`}>생성 실패 로그 드릴다운</p>
            <p className={`text-[10px] ${t.textFaint}`}>
              usage_logs 기반 · 실제 AI 생성 요청 실패 상세 원인 조회
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors flex-shrink-0`}
          >
            <i className={`ri-close-line text-sm ${t.textSub}`} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className={`px-5 py-3 border-b ${t.border} flex items-center gap-2 flex-shrink-0 flex-wrap`}>
          {/* 서비스 선택 */}
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border ${t.inputBg} ${t.text} cursor-pointer outline-none`}
          >
            {SLUG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* 기간 선택 */}
          <div className="flex items-center gap-1">
            {DAY_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setSelectedDays(o.value)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${
                  selectedDays === o.value
                    ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                    : `${t.inputBg2} ${t.textSub} hover:opacity-80`
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleFilter}
            disabled={loading}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap flex items-center gap-1"
          >
            {loading ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-line" />}
            조회
          </button>

          {data && (
            <span className={`text-[10px] ${t.textFaint} ml-auto`}>
              실패 <span className="text-red-400 font-bold">{data.failed_count}건</span> / 전체 {data.total}건
            </span>
          )}
        </div>

        {/* Summary Cards */}
        {data && (
          <div className={`px-5 py-3 border-b ${t.border} grid grid-cols-3 gap-3 flex-shrink-0`}>
            {[
              {
                label: '총 실패',
                value: `${data.failed_count}건`,
                icon: 'ri-close-circle-line',
                color: 'text-red-400',
                bg: 'bg-red-500/10',
              },
              {
                label: '실패율',
                value: data.total > 0 ? `${Math.round((data.failed_count / data.total) * 100)}%` : '-',
                icon: 'ri-percent-line',
                color: data.total > 0 && (data.failed_count / data.total) > 0.1 ? 'text-red-400' : 'text-amber-400',
                bg: data.total > 0 && (data.failed_count / data.total) > 0.1 ? 'bg-red-500/10' : 'bg-amber-500/10',
              },
              {
                label: '에러 유형',
                value: `${data.error_types.length}종`,
                icon: 'ri-bug-line',
                color: 'text-violet-400',
                bg: 'bg-violet-500/10',
              },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 flex items-center gap-2`}>
                <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
                  <i className={`${s.icon} ${s.color} text-sm`} />
                </div>
                <div>
                  <p className={`text-sm font-black ${t.text}`}>{s.value}</p>
                  <p className={`text-[9px] ${t.textFaint}`}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Nav */}
        <div className={`px-5 py-2 border-b ${t.border} flex items-center gap-1 flex-shrink-0`}>
          {[
            { id: 'logs' as const, label: '실패 로그', icon: 'ri-list-check-3' },
            { id: 'errors' as const, label: '에러 유형 분석', icon: 'ri-bug-line' },
            { id: 'chart' as const, label: '일별 추이', icon: 'ri-bar-chart-2-line' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-red-500/15 text-red-400'
                  : `${t.inputBg2} ${t.textSub} hover:opacity-80`
              }`}
            >
              <i className={`${tab.icon} text-xs`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <i className="ri-loader-4-line animate-spin text-2xl text-red-400" />
              <p className={`text-xs ${t.textFaint}`}>실패 로그 조회 중...</p>
            </div>
          )}

          {!loading && !data && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <i className={`ri-error-warning-line text-2xl ${t.textFaint}`} />
              <p className={`text-xs ${t.textFaint}`}>조회 버튼을 눌러 로그를 불러오세요</p>
            </div>
          )}

          {/* ── 실패 로그 탭 ── */}
          {!loading && data && activeTab === 'logs' && (
            <>
              {/* 검색 */}
              <div className={`px-4 py-2.5 border-b ${t.border} sticky top-0 ${t.bg} z-10`}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${t.inputBg}`}>
                  <i className={`ri-search-line text-xs ${t.textFaint}`} />
                  <input
                    type="text"
                    placeholder="이메일, 에러 메시지, 작업, 모델 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`flex-1 bg-transparent text-xs ${t.text} outline-none placeholder:${t.textFaint}`}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="cursor-pointer">
                      <i className={`ri-close-line text-xs ${t.textFaint}`} />
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <p className={`text-[9px] ${t.textFaint} mt-1`}>
                    {filteredLogs.length}건 검색됨
                  </p>
                )}
              </div>

              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <i className="ri-checkbox-circle-line text-2xl text-emerald-400" />
                  <p className={`text-xs ${t.textFaint}`}>
                    {searchQuery ? '검색 결과가 없습니다' : '해당 기간 실패 로그가 없습니다'}
                  </p>
                </div>
              ) : (
                <div className={`divide-y ${t.divider}`}>
                  {filteredLogs.map((log) => (
                    <LogRow
                      key={log.id}
                      log={log}
                      isDark={isDark}
                      isExpanded={expandedId === log.id}
                      onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 에러 유형 분석 탭 ── */}
          {!loading && data && activeTab === 'errors' && (
            <div className="p-4 space-y-3">
              {data.error_types.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <i className="ri-checkbox-circle-line text-2xl text-emerald-400" />
                  <p className={`text-xs ${t.textFaint}`}>에러 유형 데이터가 없습니다</p>
                </div>
              ) : (
                <>
                  <p className={`text-xs font-black ${t.textSub} mb-3`}>
                    상위 에러 유형 (빈도순)
                  </p>
                  {data.error_types.map((et, idx) => {
                    const maxCount = data.error_types[0]?.count ?? 1;
                    const pct = Math.round((et.count / maxCount) * 100);
                    return (
                      <div key={idx} className={`${t.cardBg2} rounded-xl p-3 border ${t.border}`}>
                        <div className="flex items-start gap-2 mb-2">
                          <span className={`text-[9px] font-black w-5 h-5 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center flex-shrink-0`}>
                            {idx + 1}
                          </span>
                          <p className={`text-[10px] font-mono text-red-400 flex-1 break-all leading-relaxed`}>
                            {et.error}
                          </p>
                          <span className={`text-xs font-black text-red-400 flex-shrink-0`}>
                            {et.count}건
                          </span>
                        </div>
                        <div className={`h-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                          <div
                            className="h-full bg-red-500/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className={`text-[9px] ${t.textFaint} mt-1`}>
                          전체 실패의 {Math.round((et.count / (data.failed_count || 1)) * 100)}%
                        </p>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── 일별 추이 탭 ── */}
          {!loading && data && activeTab === 'chart' && (
            <div className="p-4 space-y-4">
              <div className={`${t.cardBg2} rounded-xl p-4 border ${t.border}`}>
                <p className={`text-xs font-black ${t.textSub} mb-4`}>일별 실패 건수 추이</p>
                <MiniBarChart data={data.daily_failures} isDark={isDark} />
                {Object.keys(data.daily_failures).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <i className="ri-checkbox-circle-line text-xl text-emerald-400" />
                    <p className={`text-xs ${t.textFaint}`}>해당 기간 실패 없음</p>
                  </div>
                )}
              </div>

              {/* 일별 상세 테이블 */}
              {Object.keys(data.daily_failures).length > 0 && (
                <div className={`${t.cardBg2} rounded-xl border ${t.border} overflow-hidden`}>
                  <div className={`px-4 py-2.5 border-b ${t.border}`}>
                    <p className={`text-[10px] font-black ${t.textSub}`}>일별 상세</p>
                  </div>
                  <div className={`divide-y ${t.divider}`}>
                    {Object.entries(data.daily_failures)
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([date, count]) => (
                        <div key={date} className={`px-4 py-2.5 flex items-center justify-between ${t.border}`}>
                          <span className={`text-xs ${t.textSub}`}>{date}</span>
                          <div className="flex items-center gap-2">
                            <div className={`h-1 w-20 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                              <div
                                className="h-full bg-red-500/60 rounded-full"
                                style={{
                                  width: `${Math.round((count / Math.max(...Object.values(data.daily_failures))) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold text-red-400 w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t ${t.border} flex items-center gap-2 flex-shrink-0`}>
          <i className="ri-information-line text-xs text-amber-400 flex-shrink-0" />
          <p className={`text-[9px] ${t.textFaint}`}>
            usage_logs 테이블 기반 · 키 연결 오류가 아닌 실제 AI 생성 중 발생한 실패 요청입니다
          </p>
          <button
            onClick={() => fetchLogs(selectedSlug, selectedDays)}
            className={`ml-auto w-7 h-7 flex items-center justify-center rounded-lg ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors flex-shrink-0`}
            title="새로고침"
          >
            <i className={`ri-refresh-line text-xs ${t.textSub}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
