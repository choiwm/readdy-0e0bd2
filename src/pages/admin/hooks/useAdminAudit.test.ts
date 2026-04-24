import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminAudit } from './useAdminAudit';

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

describe('useAdminAudit', () => {
  it('exposes initial state', () => {
    const { result } = renderHook(() => useAdminAudit());
    expect(result.current.auditLogsData).toEqual([]);
    expect(result.current.auditLogsLoading).toBe(false);
    expect(result.current.auditStats.total).toBe(0);
    expect(result.current.ipBlocksData).toEqual([]);
    expect(result.current.adminAccountsData).toEqual([]);
  });

  it('loadAuditLogs maps rows and uppercases short id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      logs: [{
        id: 'abcdef1234-longer',
        admin_email: 'admin@x.com',
        action: '로그인',
        target_label: 'user-1',
        detail: 'login',
        ip_address: '1.2.3.4',
        target_type: 'user',
        created_at: '2026-04-22T12:00:00Z',
      }],
    }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadAuditLogs(); });

    expect(result.current.auditLogsData).toHaveLength(1);
    expect(result.current.auditLogsData[0]).toMatchObject({
      id: 'ABCDEF12',
      admin: 'admin@x.com',
      action: '로그인',
      target: 'user-1',
      ip: '1.2.3.4',
      category: 'user',
    });
  });

  it('loadAuditLogs "today" preset sets both date_from and date_to', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ logs: [] }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadAuditLogs(undefined, undefined, undefined, undefined, 'today'); });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('date_from')).toMatch(/T00:00:00\.000Z$/);
    expect(url.searchParams.get('date_to')).toMatch(/T23:59:59\.999Z$/);
  });

  it('loadAuditLogs "7d" preset sets date_from to 6 days ago', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ logs: [] }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadAuditLogs(undefined, undefined, undefined, undefined, '7d'); });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    const from = url.searchParams.get('date_from');
    expect(from).toMatch(/T00:00:00\.000Z$/);
    const fromDate = new Date(from!);
    const diffDays = Math.round((Date.now() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBeGreaterThanOrEqual(5);
    expect(diffDays).toBeLessThanOrEqual(7);
  });

  it('loadAuditLogs custom date range (no preset) passes both dates', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ logs: [] }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => {
      await result.current.loadAuditLogs(undefined, undefined, '2026-04-01', '2026-04-22');
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('date_from')).toBe('2026-04-01T00:00:00.000Z');
    expect(url.searchParams.get('date_to')).toBe('2026-04-22T23:59:59.999Z');
  });

  it('loadAuditLogs omits category when "전체"', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ logs: [] }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadAuditLogs('전체', 'hello'); });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.has('category')).toBe(false);
    expect(url.searchParams.get('search')).toBe('hello');
  });

  it('loadAuditStats writes stats', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      stats: { total: 123, today: 5, success: 100, failed: 23 },
    }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadAuditStats(); });

    expect(result.current.auditStats.total).toBe(123);
    expect(result.current.auditStats.failed).toBe(23);
  });

  it('loadIpBlocks maps active/released status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ip_blocks: [
        { id: 'B1', ip_address: '1.1.1.1', reason: '무작위 공격', blocked_by_email: 'admin@x.com', created_at: '2026-04-22T00:00:00Z', is_active: true },
        { id: 'B2', ip_address: '2.2.2.2', is_active: false },
      ],
    }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadIpBlocks(); });

    expect(result.current.ipBlocksData).toHaveLength(2);
    expect(result.current.ipBlocksData[0]).toMatchObject({ ip: '1.1.1.1', status: 'active', blockedBy: 'admin@x.com' });
    expect(result.current.ipBlocksData[1].status).toBe('released');
    expect(result.current.ipBlocksData[1].reason).toBe('-');
  });

  it('loadAdminAccounts maps fields and parses permissions array', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      admins: [{
        id: 'A1',
        email: 'alice@x.com',
        display_name: 'Alice',
        role: 'Owner',
        two_factor_enabled: true,
        last_login_at: '2026-04-22T00:00:00Z',
        last_login_ip: '10.0.0.1',
        permissions: ['read', 'write'],
      }],
    }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadAdminAccounts(); });

    expect(result.current.adminAccountsData).toHaveLength(1);
    expect(result.current.adminAccountsData[0]).toMatchObject({
      id: 'A1', name: 'Alice', email: 'alice@x.com', role: 'Owner', twofa: true,
      permissions: ['read', 'write'],
    });
  });

  it('loadAdminAccounts falls back to email prefix and empty permissions', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      admins: [{ id: 'A2', email: 'bob@x.com' }],
    }));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadAdminAccounts(); });

    expect(result.current.adminAccountsData[0]).toMatchObject({
      name: 'bob', role: 'Admin', twofa: false, permissions: [],
    });
  });

  it('loadIpBlocks swallows fetch error and clears state', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAdminAudit());
    await act(async () => { await result.current.loadIpBlocks(); });

    expect(result.current.ipBlocksData).toEqual([]);
    spy.mockRestore();
  });
});
