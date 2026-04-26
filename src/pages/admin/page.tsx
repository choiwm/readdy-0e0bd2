import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import AdminToast, { type ToastItem } from './components/AdminToast';
import { useAdminRole } from '@/components/feature/AdminGuard';
import TicketReplyModal from './components/TicketReplyModal';
import PushMailModal from './components/PushMailModal';
import PromptEditModal from './components/PromptEditModal';
import NoticeEditModal from './components/NoticeEditModal';
import AuditAlertSettingsModal, { type AuditAlertRule } from './components/AuditAlertSettingsModal';
import AiEngineTab from './components/AiEngineTab';
import TeamManageModal from './components/TeamManageModal';
import CreditGrantPanel from './components/CreditGrantPanel';
import UserDetailModal from './components/UserDetailModal';
import CouponCreateModal from './components/CouponCreateModal';
import AddAdminModal from './components/AddAdminModal';
import type { CsTicket, Notice, PromptTemplate, AdminAccount, TeamRecord, UserRecord, UserStatus } from './types';
import { apiStatus, contentTrends, dailySignups, planDist, auditLogs } from './mockData';
import NotificationPanel, { type Notification, initialNotifications } from './components/NotificationPanel';
import { GradeBadge, GRADE_META } from './components/AdminHelpers';
import GradeSettingsTab from './components/GradeSettingsTab';
import CsTab from './components/CsTab';
import CsNoticeTab from './components/CsNoticeTab';
import SysSettingsTab from './components/SysSettingsTab';
import BillingTab from './components/BillingTab';
import AuditTab from './components/AuditTab';
import SecurityTab from './components/SecurityTab';
import AdminRosterPanel from './components/AdminRosterPanel';
import UsersTab from './components/UsersTab';
import ContentTab from './components/ContentTab';
import OverviewTab from './components/OverviewTab';
import AdminSidebar from './components/AdminSidebar';
import AdminPageHeader from './components/AdminPageHeader';
import { useAdminBilling, PAYMENTS_PAGE_SIZE } from './hooks/useAdminBilling';
import { useAdminCs } from './hooks/useAdminCs';
import { useAdminAudit } from './hooks/useAdminAudit';
import { useAdminUsers } from './hooks/useAdminUsers';
import { useAdminOverview } from './hooks/useAdminOverview';
import { useAdminContent } from './hooks/useAdminContent';
import { useAdminAiEngine } from './hooks/useAdminAiEngine';
import { useAdminSecurity } from './hooks/useAdminSecurity';
import { useAdminSysSettings } from './hooks/useAdminSysSettings';
import { useAdminTheme } from './hooks/useAdminTheme';
import {
  ticketStatusChange as apiTicketStatusChange,
  noticeSave as apiNoticeSave,
  noticeDelete as apiNoticeDelete,
  sendPushMail as apiSendPushMail,
  paymentRefund as apiPaymentRefund,
  savePermissions as apiSavePermissions,
} from './hooks/useAdminActions';

// ── Types ──────────────────────────────────────────────────────────────────
type TabType = 'overview' | 'users' | 'coin-grant' | 'content' | 'ai-engine' | 'billing' | 'cs' | 'cs-notice' | 'audit' | 'sys-settings' | 'security' | 'grade-settings' | 'admin-roster';

// Server-side requireAdmin in each Edge Function is the security boundary
// (migration 0007 + auth.ts allowedRoles). The map below is purely UX —
// hide tabs the role can't use so users don't get confused 403s.
import type { AdminRole } from '@/components/feature/AdminGuard';
const VISIBLE_TABS_BY_ROLE: Record<AdminRole, ReadonlySet<TabType>> = {
  super_admin: new Set<TabType>([
    'overview', 'users', 'coin-grant', 'grade-settings',
    'content', 'ai-engine', 'billing', 'cs', 'cs-notice',
    'audit', 'sys-settings', 'security', 'admin-roster',
  ]),
  ops: new Set<TabType>([
    'overview', 'users', 'content', 'ai-engine', 'cs-notice', 'audit', 'sys-settings',
  ]),
  cs: new Set<TabType>([
    'overview', 'users', 'coin-grant', 'content', 'cs', 'cs-notice',
  ]),
  billing: new Set<TabType>([
    'overview', 'users', 'billing',
  ]),
};

