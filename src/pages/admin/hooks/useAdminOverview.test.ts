import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminOverview } from './useAdminOverview';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe('useAdminOverview', () => {
  it('exposes initial state', () => {
    const { result } = renderHook(() => useAdminOverview());
    expect(result.current.overviewStats).toBeNull();
    expect(result.current.dailySignupsData).toEqual([]);
    expect(result.current.planDistData).toEqual([]);
    expect(result.current.apiHealthData).toBeNull();
    expect(result.current.planUserCounts).toBeNull();
  });

  it('loadOverviewStats fans out 6 requests and aggregates data', async () => {
    const overview = {
      users: { total: 100, active: 80, new_today: 5, new_month: 30, plan_dist: { free: 50, pro: 40, enterprise: 10 } },
      revenue: { monthly: 1000, last_month: 800, total: 5000, growth_pct: 25 },
    };
    const dailySignups = { '2026-04-20': 3, '2026-04-21': 7, '2026-04-22': 5 };
    const planDist = [{ label: 'Free', count: 50, pct: 50, color: 'gray' }];
    const trends = [{ name: '음악', count: 12, pct: 30, color: 'pink', icon: 'note' }];
    const monthly = { '2026-03': 800, '2026-04': 1000 };
    const audit = [{ admin: 'admin', action: 'login', target: 'x', detail: '', time: '2026-04-22' }];

    fetchMock
      .mockResolvedValueOnce(jsonResponse(overview))
      .mockResolvedValueOnce(jsonResponse({ daily_signups: dailySignups }))
      .mockResolvedValueOnce(jsonResponse({ plan_dist: planDist }))
      .mockResolvedValueOnce(jsonResponse({ content_trends: trends }))
      .mockResolvedValueOnce(jsonResponse({ monthly_revenue: monthly }))
      .mockResolvedValueOnce(jsonResponse({ logs: audit }));

    const { result } = renderHook(() => useAdminOverview());
    await act(async () => { await result.current.loadOverviewStats(); });

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result.current.overviewStats).toEqual(overview);
    expect(result.current.dailySignupsData).toEqual([3, 7, 5]);
    expect(result.current.planDistData).toEqual(planDist);
    expect(result.current.contentTrendsData).toEqual(trends);
    expect(result.current.monthlyRevenueData).toEqual([
      { label: '3월', value: 800 },
      { label: '4월', value: 1000 },
    ]);
    expect(result.current.recentAuditLogs).toEqual(audit);
    expect(result.current.overviewLoading).toBe(false);
  });

  it('loadOverviewStats ignores overview response when error field is present', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'forbidden' }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}));

    const { result } = renderHook(() => useAdminOverview());
    await act(async () => { await result.current.loadOverviewStats(); });

    expect(result.current.overviewStats).toBeNull();
  });

  it('loadApiHealth populates apiHealthData', async () => {
    const stats = {
      image: { requests_24h: 100, requests_today: 50, requests_1h: 5, error_rate: 0.01, status: 'ok' },
      total_requests_today: 50,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ api_stats: stats }));
    const { result } = renderHook(() => useAdminOverview());
    await act(async () => { await result.current.loadApiHealth(); });

    expect(result.current.apiHealthData).toEqual(stats);
    expect(result.current.apiHealthLoading).toBe(false);
  });

  it('loadPlanUserCounts uses overviewStats.plan_dist if available', async () => {
    const overview = {
      users: { total: 100, active: 80, new_today: 5, new_month: 30, plan_dist: { free: 50, pro: 40, enterprise: 10 } },
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(overview))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({}));

    const { result } = renderHook(() => useAdminOverview());
    await act(async () => { await result.current.loadOverviewStats(); });

    fetchMock.mockClear();
    await act(async () => { await result.current.loadPlanUserCounts(); });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.planUserCounts).toEqual({ free: 50, pro: 40, enterprise: 10 });
  });

  it('loadPlanUserCounts falls back to plan_dist endpoint when overview empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      plan_dist: [
        { label: 'Free', count: 11 },
        { label: 'Pro', count: 22 },
        { label: 'Enterprise', count: 33 },
      ],
    }));
    const { result } = renderHook(() => useAdminOverview());
    await act(async () => { await result.current.loadPlanUserCounts(); });

    expect(result.current.planUserCounts).toEqual({ free: 11, pro: 22, enterprise: 33 });
  });

  it('loadApiHealth handles fetch error gracefully', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useAdminOverview());
    await act(async () => { await result.current.loadApiHealth(); });

    expect(result.current.apiHealthData).toBeNull();
    expect(result.current.apiHealthLoading).toBe(false);
    spy.mockRestore();
  });
});
