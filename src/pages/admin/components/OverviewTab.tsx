import { StatusBadge } from './Badges';
import { SectionHeader } from './AdminHelpers';
import TeamStatsDashboard from './TeamStatsDashboard';

export interface OverviewStats {
  users?: { total: number; active: number; new_today: number; new_month: number; plan_dist: { free: number; pro: number; enterprise: number } };
  revenue?: { monthly: number; last_month: number; total: number; growth_pct: number };
  content?: { total: number; gallery: number; audio: number; automation: number; board: number };
  cs?: { open: number; in_progress: number; total: number };
}

export interface ApiStatusItem {
  name: string;
  status: string;
  latency: string;
  uptime: string;
}

export interface ContentTrendItem {
  name: string;
  count: number;
  pct: number;
  color: string;
  icon: string;
}

export interface PlanDistItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface MonthlyRevenuePoint {
  label: string;
  value: number;
}

export interface AuditLogPreview {
  admin: string;
  action: string;
  target: string;
  detail: string;
  time: string;
}

interface Theme {
  cardBg: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
}

interface OverviewTabProps {
  isDark: boolean;
  t: Theme;

  overviewStats: OverviewStats | null;
  overviewLoading: boolean;

  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: (updater: (v: boolean) => boolean) => void;
  nextRefreshIn: number;
  setNextRefreshIn: (v: number) => void;
  lastRefreshedAt: Date | null;
  setLastRefreshedAt: (d: Date) => void;
  onManualRefresh: () => void;

  monthlyRevenueData: MonthlyRevenuePoint[];
  contentTrendsData: ContentTrendItem[];
  dailySignupsData: number[];
  planDistData: PlanDistItem[];
  recentAuditLogs: AuditLogPreview[];

  apiStatus: ApiStatusItem[];
  contentTrendsFallback: ContentTrendItem[];
  dailySignupsFallback: number[];
  planDistFallback: PlanDistItem[];
  auditLogsFallback: AuditLogPreview[];

  onJumpToAudit: () => void;
  onJumpToTeams: () => void;
}

const MONTHLY_PLACEHOLDER: MonthlyRevenuePoint[] = [
  { label: '11월', value: 0 },
  { label: '12월', value: 0 },
  { label: '1월',  value: 0 },
  { label: '2월',  value: 0 },
  { label: '3월',  value: 0 },
  { label: '4월',  value: 0 },
];