// ── Main ───────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const { role: adminRole } = useAdminRole();
  const visibleTabs = VISIBLE_TABS_BY_ROLE[adminRole];
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // 사용자가 URL 직접 입력 또는 다른 role 권한이었던 시절의 localStorage 등으로
  // 자기 role 에 보이지 않는 탭을 active 로 가지면 첫 허용 탭으로 자동 전환.
  useEffect(() => {
    if (!visibleTabs.has(activeTab)) {
      const fallback = Array.from(visibleTabs)[0] ?? 'overview';
      setActiveTab(fallback as TabType);
    }
  }, [activeTab, visibleTabs]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const {
    usersData,
    usersLoading,
    userStats,
    userSearch, setUserSearch,
    userPlanFilter, setUserPlanFilter,
    userGradeFilter, setUserGradeFilter,
    userSearchDebounceRef,
    loadUsers, loadUserStats,
    updateUserStatus, adjustCredits, updateMemberGrade,
  } = useAdminUsers();
  const [gradeChangeModal, setGradeChangeModal] = useState<UserRecord | null>(null);
  const [gradeChangeValue, setGradeChangeValue] = useState('general');
  const [gradeChangeReason, setGradeChangeReason] = useState('');
  const [contentFilter, setContentFilter] = useState('전체');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [_revenueRange, _setRevenueRange] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  // noticeModal/newNoticeTitle/newNoticeType, coupon state now come from hooks
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
  // usersData/usersLoading/userStats now come from useAdminUsers
  const {
    paymentsData, setPaymentsData,
    paymentsLoading,
    paymentsPage: paymentsPageFromHook,
    paymentsTotal: paymentsTotalFromHook,
    paymentsTotalPages: paymentsTotalPagesFromHook,
    paymentStats,
    couponsData,
    loadPayments, loadPaymentStats, loadCoupons,
    couponModal, setCouponModal,
    couponCode, setCouponCode,
    couponDiscount, setCouponDiscount,
    couponDiscountType, setCouponDiscountType,
    couponMaxUses, setCouponMaxUses,
    couponExpires, setCouponExpires,
    toggleCoupon: toggleCouponApi,
    createCoupon: createCouponApi,
  } = useAdminBilling();
  const {
    ipBlockInput, setIpBlockInput,
    ipBlockReason, setIpBlockReason,
    newAdminName, setNewAdminName,
    newAdminEmail, setNewAdminEmail,
    newAdminRole, setNewAdminRole,
    newAdminPerms, setNewAdminPerms,
    blockIp, unblockIp, createAdmin,
  } = useAdminSecurity();
  const {
    auditLogsData,
    auditLogsLoading,
    auditStats,
    ipBlocksData, setIpBlocksData,
    adminAccountsData, setAdminAccountsData,
    loadAuditLogs, loadAuditStats, loadIpBlocks, loadAdminAccounts,
  } = useAdminAudit();
  const {
    overviewStats,
    overviewLoading,
    dailySignupsData,
    planDistData,
    contentTrendsData,
    monthlyRevenueData,
    recentAuditLogs,
    apiHealthData,
    apiHealthLoading,
    planUserCounts,
    loadOverviewStats,
    loadPlanUserCounts,
    loadApiHealth,
  } = useAdminOverview();

  // ── Content / Teams ──
  const {
    contentDbItems,
    contentDbStats,
    contentDbLoading,
    teamsData,
    teamsLoading,
    teamStats,
    loadContentItems, loadContentStats, loadTeams,
    updateContentStatus,
  } = useAdminContent();

  // ── Notice / Sys-settings ──
  const {
    noticeModal, setNoticeModal,
    newNoticeTitle, setNewNoticeTitle,
    newNoticeType, setNewNoticeType,
    retentionEdit, setRetentionEdit,
    retentionValues, setRetentionValues,
    maintenanceMode, setMaintenanceMode,
    maxConcurrent, setMaxConcurrent,
    sessionTimeout, setSessionTimeout,
    watermarkDefault, setWatermarkDefault,
    autoBlock, setAutoBlock,
    emailNotif, setEmailNotif,
    slackNotif, setSlackNotif,
    slackWebhookUrl, setSlackWebhookUrl,
    contentAutoFilter, setContentAutoFilter,
  } = useAdminSysSettings();

  // paymentsPage/Total/TotalPages + PAYMENTS_PAGE_SIZE now come from useAdminBilling
  const paymentsPage = paymentsPageFromHook;
  const paymentsTotal = paymentsTotalFromHook;
  const paymentsTotalPages = paymentsTotalPagesFromHook;

  // ── CS State ──
  const {
    csTickets, setCsTickets,
    csLoading,
    csTicketStats,
    noticeList, setNoticeList,
    loadCsTickets, loadCsTicketStats, loadNotices,
  } = useAdminCs();
  const [selectedTicket, setSelectedTicket] = useState<CsTicket | null>(null);
  const [editingNotice, setEditingNotice] = useState<Notice | null | 'new'>('new' as const);
  const [noticeEditOpen, setNoticeEditOpen] = useState(false);
  const [pushMailModal, setPushMailModal] = useState<'email' | 'push' | null>(null);
  const [csTicketFilter, setCsTicketFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  // csTicketStats now comes from useAdminCs

  // ── AI Engine State ──
  const {
    promptTemplates,
    editingTemplate,
    promptEditOpen,
    toggleTemplateActive,
    upsertTemplate,
    openEditor: openPromptEditor,
    closeEditor: closePromptEditor,
  } = useAdminAiEngine();


  // ── Security State (form/list) now from useAdminSecurity ──
  const [_adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);

  // ── Coupon State ──
  const [coupons, setCoupons] = useState([
    { code: 'SPRING2026', discount: '30%', type: '구독 할인', used: 142, limit: 500, expires: '2026.05.31', active: true },
    { code: 'NEWUSER100', discount: '100 CR', type: '무료 크레딧', used: 891, limit: 2000, expires: '2026.06.30', active: true },
    { code: 'ENTERPRISE50', discount: '50%', type: '구독 할인', used: 28, limit: 100, expires: '2026.04.30', active: false },
  ]);

  // ── Content State ──
  const [contentItems, setContentItems] = useState<{ id: string; title: string; user: string; type: string; status: 'approved' | 'pending' | 'blocked'; date: string; rating: number; thumbnail: string }[]>([]);

  // ── Team Modal/Sub-tab ──
  const [teamModal, setTeamModal] = useState<TeamRecord | null | 'new'>(null);
  const [contentSubTab, setContentSubTab] = useState<'items' | 'teams'>('items');

  // ── Payment State ──
  const [payments, setPayments] = useState<{ id: string; user: string; plan: string; amount: string; date: string; status: string; method: string }[]>([]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    await apiTicketStatusChange(ticketId, status, replyContent);
    setCsTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, status } : t));
    addToast(`티켓 ${ticketId} 상태가 변경됐습니다`, 'success');
  };

  const handleNoticeSave = async (notice: Notice) => {
    const saved = await apiNoticeSave(notice, noticeList, setNoticeList);
    addToast(saved.status === 'published' ? '공지사항이 게시됐습니다' : '초안이 저장됐습니다', 'success');
  };

  const handleNoticeDelete = async (noticeId: string) => {
    await apiNoticeDelete(noticeId, setNoticeList);
    addToast('공지사항이 삭제됐습니다', 'info');
  };

  const handleSendPushMail = (type: 'push' | 'email', payload: { subject?: string; message: string; target: string }) =>
    apiSendPushMail(type, payload);

  // CS: coupon toggle (hook 위임 + 토스트)
  const handleCouponToggle = async (code: string) => {
    const result = await toggleCouponApi(code, coupons, setCoupons);
    addToast(`쿠폰 ${result.code}이 ${result.active ? '활성화' : '비활성화'}됐습니다`, 'info');
  };

  // Billing: coupon create (hook 위임 + 토스트)
  const handleCouponCreate = async () => {
    const result = await createCouponApi(setCoupons);
    if (!result.ok) { addToast(result.error ?? '생성 실패', 'error'); return; }
    addToast(`쿠폰 ${result.code}이 생성됐습니다`, 'success');
  };

  // CS: payment refund
  const _handleRefund = (payId: string) => {
    setPayments((prev) => prev.map((p) => p.id === payId ? { ...p, status: 'refunded' } : p));
    addToast(`${payId} 환불 처리됐습니다`, 'success');
  };

  // Content: status change (hook 위임 + 토스트)
  const handleContentStatus = async (contentId: string, status: 'approved' | 'pending' | 'blocked') => {
    await updateContentStatus(contentId, status, setContentItems);
    const label = status === 'approved' ? '승인' : status === 'blocked' ? '차단' : '검토중';
    addToast(`콘텐츠 ${contentId}이 ${label}됐습니다`, status === 'blocked' ? 'warning' : 'success');
  };

  // AI Engine: prompt template toggle
  const handlePromptToggle = (id: string) => {
    const pt = toggleTemplateActive(id);
    addToast(`템플릿 "${pt?.name}" ${pt?.active ? '비활성화' : '활성화'}됐습니다`, 'info');
  };

  // AI Engine: prompt template save
  const handlePromptSave = (template: PromptTemplate) => {
    upsertTemplate(template);
    addToast(`템플릿 "${template.name}"이 저장됐습니다`, 'success');
  };

  // Security: IP block add (hook 위임 + 토스트)
  const handleIpBlock = async () => {
    const result = await blockIp(ipBlocksData, setIpBlocksData, loadIpBlocks);
    if (!result) return;
    addToast(`IP ${result.ip}이 차단됐습니다`, 'warning');
  };

  // Security: IP unblock (hook 위임 + 토스트)
  const handleIpUnblock = async (ip: string) => {
    const result = await unblockIp(ip, ipBlocksData, setIpBlocksData);
    if (!result) return;
    addToast(`IP ${result.ip} 차단이 해제됐습니다`, 'info');
  };

  // Security: add admin (hook 위임 + 토스트)
  const handleAddAdmin = async () => {
    const result = await createAdmin(setAdminAccounts, loadAdminAccounts);
    if (!result) return;
    setAddAdminModal(false);
    addToast(`관리자 ${result.name} 계정이 생성됐습니다`, 'success');
  };

  // Users: member grade change (hook 위임 + 토스트)
  const handleGradeChange = async (userId: string, memberGrade: string, reason?: string) => {
    const { grade } = await updateMemberGrade(userId, memberGrade, reason);
    const gradeMeta = GRADE_META[grade];
    addToast(`등급이 ${gradeMeta?.label ?? grade}(으)로 변경됐습니다`, 'success');
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

  // Users: suspend / restore (hook 위임 + 토스트)
  const handleUserStatusChange = async (userId: string, newStatus: UserStatus) => {
    await updateUserStatus(userId, newStatus);
    addToast(
      newStatus === 'suspended' ? `계정이 정지됐습니다` : `계정이 복구됐습니다`,
      newStatus === 'suspended' ? 'warning' : 'success',
    );
  };

  // Users: credit adjust (hook 위임 + 토스트)
  const handleCreditAdjust = async (userId: string, amount: string) => {
    const result = await adjustCredits(userId, amount);
    if (!result.ok) { addToast(result.error ?? '조정 실패', 'error'); return; }
    const n = result.amount ?? 0;
    addToast(`크레딧 ${n > 0 ? '+' : ''}${n} 조정됐습니다`, 'success');
  };

  // Billing: refund (Edge Function)
  const handlePaymentRefund = async (payId: string) => {
    await apiPaymentRefund(payId, paymentsData, setPaymentsData, payments, setPayments);
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
    await apiSavePermissions(adminId, permissions, setAdminAccounts, adminAccountsData, setAdminAccountsData);
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
  // ipBlockInput/ipBlockReason now from useAdminSecurity
  const [addAdminModal, setAddAdminModal] = useState(false);
  const [editPermModal, setEditPermModal] = useState<AdminAccount | null>(null);
  const [editPermList, setEditPermList] = useState<string[]>([]);
  // retention/maintenance/slack/email/etc. now come from useAdminSysSettings

  // couponDiscountType/MaxUses/Expires now from useAdminBilling

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
    { id: 'admin-roster' as TabType, icon: 'ri-shield-user-line', label: 'Admin 관리' },
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

  const t = useAdminTheme(isDark);

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
        <AdminSidebar
          isDark={isDark}
          t={t}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          navItems={navItems.filter((item) => visibleTabs.has(item.id))}
          systemNavItems={systemNavItems.filter((item) => visibleTabs.has(item.id as TabType))}
          apiHealthData={apiHealthData}
          onSignOut={async () => {
            await supabase.auth.signOut();
            navigate('/admin-login', { replace: true });
          }}
        />

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">

            {/* Page Header */}
            <AdminPageHeader
              t={t}
              activeTab={activeTab}
              lastRefreshedAt={lastRefreshedAt}
              onCsvExport={handleCsvExport}
              onRefresh={handleRefresh}
            />

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
                onPromptEdit={(template) => openPromptEditor(template ?? null)}
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

            {/* ══════════════════════════════════════════════════════════════
                ⑩ ADMIN ROSTER (Super Admin only — gated by VISIBLE_TABS_BY_ROLE)
            ══════════════════════════════════════════════════════════════ */}
            {activeTab === 'admin-roster' && (
              <AdminRosterPanel
                isDark={isDark}
                onToast={(msg, type) => addToast(msg, type)}
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
        <CouponCreateModal
          isDark={isDark}
          t={t}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          couponDiscount={couponDiscount}
          setCouponDiscount={setCouponDiscount}
          couponDiscountType={couponDiscountType}
          setCouponDiscountType={setCouponDiscountType}
          couponMaxUses={couponMaxUses}
          setCouponMaxUses={setCouponMaxUses}
          couponExpires={couponExpires}
          setCouponExpires={setCouponExpires}
          onCreate={handleCouponCreate}
          onClose={() => setCouponModal(false)}
        />
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
          onClose={closePromptEditor}
          onSave={(template) => { handlePromptSave(template); closePromptEditor(); }}
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
        <AddAdminModal
          isDark={isDark}
          t={t}
          newAdminName={newAdminName}
          setNewAdminName={setNewAdminName}
          newAdminEmail={newAdminEmail}
          setNewAdminEmail={setNewAdminEmail}
          newAdminRole={newAdminRole}
          setNewAdminRole={setNewAdminRole}
          newAdminPerms={newAdminPerms}
          setNewAdminPerms={setNewAdminPerms}
          onCreate={handleAddAdmin}
          onClose={() => setAddAdminModal(false)}
        />
      )}

    </div>
  );
}
