import type { AuditAlertRule } from './AuditAlertSettingsModal';

export interface AuditLogEntry {
  id: string;
  admin: string;
  role: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
  time: string;
  category: string;
}

export interface AuditStats {
  total: number;
  today: number;
  success: number;
  failed: number;
}

export type AuditDatePreset = 'today' | '7d' | '30d' | 'all';

interface Theme {
  cardBg: string;
  cardBg2: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  inputBg2: string;
  tableHead: string;
  divider: string;
}

interface AuditTabProps {
  isDark: boolean;
  t: Theme;

  auditStats: AuditStats;
  displayAuditLogs: AuditLogEntry[];
  displayAdminAccountsCount: number;
  filteredAuditLogs: AuditLogEntry[];
  pagedAuditLogs: AuditLogEntry[];

  auditLogsLoading: boolean;
  auditCategoryFilter: string;
  auditSearch: string;

  auditDateFrom: string;
  auditDateTo: string;
  auditDatePreset: AuditDatePreset;
  setAuditDateFrom: (v: string) => void;
  setAuditDateTo: (v: string) => void;
  setAuditDatePreset: (v: AuditDatePreset) => void;

  auditPage: number;
  auditTotalPages: number;
  auditPageSize: number;
  setAuditPage: (updater: number | ((p: number) => number)) => void;

  auditAlertRules: AuditAlertRule[];
  activeAlertCount: number;
  onOpenAlertModal: () => void;

  onPresetClick: (p: AuditDatePreset) => void;
  onCategoryChange: (cat: string) => void;
  onSearchChange: (val: string) => void;
  onDateRangeChange: (from: string, to: string) => void;
  onResetDateRange: () => void;

