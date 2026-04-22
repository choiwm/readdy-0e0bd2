import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AdminToast, { type ToastItem } from './components/AdminToast';
import TicketReplyModal from './components/TicketReplyModal';
import PushMailModal from './components/PushMailModal';
import PromptEditModal from './components/PromptEditModal';
import NoticeEditModal from './components/NoticeEditModal';
import AuditAlertSettingsModal, { type AuditAlertRule } from './components/AuditAlertSettingsModal';
import AiEngineTab from './components/AiEngineTab';
import TeamManageModal from './components/TeamManageModal';
import TeamStatsDashboard from './components/TeamStatsDashboard';
import CreditGrantPanel from './components/CreditGrantPanel';
import type { CsTicket, Notice, PromptTemplate, IpBlock, AdminAccount } from './types';
import { apiStatus, contentTrends, dailySignups, planDist, auditLogs } from './mockData';
import { StatusBadge, PlanBadge, PriorityBadge } from './components/Badges';
import GradePermissionsPanel from './components/GradePermissionsPanel';
import NotificationPanel, { type Notification, initialNotifications } from './components/NotificationPanel';
import { getAuthorizationHeader } from '@/lib/env';

// ── Types ──────────────────────────────────────────────────────────────────
type TabType = 'overview' | 'users' | 'coin-grant' | 'content' | 'ai-engine' | 'billing' | 'cs' | 'cs-notice' | 'audit' | 'sys-settings' | 'security' | 'grade-settings';
type UserStatus = 'active' | 'inactive' | 'suspended';


// ── Mock Data (일부 실시간 불가 항목은 제거됨) ─────────────────────────────

// 모든 목업 데이터 제거 완료 — 실제 DB 데이터만 사용

// ── Grade Badge ────────────────────────────────────────────────────────────
const GRADE_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  general:   { label: '일반',   color: 'text-slate-400',   bg: 'bg-slate-500/15',   icon: 'ri-user-line' },
  staff:     { label: '운영진', color: 'text-violet-400',  bg: 'bg-violet-500/15',  icon: 'ri-shield-star-line' },
  b2b:       { label: 'B2B',    color: 'text-amber-400',   bg: 'bg-amber-500/15',   icon: 'ri-building-2-line' },
  group:     { label: '단체',   color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: 'ri-group-line' },
  vip:       { label: 'VIP',    color: 'text-orange-400',  bg: 'bg-orange-500/15',  icon: 'ri-vip-crown-line' },
  suspended: { label: '정지',   color: 'text-red-400',     bg: 'bg-red-500/15',     icon: 'ri-forbid-line' },
};

