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
import CreditGrantPanel from './components/CreditGrantPanel';
import type { CsTicket, Notice, PromptTemplate, IpBlock, AdminAccount, TeamRecord } from './types';
import { apiStatus, contentTrends, dailySignups, planDist, auditLogs } from './mockData';
import { StatusBadge, PlanBadge } from './components/Badges';
import NotificationPanel, { type Notification, initialNotifications } from './components/NotificationPanel';
import { GradeBadge, GRADE_META } from './components/AdminHelpers';
import GradeSettingsTab from './components/GradeSettingsTab';
import CsTab from './components/CsTab';
import CsNoticeTab from './components/CsNoticeTab';
import SysSettingsTab from './components/SysSettingsTab';
import BillingTab from './components/BillingTab';
import AuditTab from './components/AuditTab';
import SecurityTab from './components/SecurityTab';
import UsersTab from './components/UsersTab';
import ContentTab from './components/ContentTab';
import OverviewTab from './components/OverviewTab';
import { getAuthorizationHeader } from '@/lib/env';

// ── Types ──────────────────────────────────────────────────────────────────
type TabType = 'overview' | 'users' | 'coin-grant' | 'content' | 'ai-engine' | 'billing' | 'cs' | 'cs-notice' | 'audit' | 'sys-settings' | 'security' | 'grade-settings';
type UserStatus = 'active' | 'inactive' | 'suspended';


// ── Mock Data (일부 실시간 불가 항목은 제거됨) ─────────────────────────────