  onCsvExport: (tabName: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  '전체': '전체',
  user: '사용자',
  content: '콘텐츠',
  billing: '결제',
  system: '시스템',
  security: '보안',
};

const CATEGORY_BADGES: Record<string, { label: string; cls: string }> = {
  user:     { label: '사용자', cls: 'bg-indigo-500/15 text-indigo-400' },
  content:  { label: '콘텐츠', cls: 'bg-violet-500/15 text-violet-400' },
  billing:  { label: '결제',   cls: 'bg-emerald-500/15 text-emerald-400' },
  system:   { label: '시스템', cls: 'bg-amber-500/15 text-amber-400' },
  security: { label: '보안',   cls: 'bg-red-500/15 text-red-400' },
};

export default function AuditTab({
  isDark, t,
  auditStats, displayAuditLogs, displayAdminAccountsCount,
  filteredAuditLogs, pagedAuditLogs,
  auditLogsLoading, auditCategoryFilter, auditSearch,
  auditDateFrom, auditDateTo, auditDatePreset,
  setAuditDateFrom, setAuditDateTo, setAuditDatePreset,
  auditPage, auditTotalPages, auditPageSize, setAuditPage,
  auditAlertRules, activeAlertCount, onOpenAlertModal,
  onPresetClick, onCategoryChange, onSearchChange, onDateRangeChange, onResetDateRange,
  onCsvExport,
}: AuditTabProps) {
  const summary = [
    { label: '오늘 활동', value: auditStats.today > 0 ? `${auditStats.today}건` : `${displayAuditLogs.length}건`, icon: 'ri-file-list-3-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: '전체 로그', value: auditStats.total > 0 ? `${auditStats.total.toLocaleString()}건` : `${displayAuditLogs.length}건`, icon: 'ri-calendar-check-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '성공', value: auditStats.success > 0 ? `${auditStats.success}건` : '-', icon: 'ri-shield-flash-line', color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: '활성 관리자', value: `${displayAdminAccountsCount}명`, icon: 'ri-user-star-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  const pageNumbers: (number | '...')[] = Array.from({ length: auditTotalPages }, (_, i) => i + 1)
    .filter((p) => {
      if (auditTotalPages <= 7) return true;
      if (p === 1 || p === auditTotalPages) return true;
      return Math.abs(p - auditPage) <= 2;
    })
    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
      if (idx > 0 && typeof arr[idx - 1] === 'number' && p - (arr[idx - 1] as number) > 1) {
        acc.push('...');
      }
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className={`flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl border ${
        activeAlertCount > 0 ? 'bg-indigo-500/8 border-indigo-500/20' : `${t.cardBg} ${t.border}`
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 flex items-center justify-center rounded-xl ${activeAlertCount > 0 ? 'bg-indigo-500/15' : t.inputBg2}`}>
            <i className={`ri-notification-badge-line text-sm ${activeAlertCount > 0 ? 'text-indigo-400' : t.textMuted}`} />
          </div>
          <div>
            <p className={`text-xs font-black ${t.text}`}>액션 알림 설정</p>
            <p className={`text-[11px] ${t.textMuted}`}>
              {auditAlertRules.length === 0
                ? '특정 관리자 액션 발생 시 알림을 받도록 설정하세요'
                : `총 ${auditAlertRules.length}개 규칙 · 활성 ${activeAlertCount}개`}
            </p>
          </div>
          {activeAlertCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {auditAlertRules.filter((r) => r.enabled).slice(0, 3).map((r) => (
                <span key={r.id} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 whitespace-nowrap">
                  {r.name}
                </span>
              ))}
              {activeAlertCount > 3 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/15 ${t.textMuted} whitespace-nowrap`}>
                  +{activeAlertCount - 3}개
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onOpenAlertModal}
          className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 ${
            activeAlertCount > 0
              ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
              : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
          }`}
        >
          <i className="ri-settings-3-line text-xs" />
          {auditAlertRules.length === 0 ? '알림 설정' : '규칙 관리'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((c) => (
          <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
            <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
              <i className={`${c.icon} ${c.color} text-sm`} />
            </div>
            <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
            <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
          </div>
        ))}
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-calendar-line text-zinc-500 text-sm" />
              </div>
              <span className={`text-xs font-black ${t.textSub}`}>기간 필터</span>
              {(auditDateFrom || auditDateTo || auditDatePreset !== 'all') && (
                <button
                  onClick={onResetDateRange}
                  className={`ml-auto flex items-center gap-1 text-[11px] ${t.textMuted} hover:${t.textSub} cursor-pointer transition-colors whitespace-nowrap`}
                >
                  <i className="ri-close-circle-line text-xs" />
                  초기화
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { key: 'today', label: '오늘' },
                { key: '7d',    label: '최근 7일' },
                { key: '30d',   label: '최근 30일' },
                { key: 'all',   label: '전체 기간' },
              ] as const).map((p) => (
                <button
                  key={p.key}
                  onClick={() => onPresetClick(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap border ${
                    auditDatePreset === p.key && !(auditDateFrom || auditDateTo)
                      ? 'bg-indigo-500 border-indigo-500 text-white'
                      : `${t.cardBg2} ${t.border} ${t.textMuted} hover:${t.text}`
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] ${t.textFaint} whitespace-nowrap`}>직접 입력</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAuditDateFrom(val);
                    setAuditDatePreset('all');
                    setAuditPage(1);
                    onDateRangeChange(val, auditDateTo);
                  }}
                  aria-label="감사 로그 시작일"
                  className={`flex-1 min-w-0 ${t.inputBg2} border ${t.border} rounded-lg px-2.5 py-1.5 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                />
                <span className={`${t.textFaint} text-xs flex-shrink-0`}>~</span>
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAuditDateTo(val);
                    setAuditDatePreset('all');
                    setAuditPage(1);
                    onDateRangeChange(auditDateFrom, val);
                  }}
                  aria-label="감사 로그 종료일"
                  className={`flex-1 min-w-0 ${t.inputBg2} border ${t.border} rounded-lg px-2.5 py-1.5 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                />
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-px bg-white/5 self-stretch" />
          <div className="block lg:hidden h-px bg-white/5 w-full" />

          <div className="flex flex-col justify-center gap-2 lg:w-52 flex-shrink-0">
            <p className={`text-[10px] font-black ${t.textFaint} uppercase tracking-widest`}>현재 조회 범위</p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <span className={`text-xs font-semibold ${t.textSub}`}>
                {auditDatePreset === 'today' && (() => {
                  const today = new Date();
                  return `오늘 (${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')})`;
                })()}
                {auditDatePreset === '7d' && (() => {
                  const to = new Date();
                  const from = new Date(); from.setDate(from.getDate() - 6);
                  return `최근 7일 (${String(from.getMonth() + 1).padStart(2, '0')}.${String(from.getDate()).padStart(2, '0')} ~ ${String(to.getMonth() + 1).padStart(2, '0')}.${String(to.getDate()).padStart(2, '0')})`;
                })()}
                {auditDatePreset === '30d' && (() => {
                  const to = new Date();
                  const from = new Date(); from.setDate(from.getDate() - 29);
                  return `최근 30일 (${String(from.getMonth() + 1).padStart(2, '0')}.${String(from.getDate()).padStart(2, '0')} ~ ${String(to.getMonth() + 1).padStart(2, '0')}.${String(to.getDate()).padStart(2, '0')})`;
                })()}
                {auditDatePreset === 'all' && !auditDateFrom && !auditDateTo && '전체 기간'}
                {auditDatePreset === 'all' && (auditDateFrom || auditDateTo) && (
                  `${auditDateFrom || '시작'} ~ ${auditDateTo || '종료'}`
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className={`text-xs ${t.textMuted}`}>
                <span className={`font-black ${t.text}`}>{filteredAuditLogs.length}건</span> 조회됨
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className={`flex items-center gap-2 flex-1 ${t.cardBg} border ${t.border} rounded-xl px-3 py-2.5`}>
          <i className="ri-search-line text-zinc-500 text-sm" />
          <input
            type="text"
            value={auditSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="관리자, 액션, 대상 검색..."
            aria-label="감사 로그 검색"
            className={`flex-1 bg-transparent text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none`}
          />
          {auditLogsLoading ? (
            <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm flex-shrink-0" />
          ) : auditSearch ? (
            <button onClick={() => onSearchChange('')} className="w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors flex-shrink-0" aria-label="검색 지우기">
              <i className="ri-close-line text-xs" />
            </button>
          ) : null}
        </div>
        <div className="flex gap-2 flex-wrap">
          {['전체', 'user', 'content', 'billing', 'system', 'security'].map((f) => (
            <button
              key={f}
              onClick={() => onCategoryChange(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                auditCategoryFilter === f
                  ? 'bg-indigo-500 text-white'
                  : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
              }`}
            >
              {CATEGORY_LABELS[f] ?? f}
            </button>
          ))}
        </div>
      </div>

      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={`border-b ${t.border}`}>
                <th className={`text-left px-5 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>로그 ID</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>관리자</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>액션</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden md:table-cell`}>대상</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>상세</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>IP</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>카테고리</th>
                <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden sm:table-cell`}>시간</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divider}`}>
              {pagedAuditLogs.map((log) => {
                const cat = CATEGORY_BADGES[log.category] ?? { label: log.category, cls: 'bg-zinc-700 text-zinc-400' };
                return (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-mono ${t.textFaint}`}>{log.id}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <p className={`text-xs font-semibold ${t.text}`}>{log.admin}</p>
                        <p className={`text-[10px] ${t.textFaint}`}>{log.role}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs ${t.textSub}`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className={`text-xs ${t.textMuted} truncate max-w-[140px] block`}>{log.target}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className={`text-xs ${t.textFaint}`}>{log.detail}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className={`text-[11px] font-mono ${t.textFaint}`}>{log.ip}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.cls} whitespace-nowrap`}>
                        {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className={`text-[11px] ${t.textFaint} whitespace-nowrap`}>{log.time}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAuditLogs.length === 0 && (
          <div className={`text-center py-12 ${t.textFaint}`}>
            <i className="ri-file-search-line text-2xl mb-2 block" />
            검색 결과가 없습니다
          </div>
        )}

        <div className={`px-5 py-3.5 border-t ${t.border} flex flex-col sm:flex-row items-center gap-3 justify-between`}>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${t.textFaint}`}>
              전체 <span className={`${t.textSub} font-bold`}>{filteredAuditLogs.length}건</span> 중{' '}
              <span className={`${t.textSub} font-bold`}>
                {filteredAuditLogs.length === 0 ? 0 : (auditPage - 1) * auditPageSize + 1}
                –{Math.min(auditPage * auditPageSize, filteredAuditLogs.length)}
              </span>건 표시
            </span>
            <span className={`hidden sm:block ${t.textFaint} text-xs`}>|</span>
            <span className={`hidden sm:block text-xs ${t.textFaint}`}>
              페이지당 <span className={`${t.textMuted} font-semibold`}>{auditPageSize}건</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setAuditPage(1)}
              disabled={auditPage === 1}
              aria-label="첫 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-skip-left-line text-sm" />
            </button>
            <button
              onClick={() => setAuditPage((p: number) => Math.max(1, p - 1))}
              disabled={auditPage === 1}
              aria-label="이전 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-arrow-left-s-line text-sm" />
            </button>

            {pageNumbers.map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className={`w-7 h-7 flex items-center justify-center ${t.textFaint} text-xs select-none`}>
                  ···
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setAuditPage(p)}
                  aria-label={`${p} 페이지로 이동`}
                  aria-current={auditPage === p ? 'page' : undefined}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                    auditPage === p
                      ? 'bg-indigo-500 text-white'
                      : `${t.textMuted} hover:${t.text} hover:${t.inputBg2}`
                  }`}
                >
                  {p}
                </button>
              ),
            )}

            <button
              onClick={() => setAuditPage((p: number) => Math.min(auditTotalPages, p + 1))}
              disabled={auditPage === auditTotalPages}
              aria-label="다음 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-arrow-right-s-line text-sm" />
            </button>
            <button
              onClick={() => setAuditPage(auditTotalPages)}
              disabled={auditPage === auditTotalPages}
              aria-label="마지막 페이지"
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
            >
              <i className="ri-skip-right-line text-sm" />
            </button>
          </div>

          <button
            onClick={() => onCsvExport('감사 로그')}
            className={`flex items-center gap-1.5 text-xs ${t.textMuted} hover:${t.textSub} cursor-pointer transition-colors whitespace-nowrap`}
          >
            <i className="ri-download-line text-xs" />
            CSV 내보내기
          </button>
        </div>
      </div>
    </div>
  );
}