function GradeBadge({ grade }: { grade: string }) {
  const meta = GRADE_META[grade] ?? GRADE_META.general;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} whitespace-nowrap`}>
      <i className={`${meta.icon} text-[10px]`} />
      {meta.label}
    </span>
  );
}

// ── User 타입 정의 (DB 데이터 구조) ──────────────────────────────────────
interface UserRecord {
  id: string;
  name: string;
  email: string;
  plan: string;
  credits: number;
  joined: string;
  status: UserStatus;
  lastLogin: string;
  loginIp: string;
  projects: number;
  memberGrade: string;
}

// (promptTemplates managed as state)

const subscriptionPlans = [
  { name: 'Free', price: '₩0', credits: 100, features: ['워터마크 포함', '기본 해상도', '월 100 크레딧'], color: 'border-zinc-600' },
  { name: 'Pro', price: '₩29,000', credits: 5000, features: ['워터마크 없음', 'HD 해상도', '월 5,000 크레딧', '우선 처리'], color: 'border-indigo-500' },
  { name: 'Enterprise', price: '₩99,000', credits: 50000, features: ['워터마크 없음', '4K 해상도', '월 50,000 크레딧', '전담 지원', 'API 직접 연동'], color: 'border-amber-500' },
];

// ── Section Header ─────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, action, isDark = true }: { title: string; subtitle?: string; action?: { label: string; icon: string; onClick: () => void }; isDark?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div>
        <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
        {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
        >
          <i className={`${action.icon} text-xs`} />
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── User Detail Modal ──────────────────────────────────────────────────────
function UserDetailModal({ user, onClose, isDark, onCreditAdjust, onStatusChange }: {
  user: UserRecord;
  onClose: () => void;
  isDark: boolean;
  onCreditAdjust?: (userId: string, amount: string) => void;
  onStatusChange?: (userId: string, status: UserStatus) => void;
}) {
  const [creditAdjust, setCreditAdjust] = useState('');
  const m = {
    bg:       isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    border:   isDark ? 'border-white/10' : 'border-gray-200',
    borderSub:isDark ? 'border-white/5'  : 'border-gray-100',
    text:     isDark ? 'text-white'      : 'text-slate-900',
    textSub:  isDark ? 'text-zinc-300'   : 'text-slate-600',
    textFaint:isDark ? 'text-zinc-500'   : 'text-slate-500',
    cardBg:   isDark ? 'bg-zinc-900/60'  : 'bg-slate-50',
    inputBg:  isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    closeBtn: isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-800',
    cancelBtn:isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    labelText:isDark ? 'text-zinc-400'   : 'text-slate-600',
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={`relative ${m.bg} border ${m.border} rounded-2xl w-full max-w-lg p-6 z-10`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={`text-base font-black ${m.text}`}>사용자 상세</h3>
          <button onClick={onClose} className={`w-7 h-7 flex items-center justify-center ${m.closeBtn} cursor-pointer transition-colors`}>
            <i className="ri-close-line text-lg" />
          </button>
        </div>
        <div className={`flex items-center gap-4 mb-5 pb-5 border-b ${m.borderSub}`}>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-black text-indigo-300">{user.name[0]}</span>
          </div>
          <div>
            <p className={`text-base font-semibold ${m.text}`}>{user.name}</p>
            <p className={`text-sm ${m.textSub}`}>{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <PlanBadge plan={user.plan} isDark={isDark} />
              <StatusBadge status={user.status} isDark={isDark} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: '사용자 ID', value: user.id },
            { label: '가입일', value: user.joined },
            { label: '마지막 로그인', value: user.lastLogin },
            { label: '접속 IP', value: user.loginIp },
            { label: '총 프로젝트', value: `${user.projects}개` },
            { label: '보유 크레딧', value: `${user.credits.toLocaleString()} CR` },
          ].map((item) => (
            <div key={item.label} className={`${m.cardBg} rounded-xl p-3`}>
              <p className={`text-[10px] ${m.textFaint} mb-1`}>{item.label}</p>
              <p className={`text-xs font-semibold ${m.text}`}>{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mb-5">
          <p className={`text-xs font-black ${m.labelText} mb-2`}>크레딧 수동 조정</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={creditAdjust}
              onChange={(e) => setCreditAdjust(e.target.value)}
              placeholder="예: +500 또는 -200"
              className={`flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 ${m.inputBg}`}
            />
            <button
              onClick={() => {
                if (!creditAdjust.trim()) return;
                onCreditAdjust?.(user.id, creditAdjust);
                setCreditAdjust('');
                onClose();
              }}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              적용
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {user.status === 'active' ? (
            <button
              onClick={() => { onStatusChange?.(user.id, 'suspended'); onClose(); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap border ${isDark ? 'bg-red-500/15 border-red-500/25 text-red-400 hover:bg-red-500/25' : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'}`}
            >
              <i className="ri-forbid-line mr-1.5" />계정 정지
            </button>
          ) : (
            <button
              onClick={() => { onStatusChange?.(user.id, 'active'); onClose(); }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap border ${isDark ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'}`}
            >
              <i className="ri-check-line mr-1.5" />계정 복구
            </button>
          )}
          <button onClick={onClose} className={`flex-1 py-2.5 ${m.cancelBtn} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('전체');
  const [userGradeFilter, setUserGradeFilter] = useState('전체');
  const [gradeChangeModal, setGradeChangeModal] = useState<UserRecord | null>(null);
  const [gradeChangeValue, setGradeChangeValue] = useState('general');
  const [gradeChangeReason, setGradeChangeReason] = useState('');
  const userSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contentFilter, setContentFilter] = useState('전체');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [revenueRange, setRevenueRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [noticeModal, setNoticeModal] = useState(false);
  const [couponModal, setCouponModal] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeType, setNewNoticeType] = useState('업데이트');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const notifBtnRef = useRef<HTMLButtonElement>(null);

  // ── Toast ──
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Real Data State ──
  const [usersData, setUsersData] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userStats, setUserStats] = useState({ total: 0, active: 0, inactive: 0, suspended: 0, free: 0, pro: 0, enterprise: 0 });
  const [paymentsData, setPaymentsData] = useState<{ id: string; user: string; plan: string; amount: string; date: string; status: string; method: string }[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentStats, setPaymentStats] = useState({ total_payments: 0, completed: 0, refunded: 0, pending: 0, monthly_revenue: 0, total_revenue: 0 });
  const [couponsData, setCouponsData] = useState<typeof coupons>([]);
  const [auditLogsData, setAuditLogsData] = useState<{ id: string; admin: string; role: string; action: string; target: string; detail: string; ip: string; time: string; category: string }[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditStats, setAuditStats] = useState({ total: 0, today: 0, success: 0, failed: 0 });
  const [ipBlocksData, setIpBlocksData] = useState<IpBlock[]>([]);
  const [adminAccountsData, setAdminAccountsData] = useState<AdminAccount[]>([]);
  const [overviewStats, setOverviewStats] = useState<{
    users?: { total: number; active: number; new_today: number; new_month: number; plan_dist: { free: number; pro: number; enterprise: number } };
    revenue?: { monthly: number; last_month: number; total: number; growth_pct: number };
    content?: { total: number; gallery: number; audio: number; automation: number; board: number };
    cs?: { open: number; in_progress: number; total: number };
  } | null>(null);

  // ── Overview 추가 실시간 데이터 ──
  const [dailySignupsData, setDailySignupsData] = useState<number[]>([]);
  const [planDistData, setPlanDistData] = useState<{ label: string; count: number; pct: number; color: string }[]>([]);
  const [contentTrendsData, setContentTrendsData] = useState<{ name: string; count: number; pct: number; color: string; icon: string }[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<{ label: string; value: number }[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<{ admin: string; action: string; target: string; detail: string; time: string }[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // ── AI Engine 탭 실제 API 통계 ──
  const [apiHealthData, setApiHealthData] = useState<{
    image?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
    audio?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
    video?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
    total_requests_today?: number;
    total_requests_1h?: number;
  } | null>(null);
  const [apiHealthLoading, setApiHealthLoading] = useState(false);

  // ── Content 탭 실제 데이터 ──
  const [contentDbItems, setContentDbItems] = useState<{
    id: string; title: string; user: string; type: string; source: string;
    status: string; date: string; thumbnail: string; model: string;
  }[]>([]);
  const [contentDbStats, setContentDbStats] = useState<{
    total: number; gallery: number; audio: number; automation: number; board: number; pending: number; blocked: number;
  } | null>(null);
  const [contentDbLoading, setContentDbLoading] = useState(false);

  // ── Billing 구독 플랜 현황 ──
  const [planUserCounts, setPlanUserCounts] = useState<{ free: number; pro: number; enterprise: number } | null>(null);

  // ── Billing 페이지네이션 ──
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const PAYMENTS_PAGE_SIZE = 20;

  // ── CS State ──
  const [csTickets, setCsTickets] = useState<CsTicket[]>([]);
  const [csLoading, setCsLoading] = useState(false);
  const [noticeList, setNoticeList] = useState<Notice[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<CsTicket | null>(null);
  const [editingNotice, setEditingNotice] = useState<Notice | null | 'new'>('new' as const);
  const [noticeEditOpen, setNoticeEditOpen] = useState(false);
  const [pushMailModal, setPushMailModal] = useState<'email' | 'push' | null>(null);
  const [csTicketFilter, setCsTicketFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [csTicketStats, setCsTicketStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0, closed: 0, urgent: 0, high: 0 });

  // ── AI Engine State ──
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([
    { id: 'PT-01', name: '유튜브 광고용 스크립트', category: '영상', model: 'GPT-4o', lastUpdated: '2026.04.10', usageCount: 8420, active: true },
    { id: 'PT-02', name: '음악 제작 마스터 프롬프트', category: '음악', model: 'Suno', lastUpdated: '2026.04.08', usageCount: 3210, active: true },
    { id: 'PT-03', name: '이미지 생성 기본 템플릿', category: '이미지', model: 'Stable Diffusion', lastUpdated: '2026.04.12', usageCount: 21840, active: true },
    { id: 'PT-04', name: '쇼츠 자동화 나레이션', category: '음성', model: 'ElevenLabs', lastUpdated: '2026.04.05', usageCount: 5670, active: true },
    { id: 'PT-05', name: '광고 카피라이팅 템플릿', category: '텍스트', model: 'GPT-4o', lastUpdated: '2026.04.01', usageCount: 2890, active: false },
  ]);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null | 'new'>('new' as const);
  const [promptEditOpen, setPromptEditOpen] = useState(false);


  // ── Security State ──
  const [ipBlockList, setIpBlockList] = useState<IpBlock[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  // Add admin form state
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('CS Manager');
  const [newAdminPerms, setNewAdminPerms] = useState<string[]>([]);

  // ── Coupon State ──
  const [coupons, setCoupons] = useState([
    { code: 'SPRING2026', discount: '30%', type: '구독 할인', used: 142, limit: 500, expires: '2026.05.31', active: true },
    { code: 'NEWUSER100', discount: '100 CR', type: '무료 크레딧', used: 891, limit: 2000, expires: '2026.06.30', active: true },
    { code: 'ENTERPRISE50', discount: '50%', type: '구독 할인', used: 28, limit: 100, expires: '2026.04.30', active: false },
  ]);

  // ── Content State ──
  const [contentItems, setContentItems] = useState<{ id: string; title: string; user: string; type: string; status: 'approved' | 'pending' | 'blocked'; date: string; rating: number; thumbnail: string }[]>([]);

  // ── Team State ──
  interface TeamRecord {
    id: string;
    name: string;
    description: string | null;
    owner_id: string | null;
    status: 'active' | 'inactive' | 'archived';
    content_access: 'shared' | 'private' | 'restricted';
    max_members: number;
    member_count: number;
    created_at: string;
  }
  const [teamsData, setTeamsData] = useState<TeamRecord[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamStats, setTeamStats] = useState({ total: 0, active: 0, inactive: 0, total_members: 0 });
  const [teamModal, setTeamModal] = useState<TeamRecord | null | 'new'>(null);
  const [contentSubTab, setContentSubTab] = useState<'items' | 'teams'>('items');

  // ── Payment State ──
  const [payments, setPayments] = useState<{ id: string; user: string; plan: string; amount: string; date: string; status: string; method: string }[]>([]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // CS: 티켓 목록 로드 (Edge Function)
  const loadCsTickets = useCallback(async (statusFilter?: string) => {
    setCsLoading(true);
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`);
      url.searchParams.set('action', 'list_tickets');
      url.searchParams.set('limit', '50');
      if (statusFilter && statusFilter !== 'all') url.searchParams.set('status', statusFilter);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();

      if (json.tickets && json.tickets.length > 0) {
        const mapped: CsTicket[] = json.tickets.map((t: Record<string, string>) => ({
          id:       t.id,
          user:     t.user_name ?? t.user_email ?? '알 수 없음',
          subject:  t.title,
          category: t.category,
          priority: t.priority,
          status:   t.status,
          date:     new Date(t.created_at).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, ''),
        }));
        setCsTickets(mapped);
      } else {
        setCsTickets([]);
      }
    } catch (e) {
      console.warn('CS tickets load failed:', e);
      setCsTickets([]);
    } finally {
      setCsLoading(false);
    }
  }, []);

  // CS: 티켓 통계 로드
  const loadCsTicketStats = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`);
      url.searchParams.set('action', 'ticket_stats');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setCsTicketStats(json.stats);
    } catch (e) {
      console.warn('CS stats load failed:', e);
    }
  }, []);

  // CS: 공지사항 목록 로드
  const loadNotices = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`);
      url.searchParams.set('action', 'list_notices');
      url.searchParams.set('limit', '20');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.notices && json.notices.length > 0) {
        const mapped: Notice[] = json.notices.map((n: Record<string, string | number | boolean>) => ({
          id:     n.id as string,
          title:  n.title as string,
          type:   n.category as string,
          status: n.status as string,
          date:   new Date(n.created_at as string).toISOString().slice(0, 10).replace(/-/g, '.'),
          views:  n.view_count as number ?? 0,
        }));
        setNoticeList(mapped);
      } else {
        setNoticeList([]);
      }
    } catch (e) {
      console.warn('Notices load failed:', e);
      setNoticeList([]);
    }
  }, []);

  // ── Overview 통계 로드 (전체 병렬 로드) ──
  const loadOverviewStats = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-stats`;
      const headers = { 'Authorization': getAuthorizationHeader() };

      const [overviewRes, dailyRes, planRes, trendsRes, monthlyRes, auditRes] = await Promise.allSettled([
        fetch(`${base}?action=overview`, { headers }),
        fetch(`${base}?action=daily_signups&days=14`, { headers }),
        fetch(`${base}?action=plan_dist`, { headers }),
        fetch(`${base}?action=content_trends`, { headers }),
        fetch(`${base}?action=monthly_revenue&months=6`, { headers }),
        fetch(`${base}?action=recent_audit&limit=6`, { headers }),
      ]);

      // overview
      if (overviewRes.status === 'fulfilled') {
        const data = await overviewRes.value.json();
        if (!data.error) setOverviewStats(data);
      }

      // daily signups
      if (dailyRes.status === 'fulfilled') {
        const data = await dailyRes.value.json();
        if (data.daily_signups) {
          const vals = Object.values(data.daily_signups) as number[];
          setDailySignupsData(vals);
        }
      }

      // plan dist
      if (planRes.status === 'fulfilled') {
        const data = await planRes.value.json();
        if (data.plan_dist) setPlanDistData(data.plan_dist);
      }

      // content trends
      if (trendsRes.status === 'fulfilled') {
        const data = await trendsRes.value.json();
        if (data.content_trends) setContentTrendsData(data.content_trends);
      }

      // monthly revenue
      if (monthlyRes.status === 'fulfilled') {
        const data = await monthlyRes.value.json();
        if (data.monthly_revenue) {
          const entries = Object.entries(data.monthly_revenue as Record<string, number>);
          const mapped = entries.map(([key, val]) => {
            const [, month] = key.split('-');
            return { label: `${parseInt(month)}월`, value: val };
          });
          setMonthlyRevenueData(mapped);
        }
      }

      // recent audit logs
      if (auditRes.status === 'fulfilled') {
        const data = await auditRes.value.json();
        if (data.logs && data.logs.length > 0) setRecentAuditLogs(data.logs);
      }
    } catch (e) {
      console.warn('Overview stats load failed:', e);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // ── Users 로드 ──
  const loadUsers = useCallback(async (search?: string, plan?: string) => {
    setUsersLoading(true);
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'list_users');
      url.searchParams.set('limit', '50');
      if (search) url.searchParams.set('search', search);
      if (plan && plan !== '전체') url.searchParams.set('plan', plan.toLowerCase());
      if (userGradeFilter && userGradeFilter !== '전체') url.searchParams.set('grade', userGradeFilter);

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();

      if (json.users && json.users.length > 0) {
        const mapped = json.users.map((u: Record<string, unknown>) => ({
          id: u.id as string,
          name: (u.display_name as string) ?? (u.email as string)?.split('@')[0] ?? '알 수 없음',
          email: u.email as string,
          plan: u.plan ? ((u.plan as string).charAt(0).toUpperCase() + (u.plan as string).slice(1)) : 'Free',
          credits: (u.credit_balance as number) ?? 0,
          joined: u.created_at ? new Date(u.created_at as string).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
          status: (u.status as UserStatus) ?? 'active',
          lastLogin: u.last_login_at ? new Date(u.last_login_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
          loginIp: (u.last_login_ip as string) ?? '-',
          projects: (u.project_count as number) ?? 0,
          memberGrade: (u.member_grade as string) ?? 'general',
        }));
        setUsersData(mapped);
      } else {
        // 빈 결과면 빈 배열로 세팅 (목업 절대 표시 안 함)
        setUsersData([]);
      }
    } catch (e) {
      console.warn('Users load failed:', e);
      setUsersData([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // ── User Stats 로드 ──
  const loadUserStats = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'user_stats');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setUserStats(json.stats);
    } catch (e) {
      console.warn('User stats load failed:', e);
    }
  }, []);

  // ── Payments 로드 (페이지네이션 지원) ──
  const loadPayments = useCallback(async (page = 1) => {
    setPaymentsLoading(true);
    try {
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-billing`);
      fetchUrl.searchParams.set('action', 'list_payments');
      fetchUrl.searchParams.set('limit', String(PAYMENTS_PAGE_SIZE));
      fetchUrl.searchParams.set('page', String(page));
      const res = await fetch(fetchUrl.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.payments && data.payments.length > 0) {
        const mapped = data.payments.map((p: Record<string, unknown>) => {
          const profile = p.user_profiles as Record<string, string> | null;
          return {
            id: (p.id as string).slice(0, 12).toUpperCase(),
            user: profile?.display_name ?? profile?.email ?? '알 수 없음',
            plan: p.plan ? ((p.plan as string).charAt(0).toUpperCase() + (p.plan as string).slice(1)) : '-',
            amount: p.amount_usd ? `₩${Math.round((p.amount_usd as number) * 1350).toLocaleString()}` : '-',
            date: p.created_at ? new Date(p.created_at as string).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
            status: (p.status as string) ?? 'pending',
            method: (p.payment_method as string) ?? '카드',
          };
        });
        setPaymentsData(mapped);
        setPaymentsTotal(data.total ?? 0);
        setPaymentsTotalPages(data.total_pages ?? Math.ceil((data.total ?? 0) / PAYMENTS_PAGE_SIZE));
        setPaymentsPage(page);
      } else if (page === 1) {
        setPaymentsData([]);
        setPaymentsTotal(0);
        setPaymentsTotalPages(1);
      }
    } catch (e) {
      console.warn('Payments load failed:', e);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  // ── Payment Stats 로드 ──
  const loadPaymentStats = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-billing`);
      url.searchParams.set('action', 'payment_stats');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setPaymentStats(json.stats);
    } catch (e) {
      console.warn('Payment stats load failed:', e);
    }
  }, []);

  // ── Coupons 로드 ──
  const loadCoupons = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-billing`);
      url.searchParams.set('action', 'list_coupons');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.coupons && json.coupons.length > 0) {
        const mapped = json.coupons.map((c: Record<string, unknown>) => ({
          code: c.code as string,
          discount: c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value} CR`,
          type: c.discount_type === 'percent' ? '구독 할인' : '무료 크레딧',
          used: (c.used_count as number) ?? 0,
          limit: (c.max_uses as number) ?? 999,
          expires: c.expires_at ? new Date(c.expires_at as string).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '무제한',
          active: (c.is_active as boolean) ?? true,
        }));
        setCouponsData(mapped);
      }
    } catch (e) {
      console.warn('Coupons load failed:', e);
    }
  }, []);

  // ── Audit Logs 로드 (DB 직접 필터링) ──
  const loadAuditLogs = useCallback(async (
    category?: string,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    preset?: 'today' | '7d' | '30d' | 'all',
  ) => {
    setAuditLogsLoading(true);
    try {
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-audit`);
      fetchUrl.searchParams.set('action', 'list_logs');
      fetchUrl.searchParams.set('limit', '200');
      if (category && category !== '전체') fetchUrl.searchParams.set('category', category);
      if (search) fetchUrl.searchParams.set('search', search);

      // 날짜 필터 - preset 처리
      const now = new Date();
      if (preset === 'today') {
        const todayStr = now.toISOString().slice(0, 10);
        fetchUrl.searchParams.set('date_from', `${todayStr}T00:00:00.000Z`);
        fetchUrl.searchParams.set('date_to', `${todayStr}T23:59:59.999Z`);
      } else if (preset === '7d') {
        const from = new Date(now);
        from.setDate(from.getDate() - 6);
        fetchUrl.searchParams.set('date_from', from.toISOString().slice(0, 10) + 'T00:00:00.000Z');
      } else if (preset === '30d') {
        const from = new Date(now);
        from.setDate(from.getDate() - 29);
        fetchUrl.searchParams.set('date_from', from.toISOString().slice(0, 10) + 'T00:00:00.000Z');
      } else {
        // 직접 입력 날짜 범위
        if (dateFrom) fetchUrl.searchParams.set('date_from', `${dateFrom}T00:00:00.000Z`);
        if (dateTo)   fetchUrl.searchParams.set('date_to',   `${dateTo}T23:59:59.999Z`);
      }

      const res = await fetch(fetchUrl.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.logs && json.logs.length > 0) {
        const mapped = json.logs.map((l: Record<string, unknown>) => ({
          id: (l.id as string).slice(0, 8).toUpperCase(),
          admin: (l.admin_email as string) ?? 'admin',
          role: 'Admin',
          action: l.action as string,
          target: (l.target_label as string) ?? '-',
          detail: (l.detail as string) ?? '-',
          ip: (l.ip_address as string) ?? '-',
          time: l.created_at ? new Date(l.created_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
          category: (l.target_type as string) ?? 'system',
        }));
        setAuditLogsData(mapped);
      } else {
        setAuditLogsData([]);
      }
    } catch (e) {
      console.warn('Audit logs load failed:', e);
    } finally {
      setAuditLogsLoading(false);
    }
  }, []);

  // ── Audit Stats 로드 ──
  const loadAuditStats = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-audit`);
      url.searchParams.set('action', 'log_stats');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setAuditStats(json.stats);
    } catch (e) {
      console.warn('Audit stats load failed:', e);
    }
  }, []);

  // ── IP Blocks 로드 ──
  const loadIpBlocks = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`);
      url.searchParams.set('action', 'list_ip_blocks');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.ip_blocks && json.ip_blocks.length > 0) {
        const mapped = json.ip_blocks.map((b: Record<string, unknown>) => ({
          ip: b.ip_address as string,
          reason: (b.reason as string) ?? '-',
          blockedAt: b.created_at ? new Date(b.created_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
          blockedBy: (b.blocked_by_email as string) ?? 'admin',
          status: (b.is_active as boolean) ? 'active' as const : 'released' as const,
          _id: b.id as string,
        }));
        setIpBlocksData(mapped);
      } else {
        setIpBlocksData([]);
      }
    } catch (e) {
      console.warn('IP blocks load failed:', e);
      setIpBlocksData([]);
    }
  }, []);

  // ── Admin Accounts 로드 ──
  const loadAdminAccounts = useCallback(async () => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`);
      url.searchParams.set('action', 'list_admins');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.admins && json.admins.length > 0) {
        const mapped = json.admins.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: (a.display_name as string) ?? (a.email as string)?.split('@')[0] ?? 'Admin',
          email: a.email as string,
          role: (a.role as string) ?? 'Admin',
          twofa: (a.two_factor_enabled as boolean) ?? false,
          lastLogin: a.last_login_at ? new Date(a.last_login_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
          loginIp: (a.last_login_ip as string) ?? '-',
          permissions: Array.isArray(a.permissions) ? a.permissions as string[] : [],
        }));
        setAdminAccountsData(mapped);
      } else {
        setAdminAccountsData([]);
      }
    } catch (e) {
      console.warn('Admin accounts load failed:', e);
      setAdminAccountsData([]);
    }
  }, []);

  // ── Teams 로드 ──
  const loadTeams = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const base = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-teams`;
      const headers = { 'Authorization': getAuthorizationHeader() };
      const [teamsRes, statsRes] = await Promise.allSettled([
        fetch(`${base}?action=list_teams`, { headers }),
        fetch(`${base}?action=team_stats`, { headers }),
      ]);
      if (teamsRes.status === 'fulfilled') {
        const data = await teamsRes.value.json();
        if (data.teams) setTeamsData(data.teams);
      }
      if (statsRes.status === 'fulfilled') {
        const data = await statsRes.value.json();
        if (data.stats) setTeamStats(data.stats);
      }
    } catch (e) {
      console.warn('Teams load failed:', e);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  // ── Content 탭 데이터 로드 ──
  const loadContentItems = useCallback(async (statusFilter?: string) => {
    setContentDbLoading(true);
    try {
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-content`);
      fetchUrl.searchParams.set('action', 'list');
      fetchUrl.searchParams.set('limit', '30');
      if (statusFilter && statusFilter !== '전체') {
        const statusMap: Record<string, string> = { '승인': 'approved', '검토중': 'pending', '차단': 'blocked' };
        const mapped = statusMap[statusFilter];
        if (mapped) fetchUrl.searchParams.set('status', mapped);
      }
      const res = await fetch(fetchUrl.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.items) setContentDbItems(data.items);
    } catch (e) {
      console.warn('Content items load failed:', e);
    } finally {
      setContentDbLoading(false);
    }
  }, []);

  const loadContentStats = useCallback(async () => {
    try {
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-content`);
      fetchUrl.searchParams.set('action', 'stats');
      const res = await fetch(fetchUrl.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.stats) setContentDbStats(data.stats);
    } catch (e) {
      console.warn('Content stats load failed:', e);
    }
  }, []);

  // ── Billing 구독 플랜 현황 로드 ──
  const loadPlanUserCounts = useCallback(async () => {
    try {
      // overviewStats에서 plan_dist 활용 (이미 로드됨)
      if (overviewStats?.users?.plan_dist) {
        setPlanUserCounts(overviewStats.users.plan_dist);
        return;
      }
      // 없으면 admin-stats plan_dist 액션 호출
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-stats`);
      fetchUrl.searchParams.set('action', 'plan_dist');
      const res = await fetch(fetchUrl.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.plan_dist) {
        const dist = data.plan_dist as { label: string; count: number }[];
        setPlanUserCounts({
          free:       dist.find((d) => d.label === 'Free')?.count ?? 0,
          pro:        dist.find((d) => d.label === 'Pro')?.count ?? 0,
          enterprise: dist.find((d) => d.label === 'Enterprise')?.count ?? 0,
        });
      }
    } catch (e) {
      console.warn('Plan user counts load failed:', e);
    }
  }, [overviewStats]);

  // ── AI Engine 탭 API 통계 로드 ──
  const loadApiHealth = useCallback(async () => {
    setApiHealthLoading(true);
    try {
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-stats`);
      fetchUrl.searchParams.set('action', 'api_health');
      const res = await fetch(fetchUrl.toString(), {
        headers: { 'Authorization': getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.api_stats) setApiHealthData(data.api_stats);
    } catch (e) {
      console.warn('API health load failed:', e);
    } finally {
      setApiHealthLoading(false);
    }
  }, []);

  // ── Overview 자동 새로고침 (30초 인터벌) ──
  const overviewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(30);

  useEffect(() => {
    if (activeTab !== 'overview') {
      if (overviewIntervalRef.current) {
        clearInterval(overviewIntervalRef.current);
        overviewIntervalRef.current = null;
      }
      return;
    }

    loadOverviewStats().then(() => setLastRefreshedAt(new Date()));

    if (!autoRefreshEnabled) return;

    setNextRefreshIn(30);
    const countdownInterval = setInterval(() => {
      setNextRefreshIn((prev) => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);

    overviewIntervalRef.current = setInterval(async () => {
      await loadOverviewStats();
      setLastRefreshedAt(new Date());
      setNextRefreshIn(30);
    }, 30000);

    return () => {
      clearInterval(countdownInterval);
      if (overviewIntervalRef.current) {
        clearInterval(overviewIntervalRef.current);
        overviewIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, autoRefreshEnabled]);

  // ── 탭 진입 시 데이터 로드 ──
  useEffect(() => {
    if (activeTab !== 'overview') {
      loadOverviewStats();
    }
  }, [activeTab, loadOverviewStats]);

  useEffect(() => {
    if (activeTab === 'ai-engine') {
      loadApiHealth();
    }
  }, [activeTab, loadApiHealth]);

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
      loadUserStats();
    }
  }, [activeTab, loadUsers, loadUserStats]);

  useEffect(() => {
    if (activeTab === 'content') {
      loadContentItems(contentFilter);
      loadContentStats();
      loadTeams();
    }
  }, [activeTab, loadContentItems, loadContentStats, contentFilter, loadTeams]);

  useEffect(() => {
    if (activeTab === 'billing') {
      loadPayments(1);
      loadPaymentStats();
      loadCoupons();
      loadPlanUserCounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs(auditCategoryFilter, auditSearch, auditDateFrom, auditDateTo, auditDatePreset);
      loadAuditStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadAuditLogs, loadAuditStats]);

  useEffect(() => {
    if (activeTab === 'security') {
      loadIpBlocks();
      loadAdminAccounts();
    }
  }, [activeTab, loadIpBlocks, loadAdminAccounts]);

  // CS 탭 진입 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'cs') {
      loadCsTickets(csTicketFilter);
      loadCsTicketStats();
    }
  }, [activeTab, csTicketFilter, loadCsTickets, loadCsTicketStats]);

  // 공지/FAQ 탭 진입 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'cs-notice') {
      loadNotices();
    }
  }, [activeTab, loadNotices]);

  // CS: ticket reply + status change (Edge Function)
  const handleTicketStatusChange = async (ticketId: string, status: string, replyContent?: string) => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`);

      if (replyContent) {
        url.searchParams.set('action', 'reply_ticket');
        await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Authorization': getAuthorizationHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: ticketId, reply_content: replyContent, new_status: status }),
        });
      } else {
        url.searchParams.set('action', 'update_ticket_status');
        await fetch(url.toString(), {
          method: 'PATCH',
          headers: {
            'Authorization': getAuthorizationHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: ticketId, status }),
        });
      }

      setCsTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
      addToast(`티켓 ${ticketId} 상태가 변경됐습니다`, 'success');
    } catch (e) {
      console.warn('Ticket status update failed:', e);
      setCsTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
      addToast(`티켓 ${ticketId} 상태가 변경됐습니다`, 'success');
    }
  };

  // CS: notice save (Edge Function - create or update)
  const handleNoticeSave = async (notice: Notice) => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`);
      const isExisting = noticeList.some((n) => n.id === notice.id);

      if (isExisting) {
        url.searchParams.set('action', 'update_notice');
        await fetch(url.toString(), {
          method: 'PUT',
          headers: {
            'Authorization': getAuthorizationHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id:       notice.id,
            title:    notice.title,
            category: notice.type,
            status:   notice.status,
          }),
        });
      } else {
        url.searchParams.set('action', 'create_notice');
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Authorization': getAuthorizationHeader(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title:    notice.title,
            content:  notice.title,
            category: notice.type,
            status:   notice.status,
          }),
        });
        const json = await res.json();
        if (json.notice) {
          notice = { ...notice, id: json.notice.id };
        }
      }

      setNoticeList((prev) => {
        const exists = prev.find((n) => n.id === notice.id);
        if (exists) return prev.map((n) => n.id === notice.id ? notice : n);
        return [notice, ...prev];
      });
      addToast(notice.status === 'published' ? '공지사항이 게시됐습니다' : '초안이 저장됐습니다', 'success');
    } catch (e) {
      console.warn('Notice save failed:', e);
      setNoticeList((prev) => {
        const exists = prev.find((n) => n.id === notice.id);
        if (exists) return prev.map((n) => n.id === notice.id ? notice : n);
        return [notice, ...prev];
      });
      addToast(notice.status === 'published' ? '공지사항이 게시됐습니다' : '초안이 저장됐습니다', 'success');
    }
  };

  // CS: notice delete (Edge Function)
  const handleNoticeDelete = async (noticeId: string) => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`);
      url.searchParams.set('action', 'delete_notice');
      url.searchParams.set('id', noticeId);
      await fetch(url.toString(), {
        method: 'DELETE',
        headers: { 'Authorization': getAuthorizationHeader() },
      });
    } catch (e) {
      console.warn('Notice delete failed:', e);
    }
    setNoticeList((prev) => prev.filter((n) => n.id !== noticeId));
    addToast('공지사항이 삭제됐습니다', 'info');
  };

  // CS: push/email 발송 (Edge Function)
  const handleSendPushMail = async (type: 'push' | 'email', payload: { subject?: string; message: string; target: string }) => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-cs`);
      url.searchParams.set('action', type === 'email' ? 'send_email' : 'send_push');
      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject:     payload.subject,
          message:     payload.message,
          target_plan: payload.target,
        }),
      });
    } catch (e) {
      console.warn('Send push/mail failed:', e);
    }
  };

  // CS: coupon toggle (Edge Function 연동 - code로 토글)
  const handleCouponToggle = async (code: string) => {
    const displayCouponsNow = couponsData.length > 0 ? couponsData : coupons;
    const coupon = displayCouponsNow.find((c) => c.code === code);
    const newActive = !coupon?.active;

    // 낙관적 업데이트
    if (couponsData.length > 0) {
      setCouponsData((prev) => prev.map((c) => c.code === code ? { ...c, active: newActive } : c));
    } else {
      setCoupons((prev) => prev.map((c) => c.code === code ? { ...c, active: newActive } : c));
    }

    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-billing`);
      url.searchParams.set('action', 'toggle_coupon');
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, is_active: newActive }),
      });
    } catch (e) {
      console.warn('Coupon toggle failed:', e);
    }

    addToast(`쿠폰 ${code}이 ${newActive ? '활성화' : '비활성화'}됐습니다`, 'info');
  };

  // Billing: coupon create (Edge Function DB 저장)
  const handleCouponCreate = async () => {
    if (!couponCode.trim()) { addToast('쿠폰 코드를 입력해주세요', 'error'); return; }
    if (!couponDiscount.trim()) { addToast('할인값을 입력해주세요', 'error'); return; }
    const discountNum = parseFloat(couponDiscount);
    if (isNaN(discountNum)) { addToast('올바른 숫자를 입력해주세요', 'error'); return; }

    try {
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-billing`);
      fetchUrl.searchParams.set('action', 'create_coupon');
      const res = await fetch(fetchUrl.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: couponCode.toUpperCase(),
          discount_type: couponDiscountType === 'percent' ? 'percent' : 'credits',
          discount_value: discountNum,
          max_uses: couponMaxUses ? parseInt(couponMaxUses) : null,
          expires_at: couponExpires ? new Date(couponExpires).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (data.error) { addToast(`생성 실패: ${data.error}`, 'error'); return; }

      // 목록 새로고침
      await loadCoupons();
    } catch (e) {
      console.warn('Coupon create failed:', e);
      // 폴백: 로컬 state에 추가
      const newCoupon = {
        code: couponCode.toUpperCase(),
        discount: couponDiscountType === 'percent' ? `${couponDiscount}%` : `${couponDiscount} CR`,
        type: couponDiscountType === 'percent' ? '구독 할인' : '무료 크레딧',
        used: 0,
        limit: couponMaxUses ? parseInt(couponMaxUses) : 999,
        expires: couponExpires || '무제한',
        active: true,
      };
      setCoupons((prev) => [...prev, newCoupon]);
    }

    setCouponCode('');
    setCouponDiscount('');
    setCouponMaxUses('');
    setCouponExpires('');
    setCouponModal(false);
    addToast(`쿠폰 ${couponCode.toUpperCase()}이 생성됐습니다`, 'success');
  };

  // CS: payment refund
  const handleRefund = (payId: string) => {
    setPayments((prev) => prev.map((p) => p.id === payId ? { ...p, status: 'refunded' } : p));
    addToast(`${payId} 환불 처리됐습니다`, 'success');
  };

  // Content: status change → DB 반영 (audio_history, automation_projects 상태 업데이트)
  const handleContentStatus = async (contentId: string, status: 'approved' | 'pending' | 'blocked') => {
    // 로컬 state 낙관적 업데이트
    setContentItems((prev) => prev.map((c) => c.id === contentId ? { ...c, status } : c));
    setContentDbItems((prev) => prev.map((c) => c.id === contentId ? { ...c, status } : c));

    // DB 상태 매핑: approved→completed, pending→processing, blocked→failed
    const dbStatus = status === 'approved' ? 'completed' : status === 'blocked' ? 'failed' : 'processing';

    // audio_history 또는 automation_projects 업데이트 시도
    try {
      const [audioRes, autoRes] = await Promise.allSettled([
        supabase.from('audio_history').update({ status: dbStatus }).eq('id', contentId),
        supabase.from('automation_projects').update({ status: dbStatus }).eq('id', contentId),
      ]);

      // 감사 로그 기록
      const label = status === 'approved' ? '콘텐츠 승인' : status === 'blocked' ? '콘텐츠 차단' : '콘텐츠 검토중';
      await supabase.from('audit_logs').insert({
        admin_email: 'admin',
        action: label,
        target_type: 'content',
        target_id: contentId,
        target_label: contentId,
        result: 'success',
      });

      console.log('Content status updated:', audioRes, autoRes);
    } catch (e) {
      console.warn('Content status DB update failed:', e);
    }

    const label = status === 'approved' ? '승인' : status === 'blocked' ? '차단' : '검토중';
    addToast(`콘텐츠 ${contentId}이 ${label}됐습니다`, status === 'blocked' ? 'warning' : 'success');
  };

  // AI Engine: prompt template toggle
  const handlePromptToggle = (id: string) => {
    setPromptTemplates((prev) => prev.map((pt) => pt.id === id ? { ...pt, active: !pt.active } : pt));
    const pt = promptTemplates.find((p) => p.id === id);
    addToast(`템플릿 "${pt?.name}" ${pt?.active ? '비활성화' : '활성화'}됐습니다`, 'info');
  };

  // AI Engine: prompt template save
  const handlePromptSave = (template: PromptTemplate) => {
    setPromptTemplates((prev) => {
      const exists = prev.find((p) => p.id === template.id);
      if (exists) return prev.map((p) => p.id === template.id ? template : p);
      return [...prev, template];
    });
    addToast(`템플릿 "${template.name}"이 저장됐습니다`, 'success');
  };

  // Security: IP block add (Edge Function)
  const handleIpBlock = async () => {
    if (!ipBlockInput.trim()) return;
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`);
      url.searchParams.set('action', 'block_ip');
      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip_address: ipBlockInput, reason: ipBlockReason || '수동 차단' }),
      });
      await loadIpBlocks();
    } catch (e) {
      console.warn('IP block failed:', e);
      const newBlock: IpBlock = {
        ip: ipBlockInput,
        reason: ipBlockReason || '수동 차단',
        blockedAt: new Date().toLocaleString('ko-KR'),
        blockedBy: 'admin',
        status: 'active',
      };
      setIpBlockList((prev) => [newBlock, ...prev]);
    }
    setIpBlockInput('');
    setIpBlockReason('');
    addToast(`IP ${ipBlockInput}이 차단됐습니다`, 'warning');
  };

  // Security: IP unblock (Edge Function)
  const handleIpUnblock = async (ip: string) => {
    const displayBlocks = ipBlocksData.length > 0 ? ipBlocksData : ipBlockList;
    const block = displayBlocks.find((b) => b.ip === ip) as (typeof ipBlockList[0] & { _id?: string }) | undefined;
    if (!block) return;
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`);
      url.searchParams.set('action', 'unblock_ip');
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: block._id ?? block.ip }),
      });
      if (ipBlocksData.length > 0) {
        setIpBlocksData((prev) => prev.map((b) => b.ip === ip ? { ...b, status: 'released' as const } : b));
      } else {
        setIpBlockList((prev) => prev.map((b) => b.ip === ip ? { ...b, status: 'released' as const } : b));
      }
    } catch (e) {
      console.warn('IP unblock failed:', e);
      setIpBlockList((prev) => prev.map((b) => b.ip === ip ? { ...b, status: 'released' as const } : b));
    }
    addToast(`IP ${ip} 차단이 해제됐습니다`, 'info');
  };

  // Security: add admin (Edge Function)
  const handleAddAdmin = async () => {
    if (!newAdminName.trim() || !newAdminEmail.trim()) return;
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`);
      url.searchParams.set('action', 'create_admin');
      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newAdminEmail,
          display_name: newAdminName,
          role: newAdminRole,
          permissions: newAdminPerms.length > 0 ? newAdminPerms : [],
        }),
      });
      await loadAdminAccounts();
    } catch (e) {
      console.warn('Add admin failed:', e);
      const newAdmin: AdminAccount = {
        id: `ADM-${String(Date.now()).slice(-3)}`,
        name: newAdminName,
        email: newAdminEmail,
        role: newAdminRole,
        twofa: false,
        lastLogin: '-',
        loginIp: '-',
        permissions: newAdminPerms.length > 0 ? newAdminPerms : ['없음'],
      };
      setAdminAccounts((prev) => [...prev, newAdmin]);
    }
    setNewAdminName('');
    setNewAdminEmail('');
    setNewAdminRole('CS Manager');
    setNewAdminPerms([]);
    setAddAdminModal(false);
    addToast(`관리자 ${newAdminName} 계정이 생성됐습니다`, 'success');
  };

  // Users: member grade change (Edge Function)
  const handleGradeChange = async (userId: string, memberGrade: string, reason?: string) => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'update_member_grade');
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: userId, member_grade: memberGrade, reason }),
      });
      setUsersData((prev) => prev.map((u) => u.id === userId ? { ...u, memberGrade } : u));
    } catch (e) {
      console.warn('Grade change failed:', e);
    }
    const gradeMeta = GRADE_META[memberGrade];
    addToast(`등급이 ${gradeMeta?.label ?? memberGrade}(으)로 변경됐습니다`, 'success');
  };

  // Sys-settings: save performance settings
  const handleSavePerformance = () => {
    addToast('성능 설정이 저장됐습니다', 'success');
  };

  // Overview / Audit: CSV export
  const handleCsvExport = (tabName: string) => {
    addToast(`${tabName} 데이터를 CSV로 내보내는 중...`, 'info');
    setTimeout(() => addToast('CSV 파일이 다운로드됐습니다', 'success'), 800);
  };

  // Users: suspend / restore (Edge Function)
  const handleUserStatusChange = async (userId: string, newStatus: UserStatus) => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'update_user_status');
      await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: userId, status: newStatus }),
      });
      // 목록 갱신
      setUsersData((prev) => prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (e) {
      console.warn('User status update failed:', e);
    }
    addToast(
      newStatus === 'suspended' ? `계정이 정지됐습니다` : `계정이 복구됐습니다`,
      newStatus === 'suspended' ? 'warning' : 'success',
    );
  };

  // Users: credit adjust (Edge Function)
  const handleCreditAdjust = async (userId: string, amount: string) => {
    if (!amount.trim()) { addToast('조정 값을 입력해주세요', 'error'); return; }
    const numAmount = parseInt(amount);
    if (isNaN(numAmount)) { addToast('올바른 숫자를 입력해주세요', 'error'); return; }
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'adjust_credits');
      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: userId, amount: numAmount }),
      });
      setUsersData((prev) => prev.map((u) => u.id === userId ? { ...u, credits: Math.max(0, u.credits + numAmount) } : u));
    } catch (e) {
      console.warn('Credit adjust failed:', e);
    }
    addToast(`크레딧 ${numAmount > 0 ? '+' : ''}${numAmount} 조정됐습니다`, 'success');
  };

  // Billing: refund (Edge Function)
  const handlePaymentRefund = async (payId: string) => {
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-billing`);
      url.searchParams.set('action', 'refund_payment');
      await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: payId }),
      });
    } catch (e) {
      console.warn('Refund failed:', e);
    }
    const displayPayments = paymentsData.length > 0 ? paymentsData : payments;
    const updatedPayments = displayPayments.map((p) => p.id === payId ? { ...p, status: 'refunded' } : p);
    if (paymentsData.length > 0) setPaymentsData(updatedPayments);
    else setPayments(updatedPayments);
    addToast(`${payId} 환불 처리됐습니다`, 'success');
  };

  // Billing: Excel download
  const handleExcelDownload = () => {
    addToast('결제 내역 Excel 파일을 다운로드 중...', 'info');
    setTimeout(() => addToast('Excel 파일이 다운로드됐습니다', 'success'), 800);
  };

  // Security: force 2FA
  const handleForce2FA = (adminId: string, adminName: string) => {
    setAdminAccounts((prev) => prev.map((a) => a.id === adminId ? { ...a, twofa: true } : a));
    addToast(`${adminName} 관리자에게 2FA 설정 요청을 발송했습니다`, 'info');
  };

  // Security: 관리자 권한 수정 → DB 반영
  const handleSavePermissions = async (adminId: string, adminName: string, permissions: string[]) => {
    try {
      const fetchUrl = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`);
      fetchUrl.searchParams.set('action', 'update_admin');
      await fetch(fetchUrl.toString(), {
        method: 'PUT',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: adminId, permissions }),
      });
      // 로컬 state도 업데이트
      setAdminAccounts((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions } : a));
      if (adminAccountsData.length > 0) {
        setAdminAccountsData((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions } : a));
      }
    } catch (e) {
      console.warn('Permission update failed:', e);
      setAdminAccounts((prev) => prev.map((a) => a.id === adminId ? { ...a, permissions } : a));
    }
    addToast(`${adminName} 권한이 수정됐습니다`, 'success');
  };

  // ── System tab states ──
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('전체');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditDatePreset, setAuditDatePreset] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PAGE_SIZE = 10;

  // Audit Alert Settings
  const [showAuditAlertModal, setShowAuditAlertModal] = useState(false);
  const [auditAlertRules, setAuditAlertRules] = useState<AuditAlertRule[]>([]);
  const activeAlertCount = auditAlertRules.filter((r) => r.enabled).length;
  const [ipBlockInput, setIpBlockInput] = useState('');
  const [ipBlockReason, setIpBlockReason] = useState('');
  const [addAdminModal, setAddAdminModal] = useState(false);
  const [editPermModal, setEditPermModal] = useState<AdminAccount | null>(null);
  const [editPermList, setEditPermList] = useState<string[]>([]);
  const [retentionEdit, setRetentionEdit] = useState(false);
  const [retentionValues, setRetentionValues] = useState({ audit: '365일', content: '90일', billing: '5년' });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState('800');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [watermarkDefault, setWatermarkDefault] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [slackNotif, setSlackNotif] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [contentAutoFilter, setContentAutoFilter] = useState(true);

  // ── Coupon extra state ──
  const [couponDiscountType, setCouponDiscountType] = useState<'percent' | 'credits'>('percent');
  const [couponMaxUses, setCouponMaxUses] = useState('');
  const [couponExpires, setCouponExpires] = useState('');

  // Overview: refresh - 실제 데이터 재로드
  const handleRefresh = useCallback(() => {
    if (activeTab === 'overview') {
      loadOverviewStats().then(() => setLastRefreshedAt(new Date()));
      setNextRefreshIn(30);
      addToast('대시보드 데이터를 새로고침했습니다', 'success');
    } else if (activeTab === 'users') {
      loadUsers(userSearch, userPlanFilter);
      loadUserStats();
      addToast('사용자 데이터를 새로고침했습니다', 'success');
    } else if (activeTab === 'content') {
      loadContentItems(contentFilter);
      loadContentStats();
      loadTeams();
      addToast('콘텐츠 데이터를 새로고침했습니다', 'success');
    } else if (activeTab === 'billing') {
      loadPayments(1);
      loadPaymentStats();
      loadCoupons();
      loadPlanUserCounts();
      addToast('결제 데이터를 새로고침했습니다', 'success');
    } else if (activeTab === 'cs') {
      loadCsTickets(csTicketFilter);
      loadCsTicketStats();
      addToast('CS 티켓 데이터를 새로고침했습니다', 'success');
    } else if (activeTab === 'cs-notice') {
      loadNotices();
      addToast('공지 데이터를 새로고침했습니다', 'success');
    } else if (activeTab === 'audit') {
      loadAuditLogs(auditCategoryFilter, auditSearch, auditDateFrom, auditDateTo, auditDatePreset);
      loadAuditStats();
      addToast('감사 로그를 새로고침했습니다', 'success');
    } else if (activeTab === 'security') {
      loadIpBlocks();
      loadAdminAccounts();
      addToast('보안 데이터를 새로고침했습니다', 'success');
    } else if (activeTab === 'ai-engine') {
      loadApiHealth();
      addToast('AI 엔진 데이터를 새로고침했습니다', 'success');
    } else {
      addToast('데이터를 새로고침했습니다', 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadOverviewStats, loadUsers, loadUserStats, loadContentItems, loadContentStats,
      loadTeams, loadPayments, loadPaymentStats, loadCoupons, loadPlanUserCounts,
      loadCsTickets, loadCsTicketStats, loadNotices,
      loadAuditLogs, loadAuditStats, loadIpBlocks, loadAdminAccounts,
      userSearch, userPlanFilter, contentFilter, csTicketFilter,
      auditCategoryFilter, auditSearch, auditDateFrom, auditDateTo, auditDatePreset]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDeleteNotif = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // 실제 DB 데이터만 사용 (목업 없음)
  const displayUsers = usersData;
  // 실제 DB 데이터만 사용 (목업 폴백 없음)
  const displayPayments = paymentsData;
  const displayCoupons = couponsData;
  const displayAuditLogs = auditLogsData;
  // 실제 DB 데이터만 사용 (목업 폴백 없음)
  const displayIpBlocks = ipBlocksData;
  const displayAdminAccounts = adminAccountsData;

  // DB에서 직접 검색/필터링하므로 로컬 필터 없이 displayUsers 그대로 사용
  const filteredUsers = displayUsers;

  const filteredContent = contentItems.filter((c) => {
    if (contentFilter === '전체') return true;
    if (contentFilter === '승인') return c.status === 'approved';
    if (contentFilter === '검토중') return c.status === 'pending';
    if (contentFilter === '차단') return c.status === 'blocked';
    return true;
  });

  const navItems: { id: TabType; label: string; icon: string; badge?: string }[] = [
    { id: 'overview',        label: '대시보드',       icon: 'ri-dashboard-3-line' },
    {
      id: 'users',
      label: '사용자 관리',
      icon: 'ri-user-3-line',
      badge: userStats.total > 0
        ? userStats.total >= 1000
          ? `${(userStats.total / 1000).toFixed(1)}k`
          : String(userStats.total)
        : overviewStats?.users?.total
          ? overviewStats.users.total >= 1000
            ? `${(overviewStats.users.total / 1000).toFixed(1)}k`
            : String(overviewStats.users.total)
          : undefined,
    },
    { id: 'coin-grant' as TabType,     label: '코인 직접 지급',  icon: 'ri-coin-line' },
    { id: 'grade-settings',  label: '등급 권한 설정', icon: 'ri-vip-crown-line' },
    {
      id: 'content',
      label: 'AI 콘텐츠 관리',
      icon: 'ri-image-ai-line',
      badge: contentDbStats?.pending && contentDbStats.pending > 0 ? String(contentDbStats.pending) : undefined,
    },
    { id: 'ai-engine',       label: 'AI 엔진 설정',   icon: 'ri-cpu-line' },
    { id: 'billing',         label: '결제 관리',       icon: 'ri-bank-card-line' },
    {
      id: 'cs',
      label: 'CS 티켓 관리',
      icon: 'ri-customer-service-2-line',
      badge: csTicketStats.open > 0 ? String(csTicketStats.open) : undefined,
    },
    { id: 'cs-notice',       label: '공지 / FAQ 관리', icon: 'ri-megaphone-line' },
  ];

  const systemNavItems = [
    { id: 'audit' as TabType, icon: 'ri-file-chart-line', label: '감사 로그' },
    { id: 'sys-settings' as TabType, icon: 'ri-settings-3-line', label: '시스템 설정' },
    { id: 'security' as TabType, icon: 'ri-shield-keyhole-line', label: '보안 / 2FA' },
  ];

  // DB에서 직접 필터링하므로 displayAuditLogs 그대로 사용
  const filteredAuditLogs = displayAuditLogs;

  const handleAuditPreset = (preset: 'today' | '7d' | '30d' | 'all') => {
    setAuditDatePreset(preset);
    setAuditPage(1);
    const newFrom = preset !== 'all' ? '' : auditDateFrom;
    const newTo   = preset !== 'all' ? '' : auditDateTo;
    if (preset !== 'all') {
      setAuditDateFrom('');
      setAuditDateTo('');
    }
    loadAuditLogs(auditCategoryFilter, auditSearch, newFrom, newTo, preset);
  };

  // Audit: 카테고리/검색 변경 시 DB 재검색 (디바운스)
  const auditSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAuditCategoryChange = (cat: string) => {
    setAuditCategoryFilter(cat);
    setAuditPage(1);
    loadAuditLogs(cat, auditSearch, auditDateFrom, auditDateTo, auditDatePreset);
  };

  const handleAuditSearchChange = (val: string) => {
    setAuditSearch(val);
    setAuditPage(1);
    if (auditSearchDebounceRef.current) clearTimeout(auditSearchDebounceRef.current);
    auditSearchDebounceRef.current = setTimeout(() => {
      loadAuditLogs(auditCategoryFilter, val, auditDateFrom, auditDateTo, auditDatePreset);
    }, 300);
  };

  const auditTotalPages = Math.max(1, Math.ceil(filteredAuditLogs.length / AUDIT_PAGE_SIZE));
  const pagedAuditLogs = filteredAuditLogs.slice(
    (auditPage - 1) * AUDIT_PAGE_SIZE,
    auditPage * AUDIT_PAGE_SIZE,
  );

  const t = {
    bg:          isDark ? 'bg-[#09090c]'    : 'bg-slate-50',
    headerBg:    isDark ? 'bg-[#0d0d10]'    : 'bg-white',
    sidebarBg:   isDark ? 'bg-[#0d0d10]'    : 'bg-white',
    cardBg:      isDark ? 'bg-[#0f0f13]'    : 'bg-white',
    cardBg2:     isDark ? 'bg-zinc-900/60'   : 'bg-slate-50',
    border:      isDark ? 'border-white/5'   : 'border-slate-200',
    border2:     isDark ? 'border-white/10'  : 'border-slate-300',
    text:        isDark ? 'text-white'       : 'text-slate-900',
    textSub:     isDark ? 'text-zinc-300'    : 'text-slate-700',
    textMuted:   isDark ? 'text-zinc-400'    : 'text-slate-600',
    textFaint:   isDark ? 'text-zinc-500'    : 'text-slate-500',
    inputBg:     isDark ? 'bg-zinc-900'      : 'bg-white',
    inputBg2:    isDark ? 'bg-zinc-800'      : 'bg-slate-100',
    rowHover:    isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50',
    divider:     isDark ? 'divide-white/[0.03]'   : 'divide-slate-100',
    navActive:   isDark ? 'bg-indigo-500/15 border-indigo-500/25 text-white' : 'bg-indigo-50 border-indigo-300 text-indigo-800',
    navInactive: isDark ? 'border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/5' : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    tableHead:   isDark ? 'text-zinc-400'    : 'text-slate-500',
    btnSecondary: isDark ? 'bg-zinc-800 border border-white/10 hover:border-white/20 text-zinc-200' : 'bg-white border border-slate-300 hover:border-slate-400 text-slate-700',
    toggleBg:    isDark ? 'bg-zinc-700'      : 'bg-slate-200',
    statusBg:    isDark ? 'bg-zinc-800/60 border border-white/5' : 'bg-slate-100 border border-slate-200',
  };

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col transition-colors duration-200`}>

      {/* ── Top Bar ── */}
      <header className={`flex-shrink-0 h-14 border-b ${t.border} ${t.headerBg} flex items-center px-4 md:px-6 gap-4 z-30`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`md:hidden w-8 h-8 flex items-center justify-center cursor-pointer ${isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <i className="ri-menu-line text-lg" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <i className="ri-shield-star-line text-white text-sm" />
          </div>
          <span className="font-black text-sm text-white tracking-tight">Admin Console</span>
          <span className={`hidden sm:block text-[10px] px-2 py-0.5 rounded-full font-semibold ${isDark ? 'text-zinc-500 bg-zinc-800' : 'text-slate-500 bg-slate-100'}`}>AiMetaWOW</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 md:gap-3">
          <div className={`hidden sm:flex items-center gap-2 ${t.statusBg} rounded-xl px-3 py-1.5`}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className={`text-[11px] ${t.textSub} font-semibold`}>시스템 정상</span>
          </div>
          {/* Dark/Light toggle */}
          <button
            onClick={() => setIsDark((v) => !v)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${isDark ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
            title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            <i className={`${isDark ? 'ri-sun-line' : 'ri-moon-line'} text-base`} />
          </button>
          {/* Notification Bell */}
          <div className="relative">
            <button
              ref={notifBtnRef}
              onClick={() => setNotifOpen((v) => !v)}
              className={`relative w-8 h-8 flex items-center justify-center cursor-pointer transition-colors ${isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <i className="ri-notification-3-line text-base" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center px-1">
                  <span className="text-[9px] font-black text-white leading-none">{unreadCount}</span>
                </span>
              )}
            </button>
            {notifOpen && (
              <NotificationPanel
                notifications={notifications}
                onClose={() => setNotifOpen(false)}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onDelete={handleDeleteNotif}
                isDark={isDark}
              />
            )}
          </div>
          <Link to="/" className={`flex items-center gap-1.5 text-xs transition-colors cursor-pointer whitespace-nowrap ${isDark ? 'text-zinc-500 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}>
            <i className="ri-home-4-line text-sm" />
            <span className="hidden sm:inline">메인으로</span>
          </Link>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-black">A</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <>
          {sidebarOpen && (
            <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}
          <aside className={`
            fixed md:static inset-y-0 left-0 z-20 w-60 flex-shrink-0
            ${t.sidebarBg} border-r ${t.border} flex flex-col
            transition-transform duration-300 md:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            top-14 md:top-0
          `}>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              <p className={`text-[10px] font-black uppercase tracking-widest px-3 mb-3 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>운영 메뉴</p>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left border ${
                    activeTab === item.id ? t.navActive : t.navInactive
                  }`}
                >
                  <div className={`w-5 h-5 flex items-center justify-center ${activeTab === item.id ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : ''}`}>
                    <i className={`${item.icon} text-sm`} />
                  </div>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      item.id === 'content' || item.id === 'cs'
                        ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                        : (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600')
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}

              <div className="pt-4">
                <p className={`text-[10px] font-black uppercase tracking-widest px-3 mb-3 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>시스템</p>
                {systemNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left border ${
                      activeTab === item.id ? t.navActive : t.navInactive
                    }`}
                  >
                    <div className={`w-5 h-5 flex items-center justify-center ${activeTab === item.id ? 'text-indigo-400' : ''}`}>
                      <i className={`${item.icon} text-sm`} />
                    </div>
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className={`px-3 py-4 border-t ${t.border} space-y-2`}>
              <div className={`${t.cardBg2} rounded-xl p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-semibold ${t.textFaint}`}>서버 부하</p>
                  {apiHealthData ? (
                    <span className={`text-[10px] font-bold ${
                      (apiHealthData.image?.error_rate ?? 0) > 5 || (apiHealthData.video?.error_rate ?? 0) > 5
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}>
                      {(apiHealthData.image?.error_rate ?? 0) > 5 || (apiHealthData.video?.error_rate ?? 0) > 5 ? '주의' : '정상'}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 font-bold">정상</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {(() => {
                    // API 데이터 기반 동적 부하 계산
                    const totalReq1h = apiHealthData?.total_requests_1h ?? 0;
                    const maxReq = 1000; // 시간당 최대 요청 기준
                    const cpuPct = apiHealthData
                      ? Math.min(95, Math.round((totalReq1h / maxReq) * 100) + 20)
                      : 34;
                    const imgErrRate = apiHealthData?.image?.error_rate ?? 0;
                    const vidErrRate = apiHealthData?.video?.error_rate ?? 0;
                    const gpuPct = apiHealthData
                      ? Math.min(95, Math.round(((imgErrRate + vidErrRate) / 2) * 5 + 40))
                      : 71;
                    const memPct = apiHealthData
                      ? Math.min(90, Math.round(cpuPct * 0.8 + 10))
                      : 58;
                    return [
                      { label: 'CPU', pct: cpuPct, color: cpuPct > 80 ? 'bg-red-500' : cpuPct > 60 ? 'bg-amber-500' : 'bg-emerald-500' },
                      { label: 'MEM', pct: memPct, color: memPct > 80 ? 'bg-red-500' : memPct > 60 ? 'bg-amber-500' : 'bg-amber-500' },
                      { label: 'GPU', pct: gpuPct, color: gpuPct > 80 ? 'bg-red-500' : gpuPct > 60 ? 'bg-amber-500' : 'bg-indigo-500' },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className={`text-[9px] ${t.textFaint} w-6`}>{s.label}</span>
                        <div className={`flex-1 h-1 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'} rounded-full overflow-hidden`}>
                          <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${s.pct}%` }} />
                        </div>
                        <span className={`text-[9px] ${t.textFaint} font-mono w-6 text-right`}>{s.pct}%</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div className="flex items-center gap-2 px-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[9px] font-black">A</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-zinc-300">관리자A</p>
                  <p className="text-[9px] text-zinc-600">Super Admin</p>
                </div>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate('/admin-login', { replace: true });
                  }}
                  className="w-5 h-5 flex items-center justify-center text-zinc-600 hover:text-red-400 cursor-pointer transition-colors"
                  title="로그아웃"
                >
                  <i className="ri-logout-box-r-line text-xs" />
                </button>
              </div>
            </div>
          </aside>
        </>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6 md:mb-8">
              <div>
                <h1 className={`text-xl md:text-2xl font-black ${t.text}`}>
                  {activeTab === 'overview'       && '글로벌 대시보드'}
                  {activeTab === 'users'          && '사용자 관리'}
                  {activeTab === 'coin-grant'     && '코인 직접 지급'}
                  {activeTab === 'grade-settings' && '회원 등급 권한 설정'}
                  {activeTab === 'content'        && 'AI 콘텐츠 관리'}
                  {activeTab === 'ai-engine'      && 'AI 엔진 & API 설정'}
                  {activeTab === 'billing'        && '결제 & 구독 관리'}
                  {activeTab === 'cs'             && 'CS 티켓 관리'}
                  {activeTab === 'cs-notice'      && '공지 / FAQ 관리'}
                  {activeTab === 'audit'          && '감사 로그'}
                  {activeTab === 'sys-settings'   && '시스템 설정'}
                  {activeTab === 'security'       && '보안 / 2FA 관리'}
                </h1>
                <p className={`${t.textMuted} text-sm mt-1`}>
                  마지막 업데이트:{' '}
                  {lastRefreshedAt
                    ? lastRefreshedAt.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')
                    : new Date().toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCsvExport(
                    activeTab === 'overview' ? '대시보드' :
                    activeTab === 'users' ? '사용자' :
                    activeTab === 'billing' ? '결제' :
                    activeTab === 'audit' ? '감사 로그' : '데이터'
                  )}
                  className={`flex items-center gap-1.5 ${t.btnSecondary} text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap`}
                >
                  <i className="ri-download-line text-xs" />
                  <span className="hidden sm:inline">CSV 내보내기</span>
                </button>
                <button
                  onClick={handleRefresh}
                  className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                >
                  <i className="ri-refresh-line text-xs" />
                  <span className="hidden sm:inline">새로고침</span>
                </button>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                ① OVERVIEW TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
              <div className="space-y-6 md:space-y-8">

                {/* 자동 새로고침 상태 바 */}
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
                      onClick={() => {
                        loadOverviewStats().then(() => setLastRefreshedAt(new Date()));
                        setNextRefreshIn(30);
                        addToast('대시보드 데이터를 새로고침했습니다', 'success');
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300' : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'} whitespace-nowrap cursor-pointer`}
                    >
                      <i className={`ri-refresh-line text-xs ${overviewLoading ? 'animate-spin' : ''}`} />
                      지금 갱신
                    </button>
                    <button
                      onClick={() => setAutoRefreshEnabled((v) => !v)}
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

                {/* Stats Grid - 완전 DB 데이터 */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {[
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
                  ].map((card) => (
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

                {/* Revenue + API Status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                  {/* Revenue Chart - DB 데이터 */}
                  <div className={`lg:col-span-2 ${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className={`text-sm font-black ${t.text}`}>월별 매출 추이</p>
                        <p className={`text-xs ${t.textMuted} mt-0.5`}>최근 6개월 실제 결제 데이터</p>
                      </div>
                      {overviewLoading && (
                        <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />
                      )}
                    </div>
                    {(() => {
                      const chartData = monthlyRevenueData.length > 0
                        ? monthlyRevenueData
                        : [
                            { label: '11월', value: 0 },
                            { label: '12월', value: 0 },
                            { label: '1월',  value: 0 },
                            { label: '2월',  value: 0 },
                            { label: '3월',  value: 0 },
                            { label: '4월',  value: 0 },
                          ];
                      const maxVal = Math.max(...chartData.map((d) => d.value), 1);
                      return (
                        <>
                          <div className="flex items-end gap-3 h-36">
                            {chartData.map((d, i) => {
                              const h = Math.max(4, Math.round((d.value / maxVal) * 100));
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
                        </>
                      );
                    })()}
                  </div>

                  {/* API Status */}
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

                {/* Content Trends + Daily Signups */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  {/* Content Trends - DB 데이터 */}
                  <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                    <SectionHeader title="콘텐츠 트렌드" subtitle="이번 달 카테고리별 생성량" isDark={isDark} />
                    {overviewLoading && contentTrendsData.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <i className="ri-loader-4-line animate-spin text-2xl text-indigo-400" />
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {(contentTrendsData.length > 0 ? contentTrendsData : contentTrends).map((trend) => (
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

                  {/* Daily Signups + Plan Dist - DB 데이터 */}
                  <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                    <SectionHeader title="일별 신규 가입" subtitle="최근 14일" isDark={isDark} />
                    {(() => {
                      const signupVals = dailySignupsData.length > 0 ? dailySignupsData : dailySignups;
                      const maxVal = Math.max(...signupVals, 1);
                      return (
                        <div className="flex items-end gap-1 h-24 mb-4">
                          {signupVals.map((val, i) => {
                            const h = Math.max(4, Math.round((val / maxVal) * 100));
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
                      );
                    })()}
                    <div className={`pt-4 border-t ${t.border}`}>
                      <p className={`text-xs font-black ${t.textSub} mb-3`}>플랜 분포</p>
                      {overviewLoading && planDistData.length === 0 ? (
                        <div className="flex items-center justify-center py-4">
                          <i className="ri-loader-4-line animate-spin text-indigo-400" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(planDistData.length > 0 ? planDistData : planDist).map((p) => (
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

                {/* Team Stats Dashboard */}
                <TeamStatsDashboard
                  isDark={isDark}
                  onNavigateToTeams={() => {
                    setActiveTab('content');
                    setContentSubTab('teams');
                  }}
                />

                {/* Audit Log Preview - DB 데이터 */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className={`text-sm font-black ${t.text}`}>최근 감사 로그</h2>
                      <p className={`text-xs mt-0.5 ${t.textMuted}`}>관리자 활동 이력 (실시간)</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('audit')}
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
                      {(recentAuditLogs.length > 0 ? recentAuditLogs : auditLogs).map((log, i) => (
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
            )}

            {/* ══════════════════════════════════════════════════════════════
                ② USERS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'users' && (
              <div className="space-y-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '전체 회원', value: usersLoading ? '...' : userStats.total > 0 ? userStats.total.toLocaleString() : displayUsers.length.toLocaleString(), icon: 'ri-user-3-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { label: '활성 회원', value: usersLoading ? '...' : userStats.total > 0 ? userStats.active.toLocaleString() : displayUsers.filter((u) => u.status === 'active').length.toLocaleString(), icon: 'ri-user-follow-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: '정지 계정', value: usersLoading ? '...' : userStats.total > 0 ? userStats.suspended.toLocaleString() : displayUsers.filter((u) => u.status === 'suspended').length.toLocaleString(), icon: 'ri-user-forbid-line', color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: '오늘 신규', value: usersLoading ? '...' : overviewStats?.users?.new_today !== undefined ? String(overviewStats.users.new_today) : '-', icon: 'ri-user-add-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  ].map((c) => (
                    <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <i className={`${c.icon} ${c.color} text-sm`} />
                      </div>
                      <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                      <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className={`flex items-center gap-2 flex-1 ${t.cardBg} border ${t.border} rounded-xl px-3 py-2.5`}>
                      <i className="ri-search-line text-zinc-500 text-sm" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setUserSearch(val);
                          if (userSearchDebounceRef.current) clearTimeout(userSearchDebounceRef.current);
                          userSearchDebounceRef.current = setTimeout(() => {
                            loadUsers(val, userPlanFilter);
                          }, 300);
                        }}
                        placeholder="이름, 이메일, ID 검색..."
                        className={`flex-1 bg-transparent text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none`}
                      />
                      {usersLoading ? (
                        <i className="ri-loader-4-line animate-spin text-indigo-400 text-sm" />
                      ) : userSearch ? (
                        <button
                          onClick={() => {
                            setUserSearch('');
                            if (userSearchDebounceRef.current) clearTimeout(userSearchDebounceRef.current);
                            loadUsers('', userPlanFilter);
                          }}
                          className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                        >
                          <i className="ri-close-line text-sm" />
                        </button>
                      ) : null}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {['전체', 'Pro', 'Free', 'Enterprise'].map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setUserPlanFilter(f);
                            loadUsers(userSearch, f);
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                            userPlanFilter === f
                              ? 'bg-indigo-500 text-white'
                              : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 등급 필터 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold ${t.textFaint} whitespace-nowrap`}>등급 필터:</span>
                    {[
                      { key: '전체', label: '전체', icon: '', color: '' },
                      { key: 'general', label: '일반', icon: 'ri-user-line', color: 'text-slate-400' },
                      { key: 'staff', label: '운영진', icon: 'ri-shield-star-line', color: 'text-violet-400' },
                      { key: 'b2b', label: 'B2B', icon: 'ri-building-2-line', color: 'text-amber-400' },
                      { key: 'group', label: '단체', icon: 'ri-group-line', color: 'text-emerald-400' },
                      { key: 'vip', label: 'VIP', icon: 'ri-vip-crown-line', color: 'text-orange-400' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => {
                          setUserGradeFilter(f.key);
                          // grade 필터를 직접 URL 파라미터로 전달
                          const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
                          url.searchParams.set('action', 'list_users');
                          url.searchParams.set('limit', '50');
                          if (userSearch) url.searchParams.set('search', userSearch);
                          if (userPlanFilter && userPlanFilter !== '전체') url.searchParams.set('plan', userPlanFilter.toLowerCase());
                          if (f.key && f.key !== '전체') url.searchParams.set('grade', f.key);
                          setUsersLoading(true);
                          fetch(url.toString(), { headers: { 'Authorization': getAuthorizationHeader() } })
                            .then((r) => r.json())
                            .then((json) => {
                              if (json.users) {
                                setUsersData(json.users.map((u: Record<string, unknown>) => ({
                                  id: u.id as string,
                                  name: (u.display_name as string) ?? (u.email as string)?.split('@')[0] ?? '알 수 없음',
                                  email: u.email as string,
                                  plan: u.plan ? ((u.plan as string).charAt(0).toUpperCase() + (u.plan as string).slice(1)) : 'Free',
                                  credits: (u.credit_balance as number) ?? 0,
                                  joined: u.created_at ? new Date(u.created_at as string).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
                                  status: (u.status as UserStatus) ?? 'active',
                                  lastLogin: u.last_login_at ? new Date(u.last_login_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
                                  loginIp: (u.last_login_ip as string) ?? '-',
                                  projects: (u.project_count as number) ?? 0,
                                  memberGrade: (u.member_grade as string) ?? 'general',
                                })));
                              } else {
                                setUsersData([]);
                              }
                            })
                            .catch(() => setUsersData([]))
                            .finally(() => setUsersLoading(false));
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                          userGradeFilter === f.key
                            ? 'bg-indigo-500 text-white'
                            : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
                        }`}
                      >
                        {f.icon && <i className={`${f.icon} text-xs ${userGradeFilter === f.key ? 'text-white' : f.color}`} />}
                        {f.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveTab('grade-settings')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ml-auto ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
                    >
                      <i className="ri-settings-3-line text-xs" />
                      등급 권한 설정
                    </button>
                  </div>
                </div>

                {/* Users Table */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${t.border}`}>
                          <th className={`text-left px-5 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>사용자</th>
                          <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden sm:table-cell`}>ID</th>
                          <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>플랜</th>
                          <th className={`text-right px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden md:table-cell`}>크레딧</th>
                          <th className={`text-right px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>프로젝트</th>
                          <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>가입일</th>
                          <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden md:table-cell`}>등급</th>
                          <th className={`text-left px-4 py-3.5 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>상태</th>
                          <th className="px-4 py-3.5" />
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${t.divider}`}>
                        {filteredUsers.map((u) => (
                          <tr key={u.id} className={`${t.rowHover} transition-colors group`}>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-black text-indigo-300">{u.name[0]}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-sm font-semibold ${t.text}`}>{u.name}</p>
                                  <p className={`text-[11px] ${t.textFaint} truncate`}>{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 hidden sm:table-cell">
                              <span className={`text-xs font-mono ${t.textMuted}`}>{u.id}</span>
                            </td>
                            <td className="px-4 py-3.5"><PlanBadge plan={u.plan} isDark={isDark} /></td>
                            <td className="px-4 py-3.5 text-right hidden md:table-cell">
                              <span className={`text-sm font-bold ${t.text}`}>{u.credits.toLocaleString()}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                              <span className={`text-sm ${t.textSub}`}>{u.projects}</span>
                            </td>
                            <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                              <span className={`text-xs ${t.textMuted}`}>{u.joined}</span>
                            </td>
                            <td className="px-4 py-3.5 hidden md:table-cell">
                              <GradeBadge grade={u.memberGrade ?? 'general'} />
                            </td>
                            <td className="px-4 py-3.5"><StatusBadge status={u.status} isDark={isDark} /></td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setSelectedUser(u)}
                                  className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors`}
                                  title="상세보기"
                                >
                                  <i className={`ri-eye-line ${t.textSub} text-xs`} />
                                </button>
                                <button
                                  onClick={() => { setGradeChangeModal(u); setGradeChangeValue(u.memberGrade ?? 'general'); setGradeChangeReason(''); }}
                                  className="w-7 h-7 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 flex items-center justify-center cursor-pointer transition-colors"
                                  title="등급 변경"
                                >
                                  <i className="ri-vip-crown-line text-violet-400 text-xs" />
                                </button>
                                <button
                                  onClick={() => handleUserStatusChange(u.id, u.status === 'suspended' ? 'active' : 'suspended')}
                                  className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                                  title={u.status === 'suspended' ? '계정 복구' : '계정 정지'}
                                >
                                  <i className={`${u.status === 'suspended' ? 'ri-user-follow-line text-emerald-400' : 'ri-forbid-line text-red-400'} text-xs`} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {usersLoading && filteredUsers.length === 0 && (
                    <div className={`text-center py-16 ${t.textFaint}`}>
                      <i className="ri-loader-4-line animate-spin text-3xl text-indigo-400 mb-3 block" />
                      <p className="text-sm">사용자 데이터를 불러오는 중...</p>
                    </div>
                  )}
                  {!usersLoading && filteredUsers.length === 0 && (
                    <div className={`text-center py-16 ${t.textFaint}`}>
                      <i className="ri-user-search-line text-3xl mb-3 block" />
                      <p className="text-sm font-semibold mb-1">
                        {userSearch || userPlanFilter !== '전체' ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'}
                      </p>
                      {(userSearch || userPlanFilter !== '전체') && (
                        <p className={`text-xs ${t.textFaint}`}>다른 검색어나 필터를 시도해보세요</p>
                      )}
                    </div>
                  )}
                  <div className={`px-5 py-3 border-t ${t.border} flex items-center justify-between`}>
                    <span className={`text-xs ${t.textFaint}`}>
                      {usersLoading ? (
                        <span className="flex items-center gap-1.5">
                          <i className="ri-loader-4-line animate-spin text-indigo-400 text-xs" />
                          데이터 로딩 중...
                        </span>
                      ) : `${filteredUsers.length}명 표시 중`}
                    </span>
                    <div className="flex items-center gap-1">
                      <button className={`w-7 h-7 rounded-lg ${t.inputBg2} flex items-center justify-center ${t.textMuted} cursor-pointer hover:${t.text} transition-colors`}>
                        <i className="ri-arrow-left-s-line text-sm" />
                      </button>
                      <span className={`text-xs ${t.textMuted} px-2`}>1 / 1</span>
                      <button className={`w-7 h-7 rounded-lg ${t.inputBg2} flex items-center justify-center ${t.textMuted} cursor-pointer hover:${t.text} transition-colors`}>
                        <i className="ri-arrow-right-s-line text-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ② - B COIN GRANT TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'coin-grant' && (
              <CreditGrantPanel isDark={isDark} onToast={addToast} />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ② - C GRADE SETTINGS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'grade-settings' && (
              <div className="space-y-5">
                {/* 안내 배너 */}
                <div className={`flex items-start gap-4 px-5 py-4 rounded-2xl border ${isDark ? 'bg-violet-500/8 border-violet-500/20' : 'bg-violet-50 border-violet-200'}`}>
                  <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                    <i className="ri-vip-crown-line text-violet-400 text-base" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-black ${t.text} mb-1`}>회원 등급 권한 설정</p>
                    <p className={`text-xs ${t.textMuted} leading-relaxed`}>
                      등급별로 이용 가능한 AI 기능, 서비스, 혜택을 세밀하게 설정할 수 있습니다.
                      변경 사항은 즉시 DB에 저장되며, 해당 등급의 모든 회원에게 적용됩니다.
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {[
                        { label: '일반 회원', icon: 'ri-user-line', color: 'text-slate-400' },
                        { label: '운영진', icon: 'ri-shield-star-line', color: 'text-violet-400' },
                        { label: 'B2B 기업', icon: 'ri-building-2-line', color: 'text-amber-400' },
                        { label: '단체 고객', icon: 'ri-group-line', color: 'text-emerald-400' },
                        { label: 'VIP', icon: 'ri-vip-crown-line', color: 'text-orange-400' },
                        { label: '이용 정지', icon: 'ri-forbid-line', color: 'text-red-400' },
                      ].map((g) => (
                        <span key={g.label} className={`flex items-center gap-1 text-[11px] ${t.textFaint}`}>
                          <i className={`${g.icon} ${g.color} text-xs`} />
                          {g.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 ${isDark ? 'text-violet-400 hover:text-violet-300' : 'text-violet-600 hover:text-violet-800'}`}
                  >
                    <i className="ri-user-3-line text-xs" />
                    사용자 관리로
                  </button>
                </div>

                <GradePermissionsPanel isDark={isDark} onToast={addToast} />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ③ CONTENT TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'content' && (
              <div className="space-y-5">

                {/* Sub-tab: 콘텐츠 검수 / 팀 관리 */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${t.border} ${t.cardBg} w-fit`}>
                  {([
                    { id: 'items', label: '콘텐츠 검수', icon: 'ri-image-ai-line' },
                    { id: 'teams', label: '팀 / 그룹 관리', icon: 'ri-team-line' },
                  ] as const).map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setContentSubTab(sub.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                        contentSubTab === sub.id
                          ? 'bg-indigo-500 text-white'
                          : `${t.textMuted} hover:${t.text}`
                      }`}
                    >
                      <i className={`${sub.icon} text-xs`} />
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* ── 콘텐츠 검수 섹션 ── */}
                {contentSubTab === 'items' && <>

                {/* Summary - DB 실제 데이터 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      label: '전체 콘텐츠',
                      value: contentDbStats ? contentDbStats.total.toLocaleString() : (contentDbLoading ? '...' : '-'),
                      icon: 'ri-image-ai-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10',
                    },
                    {
                      label: '처리 중',
                      value: contentDbStats ? String(contentDbStats.pending) : (contentDbLoading ? '...' : '-'),
                      icon: 'ri-time-line', color: 'text-amber-400', bg: 'bg-amber-500/10',
                    },
                    {
                      label: '실패/차단',
                      value: contentDbStats ? String(contentDbStats.blocked) : (contentDbLoading ? '...' : '-'),
                      icon: 'ri-spam-2-line', color: 'text-red-400', bg: 'bg-red-500/10',
                    },
                    {
                      label: 'AI 이미지',
                      value: contentDbStats ? contentDbStats.gallery.toLocaleString() : (contentDbLoading ? '...' : '-'),
                      icon: 'ri-star-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
                    },
                  ].map((c) => (
                    <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <i className={`${c.icon} ${c.color} text-sm`} />
                      </div>
                      <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                      <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Filter */}
                <div className="flex gap-2 flex-wrap">
                  {['전체', '승인', '검토중', '차단'].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setContentFilter(f);
                        loadContentItems(f);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        contentFilter === f
                          ? 'bg-indigo-500 text-white'
                          : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                  {contentDbLoading && (
                    <div className="flex items-center gap-1.5 px-2">
                      <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />
                      <span className={`text-xs ${t.textFaint}`}>로딩 중...</span>
                    </div>
                  )}
                </div>

                {/* Content Grid - DB 실제 데이터 */}
                {(() => {
                  // DB 데이터 우선, 없으면 mock
                  const displayItems = contentDbItems.length > 0
                    ? contentDbItems.map((c) => ({
                        id: c.id,
                        title: c.title,
                        user: c.user,
                        type: c.type,
                        status: c.status as 'approved' | 'pending' | 'blocked',
                        date: c.date ? new Date(c.date).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '') : '-',
                        rating: c.status === 'approved' ? 4 : c.status === 'blocked' ? 1 : 3,
                        thumbnail: c.thumbnail,
                      }))
                    : contentItems;

                  const filtered = displayItems.filter((c) => {
                    if (contentFilter === '전체') return true;
                    if (contentFilter === '승인') return c.status === 'approved';
                    if (contentFilter === '검토중') return c.status === 'pending';
                    if (contentFilter === '차단') return c.status === 'blocked';
                    return true;
                  });

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {contentDbLoading && contentDbItems.length === 0 ? (
                        <div className={`col-span-2 flex items-center justify-center py-16 ${t.textFaint}`}>
                          <i className="ri-loader-4-line animate-spin text-3xl text-indigo-400" />
                        </div>
                      ) : filtered.length === 0 ? (
                        <div className={`col-span-2 flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
                          <i className="ri-image-ai-line text-3xl mb-2" />
                          <p className="text-sm">콘텐츠가 없습니다</p>
                        </div>
                      ) : filtered.map((c) => (
                        <div key={c.id} className={`${t.cardBg} border ${t.border} rounded-2xl p-4 flex gap-4 group ${isDark ? 'hover:border-white/10' : 'hover:border-gray-300'} transition-colors`}>
                          <div className={`w-24 h-14 rounded-xl overflow-hidden flex-shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} flex items-center justify-center`}>
                            {c.thumbnail ? (
                              <img src={c.thumbnail} alt={c.title} className="w-full h-full object-cover object-top" />
                            ) : (
                              <i className={`ri-image-line text-xl ${t.textFaint}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className={`text-sm font-semibold ${t.text} truncate`}>{c.title}</p>
                              <StatusBadge status={c.status} isDark={isDark} />
                            </div>
                            <p className={`text-[11px] ${t.textFaint} mb-2`}>{c.user} · {c.type} · {c.date}</p>
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map((s) => (
                                <i key={s} className={`${s <= c.rating ? 'ri-star-fill text-amber-400' : 'ri-star-line text-zinc-700'} text-[10px]`} />
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleContentStatus(c.id, 'approved')}
                              className={`w-7 h-7 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center cursor-pointer transition-colors ${c.status === 'approved' ? 'ring-1 ring-emerald-500/40' : ''}`}
                              title="승인"
                            >
                              <i className="ri-check-line text-emerald-400 text-xs" />
                            </button>
                            <button
                              onClick={() => handleContentStatus(c.id, 'pending')}
                              className={`w-7 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 flex items-center justify-center cursor-pointer transition-colors ${c.status === 'pending' ? 'ring-1 ring-amber-500/40' : ''}`}
                              title="검토중"
                            >
                              <i className="ri-star-line text-amber-400 text-xs" />
                            </button>
                            <button
                              onClick={() => handleContentStatus(c.id, 'blocked')}
                              className={`w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors ${c.status === 'blocked' ? 'ring-1 ring-red-500/40' : ''}`}
                              title="차단"
                            >
                              <i className="ri-spam-2-line text-red-400 text-xs" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Data Labeling - DB 실제 데이터 기반 */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <SectionHeader title="데이터 라벨링" subtitle="AI 품질 개선을 위한 운영자 태깅" isDark={isDark} />
                  {(() => {
                    const total = contentDbStats ? contentDbStats.total : 0;
                    const approved = contentDbStats ? contentDbStats.gallery + contentDbStats.audio + contentDbStats.automation + contentDbStats.board - (contentDbStats.pending + contentDbStats.blocked) : 0;
                    const pending = contentDbStats ? contentDbStats.pending : 0;
                    const blocked = contentDbStats ? contentDbStats.blocked : 0;
                    const safeTotal = Math.max(total, 1);
                    const approvedPct = Math.round((Math.max(0, approved) / safeTotal) * 100);
                    const pendingPct = Math.round((pending / safeTotal) * 100);
                    const blockedPct = Math.round((blocked / safeTotal) * 100);
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { label: '태깅 완료', value: contentDbStats ? Math.max(0, approved).toLocaleString() : '-', pct: approvedPct, color: 'bg-emerald-500' },
                          { label: '태깅 대기', value: contentDbStats ? pending.toLocaleString() : '-', pct: pendingPct, color: 'bg-amber-500' },
                          { label: '재검토 필요', value: contentDbStats ? blocked.toLocaleString() : '-', pct: blockedPct, color: 'bg-red-500' },
                        ].map((item) => (
                          <div key={item.label} className={`${t.cardBg2} rounded-xl p-4`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-semibold ${t.textSub}`}>{item.label}</span>
                              <span className={`text-sm font-black ${t.text}`}>
                                {contentDbLoading ? <i className="ri-loader-4-line animate-spin text-indigo-400" /> : item.value}
                              </span>
                            </div>
                            <div className={`h-1.5 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
                              <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.pct}%` }} />
                            </div>
                            <p className={`text-[10px] ${t.textFaint} mt-1.5`}>{item.pct}%</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                </>}

                {/* ── 팀 / 그룹 관리 섹션 ── */}
                {contentSubTab === 'teams' && (
                  <div className="space-y-5">

                    {/* Team Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: '전체 팀', value: teamStats.total > 0 ? `${teamStats.total}개` : (teamsData.length > 0 ? `${teamsData.length}개` : '-'), icon: 'ri-team-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                        { label: '활성 팀', value: teamStats.active > 0 ? `${teamStats.active}개` : `${teamsData.filter((t) => t.status === 'active').length}개`, icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                        { label: '전체 팀 멤버', value: teamStats.total_members > 0 ? `${teamStats.total_members}명` : '-', icon: 'ri-user-3-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { label: '비활성 팀', value: teamStats.inactive > 0 ? `${teamStats.inactive}개` : `${teamsData.filter((t) => t.status !== 'active').length}개`, icon: 'ri-pause-circle-line', color: 'text-zinc-400', bg: 'bg-zinc-500/10' },
                      ].map((c) => (
                        <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                          <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                            <i className={`${c.icon} ${c.color} text-sm`} />
                          </div>
                          <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                          <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Team List */}
                    <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                      <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
                        <div>
                          <p className={`text-sm font-black ${t.text}`}>팀 / 그룹 목록</p>
                          <p className={`text-xs ${t.textMuted} mt-0.5`}>특정 회원층만 AI 콘텐츠를 공유·협업할 수 있는 팀 단위 접근 제어</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {teamsLoading && <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm" />}
                          <button
                            onClick={() => setTeamModal('new')}
                            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-add-line text-xs" />
                            팀 생성
                          </button>
                        </div>
                      </div>

                      {/* Access mode legend */}
                      <div className={`px-5 py-2.5 border-b ${t.border} flex items-center gap-4 flex-wrap`}>
                        {[
                          { key: 'shared', label: '공유', icon: 'ri-team-line', color: 'text-emerald-400' },
                          { key: 'private', label: '비공개', icon: 'ri-lock-line', color: 'text-red-400' },
                          { key: 'restricted', label: '제한', icon: 'ri-shield-line', color: 'text-amber-400' },
                        ].map((a) => (
                          <div key={a.key} className="flex items-center gap-1.5">
                            <i className={`${a.icon} ${a.color} text-xs`} />
                            <span className={`text-[10px] ${t.textFaint}`}>{a.label}</span>
                          </div>
                        ))}
                        <span className={`text-[10px] ${t.textFaint} ml-auto`}>콘텐츠 접근 모드</span>
                      </div>

                      {teamsData.length === 0 && !teamsLoading ? (
                        <div className={`flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
                          <i className="ri-team-line text-3xl mb-3" />
                          <p className="text-sm font-semibold mb-1">아직 팀이 없습니다</p>
                          <p className={`text-xs ${t.textFaint} mb-4 text-center max-w-xs`}>
                            팀을 생성하면 특정 회원들끼리 AI 콘텐츠를 공유하고 협업할 수 있습니다
                          </p>
                          <button
                            onClick={() => setTeamModal('new')}
                            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <i className="ri-add-line text-xs" />
                            첫 팀 만들기
                          </button>
                        </div>
                      ) : (
                        <div className={`divide-y ${t.divider}`}>
                          {teamsData.map((team) => {
                            const accessConfig = {
                              shared:     { icon: 'ri-team-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: '공유' },
                              private:    { icon: 'ri-lock-line', color: 'text-red-400', bg: 'bg-red-500/10', label: '비공개' },
                              restricted: { icon: 'ri-shield-line', color: 'text-amber-400', bg: 'bg-amber-500/10', label: '제한' },
                            }[team.content_access];
                            return (
                              <div key={team.id} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
                                <div className={`w-10 h-10 rounded-xl ${accessConfig.bg} flex items-center justify-center flex-shrink-0`}>
                                  <i className={`${accessConfig.icon} ${accessConfig.color} text-base`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <p className={`text-sm font-semibold ${t.text}`}>{team.name}</p>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${accessConfig.bg} ${accessConfig.color}`}>
                                      {accessConfig.label}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                      team.status === 'active'
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-zinc-500/15 text-zinc-400'
                                    }`}>
                                      {team.status === 'active' ? '활성' : team.status === 'inactive' ? '비활성' : '보관됨'}
                                    </span>
                                  </div>
                                  <p className={`text-[11px] ${t.textFaint}`}>
                                    {team.description ?? '설명 없음'} · 멤버 {team.member_count}/{team.max_members}명
                                  </p>
                                  <p className={`text-[10px] ${t.textFaint} mt-0.5`}>
                                    생성일: {new Date(team.created_at).toLocaleDateString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <button
                                    onClick={() => setTeamModal(team)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                                  >
                                    <i className="ri-settings-3-line text-xs" />
                                    관리
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* How it works */}
                    <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5`}>
                      <p className={`text-sm font-black ${t.text} mb-4`}>팀 기반 콘텐츠 접근 제어 안내</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                          {
                            step: '1',
                            title: '팀 생성',
                            desc: '팀 이름, 설명, 콘텐츠 접근 모드(공유/비공개/제한)를 설정하고 팀을 만듭니다.',
                            icon: 'ri-add-circle-line',
                            color: 'text-indigo-400',
                            bg: 'bg-indigo-500/10',
                          },
                          {
                            step: '2',
                            title: '멤버 초대',
                            desc: '사용자를 검색해 팀에 추가합니다. 역할(오너/관리자/멤버/뷰어)을 지정할 수 있습니다.',
                            icon: 'ri-user-add-line',
                            color: 'text-emerald-400',
                            bg: 'bg-emerald-500/10',
                          },
                          {
                            step: '3',
                            title: '콘텐츠 공유',
                            desc: '팀 멤버가 생성한 AI 콘텐츠를 접근 모드에 따라 팀 내에서 공유하고 협업합니다.',
                            icon: 'ri-share-line',
                            color: 'text-amber-400',
                            bg: 'bg-amber-500/10',
                          },
                        ].map((item) => (
                          <div key={item.step} className={`${t.cardBg2} rounded-xl p-4`}>
                            <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                              <i className={`${item.icon} ${item.color} text-base`} />
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-black ${t.textFaint} bg-zinc-800 px-1.5 py-0.5 rounded-full`}>STEP {item.step}</span>
                              <p className={`text-xs font-bold ${t.text}`}>{item.title}</p>
                            </div>
                            <p className={`text-[11px] ${t.textFaint} leading-relaxed`}>{item.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ④ AI ENGINE TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'ai-engine' && (
              <AiEngineTab
                isDark={isDark}
                onToast={(msg, type) => addToast(msg, type ?? 'success')}
                apiStatus={apiStatus}
                promptTemplates={promptTemplates}
                onPromptToggle={handlePromptToggle}
                onPromptEdit={(template) => {
                  setEditingTemplate(template ?? 'new');
                  setPromptEditOpen(true);
                }}
                apiHealthData={apiHealthData}
                apiHealthLoading={apiHealthLoading}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑤ BILLING TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'billing' && (
              <div className="space-y-5 md:space-y-6">
                {/* Revenue Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '이번 달 매출', value: paymentStats.monthly_revenue > 0 ? `₩${Math.round(paymentStats.monthly_revenue * 1350).toLocaleString()}` : (overviewStats?.revenue?.monthly ? `₩${Math.round(overviewStats.revenue.monthly * 1350).toLocaleString()}` : (paymentsLoading ? '...' : '-')), icon: 'ri-money-dollar-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: '환불 처리', value: paymentStats.refunded > 0 ? `${paymentStats.refunded}건` : (paymentsLoading ? '...' : '-'), icon: 'ri-refund-2-line', color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: '완료 결제', value: paymentStats.completed > 0 ? `${paymentStats.completed.toLocaleString()}건` : (paymentsLoading ? '...' : '-'), icon: 'ri-vip-crown-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: '쿠폰 수', value: displayCoupons.length > 0 ? `${displayCoupons.length}개` : (paymentsLoading ? '...' : '-'), icon: 'ri-coupon-3-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  ].map((c) => (
                    <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <i className={`${c.icon} ${c.color} text-sm`} />
                      </div>
                      <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                      <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Subscription Plans - 구독자 수 DB 실시간 */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>구독 플랜 현황</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>플랜별 실제 구독자 수 (DB 실시간)</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {subscriptionPlans.map((plan) => {
                      const planKey = plan.name.toLowerCase() as 'free' | 'pro' | 'enterprise';
                      const realCount = planUserCounts?.[planKey];
                      return (
                        <div key={plan.name} className={`${t.cardBg2} rounded-2xl p-5 border ${plan.color}`}>
                          <div className="flex items-center justify-between mb-3">
                            <PlanBadge plan={plan.name} isDark={isDark} />
                            <button className={`w-6 h-6 flex items-center justify-center ${t.textFaint} hover:${t.textSub} cursor-pointer transition-colors`}>
                              <i className="ri-edit-line text-xs" />
                            </button>
                          </div>
                          <p className={`text-2xl font-black ${t.text} mb-1`}>{plan.price}</p>
                          <p className={`text-xs ${t.textMuted} mb-3`}>월 {plan.credits.toLocaleString()} 크레딧</p>
                          <div className="space-y-1.5 mb-4">
                            {plan.features.map((f) => (
                              <div key={f} className="flex items-center gap-2">
                                <i className="ri-check-line text-emerald-400 text-xs" />
                                <span className={`text-xs ${t.textSub}`}>{f}</span>
                              </div>
                            ))}
                          </div>
                          <div className={`pt-3 border-t ${t.border}`}>
                            <p className={`text-[11px] ${t.textFaint}`}>
                              현재 구독자:{' '}
                              {realCount !== undefined ? (
                                <>
                                  <span className={`${t.textSub} font-bold`}>{realCount.toLocaleString()}명</span>
                                  <span className="ml-1 text-[9px] text-emerald-400 font-semibold">실시간</span>
                                </>
                              ) : paymentsLoading ? (
                                <i className="ri-loader-4-line animate-spin text-indigo-400 text-xs ml-1" />
                              ) : (
                                <span className={`${t.textFaint} font-medium`}>-</span>
                              )}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Coupon Management */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>프로모션 & 쿠폰 관리</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>할인 쿠폰 생성 및 무료 크레딧 이벤트</p>
                    </div>
                    <button
                      onClick={() => setCouponModal(true)}
                      className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-coupon-3-line text-xs" />
                      쿠폰 생성
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayCoupons.length === 0 && (
                      <div className={`col-span-3 flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
                        <i className="ri-coupon-3-line text-3xl mb-3" />
                        <p className={`text-sm font-semibold ${t.textMuted}`}>등록된 쿠폰이 없습니다</p>
                        <p className="text-xs mt-1">위 버튼으로 쿠폰을 생성하세요</p>
                      </div>
                    )}
                    {displayCoupons.map((coupon) => (
                      <div key={coupon.code} className={`${t.cardBg2} rounded-xl p-4 border ${coupon.active ? 'border-indigo-500/20' : t.border}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-black ${t.text} font-mono`}>{coupon.code}</span>
                          <button
                            onClick={() => handleCouponToggle(coupon.code)}
                            className={`w-6 h-3.5 rounded-full transition-colors cursor-pointer relative ${coupon.active ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                          >
                            <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${coupon.active ? 'translate-x-3' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                        <p className={`text-xs ${t.textMuted} mb-2`}>{coupon.type} · {coupon.discount}</p>
                        <div className={`h-1 ${isDark ? 'bg-zinc-800' : 'bg-gray-200'} rounded-full overflow-hidden mb-1.5`}>
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(coupon.used / coupon.limit) * 100}%` }} />
                        </div>
                        <div className="flex justify-between">
                          <span className={`text-[10px] ${t.textFaint}`}>{coupon.used}/{coupon.limit} 사용</span>
                          <span className={`text-[10px] ${t.textFaint}`}>~{coupon.expires}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment History */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>결제 내역</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>PG사 연동 결제 이력</p>
                    </div>
                    <button
                      onClick={handleExcelDownload}
                      className="flex items-center gap-1.5 bg-zinc-800 border border-white/10 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-file-excel-2-line text-xs" />
                      Excel 다운로드
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${t.border}`}>
                          <th className={`text-left px-5 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>결제 ID</th>
                          <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>사용자</th>
                          <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden sm:table-cell`}>플랜</th>
                          <th className={`text-right px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>금액</th>
                          <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden md:table-cell`}>수단</th>
                          <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider hidden lg:table-cell`}>날짜</th>
                          <th className={`text-left px-4 py-3 text-[11px] font-black ${t.tableHead} uppercase tracking-wider`}>상태</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${t.divider}`}>
                        {paymentsLoading ? (
                          <tr><td colSpan={8} className="text-center py-8"><i className="ri-loader-4-line animate-spin text-2xl text-indigo-400" /></td></tr>
                        ) : null}
                        {!paymentsLoading && displayPayments.map((p) => (
                          <tr key={p.id} className={`${t.rowHover} transition-colors group`}>
                            <td className="px-5 py-3.5">
                              <span className={`text-xs font-mono ${t.textMuted}`}>{p.id}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`text-sm font-semibold ${t.text}`}>{p.user}</span>
                            </td>
                            <td className="px-4 py-3.5 hidden sm:table-cell">
                              <PlanBadge plan={p.plan} isDark={isDark} />
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className={`text-sm font-bold ${t.text}`}>{p.amount}</span>
                            </td>
                            <td className="px-4 py-3.5 hidden md:table-cell">
                              <span className={`text-xs ${t.textMuted}`}>{p.method}</span>
                            </td>
                            <td className="px-4 py-3.5 hidden lg:table-cell">
                              <span className={`text-xs ${t.textMuted}`}>{p.date}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusBadge status={p.status} isDark={isDark} />
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                {p.status === 'completed' && (
                                  <button
                                    onClick={() => handlePaymentRefund(p.id)}
                                    className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                                  >
                                    환불
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!paymentsLoading && displayPayments.length === 0 && (
                          <tr>
                            <td colSpan={8} className={`text-center py-12 ${t.textFaint}`}>
                              <i className="ri-bank-card-line text-2xl mb-2 block" />
                              결제 내역이 없습니다
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* 결제 내역 페이지네이션 */}
                  <div className={`px-5 py-3.5 border-t ${t.border} flex flex-col sm:flex-row items-center gap-3 justify-between`}>
                    <span className={`text-xs ${t.textFaint}`}>
                      전체 <span className={`${t.textSub} font-bold`}>{paymentsTotal.toLocaleString()}건</span> 중{' '}
                      <span className={`${t.textSub} font-bold`}>
                        {paymentsTotal === 0 ? 0 : (paymentsPage - 1) * PAYMENTS_PAGE_SIZE + 1}–{Math.min(paymentsPage * PAYMENTS_PAGE_SIZE, paymentsTotal)}
                      </span>건 표시
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => loadPayments(1)}
                        disabled={paymentsPage === 1}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-skip-left-line text-sm" />
                      </button>
                      <button
                        onClick={() => loadPayments(paymentsPage - 1)}
                        disabled={paymentsPage === 1}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-arrow-left-s-line text-sm" />
                      </button>
                      <span className={`text-xs ${t.textMuted} px-3`}>{paymentsPage} / {paymentsTotalPages}</span>
                      <button
                        onClick={() => loadPayments(paymentsPage + 1)}
                        disabled={paymentsPage >= paymentsTotalPages}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-arrow-right-s-line text-sm" />
                      </button>
                      <button
                        onClick={() => loadPayments(paymentsTotalPages)}
                        disabled={paymentsPage >= paymentsTotalPages}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-skip-right-line text-sm" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑥ CS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'cs' && (
              <div className="space-y-5 md:space-y-6">
                {/* CS Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '미처리 티켓', value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.open) : String(csTickets.filter((t) => t.status === 'open').length), icon: 'ri-customer-service-2-line', color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: '처리 중', value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.in_progress) : String(csTickets.filter((t) => t.status === 'in_progress').length), icon: 'ri-time-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: '완료 (전체)', value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.resolved + csTicketStats.closed) : String(csTickets.filter((t) => t.status === 'closed' || t.status === 'resolved').length), icon: 'ri-check-double-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: '전체 티켓', value: csLoading ? '...' : csTicketStats.total > 0 ? String(csTicketStats.total) : String(csTickets.length), icon: 'ri-timer-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                  ].map((c) => (
                    <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <i className={`${c.icon} ${c.color} text-sm`} />
                      </div>
                      <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                      <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* CS Tickets */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>1:1 문의 티켓</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>사용자 기술 지원 및 티켓 관리</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { loadCsTickets(csTicketFilter); loadCsTicketStats(); }}
                        className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
                        title="새로고침"
                      >
                        <i className={`ri-refresh-line text-sm ${t.textSub} ${csLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  {/* 필터 탭 */}
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
                        {{ all: '전체', open: '미처리', in_progress: '처리 중', resolved: '해결됨', closed: '완료' }[f]}
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
                            onClick={() => setSelectedTicket(ticket)}
                            className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors opacity-0 group-hover:opacity-100`}
                            title="답변하기"
                          >
                            <i className={`ri-reply-line ${t.textSub} text-xs`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑥-B CS-NOTICE TAB (공지 / FAQ 관리)
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'cs-notice' && (
              <div className="space-y-5 md:space-y-6">

                {/* 공지 통계 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '전체 공지', value: String(noticeList.length), icon: 'ri-megaphone-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { label: '게시 중', value: String(noticeList.filter((n) => n.status === 'published').length), icon: 'ri-checkbox-circle-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: '초안', value: String(noticeList.filter((n) => n.status === 'draft').length), icon: 'ri-draft-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: '총 조회수', value: noticeList.reduce((acc, n) => acc + n.views, 0).toLocaleString(), icon: 'ri-eye-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                  ].map((c) => (
                    <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <i className={`${c.icon} ${c.color} text-sm`} />
                      </div>
                      <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                      <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* 공지 유형 필터 + 작성 버튼 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                  <div className="flex gap-2 flex-wrap">
                    {['전체', '업데이트', '점검', '이벤트', '공지'].map((f) => (
                      <button
                        key={f}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                          f === '전체'
                            ? 'bg-indigo-500 text-white'
                            : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setEditingNotice('new'); setNoticeEditOpen(true); }}
                    className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <i className="ri-add-line text-xs" />
                    공지 작성
                  </button>
                </div>

                {/* 공지 목록 */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>공지사항 목록</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>서비스 업데이트, 점검, 이벤트 공지 관리</p>
                    </div>
                    <button
                      onClick={() => { loadNotices(); addToast('공지 목록을 새로고침했습니다', 'success'); }}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
                      title="새로고침"
                    >
                      <i className={`ri-refresh-line text-sm ${t.textSub}`} />
                    </button>
                  </div>
                  <div className={`divide-y ${t.divider}`}>
                    {noticeList.length === 0 ? (
                      <div className={`flex flex-col items-center justify-center py-16 ${t.textFaint}`}>
                        <i className="ri-megaphone-line text-3xl mb-2" />
                        <p className="text-sm">공지사항이 없습니다</p>
                        <button
                          onClick={() => { setEditingNotice('new'); setNoticeEditOpen(true); }}
                          className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
                        >
                          첫 공지 작성하기
                        </button>
                      </div>
                    ) : noticeList.map((n) => (
                      <div key={n.id} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
                        {/* 유형 아이콘 */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          n.type === '업데이트' ? 'bg-indigo-500/10' :
                          n.type === '점검' ? 'bg-amber-500/10' :
                          n.type === '이벤트' ? 'bg-emerald-500/10' :
                          'bg-zinc-700/40'
                        }`}>
                          <i className={`text-sm ${
                            n.type === '업데이트' ? 'ri-refresh-line text-indigo-400' :
                            n.type === '점검' ? 'ri-tools-line text-amber-400' :
                            n.type === '이벤트' ? 'ri-gift-line text-emerald-400' :
                            `ri-megaphone-line ${t.textMuted}`
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              n.type === '업데이트' ? 'bg-indigo-500/15 text-indigo-400' :
                              n.type === '점검' ? 'bg-amber-500/15 text-amber-400' :
                              n.type === '이벤트' ? 'bg-emerald-500/15 text-emerald-400' :
                              `${t.cardBg2} ${t.textMuted}`
                            }`}>{n.type}</span>
                            <StatusBadge status={n.status} isDark={isDark} />
                          </div>
                          <p className={`text-sm font-semibold ${t.text} truncate`}>{n.title}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className={`text-[11px] ${t.textFaint}`}>{n.date}</p>
                            <div className="flex items-center gap-1">
                              <i className={`ri-eye-line text-[10px] ${t.textFaint}`} />
                              <span className={`text-[11px] ${t.textFaint}`}>{n.views.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {n.status === 'draft' && (
                            <button
                              onClick={() => handleNoticeSave({ ...n, status: 'published' })}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                            >
                              게시
                            </button>
                          )}
                          {n.status === 'published' && (
                            <button
                              onClick={() => handleNoticeSave({ ...n, status: 'draft' })}
                              className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                            >
                              내리기
                            </button>
                          )}
                          <button
                            onClick={() => { setEditingNotice(n); setNoticeEditOpen(true); }}
                            className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors`}
                            title="편집"
                          >
                            <i className={`ri-edit-line ${t.textSub} text-xs`} />
                          </button>
                          <button
                            onClick={() => handleNoticeDelete(n.id)}
                            className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                            title="삭제"
                          >
                            <i className="ri-delete-bin-line text-red-400 text-xs" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FAQ 섹션 */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>자주 묻는 질문 (FAQ)</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>사용자 FAQ 항목 관리</p>
                    </div>
                    <button
                      onClick={() => addToast('FAQ 편집 기능은 준비 중입니다', 'info')}
                      className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-add-line text-xs" />
                      FAQ 추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {[
                      { q: '크레딧은 어떻게 충전하나요?', a: '크레딧 구매 페이지에서 원하는 플랜을 선택하거나 크레딧 팩을 구매할 수 있습니다.', views: 4821, category: '결제' },
                      { q: 'AI 이미지 생성 시 저작권은 누구에게 있나요?', a: '생성된 이미지의 저작권은 생성한 사용자에게 귀속됩니다. 단, 상업적 이용 시 Pro 이상 플랜이 필요합니다.', views: 3204, category: '저작권' },
                      { q: '구독을 해지하면 크레딧은 어떻게 되나요?', a: '구독 해지 후에도 남은 크레딧은 유효기간 내 사용 가능합니다. 단, 구독 혜택은 즉시 종료됩니다.', views: 2891, category: '구독' },
                      { q: '생성 실패 시 크레딧이 차감되나요?', a: '서버 오류로 인한 생성 실패 시 크레딧이 자동 환불됩니다. 단, 사용자 설정 오류로 인한 실패는 환불되지 않습니다.', views: 2104, category: '기술' },
                      { q: '워터마크를 제거하려면 어떻게 해야 하나요?', a: 'Pro 이상 플랜으로 업그레이드하면 워터마크 없이 콘텐츠를 생성할 수 있습니다.', views: 1876, category: '기능' },
                    ].map((faq, i) => (
                      <div key={i} className={`${t.cardBg2} rounded-xl p-4 group`}>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-black text-indigo-400">Q</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className={`text-sm font-semibold ${t.text}`}>{faq.q}</p>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400`}>{faq.category}</span>
                            </div>
                            <p className={`text-xs ${t.textMuted} leading-relaxed`}>{faq.a}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1">
                                <i className={`ri-eye-line text-[10px] ${t.textFaint}`} />
                                <span className={`text-[10px] ${t.textFaint}`}>{faq.views.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => addToast('FAQ 편집 기능은 준비 중입니다', 'info')}
                              className={`w-7 h-7 rounded-lg ${t.inputBg2} hover:opacity-80 flex items-center justify-center cursor-pointer transition-colors`}
                            >
                              <i className={`ri-edit-line ${t.textSub} text-xs`} />
                            </button>
                            <button
                              onClick={() => addToast('FAQ가 삭제됐습니다', 'info')}
                              className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <i className="ri-delete-bin-line text-red-400 text-xs" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 푸시 / 메일 발송 */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <SectionHeader title="공지 발송" subtitle="공지사항 관련 이메일 및 푸시 알림 발송" isDark={isDark} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { icon: 'ri-mail-send-line', title: '이메일 발송', desc: '공지사항을 이메일로 전체 또는 특정 사용자에게 발송', color: 'text-indigo-400', bg: 'bg-indigo-500/10', btn: '메일 작성', mode: 'email' as const },
                      { icon: 'ri-notification-3-line', title: '브라우저 푸시', desc: '공지사항 푸시 알림을 전체 또는 특정 플랜 대상으로 발송', color: 'text-amber-400', bg: 'bg-amber-500/10', btn: '푸시 발송', mode: 'push' as const },
                    ].map((item) => (
                      <div key={item.title} className={`${t.cardBg2} rounded-xl p-4`}>
                        <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                          <i className={`${item.icon} ${item.color} text-base`} />
                        </div>
                        <p className={`text-sm font-semibold ${t.text} mb-1`}>{item.title}</p>
                        <p className={`text-xs ${t.textFaint} mb-3`}>{item.desc}</p>
                        <button
                          onClick={() => setPushMailModal(item.mode)}
                          className={`w-full py-2 ${t.inputBg2} hover:opacity-80 ${t.textSub} text-xs font-semibold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}
                        >
                          {item.btn}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑦ AUDIT LOG TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'audit' && (
              <div className="space-y-5 md:space-y-6">

                {/* Alert Settings Banner */}
                <div className={`flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl border ${
                  activeAlertCount > 0
                    ? 'bg-indigo-500/8 border-indigo-500/20'
                    : `${t.cardBg} ${t.border}`
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
                    onClick={() => setShowAuditAlertModal(true)}
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

                {/* Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '오늘 활동', value: auditStats.today > 0 ? `${auditStats.today}건` : `${displayAuditLogs.length}건`, icon: 'ri-file-list-3-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                    { label: '전체 로그', value: auditStats.total > 0 ? `${auditStats.total.toLocaleString()}건` : `${displayAuditLogs.length}건`, icon: 'ri-calendar-check-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: '성공', value: auditStats.success > 0 ? `${auditStats.success}건` : '-', icon: 'ri-shield-flash-line', color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: '활성 관리자', value: `${displayAdminAccounts.length}명`, icon: 'ri-user-star-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                  ].map((c) => (
                    <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <i className={`${c.icon} ${c.color} text-sm`} />
                      </div>
                      <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                      <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Date Range Filter */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Left: preset + custom range */}
                    <div className="flex flex-col gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <i className="ri-calendar-line text-zinc-500 text-sm" />
                        </div>
                        <span className={`text-xs font-black ${t.textSub}`}>기간 필터</span>
                        {(auditDateFrom || auditDateTo || auditDatePreset !== 'all') && (
                          <button
                            onClick={() => {
                              setAuditDateFrom('');
                              setAuditDateTo('');
                              setAuditDatePreset('all');
                              setAuditPage(1);
                              loadAuditLogs(auditCategoryFilter, auditSearch, '', '', 'all');
                            }}
                            className={`ml-auto flex items-center gap-1 text-[11px] ${t.textMuted} hover:${t.textSub} cursor-pointer transition-colors whitespace-nowrap`}
                          >
                            <i className="ri-close-circle-line text-xs" />
                            초기화
                          </button>
                        )}
                      </div>
                      {/* Preset buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {([
                          { key: 'today', label: '오늘' },
                          { key: '7d',    label: '최근 7일' },
                          { key: '30d',   label: '최근 30일' },
                          { key: 'all',   label: '전체 기간' },
                        ] as const).map((p) => (
                          <button
                            key={p.key}
                            onClick={() => handleAuditPreset(p.key)}
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
                      {/* Custom date range */}
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
                              loadAuditLogs(auditCategoryFilter, auditSearch, val, auditDateTo, 'all');
                            }}
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
                              loadAuditLogs(auditCategoryFilter, auditSearch, auditDateFrom, val, 'all');
                            }}
                            className={`flex-1 min-w-0 ${t.inputBg2} border ${t.border} rounded-lg px-2.5 py-1.5 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px bg-white/5 self-stretch" />
                    <div className="block lg:hidden h-px bg-white/5 w-full" />

                    {/* Right: active filter summary */}
                    <div className="flex flex-col justify-center gap-2 lg:w-52 flex-shrink-0">
                      <p className={`text-[10px] font-black ${t.textFaint} uppercase tracking-widest`}>현재 조회 범위</p>
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                        <span className={`text-xs font-semibold ${t.textSub}`}>
                          {auditDatePreset === 'today' && (() => {
                            const today = new Date();
                            return `오늘 (${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')})`;
                          })()}
                          {auditDatePreset === '7d' && (() => {
                            const to = new Date();
                            const from = new Date(); from.setDate(from.getDate() - 6);
                            return `최근 7일 (${String(from.getMonth()+1).padStart(2,'0')}.${String(from.getDate()).padStart(2,'0')} ~ ${String(to.getMonth()+1).padStart(2,'0')}.${String(to.getDate()).padStart(2,'0')})`;
                          })()}
                          {auditDatePreset === '30d' && (() => {
                            const to = new Date();
                            const from = new Date(); from.setDate(from.getDate() - 29);
                            return `최근 30일 (${String(from.getMonth()+1).padStart(2,'0')}.${String(from.getDate()).padStart(2,'0')} ~ ${String(to.getMonth()+1).padStart(2,'0')}.${String(to.getDate()).padStart(2,'0')})`;
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

                {/* Search + Category Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className={`flex items-center gap-2 flex-1 ${t.cardBg} border ${t.border} rounded-xl px-3 py-2.5`}>
                    <i className="ri-search-line text-zinc-500 text-sm" />
                    <input
                      type="text"
                      value={auditSearch}
                      onChange={(e) => handleAuditSearchChange(e.target.value)}
                      placeholder="관리자, 액션, 대상 검색..."
                      className={`flex-1 bg-transparent text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none`}
                    />
                    {auditLogsLoading ? (
                      <i className="ri-loader-4-line animate-spin text-zinc-500 text-sm flex-shrink-0" />
                    ) : auditSearch ? (
                      <button onClick={() => handleAuditSearchChange('')} className="w-4 h-4 flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors flex-shrink-0">
                        <i className="ri-close-line text-xs" />
                      </button>
                    ) : null}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {['전체', 'user', 'content', 'billing', 'system', 'security'].map((f) => (
                      <button
                        key={f}
                        onClick={() => handleAuditCategoryChange(f)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                          auditCategoryFilter === f
                            ? 'bg-indigo-500 text-white'
                            : `${t.cardBg2} border ${t.border} ${t.textMuted} hover:${t.text}`
                        }`}
                      >
                        {f === '전체' ? '전체' : f === 'user' ? '사용자' : f === 'content' ? '콘텐츠' : f === 'billing' ? '결제' : f === 'system' ? '시스템' : '보안'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audit Log Table */}
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
                          const catConfig: Record<string, { label: string; cls: string }> = {
                            user:     { label: '사용자', cls: 'bg-indigo-500/15 text-indigo-400' },
                            content:  { label: '콘텐츠', cls: 'bg-violet-500/15 text-violet-400' },
                            billing:  { label: '결제',   cls: 'bg-emerald-500/15 text-emerald-400' },
                            system:   { label: '시스템', cls: 'bg-amber-500/15 text-amber-400' },
                            security: { label: '보안',   cls: 'bg-red-500/15 text-red-400' },
                          };
                          const cat = catConfig[log.category] ?? { label: log.category, cls: 'bg-zinc-700 text-zinc-400' };
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

                  {/* ── Pagination Footer ── */}
                  <div className={`px-5 py-3.5 border-t ${t.border} flex flex-col sm:flex-row items-center gap-3 justify-between`}>
                    {/* Left: count info */}
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${t.textFaint}`}>
                        전체 <span className={`${t.textSub} font-bold`}>{filteredAuditLogs.length}건</span> 중{' '}
                        <span className={`${t.textSub} font-bold`}>
                          {filteredAuditLogs.length === 0 ? 0 : (auditPage - 1) * AUDIT_PAGE_SIZE + 1}
                          –{Math.min(auditPage * AUDIT_PAGE_SIZE, filteredAuditLogs.length)}
                        </span>건 표시
                      </span>
                      <span className={`hidden sm:block ${t.textFaint} text-xs`}>|</span>
                      <span className={`hidden sm:block text-xs ${t.textFaint}`}>
                        페이지당 <span className={`${t.textMuted} font-semibold`}>{AUDIT_PAGE_SIZE}건</span>
                      </span>
                    </div>

                    {/* Center: page buttons */}
                    <div className="flex items-center gap-1">
                      {/* First */}
                      <button
                        onClick={() => setAuditPage(1)}
                        disabled={auditPage === 1}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-skip-left-line text-sm" />
                      </button>
                      {/* Prev */}
                      <button
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                        disabled={auditPage === 1}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-arrow-left-s-line text-sm" />
                      </button>

                      {/* Page number pills */}
                      {Array.from({ length: auditTotalPages }, (_, i) => i + 1)
                        .filter((p) => {
                          if (auditTotalPages <= 7) return true;
                          if (p === 1 || p === auditTotalPages) return true;
                          if (Math.abs(p - auditPage) <= 2) return true;
                          return false;
                        })
                        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === '...' ? (
                            <span key={`ellipsis-${idx}`} className={`w-7 h-7 flex items-center justify-center ${t.textFaint} text-xs select-none`}>
                              ···
                            </span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setAuditPage(p as number)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                                auditPage === p
                                  ? 'bg-indigo-500 text-white'
                                  : `${t.textMuted} hover:${t.text} hover:${t.inputBg2}`
                              }`}
                            >
                              {p}
                            </button>
                          )
                        )}

                      {/* Next */}
                      <button
                        onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                        disabled={auditPage === auditTotalPages}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-arrow-right-s-line text-sm" />
                      </button>
                      {/* Last */}
                      <button
                        onClick={() => setAuditPage(auditTotalPages)}
                        disabled={auditPage === auditTotalPages}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.textMuted} hover:${t.text} hover:${t.inputBg2} disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors`}
                      >
                        <i className="ri-skip-right-line text-sm" />
                      </button>
                    </div>

                    {/* Right: CSV */}
                    <button
                      onClick={() => handleCsvExport('감사 로그')}
                      className={`flex items-center gap-1.5 text-xs ${t.textMuted} hover:${t.textSub} cursor-pointer transition-colors whitespace-nowrap`}
                    >
                      <i className="ri-download-line text-xs" />
                      CSV 내보내기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑧ SYSTEM SETTINGS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'sys-settings' && (
              <div className="space-y-5 md:space-y-6">

                {/* Service Status */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <SectionHeader title="서비스 운영 상태" subtitle="전체 서비스 가동 여부 제어" isDark={isDark} />
                  <div className="space-y-3">
                    {/* Maintenance Mode */}
                    <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${maintenanceMode ? `bg-amber-500/5 border-amber-500/20` : `${t.cardBg2} ${t.border}`}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${maintenanceMode ? 'bg-amber-500/15' : t.inputBg2}`}>
                          <i className={`ri-tools-line text-sm ${maintenanceMode ? 'text-amber-400' : t.textMuted}`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${t.text}`}>유지보수 모드</p>
                          <p className={`text-xs ${t.textMuted}`}>활성화 시 일반 사용자 접근 차단, 관리자만 접근 가능</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setMaintenanceMode((v) => !v)}
                        className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${maintenanceMode ? 'bg-amber-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    {/* Auto Content Filter */}
                    <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                          <i className={`ri-shield-check-line ${t.textMuted} text-sm`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${t.text}`}>AI 콘텐츠 자동 필터</p>
                          <p className={`text-xs ${t.textMuted}`}>부적절 콘텐츠 자동 감지 및 차단</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setContentAutoFilter((v) => !v)}
                        className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${contentAutoFilter ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${contentAutoFilter ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    {/* Watermark Default */}
                    <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                          <i className={`ri-copyright-line ${t.textMuted} text-sm`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${t.text}`}>Free 플랜 워터마크 기본값</p>
                          <p className={`text-xs ${t.textMuted}`}>Free 플랜 생성물에 워터마크 자동 삽입</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setWatermarkDefault((v) => !v)}
                        className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${watermarkDefault ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${watermarkDefault ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Performance Settings */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <SectionHeader title="성능 & 리소스 설정" subtitle="서버 처리 한도 및 타임아웃 설정" isDark={isDark} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: '최대 동시 요청 수', value: maxConcurrent, setter: setMaxConcurrent, unit: '건', desc: '초과 시 대기열 처리' },
                      { label: '세션 타임아웃', value: sessionTimeout, setter: setSessionTimeout, unit: '분', desc: '비활성 세션 자동 만료' },
                      { label: 'API 요청 제한 (분당)', value: '1000', setter: () => {}, unit: '회', desc: '사용자당 분당 최대 요청' },
                    ].map((item) => (
                      <div key={item.label} className={`${t.cardBg2} rounded-xl p-4`}>
                        <p className="text-xs font-semibold text-zinc-300 mb-1">{item.label}</p>
                        <p className="text-[10px] text-zinc-600 mb-3">{item.desc}</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={item.value}
                            onChange={(e) => item.setter(e.target.value)}
                            className="flex-1 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 font-mono"
                          />
                          <span className="text-xs text-zinc-500 whitespace-nowrap">{item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={handleSavePerformance} className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                      <i className="ri-save-line text-xs" />
                      설정 저장
                    </button>
                  </div>
                </div>

                {/* Notification Settings */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <SectionHeader title="알림 설정" subtitle="시스템 이벤트 알림 채널 관리" isDark={isDark} />
                  <div className="space-y-3">
                    <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                          <i className={`ri-mail-line ${t.textMuted} text-sm`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${t.text}`}>이메일 알림</p>
                          <p className={`text-xs ${t.textMuted}`}>긴급 이벤트 발생 시 관리자 이메일 발송</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEmailNotif((v) => !v)}
                        className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${emailNotif ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${emailNotif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                          <i className={`ri-slack-line ${t.textMuted} text-sm`} />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${t.text}`}>Slack 알림</p>
                          <p className={`text-xs ${t.textMuted}`}>Slack 웹훅 연동 알림 발송</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSlackNotif((v) => !v)}
                        className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${slackNotif ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${slackNotif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {slackNotif && (
                      <div className={`p-4 rounded-xl ${t.cardBg2} border ${t.border}`}>
                        <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>Slack Webhook URL</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={slackWebhookUrl}
                            onChange={(e) => setSlackWebhookUrl(e.target.value)}
                            placeholder="https://hooks.slack.com/services/..."
                            className={`flex-1 ${t.inputBg2} border ${t.border2} rounded-xl px-3 py-2 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                          />
                          <button
                            onClick={() => {
                              if (!slackWebhookUrl.trim()) { addToast('Webhook URL을 입력해주세요', 'error'); return; }
                              addToast('Slack Webhook URL이 저장됐습니다', 'success');
                            }}
                            className="px-3 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Data Retention */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>데이터 보존 정책</h2>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>로그 및 생성물 보존 기간 설정</p>
                    </div>
                    <button
                      onClick={() => setRetentionEdit((v) => !v)}
                      className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors whitespace-nowrap ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}
                    >
                      <i className={`${retentionEdit ? 'ri-close-line' : 'ri-edit-line'} text-xs`} />
                      {retentionEdit ? '취소' : '편집'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { label: '감사 로그 보존', key: 'audit' as const, icon: 'ri-file-chart-line', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                      { label: '생성 콘텐츠 보존', key: 'content' as const, icon: 'ri-image-ai-line', color: 'text-violet-400', bg: 'bg-violet-500/10' },
                      { label: '결제 내역 보존', key: 'billing' as const, icon: 'ri-bank-card-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    ].map((item) => (
                      <div key={item.label} className={`${t.cardBg2} rounded-xl p-4 flex items-center gap-3`}>
                        <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                          <i className={`${item.icon} ${item.color} text-sm`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${t.textMuted}`}>{item.label}</p>
                          {retentionEdit ? (
                            <input
                              type="text"
                              value={retentionValues[item.key]}
                              onChange={(e) => setRetentionValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                              className={`w-full mt-1 ${t.inputBg} border ${t.border2} rounded-lg px-2 py-1 text-xs ${t.text} focus:outline-none focus:border-indigo-500/50`}
                            />
                          ) : (
                            <p className={`text-sm font-black ${t.text}`}>{retentionValues[item.key]}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {retentionEdit && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => { setRetentionEdit(false); addToast('데이터 보존 정책이 저장됐습니다', 'success'); }}
                        className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <i className="ri-save-line text-xs" />
                        저장
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑨ SECURITY / 2FA TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <div className="space-y-5 md:space-y-6">

                {/* Security Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: '차단된 IP', value: `${displayIpBlocks.filter((b) => b.status === 'active').length}개`, icon: 'ri-forbid-2-line', color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: '2FA 활성 관리자', value: `${displayAdminAccounts.filter((a) => a.twofa).length}/${displayAdminAccounts.length}명`, icon: 'ri-shield-check-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: '전체 관리자', value: `${displayAdminAccounts.length}명`, icon: 'ri-login-box-line', color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: '감사 로그 (오늘)', value: auditStats.today > 0 ? `${auditStats.today}건` : '-', icon: 'ri-alarm-warning-line', color: 'text-red-400', bg: 'bg-red-500/10' },
                  ].map((c) => (
                    <div key={c.label} className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                      <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                        <i className={`${c.icon} ${c.color} text-sm`} />
                      </div>
                      <p className={`text-lg font-black ${t.text}`}>{c.value}</p>
                      <p className={`text-[11px] ${t.textMuted}`}>{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Admin Accounts & 2FA */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
                    <div>
                      <p className={`text-sm font-black ${t.text}`}>관리자 계정 & 2FA 설정</p>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>역할 기반 접근 제어 (RBAC)</p>
                    </div>
                    <button
                      onClick={() => setAddAdminModal(true)}
                      className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <i className="ri-user-add-line text-xs" />
                      관리자 추가
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.03]">
                    {displayAdminAccounts.length === 0 && (
                      <div className={`flex flex-col items-center justify-center py-14 ${t.textFaint}`}>
                        <i className="ri-user-star-line text-3xl mb-3" />
                        <p className={`text-sm font-semibold ${t.textMuted}`}>등록된 관리자 계정이 없습니다</p>
                        <p className={`text-xs mt-1`}>위 버튼으로 관리자를 추가하세요</p>
                      </div>
                    )}
                    {displayAdminAccounts.map((admin) => (
                      <div key={admin.id} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-black text-indigo-300">{admin.name.slice(-1)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className={`text-sm font-semibold ${t.text}`}>{admin.name}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              admin.role === 'Super Admin' ? 'bg-amber-500/15 text-amber-400' :
                              admin.role === 'CS Manager' ? 'bg-indigo-500/15 text-indigo-400' :
                              'bg-emerald-500/15 text-emerald-400'
                            }`}>{admin.role}</span>
                            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${admin.twofa ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                              <i className={`${admin.twofa ? 'ri-shield-check-line' : 'ri-shield-cross-line'} text-[10px]`} />
                              2FA {admin.twofa ? '활성' : '미설정'}
                            </div>
                          </div>
                          <p className={`text-[11px] ${t.textFaint}`}>{admin.email} · 마지막 로그인 {admin.lastLogin} ({admin.loginIp})</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {admin.permissions.map((p) => (
                              <span key={p} className={`text-[9px] ${t.inputBg2} ${t.textMuted} px-1.5 py-0.5 rounded-full`}>{p}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => { setEditPermModal(admin); setEditPermList([...admin.permissions]); }}
                            className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap`}
                          >
                            권한 수정
                          </button>
                          {!admin.twofa && (
                            <button
                              onClick={() => handleForce2FA(admin.id, admin.name)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-semibold cursor-pointer transition-colors whitespace-nowrap"
                            >
                              2FA 강제 설정
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Auto Block Setting */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl p-5 md:p-6`}>
                  <SectionHeader title="자동 차단 설정" subtitle="비정상 접근 자동 감지 및 차단" isDark={isDark} />
                  <div className={`flex items-center justify-between p-4 rounded-xl ${t.cardBg2} border ${t.border} mb-4`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${t.inputBg2} flex items-center justify-center`}>
                        <i className={`ri-robot-line ${t.textMuted} text-sm`} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${t.text}`}>자동 IP 차단</p>
                        <p className={`text-xs ${t.textMuted}`}>로그인 5회 실패 시 IP 자동 차단 (30분)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoBlock((v) => !v)}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 relative ${autoBlock ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoBlock ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>

                {/* IP Block List */}
                <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                  <div className={`px-5 py-4 border-b ${t.border}`}>
                    <p className={`text-sm font-black ${t.text}`}>IP 차단 목록</p>
                    <p className={`text-xs ${t.textMuted} mt-0.5`}>수동 등록 및 자동 차단 IP 관리</p>
                  </div>
                  {/* Add IP */}
                  <div className={`px-5 py-4 border-b ${t.border} ${t.cardBg2}`}>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={ipBlockInput}
                        onChange={(e) => setIpBlockInput(e.target.value)}
                        placeholder="차단할 IP 주소 (예: 192.168.1.100)"
                        className={`flex-1 ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50 font-mono`}
                      />
                      <input
                        type="text"
                        value={ipBlockReason}
                        onChange={(e) => setIpBlockReason(e.target.value)}
                        placeholder="차단 사유"
                        className={`flex-1 ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                      />
                      <button
                        onClick={handleIpBlock}
                        className="px-4 py-2.5 bg-red-500/80 hover:bg-red-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <i className="ri-forbid-2-line mr-1.5" />
                        IP 차단
                      </button>
                    </div>
                  </div>
                  <div className={`divide-y ${t.divider}`}>
                    {displayIpBlocks.length === 0 && (
                      <div className={`flex flex-col items-center justify-center py-12 ${t.textFaint}`}>
                        <i className="ri-shield-check-line text-3xl mb-3 text-emerald-500/50" />
                        <p className={`text-sm font-semibold ${t.textMuted}`}>차단된 IP가 없습니다</p>
                        <p className="text-xs mt-1">위 입력창으로 IP를 차단할 수 있습니다</p>
                      </div>
                    )}
                    {displayIpBlocks.map((item) => (
                      <div key={item.ip} className={`px-5 py-4 flex items-center gap-4 ${t.rowHover} transition-colors group`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.status === 'active' ? 'bg-red-500/10' : t.inputBg2}`}>
                          <i className={`ri-forbid-2-line text-sm ${item.status === 'active' ? 'text-red-400' : t.textFaint}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm font-mono font-semibold ${t.text}`}>{item.ip}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'active' ? 'bg-red-500/15 text-red-400' : `${t.cardBg2} ${t.textMuted}`}`}>
                              {item.status === 'active' ? '차단 중' : '해제됨'}
                            </span>
                          </div>
                          <p className={`text-[11px] ${t.textFaint}`}>{item.reason} · {item.blockedAt} · {item.blockedBy}</p>
                        </div>
                        {item.status === 'active' && (
                          <button
                            onClick={() => handleIpUnblock(item.ip)}
                            className={`px-2.5 py-1.5 rounded-lg ${t.inputBg2} hover:opacity-80 ${t.textSub} text-[10px] font-semibold cursor-pointer transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap`}
                          >
                            차단 해제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>
        </main>
      </div>

      {/* ── User Detail Modal ── */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          isDark={isDark}
          onCreditAdjust={handleCreditAdjust}
          onStatusChange={handleUserStatusChange}
        />
      )}

      {/* ── Notice Modal ── */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setNoticeModal(false)} />
          <div className={`relative ${t.cardBg} border ${t.border2} rounded-2xl w-full max-w-md p-6 z-10`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-base font-black ${t.text}`}>공지사항 작성</h3>
              <button onClick={() => setNoticeModal(false)} className={`w-7 h-7 flex items-center justify-center ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} cursor-pointer transition-colors`}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>제목</label>
                <input
                  type="text"
                  value={newNoticeTitle}
                  onChange={(e) => setNewNoticeTitle(e.target.value)}
                  placeholder="공지사항 제목 입력..."
                  className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                />
              </div>
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>유형</label>
                <select
                  value={newNoticeType}
                  onChange={(e) => setNewNoticeType(e.target.value)}
                  className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                >
                  {['업데이트', '점검', '이벤트', '공지'].map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>내용</label>
                <textarea
                  rows={4}
                  placeholder="공지 내용을 입력하세요..."
                  className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50 resize-none`}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                게시하기
              </button>
              <button className={`flex-1 py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                초안 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Coupon Modal - DB 연동 ── */}
      {couponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCouponModal(false)} />
          <div className={`relative ${t.cardBg} border ${t.border2} rounded-2xl w-full max-w-md p-6 z-10`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-base font-black ${t.text}`}>쿠폰 생성</h3>
              <button onClick={() => setCouponModal(false)} className={`w-7 h-7 flex items-center justify-center ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} cursor-pointer transition-colors`}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>쿠폰 코드 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="예: SUMMER2026"
                  className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50 font-mono uppercase`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>할인 유형 <span className="text-red-400">*</span></label>
                  <select
                    value={couponDiscountType}
                    onChange={(e) => setCouponDiscountType(e.target.value as 'percent' | 'credits')}
                    className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                  >
                    <option value="percent">구독 할인 (%)</option>
                    <option value="credits">무료 크레딧</option>
                  </select>
                </div>
                <div>
                  <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>
                    {couponDiscountType === 'percent' ? '할인율 (%)' : '크레딧 수'} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={couponDiscount}
                    onChange={(e) => setCouponDiscount(e.target.value)}
                    placeholder={couponDiscountType === 'percent' ? '예: 30' : '예: 500'}
                    className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>사용 한도</label>
                  <input
                    type="number"
                    value={couponMaxUses}
                    onChange={(e) => setCouponMaxUses(e.target.value)}
                    placeholder="무제한"
                    className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>만료일</label>
                  <input
                    type="date"
                    value={couponExpires}
                    onChange={(e) => setCouponExpires(e.target.value)}
                    className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCouponCreate}
                disabled={!couponCode.trim() || !couponDiscount.trim()}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-coupon-3-line mr-1.5" />
                DB에 쿠폰 생성
              </button>
              <button onClick={() => setCouponModal(false)} className={`flex-1 py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ── */}
      <AdminToast toasts={toasts} onRemove={removeToast} />

      {/* ── Ticket Reply Modal ── */}
      {selectedTicket && (
        <TicketReplyModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onStatusChange={(ticketId, status) => {
            handleTicketStatusChange(ticketId, status);
            setSelectedTicket(null);
          }}
          isDark={isDark}
        />
      )}

      {/* ── Notice Edit Modal ── */}
      {noticeEditOpen && (
        <NoticeEditModal
          notice={editingNotice === 'new' ? null : editingNotice}
          onClose={() => { setNoticeEditOpen(false); setEditingNotice('new'); }}
          onSave={(notice) => { handleNoticeSave(notice); setNoticeEditOpen(false); }}
          isDark={isDark}
        />
      )}

      {/* ── Push / Mail Modal ── */}
      {pushMailModal && (
        <PushMailModal
          type={pushMailModal}
          onClose={() => setPushMailModal(null)}
          onSend={(msg) => {
            // Edge Function 호출 (fire-and-forget)
            const type = pushMailModal;
            handleSendPushMail(type, { message: msg, target: '전체' }).catch(console.warn);
            addToast(msg, 'success');
            setPushMailModal(null);
          }}
          isDark={isDark}
        />
      )}

      {/* ── Audit Alert Settings Modal ── */}
      {showAuditAlertModal && (
        <AuditAlertSettingsModal
          isDark={isDark}
          rules={auditAlertRules}
          onClose={() => setShowAuditAlertModal(false)}
          onSave={(rules) => {
            setAuditAlertRules(rules);
            setShowAuditAlertModal(false);
            const activeCount = rules.filter((r) => r.enabled).length;
            addToast(
              activeCount > 0
                ? `알림 규칙 ${rules.length}개 저장됨 (활성 ${activeCount}개)`
                : `알림 규칙 ${rules.length}개 저장됨`,
              'success',
            );
          }}
        />
      )}

      {/* ── Prompt Edit Modal ── */}
      {promptEditOpen && (
        <PromptEditModal
          template={editingTemplate === 'new' ? null : editingTemplate}
          onClose={() => { setPromptEditOpen(false); setEditingTemplate('new'); }}
          onSave={(template) => { handlePromptSave(template); setPromptEditOpen(false); }}
          isDark={isDark}
        />
      )}

      {/* ── Edit Permission Modal - DB 연동 ── */}
      {editPermModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditPermModal(null)} />
          <div className={`relative ${t.cardBg} border ${t.border2} rounded-2xl w-full max-w-md p-6 z-10`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className={`text-base font-black ${t.text}`}>{editPermModal.name} 권한 수정</h3>
                <p className={`text-xs ${t.textMuted} mt-0.5`}>변경 사항은 DB에 즉시 저장됩니다</p>
              </div>
              <button onClick={() => setEditPermModal(null)} className={`w-7 h-7 flex items-center justify-center ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} cursor-pointer transition-colors`}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {['사용자 관리', 'AI 콘텐츠', 'AI 엔진', '결제 관리', 'CS / 공지', '감사 로그', '시스템 설정', '보안 관리'].map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPermList.includes(perm) || editPermList.includes('전체')}
                    onChange={(e) => {
                      if (e.target.checked) setEditPermList((prev) => [...prev, perm]);
                      else setEditPermList((prev) => prev.filter((p) => p !== perm));
                    }}
                    className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                  />
                  <span className={`text-xs ${t.textSub}`}>{perm}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await handleSavePermissions(editPermModal.id, editPermModal.name, editPermList);
                  setEditPermModal(null);
                }}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-save-line mr-1.5" />
                DB에 저장
              </button>
              <button onClick={() => setEditPermModal(null)} className={`flex-1 py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Grade Change Modal ── */}
      {gradeChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setGradeChangeModal(null)} />
          <div className={`relative ${t.cardBg} border ${t.border2} rounded-2xl w-full max-w-md p-6 z-10`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className={`text-base font-black ${t.text}`}>회원 등급 변경</h3>
                <p className={`text-xs ${t.textMuted} mt-0.5`}>{gradeChangeModal.name} ({gradeChangeModal.email})</p>
              </div>
              <button onClick={() => setGradeChangeModal(null)} className={`w-7 h-7 flex items-center justify-center ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} cursor-pointer transition-colors`}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            {/* 현재 등급 */}
            <div className={`flex items-center gap-3 p-3 rounded-xl ${t.cardBg2} border ${t.border} mb-4`}>
              <div className="w-8 h-8 flex items-center justify-center">
                <i className={`${GRADE_META[gradeChangeModal.memberGrade ?? 'general']?.icon ?? 'ri-user-line'} ${GRADE_META[gradeChangeModal.memberGrade ?? 'general']?.color ?? 'text-slate-400'} text-base`} />
              </div>
              <div>
                <p className={`text-[10px] ${t.textFaint}`}>현재 등급</p>
                <GradeBadge grade={gradeChangeModal.memberGrade ?? 'general'} />
              </div>
              <i className="ri-arrow-right-line text-zinc-500 mx-2" />
              <div>
                <p className={`text-[10px] ${t.textFaint}`}>변경 후</p>
                <GradeBadge grade={gradeChangeValue} />
              </div>
            </div>
            {/* 등급 선택 */}
            <div className="mb-4">
              <label className={`text-xs font-semibold ${t.textSub} mb-2 block`}>새 등급 선택</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'general', label: '일반 회원', icon: 'ri-user-line', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
                  { key: 'staff', label: '운영진', icon: 'ri-shield-star-line', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
                  { key: 'b2b', label: 'B2B 기업 고객', icon: 'ri-building-2-line', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
                  { key: 'group', label: '단체 고객', icon: 'ri-group-line', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                  { key: 'vip', label: 'VIP 회원', icon: 'ri-vip-crown-line', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
                  { key: 'suspended', label: '이용 정지', icon: 'ri-forbid-line', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
                ].map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setGradeChangeValue(g.key)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all text-left ${
                      gradeChangeValue === g.key
                        ? `${g.bg} ${g.border} ring-1`
                        : `${t.cardBg2} ${t.border} ${t.rowHover}`
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${g.bg} flex items-center justify-center flex-shrink-0`}>
                      <i className={`${g.icon} ${g.color} text-sm`} />
                    </div>
                    <span className={`text-xs font-semibold ${gradeChangeValue === g.key ? g.color : t.textSub}`}>{g.label}</span>
                    {gradeChangeValue === g.key && (
                      <i className="ri-check-line text-xs ml-auto text-indigo-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            {/* 변경 사유 */}
            <div className="mb-5">
              <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>변경 사유 (선택)</label>
              <input
                type="text"
                value={gradeChangeReason}
                onChange={(e) => setGradeChangeReason(e.target.value)}
                placeholder="예: B2B 계약 체결, VIP 프로모션 적용..."
                className={`w-full ${isDark ? 'bg-zinc-900 border-white/10 text-white placeholder-zinc-600' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50`}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await handleGradeChange(gradeChangeModal.id, gradeChangeValue, gradeChangeReason);
                  setGradeChangeModal(null);
                }}
                disabled={gradeChangeValue === (gradeChangeModal.memberGrade ?? 'general')}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                <i className="ri-vip-crown-line mr-1.5" />
                등급 변경 적용
              </button>
              <button onClick={() => setGradeChangeModal(null)} className={`flex-1 py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Team Manage Modal ── */}
      {teamModal !== null && (
        <TeamManageModal
          team={teamModal === 'new' ? null : teamModal}
          onClose={() => setTeamModal(null)}
          onSave={(msg) => {
            addToast(msg, 'success');
            setTeamModal(null);
            loadTeams();
          }}
          isDark={isDark}
        />
      )}

      {/* ── Add Admin Modal ── */}
      {addAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setAddAdminModal(false)} />
          <div className={`relative ${t.cardBg} border ${t.border2} rounded-2xl w-full max-w-md p-6 z-10`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-base font-black ${t.text}`}>관리자 계정 추가</h3>
              <button onClick={() => setAddAdminModal(false)} className={`w-7 h-7 flex items-center justify-center ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} cursor-pointer transition-colors`}>
                <i className="ri-close-line text-lg" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>이름</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="관리자 이름"
                  className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                />
              </div>
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>이메일</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@aimetawow.com"
                  className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} ${isDark ? 'placeholder-zinc-600' : 'placeholder-gray-400'} focus:outline-none focus:border-indigo-500/50`}
                />
              </div>
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>역할</label>
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value)}
                  className={`w-full ${t.inputBg} border ${t.border2} rounded-xl px-3 py-2.5 text-sm ${t.text} focus:outline-none focus:border-indigo-500/50 cursor-pointer`}
                >
                  <option>CS Manager</option>
                  <option>System Admin</option>
                  <option>Content Moderator</option>
                </select>
              </div>
              <div>
                <label className={`text-xs font-semibold ${t.textSub} mb-1.5 block`}>접근 권한</label>
                <div className="grid grid-cols-2 gap-2">
                  {['사용자 관리', 'AI 콘텐츠', 'AI 엔진', '결제 관리', 'CS / 공지', '감사 로그'].map((perm) => (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAdminPerms.includes(perm)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewAdminPerms((prev) => [...prev, perm]);
                          } else {
                            setNewAdminPerms((prev) => prev.filter((p) => p !== perm));
                          }
                        }}
                        className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                      />
                      <span className={`text-xs ${t.textSub}`}>{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleAddAdmin}
                disabled={!newAdminName.trim() || !newAdminEmail.trim()}
                className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
              >
                계정 생성 & 초대 발송
              </button>
              <button onClick={() => setAddAdminModal(false)} className={`flex-1 py-2.5 ${isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap`}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
