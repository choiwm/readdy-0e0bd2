/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect } from 'react';

export type NotifLevel = 'critical' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  level: NotifLevel;
  title: string;
  desc: string;
  time: string;
  read: boolean;
  category: 'api' | 'cs' | 'system' | 'billing' | 'user';
}

export const initialNotifications: Notification[] = [
  {
    id: 'N001',
    level: 'critical',
    title: 'API 에러율 급증',
    desc: 'Suno (음악) API 에러율이 지난 10분간 12.4%로 급증했습니다. 즉시 확인이 필요합니다.',
    time: '방금 전',
    read: false,
    category: 'api',
  },
  {
    id: 'N002',
    level: 'critical',
    title: '신규 긴급 CS 티켓',
    desc: '이서연 님이 "크레딧 차감 후 생성 실패" 긴급 티켓을 제출했습니다.',
    time: '2분 전',
    read: false,
    category: 'cs',
  },
  {
    id: 'N003',
    level: 'warning',
    title: 'GPU-02 부하 임계치 초과',
    desc: 'GPU-02 (영상) 부하가 88%로 임계치(85%)를 초과했습니다. 부하 분산을 검토하세요.',
    time: '5분 전',
    read: false,
    category: 'system',
  },
  {
    id: 'N004',
    level: 'warning',
    title: '신규 CS 티켓 2건',
    desc: '최하은 님의 환불 요청, 윤도현 님의 계정 정지 문의가 접수됐습니다.',
    time: '12분 전',
    read: false,
    category: 'cs',
  },
  {
    id: 'N005',
    level: 'info',
    title: '대용량 Enterprise 결제',
    desc: '정태민 님이 Enterprise 플랜 ₩99,000 결제를 완료했습니다.',
    time: '18분 전',
    read: true,
    category: 'billing',
  },
  {
    id: 'N006',
    level: 'warning',
    title: 'OpenAI API 응답 지연',
    desc: 'GPT-4o 평균 응답 시간이 2.1s로 평소 대비 2.4배 증가했습니다.',
    time: '24분 전',
    read: true,
    category: 'api',
  },
  {
    id: 'N007',
    level: 'info',
    title: '신규 사용자 급증',
    desc: '오늘 신규 가입자가 143명으로 전일 대비 +38% 증가했습니다.',
    time: '1시간 전',
    read: true,
    category: 'user',
  },
  {
    id: 'N008',
    level: 'success',
    title: '정기 점검 완료',
    desc: '2026년 4월 정기 점검이 예정대로 완료됐습니다. 모든 서비스가 정상 운영 중입니다.',
    time: '2시간 전',
    read: true,
    category: 'system',
  },
  {
    id: 'N009',
    level: 'info',
    title: '쿠폰 SPRING2026 사용률 28%',
    desc: '500개 한도 중 142개가 사용됐습니다. 만료일까지 46일 남았습니다.',
    time: '3시간 전',
    read: true,
    category: 'billing',
  },
  {
    id: 'N010',
    level: 'critical',
    title: '부적절 콘텐츠 감지',
    desc: 'C-5517 콘텐츠가 AI 필터에 의해 부적절 콘텐츠로 감지됐습니다. 검수가 필요합니다.',
    time: '4시간 전',
    read: true,
    category: 'system',
  },
];

interface NotificationPanelProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
  isDark: boolean;
}

