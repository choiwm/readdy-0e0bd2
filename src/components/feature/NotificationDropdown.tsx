import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppNotification, NotificationType, NOTIF_CONFIG } from '@/hooks/useNotifications';

interface Props {
  notifications: AppNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

type FilterTab = 'all' | NotificationType;

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'all', label: '전체', icon: 'ri-apps-line' },
  { key: 'credit_alert', label: '크레딧', icon: 'ri-copper-diamond-line' },
  { key: 'generation_complete', label: '생성', icon: 'ri-sparkling-2-line' },
  { key: 'generation_in_progress', label: '진행 중', icon: 'ri-loader-4-line' },
  { key: 'system_notice', label: '공지', icon: 'ri-megaphone-line' },
  { key: 'feature_update', label: '업데이트', icon: 'ri-rocket-2-line' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function NotifItem({ notif, onMarkRead, onClose }: {
  notif: AppNotification;
  onMarkRead: (id: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const cfg = NOTIF_CONFIG[notif.type] ?? NOTIF_CONFIG.system_notice;
  const isInProgress = notif.type === 'generation_in_progress';
  const isFailed = notif.type === 'generation_failed';

  const handleClick = () => {
    if (!notif.is_read && !isInProgress) onMarkRead(notif.id);
    if (notif.data?.action_url && !isInProgress) {
      onClose();
      navigate(notif.data.action_url);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group flex items-start gap-3 px-4 py-3.5 border-b border-zinc-800/40 last:border-0 transition-all duration-150 ${
        isInProgress
          ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500/40'
          : isFailed
          ? 'bg-red-500/5 cursor-pointer hover:bg-red-500/10'
          : notif.is_read
          ? 'cursor-pointer hover:bg-zinc-800/25'
          : 'bg-white/[0.025] cursor-pointer hover:bg-white/[0.04]'
      }`}
    >
      {/* 아이콘 */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bgColor} transition-transform ${isInProgress ? '' : 'group-hover:scale-105'}`}>
        <i className={`${cfg.icon} ${cfg.iconColor} text-sm ${isInProgress ? 'animate-spin' : ''}`} />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={`text-xs font-bold truncate ${notif.is_read && !isInProgress ? 'text-zinc-300' : 'text-white'}`}>
              {notif.title}
            </p>
            {!notif.is_read && !isInProgress && (
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.iconColor.replace('text-', 'bg-')}`} />
            )}
            {isInProgress && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded-full">
                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                처리 중
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-600 flex-shrink-0 mt-0.5">{timeAgo(notif.created_at)}</span>
        </div>

        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{notif.message}</p>

        {/* 진행 중 프로그레스 바 */}
        {isInProgress && (
          <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full animate-[progress_2s_ease-in-out_infinite]"
              style={{ width: '60%', animation: 'indeterminate 1.5s ease-in-out infinite' }}
            />
          </div>
        )}

        {/* 타입 뱃지 + 액션 힌트 */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bgColor} ${cfg.iconColor}`}>
            {cfg.label}
          </span>
          {notif.data?.action_url && !isInProgress && (
            <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
              <i className="ri-arrow-right-s-line text-xs" />
              바로가기
            </span>
          )}
          {notif.data?.is_test && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-700/60 text-zinc-500">
              테스트
            </span>
          )}
          {isFailed && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
              재시도 필요
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationDropdown({ notifications, unreadCount, onMarkRead, onMarkAllRead, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const tabUnread = useMemo(() => {
    const counts: Partial<Record<FilterTab, number>> = { all: unreadCount };
    FILTER_TABS.slice(1).forEach(({ key }) => {
      counts[key] = notifications.filter((n) => n.type === key && !n.is_read).length;
    });
    return counts;
  }, [notifications, unreadCount]);

  const hasCreditAlert = notifications.some((n) => n.type === 'credit_alert' && !n.is_read);

  return (
    <div className="w-[340px] bg-[#18181c] border border-zinc-700/50 rounded-2xl overflow-hidden">

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black text-white">알림</p>
          {unreadCount > 0 && (
            <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white font-semibold cursor-pointer transition-colors whitespace-nowrap"
          >
            <i className="ri-check-double-line text-xs" />
            모두 읽음
          </button>
        )}
      </div>

      {/* ── 필터 탭 ── */}
      <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map((tab) => {
          const count = tabUnread[tab.key] ?? 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex-shrink-0 ${
                isActive
                  ? 'bg-zinc-700/80 text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'
              }`}
            >
              <i className={`${tab.icon} text-xs`} />
              {tab.label}
              {count > 0 && (
                <span className={`text-[9px] font-black px-1 py-0.5 rounded-full leading-none ${
                  isActive ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── 구분선 ── */}
      <div className="h-px bg-zinc-800/60 mx-0" />

      {/* ── 알림 목록 ── */}
      <div className="max-h-[360px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 flex items-center justify-center bg-zinc-800/60 rounded-2xl">
              <i className="ri-notification-off-line text-zinc-500 text-2xl" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-zinc-400">알림 없음</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                {activeTab === 'all' ? '새 알림이 없습니다' : `${FILTER_TABS.find((t) => t.key === activeTab)?.label} 알림이 없습니다`}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((notif) => (
            <NotifItem
              key={notif.id}
              notif={notif}
              onMarkRead={onMarkRead}
              onClose={onClose}
            />
          ))
        )}
      </div>

      {/* ── 하단 CTA ── */}
      {hasCreditAlert && (
        <div className="px-3 py-3 border-t border-zinc-800/60 bg-amber-500/5">
          <Link to="/credit-purchase" onClick={onClose}>
            <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/15 border border-amber-500/25 text-amber-400 text-xs font-bold rounded-xl hover:from-amber-500/30 hover:to-orange-500/25 transition-all cursor-pointer whitespace-nowrap">
              <i className="ri-copper-diamond-line text-sm" />
              크레딧 충전하러 가기
              <i className="ri-arrow-right-line text-xs" />
            </button>
          </Link>
        </div>
      )}

      {/* ── 알림 없을 때 빈 상태 하단 ── */}
      {notifications.length === 0 && (
        <div className="px-3 py-3 border-t border-zinc-800/60">
          <div className="grid grid-cols-2 gap-2">
            <Link to="/ai-create" onClick={onClose}>
              <button className="w-full flex items-center justify-center gap-1.5 py-2 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-sparkling-2-line text-xs" />
                AI Create
              </button>
            </Link>
            <Link to="/ai-sound" onClick={onClose}>
              <button className="w-full flex items-center justify-center gap-1.5 py-2 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap">
                <i className="ri-equalizer-line text-xs" />
                AI Sound
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