export default function OverviewTab({
  isDark, t,
  overviewStats, overviewLoading,
  autoRefreshEnabled, setAutoRefreshEnabled,
  nextRefreshIn, lastRefreshedAt,
  onManualRefresh,
  monthlyRevenueData, contentTrendsData, dailySignupsData, planDistData, recentAuditLogs,
  apiStatus, contentTrendsFallback, dailySignupsFallback, planDistFallback, auditLogsFallback,
  onJumpToAudit, onJumpToTeams,
}: OverviewTabProps) {
  const statsCards = [
    {
      label: '이번 달 신규 가입',
      value: overviewStats?.users?.new_month !== undefined
        ? `${overviewStats.users.new_month.toLocaleString()}명`
        : (overviewLoading ? '...' : '-'),
      change: overviewStats?.users?.new_today !== undefined
        ? `오늘 +${overviewStats.users.new_today}명`
        : '-',
      up: true,
      icon: 'ri-user-add-line',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: '이번 달 매출',
      value: overviewStats?.revenue?.monthly !== undefined
        ? `₩${Math.round(overviewStats.revenue.monthly * 1350).toLocaleString()}`
        : (overviewLoading ? '...' : '-'),
      change: overviewStats?.revenue?.growth_pct !== undefined
        ? `${overviewStats.revenue.growth_pct >= 0 ? '+' : ''}${overviewStats.revenue.growth_pct}%`
        : '-',
      up: (overviewStats?.revenue?.growth_pct ?? 0) >= 0,
      icon: 'ri-money-dollar-circle-line',
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
    },
    {
      label: '전체 사용자',
      value: overviewStats?.users?.total !== undefined
        ? overviewStats.users.total.toLocaleString()
        : (overviewLoading ? '...' : '-'),
      change: overviewStats?.users?.active !== undefined
        ? `활성 ${overviewStats.users.active.toLocaleString()}명`
        : '-',
      up: true,
      icon: 'ri-user-3-line',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
    },
    {
      label: '총 생성 콘텐츠',
      value: overviewStats?.content?.total !== undefined
        ? overviewStats.content.total.toLocaleString()
        : (overviewLoading ? '...' : '-'),
      change: overviewStats?.content
        ? `이미지 ${(overviewStats.content.gallery ?? 0).toLocaleString()}`
        : '-',
      up: true,
      icon: 'ri-image-ai-line',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
    },
    {
      label: '미처리 CS 티켓',
      value: overviewStats?.cs?.open !== undefined
        ? `${overviewStats.cs.open}건`
        : (overviewLoading ? '...' : '-'),
      change: overviewStats?.cs?.in_progress !== undefined
        ? `처리 중 ${overviewStats.cs.in_progress}건`
        : '-',
      up: (overviewStats?.cs?.open ?? 1) === 0,
      icon: 'ri-customer-service-2-line',
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
    {
      label: '누적 총 매출',
      value: overviewStats?.revenue?.total !== undefined
        ? `₩${Math.round(overviewStats.revenue.total * 1350).toLocaleString()}`
        : (overviewLoading ? '...' : '-'),
      change: overviewStats?.revenue?.last_month !== undefined
        ? `전월 ₩${Math.round(overviewStats.revenue.last_month * 1350 / 10000).toLocaleString()}만`
        : '-',
      up: true,
      icon: 'ri-bar-chart-2-line',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
  ];

  const chartData = monthlyRevenueData.length > 0 ? monthlyRevenueData : MONTHLY_PLACEHOLDER;
  const maxChartVal = Math.max(...chartData.map((d) => d.value), 1);

  const signupVals = dailySignupsData.length > 0 ? dailySignupsData : dailySignupsFallback;
  const maxSignup = Math.max(...signupVals, 1);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${t.border} ${isDark ? 'bg-zinc-800/60' : 'bg-zinc-50'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
          <span className={`text-xs font-medium ${t.textSub}`}>
            {autoRefreshEnabled
              ? `자동 새로고침 활성 — ${nextRefreshIn}초 후 갱신`
              : '자동 새로고침 일시정지'}
          </span>
          {lastRefreshedAt && (
            <span className={`text-xs ${t.textFaint}`}>
              마지막 갱신: {lastRefreshedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onManualRefresh}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'} whitespace-nowrap cursor-pointer`}
          >
            <i className={`ri-refresh-line text-xs ${overviewLoading ? 'animate-spin' : ''}`} />
            지금 갱신
          </button>
          <button
            onClick={() => setAutoRefreshEnabled((v) => !v)}
            aria-pressed={autoRefreshEnabled}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              autoRefreshEnabled
                ? isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400' : 'bg-white hover:bg-zinc-100 text-zinc-500 border border-zinc-200'
            }`}
          >
            <i className={`${autoRefreshEnabled ? 'ri-pause-line' : 'ri-play-line'} text-xs`} />
            {autoRefreshEnabled ? '일시정지' : '재개'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {statsCards.map((card) => (
          <div key={card.label} className={`${t.cardBg} border ${card.border} rounded-2xl p-4 md:p-5`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                <i className={`${card.icon} ${card.color} text-base`} />
              </div>
              {overviewLoading ? (
                <i className="ri-loader-4-line animate-spin text-zinc-600 text-sm" />
              ) : (
                <span className={`text-[11px] font-bold flex items-center gap-0.5 ${card.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  {card.change}
                </span>
              )}
            </div>
            <p className={`text-xl md:text-2xl font-black ${t.text} mb-1`}>{card.value}</p>
            <p className={`text-xs ${t.textMuted} font-medium`}>{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className={`lg:col-span-2 ${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className={`text-sm font-black ${t.text}`}>월별 매출 추이</p>
              <p className={`text-xs ${t.textMuted} mt-0.5`}>최근 6개월 실제 결제 데이터</p>
            </div>
            {overviewLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
          </div>
          <div className="flex items-end gap-3 h-36">
            {chartData.map((d, i) => {
              const h = Math.max(4, Math.round((d.value / maxChartVal) * 100));
              const isLast = i === chartData.length - 1;
              return (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full flex items-end" style={{ height: '112px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all ${isLast ? 'bg-indigo-500' : 'bg-zinc-700 group-hover:bg-zinc-600'}`}
                      style={{ height: `${h}%` }}
                    />
                    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 ${isDark ? 'bg-zinc-800 text-white' : 'bg-gray-700 text-white'} text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none`}>
                      {d.value > 0 ? `₩${Math.round(d.value * 1350 / 10000).toLocaleString()}만` : '₩0'}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600">{d.label}</span>
                </div>
              );
            })}
          </div>
          <div className={`mt-4 pt-4 border-t ${t.border} grid grid-cols-3 gap-4`}>
            {[
              {
                label: '이번 달 매출',
                value: overviewStats?.revenue?.monthly !== undefined
                  ? `₩${Math.round(overviewStats.revenue.monthly * 1350).toLocaleString()}`
                  : '-',
              },
              {
                label: '지난 달',
                value: overviewStats?.revenue?.last_month !== undefined
                  ? `₩${Math.round(overviewStats.revenue.last_month * 1350).toLocaleString()}`
                  : '-',
              },
              {
                label: '성장률',
                value: overviewStats?.revenue?.growth_pct !== undefined
                  ? `${overviewStats.revenue.growth_pct >= 0 ? '+' : ''}${overviewStats.revenue.growth_pct}%`
                  : '-',
              },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-sm font-black ${t.text}`}>{s.value}</p>
                <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
          <SectionHeader title="AI API 상태" subtitle="실시간 모니터링" isDark={isDark} />
          <div className="space-y-2.5">
            {apiStatus.map((api) => (
              <div key={api.name} className="flex items-center gap-2.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${api.status === 'normal' ? 'bg-emerald-400' : api.status === 'warning' ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold ${t.textSub} truncate`}>{api.name}</p>
                  <p className={`text-[9px] ${t.textFaint}`}>{api.latency} · {api.uptime}</p>
                </div>
                <StatusBadge status={api.status} isDark={isDark} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
          <SectionHeader title="콘텐츠 트렌드" subtitle="이번 달 카테고리별 생성량" isDark={isDark} />
          {overviewLoading && contentTrendsData.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <i className="ri-loader-4-line animate-spin text-2xl text-indigo-400" />
            </div>
          ) : (
            <div className="space-y-3.5">
              {(contentTrendsData.length > 0 ? contentTrendsData : contentTrendsFallback).map((trend) => (
                <div key={trend.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className={`${trend.icon} ${t.textMuted} text-sm`} />
                      </div>
                      <span className={`text-xs font-semibold ${t.textSub}`}>{trend.name}</span>
                    </div>
                    <span className={`text-xs font-black ${t.text}`}>{trend.count.toLocaleString()}</span>
                  </div>
                  <div className={`h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                    <div className={`h-full ${trend.color} rounded-full`} style={{ width: `${trend.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
          <SectionHeader title="일별 신규 가입" subtitle="최근 14일" isDark={isDark} />
          <div className="flex items-end gap-1 h-24 mb-4">
            {signupVals.map((val, i) => {
              const h = Math.max(4, Math.round((val / maxSignup) * 100));
              const isToday = i === signupVals.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  <div className="relative w-full flex items-end" style={{ height: '88px' }}>
                    <div
                      className={`w-full rounded-t transition-all ${isToday ? 'bg-indigo-500' : 'bg-zinc-700 group-hover:bg-zinc-600'}`}
                      style={{ height: `${h}%` }}
                    />
                    <div className={`absolute -top-6 left-1/2 -translate-x-1/2 ${isDark ? 'bg-zinc-800 text-white' : 'bg-gray-700 text-white'} text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10`}>
                      {val}명
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={`pt-4 border-t ${t.border}`}>
            <p className={`text-xs font-black ${t.textSub} mb-3`}>플랜 분포</p>
            {overviewLoading && planDistData.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <i className="ri-loader-4-line animate-spin text-indigo-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {(planDistData.length > 0 ? planDistData : planDistFallback).map((p) => (
                  <div key={p.label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${p.color} flex-shrink-0`} />
                    <span className={`text-xs ${t.textSub} w-16`}>{p.label}</span>
                    <div className={`flex-1 h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                      <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${t.textSub} w-14 text-right`}>
                      {p.pct}% <span className={`${t.textFaint} font-normal`}>({p.count.toLocaleString()})</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TeamStatsDashboard
        isDark={isDark}
        onNavigateToTeams={onJumpToTeams}
      />

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={`text-sm font-black ${t.text}`}>최근 감사 로그</h2>
            <p className={`text-xs mt-0.5 ${t.textMuted}`}>관리자 활동 이력 (실시간)</p>
          </div>
          <button
            onClick={onJumpToAudit}
            className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            <i className="ri-arrow-right-line text-xs" />
            전체 보기
          </button>
        </div>
        {overviewLoading && recentAuditLogs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <i className="ri-loader-4-line animate-spin text-2xl text-indigo-400" />
          </div>
        ) : (
          <div className="space-y-2">
            {(recentAuditLogs.length > 0 ? recentAuditLogs : auditLogsFallback).map((log, i) => (
              <div key={i} className={`flex items-start gap-3 py-2 border-b ${t.border} last:border-0`}>
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-black text-indigo-400">{log.admin.slice(-1).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${t.text}`}>{log.admin}</span>
                    <span className={`text-xs ${t.textMuted}`}>{log.action}</span>
                    <span className={`text-xs ${t.textFaint}`}>→ {log.target}</span>
                  </div>
                  <p className={`text-[10px] ${t.textFaint} mt-0.5`}>{log.detail} · {log.time}</p>
                </div>
              </div>
            ))}
            {recentAuditLogs.length === 0 && !overviewLoading && (
              <div className={`text-center py-6 ${t.textFaint}`}>
                <i className="ri-file-list-3-line text-xl mb-1 block" />
                <p className="text-xs">감사 로그가 없습니다</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