export function NotificationPanel({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  isDark,
}: NotificationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'api' | 'cs' | 'system'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'api') return n.category === 'api';
    if (filter === 'cs') return n.category === 'cs';
    if (filter === 'system') return n.category === 'system';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const np = {
    panelBg:    isDark ? 'bg-[#0f0f13]'       : 'bg-white',
    border:     isDark ? 'border-white/10'     : 'border-gray-200',
    borderSub:  isDark ? 'border-white/5'      : 'border-gray-100',
    text:       isDark ? 'text-white'          : 'text-slate-900',
    textSub:    isDark ? 'text-zinc-300'       : 'text-slate-600',
    textFaint:  isDark ? 'text-zinc-500'       : 'text-slate-500',
    tagBg:      isDark ? 'bg-zinc-800'         : 'bg-slate-100',
    tagText:    isDark ? 'text-zinc-400'       : 'text-slate-600',
    rowUnread:  isDark ? 'bg-white/[0.025] hover:bg-white/[0.04]' : 'bg-indigo-50/60 hover:bg-indigo-50',
    rowRead:    isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
    divider:    isDark ? 'divide-white/[0.03]' : 'divide-slate-100',
    filterInactive: isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    footerBtn:  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    closeBtn:   isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-800',
    deleteBtn:  isDark ? 'text-zinc-600 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600',
    shadow:     isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(0,0,0,0.12)',
  };

  const levelConfig: Record<NotifLevel, { icon: string; color: string; bg: string; border: string; dot: string }> = {
    critical: { icon: 'ri-alarm-warning-line', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', dot: 'bg-red-500' },
    warning:  { icon: 'ri-error-warning-line', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
    info:     { icon: 'ri-information-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', dot: 'bg-indigo-500' },
    success:  { icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  };

  const categoryLabel: Record<string, string> = {
    api: 'API', cs: 'CS', system: '시스템', billing: '결제', user: '사용자',
  };

  return (
    <div
      ref={panelRef}
      className={`absolute top-full right-0 mt-2 w-[380px] max-h-[600px] ${np.panelBg} border ${np.border} rounded-2xl z-50 flex flex-col overflow-hidden`}
      style={{ boxShadow: np.shadow }}
    >
      <div className={`px-4 py-3.5 border-b ${np.borderSub} flex items-center justify-between flex-shrink-0`}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex items-center justify-center">
            <i className={`ri-notification-3-line ${np.text} text-base`} />
          </div>
          <span className={`text-sm font-black ${np.text}`}>실시간 알림</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[11px] text-indigo-500 hover:text-indigo-400 cursor-pointer transition-colors whitespace-nowrap"
            >
              모두 읽음
            </button>
          )}
          <button
            onClick={onClose}
            className={`w-6 h-6 flex items-center justify-center ${np.closeBtn} cursor-pointer transition-colors`}
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] text-emerald-500 font-semibold">실시간 모니터링 중</span>
        <span className={`text-[11px] ${np.textFaint} ml-auto`}>마지막 갱신: 방금 전</span>
      </div>

      <div className={`px-4 py-2.5 border-b ${np.borderSub} flex items-center gap-1 flex-shrink-0 overflow-x-auto`}>
        {(['all', 'unread', 'api', 'cs', 'system'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all whitespace-nowrap ${
              filter === f
                ? 'bg-indigo-500 text-white'
                : np.filterInactive
            }`}
          >
            {f === 'all' ? '전체' : f === 'unread' ? `미읽음 ${unreadCount}` : f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-12 ${np.textFaint}`}>
            <i className="ri-notification-off-line text-2xl mb-2" />
            <p className="text-xs">알림이 없습니다</p>
          </div>
        ) : (
          <div className={`divide-y ${np.divider}`}>
            {filtered.map((notif) => {
              const cfg = levelConfig[notif.level];
              return (
                <div
                  key={notif.id}
                  className={`px-4 py-3.5 flex gap-3 group transition-colors cursor-pointer ${
                    notif.read ? np.rowRead : np.rowUnread
                  }`}
                  onClick={() => onMarkRead(notif.id)}
                >
                  <div className={`w-8 h-8 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <i className={`${cfg.icon} ${cfg.color} text-sm`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!notif.read && (
                          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
                        )}
                        <span className={`text-xs font-bold ${np.text} leading-tight`}>{notif.title}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(notif.id); }}
                        className={`w-5 h-5 flex items-center justify-center ${np.deleteBtn} cursor-pointer transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0`}
                      >
                        <i className="ri-close-line text-xs" />
                      </button>
                    </div>
                    <p className={`text-[11px] ${np.textSub} leading-relaxed mb-1.5`}>{notif.desc}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] ${np.tagBg} ${np.tagText} px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {notif.level === 'critical' ? '긴급' : notif.level === 'warning' ? '경고' : notif.level === 'success' ? '완료' : '정보'}
                      </span>
                      <span className={`text-[9px] ${np.tagBg} ${np.tagText} px-1.5 py-0.5 rounded-full`}>
                        {categoryLabel[notif.category]}
                      </span>
                      <span className={`text-[10px] ${np.textFaint} ml-auto`}>{notif.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`px-4 py-3 border-t ${np.borderSub} flex-shrink-0`}>
        <div className="grid grid-cols-3 gap-2 mb-2.5">
          {[
            { label: '긴급', count: notifications.filter(n => n.level === 'critical').length, color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: '경고', count: notifications.filter(n => n.level === 'warning').length, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: '정보', count: notifications.filter(n => n.level === 'info' || n.level === 'success').length, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl px-3 py-2 text-center`}>
              <p className={`text-base font-black ${s.color}`}>{s.count}</p>
              <p className={`text-[10px] ${np.textFaint}`}>{s.label}</p>
            </div>
          ))}
        </div>
        <button className={`w-full py-2 ${np.footerBtn} text-xs font-semibold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
          알림 설정 관리
        </button>
      </div>
    </div>
  );
}

export default NotificationPanel;
