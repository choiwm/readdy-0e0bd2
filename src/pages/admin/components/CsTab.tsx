import type { CsTicket } from '../types';
import { StatusBadge, PriorityBadge } from './Badges';

export interface CsTicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  urgent: number;
  high: number;
}

export type CsTicketFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

interface Theme {
  cardBg: string;
  cardBg2: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  textFaint: string;
  inputBg2: string;
  rowHover: string;
  divider: string;
}

interface CsTabProps {
  isDark: boolean;
  t: Theme;
  csLoading: boolean;
  csTickets: CsTicket[];
  csTicketStats: CsTicketStats;
  csTicketFilter: CsTicketFilter;
  setCsTicketFilter: (f: CsTicketFilter) => void;
  onRefresh: () => void;
  onSelectTicket: (ticket: CsTicket) => void;
}

const FILTER_LABELS: Record<CsTicketFilter, string> = {
  all: '전체',
  open: '미처리',
  in_progress: '처리 중',
  resolved: '해결됨',
  closed: '완료',
};

export default function CsTab({
  isDark,
  t,
  csLoading,
  csTickets,
  csTicketStats,
  csTicketFilter,
  setCsTicketFilter,
  onRefresh,
  onSelectTicket,
}: CsTabProps) {
  const summary = [
    {
      label: '미처리 티켓',
      value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.open) : String(csTickets.filter((tk) => tk.status === 'open').length),
      icon: 'ri-customer-service-2-line', color: 'text-red-400', bg: 'bg-red-500/10',
    },
    {
      label: '처리 중',
      value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.in_progress) : String(csTickets.filter((tk) => tk.status === 'in_progress').length),
      icon: 'ri-time-line', color: 'text-amber-400', bg: 'bg-amber-500/10',
    },
    {
      label: '완료 (전체)',
      value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.resolved + csTicketStats.closed) : String(csTickets.filter((tk) => tk.status === 'closed' || tk.status === 'resolved').length),
      icon: 'ri-check-double-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
    },
    {
      label: '전체 티켓',
      value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.total) : String(csTickets.length),
      icon: 'ri-timer-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10',
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
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

      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
          <div>
            <p className={`text-sm font-black ${t.text}`}>1:1 문의 티켓</p>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>사용자 기술 지원 및 티켓 관리</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
              title="새로고침"
              aria-label="티켓 새로고침"
            >
              <i className={`ri-refresh-line text-sm ${t.textSub} ${csLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className={`px-5 py-2.5 border-b ${t.border} flex items-center gap-1 overflow-x-auto`}>
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setCsTicketFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                csTicketFilter === f
                  ? 'bg-indigo-500 text-white'
                  : `${t.inputBg2} ${t.textSub} hover:opacity-80`
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        <div className={`divide-y ${t.divider}`}>
          {csLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <i className="ri-loader-4-line animate-spin text-3xl text-indigo-400" />
              <span className={`text-sm ${t.textMuted}`}>티켓 데이터를 불러오는 중...</span>
            </div>
          ) : csTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <i className={`ri-customer-service-2-line text-3xl ${t.textFaint}`} />
              <p className={`text-sm font-semibold ${t.textMuted}`}>
                {csTicketFilter !== 'all' ? '해당 상태의 티켓이 없습니다' : '접수된 CS 티켓이 없습니다'}
              </p>
              {csTicketFilter !== 'all' && (
                <button
                  onClick={() => setCsTicketFilter('all')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors mt-1"
                >
                  전체 티켓 보기
                </button>
              )}
            </div>
          ) : null}
          {!csLoading && csTickets.map((ticket) => (
            <div key={ticket.id} className={`px-5 py-4 flex items-start gap-4 ${t.rowHover} transition-colors group`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs font-mono ${t.textFaint}`}>{ticket.id}</span>
                  <PriorityBadge priority={ticket.priority} isDark={isDark} />
                  <span className={`text-[10px] ${t.cardBg2} ${t.textMuted} px-1.5 py-0.5 rounded-full`}>{ticket.category}</span>
                </div>
                <p className={`text-sm font-semibold ${t.text} mb-1`}>{ticket.subject}</p>
                <p className={`text-[11px] ${t.textFaint}`}>{ticket.user} · {ticket.date}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={ticket.status} isDark={isDark} />
                <button
                  onClick={() => onSelectTicket(ticket)}
                  className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100`}
                  title="답변하기"
                  aria-label={`티켓 ${ticket.id} 답변`}
                >
                  <i className={`ri-reply-line ${t.textSub} text-xs`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
