import { useCallback, useState } from 'react';
import { getAuthorizationHeader } from '@/lib/env';
import type {
  OverviewStats,
  ContentTrendItem,
  PlanDistItem,
  MonthlyRevenuePoint,
  AuditLogPreview,
} from '../components/OverviewTab';

const STATS_URL = `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/admin-stats`;

interface ApiHealthData {
  image?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
  audio?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
  video?: { requests_24h: number; requests_today: number; requests_1h: number; error_rate: number; status: string };
  total_requests_today?: number;
  total_requests_1h?: number;
}

type PlanUserCounts = { free: number; pro: number; enterprise: number };

export function useAdminOverview() {
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [dailySignupsData, setDailySignupsData] = useState<number[]>([]);
  const [planDistData, setPlanDistData] = useState<PlanDistItem[]>([]);
  const [contentTrendsData, setContentTrendsData] = useState<ContentTrendItem[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<MonthlyRevenuePoint[]>([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLogPreview[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [apiHealthData, setApiHealthData] = useState<ApiHealthData | null>(null);
  const [apiHealthLoading, setApiHealthLoading] = useState(false);
  const [planUserCounts, setPlanUserCounts] = useState<PlanUserCounts | null>(null);

  const loadOverviewStats = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const headers = { Authorization: getAuthorizationHeader() };
      const [overviewRes, dailyRes, planRes, trendsRes, monthlyRes, auditRes] = await Promise.allSettled([
        fetch(`${STATS_URL}?action=overview`, { headers }),
        fetch(`${STATS_URL}?action=daily_signups&days=14`, { headers }),
        fetch(`${STATS_URL}?action=plan_dist`, { headers }),
        fetch(`${STATS_URL}?action=content_trends`, { headers }),
        fetch(`${STATS_URL}?action=monthly_revenue&months=6`, { headers }),
        fetch(`${STATS_URL}?action=recent_audit&limit=6`, { headers }),
      ]);

      if (overviewRes.status === 'fulfilled') {
        const data = await overviewRes.value.json();
        if (!data.error) setOverviewStats(data);
      }

      if (dailyRes.status === 'fulfilled') {
        const data = await dailyRes.value.json();
        if (data.daily_signups) {
          const vals = Object.values(data.daily_signups) as number[];
          setDailySignupsData(vals);
        }
      }

      if (planRes.status === 'fulfilled') {
        const data = await planRes.value.json();
        if (data.plan_dist) setPlanDistData(data.plan_dist);
      }

      if (trendsRes.status === 'fulfilled') {
        const data = await trendsRes.value.json();
        if (data.content_trends) setContentTrendsData(data.content_trends);
      }

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

  const loadPlanUserCounts = useCallback(async () => {
    try {
      if (overviewStats?.users?.plan_dist) {
        setPlanUserCounts(overviewStats.users.plan_dist);
        return;
      }
      const url = new URL(STATS_URL);
      url.searchParams.set('action', 'plan_dist');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.plan_dist) {
        const dist = data.plan_dist as { label: string; count: number }[];
        setPlanUserCounts({
          free: dist.find((d) => d.label === 'Free')?.count ?? 0,
          pro: dist.find((d) => d.label === 'Pro')?.count ?? 0,
          enterprise: dist.find((d) => d.label === 'Enterprise')?.count ?? 0,
        });
      }
    } catch (e) {
      console.warn('Plan user counts load failed:', e);
    }
  }, [overviewStats]);

  const loadApiHealth = useCallback(async () => {
    setApiHealthLoading(true);
    try {
      const url = new URL(STATS_URL);
      url.searchParams.set('action', 'api_health');
      const res = await fetch(url.toString(), {
        headers: { Authorization: getAuthorizationHeader() },
      });
      const data = await res.json();
      if (data.api_stats) setApiHealthData(data.api_stats);
    } catch (e) {
      console.warn('API health load failed:', e);
    } finally {
      setApiHealthLoading(false);
    }
  }, []);

  return {
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
  };
}
