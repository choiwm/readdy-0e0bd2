import { useCallback, useState } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type { IpBlock, AdminAccount } from '../types';
import type { AuditLogEntry, AuditStats, AuditDatePreset } from '../components/AuditTab';

const AUDIT_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-audit`;
const SECURITY_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-security`;

const INITIAL_AUDIT_STATS: AuditStats = { total: 0, today: 0, success: 0, failed: 0 };

export function useAdminAudit() {
  const [auditLogsData, setAuditLogsData] = useState<AuditLogEntry[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditStats, setAuditStats] = useState<AuditStats>(INITIAL_AUDIT_STATS);
  const [ipBlocksData, setIpBlocksData] = useState<IpBlock[]>([]);
  const [adminAccountsData, setAdminAccountsData] = useState<AdminAccount[]>([]);

  const loadAuditLogs = useCallback(async (
    category?: string,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    preset?: AuditDatePreset,
  ) => {
    setAuditLogsLoading(true);
    try {
      const fetchUrl = new URL(AUDIT_URL);
      fetchUrl.searchParams.set('action', 'list_logs');
      fetchUrl.searchParams.set('limit', '200');
      if (category && category !== '전체') fetchUrl.searchParams.set('category', category);
      if (search) fetchUrl.searchParams.set('search', search);

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
        if (dateFrom) fetchUrl.searchParams.set('date_from', `${dateFrom}T00:00:00.000Z`);
        if (dateTo)   fetchUrl.searchParams.set('date_to',   `${dateTo}T23:59:59.999Z`);
      }

      const res = await fetch(fetchUrl.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.logs && json.logs.length > 0) {
        const mapped: AuditLogEntry[] = json.logs.map((l: Record<string, unknown>) => ({
          id: (l.id as string).slice(0, 8).toUpperCase(),
          admin: (l.admin_email as string) ?? 'admin',
          role: 'Admin',
          action: l.action as string,
          target: (l.target_label as string) ?? '-',
          detail: (l.detail as string) ?? '-',
          ip: (l.ip_address as string) ?? '-',
          time: l.created_at
            ? new Date(l.created_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
            : '-',
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

  const loadAuditStats = useCallback(async () => {
    try {
      const url = new URL(AUDIT_URL);
      url.searchParams.set('action', 'log_stats');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.stats) setAuditStats(json.stats);
    } catch (e) {
      console.warn('Audit stats load failed:', e);
    }
  }, []);

  const loadIpBlocks = useCallback(async () => {
    try {
      const url = new URL(SECURITY_URL);
      url.searchParams.set('action', 'list_ip_blocks');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.ip_blocks && json.ip_blocks.length > 0) {
        const mapped = json.ip_blocks.map((b: Record<string, unknown>) => ({
          ip: b.ip_address as string,
          reason: (b.reason as string) ?? '-',
          blockedAt: b.created_at
            ? new Date(b.created_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
            : '-',
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

  const loadAdminAccounts = useCallback(async () => {
    try {
      const url = new URL(SECURITY_URL);
      url.searchParams.set('action', 'list_admins');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const json = await res.json();
      if (json.admins && json.admins.length > 0) {
        const mapped = json.admins.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: (a.display_name as string) ?? (a.email as string)?.split('@')[0] ?? 'Admin',
          email: a.email as string,
          role: (a.role as string) ?? 'Admin',
          twofa: (a.two_factor_enabled as boolean) ?? false,
          lastLogin: a.last_login_at
            ? new Date(a.last_login_at as string).toLocaleString('ko-KR').replace(/\. /g, '.').replace(/\.$/, '')
            : '-',
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

  return {
    auditLogsData,
    setAuditLogsData,
    auditLogsLoading,
    auditStats,
    ipBlocksData,
    setIpBlocksData,
    adminAccountsData,
    setAdminAccountsData,
    loadAuditLogs,
    loadAuditStats,
    loadIpBlocks,
    loadAdminAccounts,
  };
}