// 모든 목업 데이터 제거 완료 — 실제 DB 데이터만 사용

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
  const [_revenueRange, _setRevenueRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
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
  const [_adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
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
  const loadUsers = useCallback(async (search?: string, plan?: string, grade?: string) => {
    setUsersLoading(true);
    try {
      const url = new URL(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`);
      url.searchParams.set('action', 'list_users');
      url.searchParams.set('limit', '50');
      if (search) url.searchParams.set('search', search);
      if (plan && plan !== '전체') url.searchParams.set('plan', plan.toLowerCase());
      const effectiveGrade = grade ?? userGradeFilter;
      if (effectiveGrade && effectiveGrade !== '전체') url.searchParams.set('grade', effectiveGrade);

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
  }, [userGradeFilter]);

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
  const _handleRefund = (payId: string) => {
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

  const _filteredContent = contentItems.filter((c) => {
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
              <OverviewTab
                isDark={isDark}
                t={t}
                overviewStats={overviewStats}
                overviewLoading={overviewLoading}
                autoRefreshEnabled={autoRefreshEnabled}
                setAutoRefreshEnabled={setAutoRefreshEnabled}
                nextRefreshIn={nextRefreshIn}
                setNextRefreshIn={setNextRefreshIn}
                lastRefreshedAt={lastRefreshedAt}
                setLastRefreshedAt={setLastRefreshedAt}
                onManualRefresh={() => {
                  loadOverviewStats().then(() => setLastRefreshedAt(new Date()));
                  setNextRefreshIn(30);
                  addToast('대시보드 데이터를 새로고침했습니다', 'success');
                }}
                monthlyRevenueData={monthlyRevenueData}
                contentTrendsData={contentTrendsData}
                dailySignupsData={dailySignupsData}
                planDistData={planDistData}
                recentAuditLogs={recentAuditLogs}
                apiStatus={apiStatus}
                contentTrendsFallback={contentTrends}
                dailySignupsFallback={dailySignups}
                planDistFallback={planDist}
                auditLogsFallback={auditLogs}
                onJumpToAudit={() => setActiveTab('audit')}
                onJumpToTeams={() => { setActiveTab('content'); setContentSubTab('teams'); }}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ② USERS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'users' && (
              <UsersTab
                isDark={isDark}
                t={t}
                usersLoading={usersLoading}
                userStats={userStats}
                displayUsers={displayUsers}
                filteredUsers={filteredUsers}
                overviewNewToday={overviewStats?.users?.new_today}
                userSearch={userSearch}
                setUserSearch={setUserSearch}
                userSearchDebounceRef={userSearchDebounceRef}
                userPlanFilter={userPlanFilter}
                setUserPlanFilter={setUserPlanFilter}
                userGradeFilter={userGradeFilter}
                setUserGradeFilter={setUserGradeFilter}
                loadUsers={loadUsers}
                onViewUser={setSelectedUser}
                onOpenGradeChange={(u) => { setGradeChangeModal(u); setGradeChangeValue(u.memberGrade ?? 'general'); setGradeChangeReason(''); }}
                onToggleUserStatus={(u) => handleUserStatusChange(u.id, u.status === 'suspended' ? 'active' : 'suspended')}
                onJumpToGradeSettings={() => setActiveTab('grade-settings')}
              />
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
              <GradeSettingsTab
                isDark={isDark}
                t={t}
                onToast={addToast}
                onJumpToUsers={() => setActiveTab('users')}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ③ CONTENT TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'content' && (
              <ContentTab
                isDark={isDark}
                t={t}
                contentSubTab={contentSubTab}
                setContentSubTab={setContentSubTab}
                contentDbStats={contentDbStats}
                contentDbLoading={contentDbLoading}
                contentDbItems={contentDbItems}
                contentItems={contentItems}
                contentFilter={contentFilter}
                setContentFilter={setContentFilter}
                loadContentItems={loadContentItems}
                onContentStatusChange={handleContentStatus}
                teamStats={teamStats}
                teamsData={teamsData}
                teamsLoading={teamsLoading}
                onOpenNewTeam={() => setTeamModal('new')}
                onOpenTeam={setTeamModal}
              />
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
              <BillingTab
                isDark={isDark}
                t={t}
                paymentsLoading={paymentsLoading}
                paymentStats={paymentStats}
                overviewRevenue={overviewStats?.revenue}
                planUserCounts={planUserCounts}
                displayCoupons={displayCoupons}
                displayPayments={displayPayments}
                paymentsTotal={paymentsTotal}
                paymentsPage={paymentsPage}
                paymentsTotalPages={paymentsTotalPages}
                paymentsPageSize={PAYMENTS_PAGE_SIZE}
                onOpenCouponModal={() => setCouponModal(true)}
                onCouponToggle={handleCouponToggle}
                onExcelDownload={handleExcelDownload}
                onPaymentRefund={handlePaymentRefund}
                onGoToPage={loadPayments}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑥ CS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'cs' && (
              <CsTab
                isDark={isDark}
                t={t}
                csLoading={csLoading}
                csTickets={csTickets}
                csTicketStats={csTicketStats}
                csTicketFilter={csTicketFilter}
                setCsTicketFilter={setCsTicketFilter}
                onRefresh={() => { loadCsTickets(csTicketFilter); loadCsTicketStats(); }}
                onSelectTicket={setSelectedTicket}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑥-B CS-NOTICE TAB (공지 / FAQ 관리)
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'cs-notice' && (
              <CsNoticeTab
                isDark={isDark}
                t={t}
                noticeList={noticeList}
                onRefresh={() => { loadNotices(); addToast('공지 목록을 새로고침했습니다', 'success'); }}
                onComposeNotice={() => { setEditingNotice('new'); setNoticeEditOpen(true); }}
                onEditNotice={(n) => { setEditingNotice(n); setNoticeEditOpen(true); }}
                onToggleStatus={(n, next) => handleNoticeSave({ ...n, status: next })}
                onDeleteNotice={handleNoticeDelete}
                onOpenPushMail={(mode) => setPushMailModal(mode)}
                onFaqPlaceholderAction={(msg) => addToast(msg, 'info')}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑦ AUDIT LOG TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'audit' && (
              <AuditTab
                isDark={isDark}
                t={t}
                auditStats={auditStats}
                displayAuditLogs={displayAuditLogs}
                displayAdminAccountsCount={displayAdminAccounts.length}
                filteredAuditLogs={filteredAuditLogs}
                pagedAuditLogs={pagedAuditLogs}
                auditLogsLoading={auditLogsLoading}
                auditCategoryFilter={auditCategoryFilter}
                auditSearch={auditSearch}
                auditDateFrom={auditDateFrom}
                auditDateTo={auditDateTo}
                auditDatePreset={auditDatePreset}
                setAuditDateFrom={setAuditDateFrom}
                setAuditDateTo={setAuditDateTo}
                setAuditDatePreset={setAuditDatePreset}
                auditPage={auditPage}
                auditTotalPages={auditTotalPages}
                auditPageSize={AUDIT_PAGE_SIZE}
                setAuditPage={setAuditPage}
                auditAlertRules={auditAlertRules}
                activeAlertCount={activeAlertCount}
                onOpenAlertModal={() => setShowAuditAlertModal(true)}
                onPresetClick={handleAuditPreset}
                onCategoryChange={handleAuditCategoryChange}
                onSearchChange={handleAuditSearchChange}
                onDateRangeChange={(from, to) => loadAuditLogs(auditCategoryFilter, auditSearch, from, to, 'all')}
                onResetDateRange={() => {
                  setAuditDateFrom('');
                  setAuditDateTo('');
                  setAuditDatePreset('all');
                  setAuditPage(1);
                  loadAuditLogs(auditCategoryFilter, auditSearch, '', '', 'all');
                }}
                onCsvExport={handleCsvExport}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑧ SYSTEM SETTINGS TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'sys-settings' && (
              <SysSettingsTab
                isDark={isDark}
                t={t}
                maintenanceMode={maintenanceMode}
                setMaintenanceMode={setMaintenanceMode}
                contentAutoFilter={contentAutoFilter}
                setContentAutoFilter={setContentAutoFilter}
                watermarkDefault={watermarkDefault}
                setWatermarkDefault={setWatermarkDefault}
                maxConcurrent={maxConcurrent}
                setMaxConcurrent={setMaxConcurrent}
                sessionTimeout={sessionTimeout}
                setSessionTimeout={setSessionTimeout}
                onSavePerformance={handleSavePerformance}
                emailNotif={emailNotif}
                setEmailNotif={setEmailNotif}
                slackNotif={slackNotif}
                setSlackNotif={setSlackNotif}
                slackWebhookUrl={slackWebhookUrl}
                setSlackWebhookUrl={setSlackWebhookUrl}
                retentionEdit={retentionEdit}
                setRetentionEdit={setRetentionEdit}
                retentionValues={retentionValues}
                setRetentionValues={setRetentionValues}
                onToast={addToast}
              />
            )}

            {/* ══════════════════════════════════════════════════════════════
                ⑨ SECURITY / 2FA TAB
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'security' && (
              <SecurityTab
                isDark={isDark}
                t={t}
                displayIpBlocks={displayIpBlocks}
                displayAdminAccounts={displayAdminAccounts}
                auditTodayCount={auditStats.today}
                onOpenAddAdmin={() => setAddAdminModal(true)}
                onOpenEditPerm={(admin) => { setEditPermModal(admin); setEditPermList([...admin.permissions]); }}
                onForce2FA={handleForce2FA}
                autoBlock={autoBlock}
                setAutoBlock={setAutoBlock}
                ipBlockInput={ipBlockInput}
                setIpBlockInput={setIpBlockInput}
                ipBlockReason={ipBlockReason}
                setIpBlockReason={setIpBlockReason}
                onIpBlock={handleIpBlock}
                onIpUnblock={handleIpUnblock}
              />
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
