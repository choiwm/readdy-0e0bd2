import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminUsers } from './useAdminUsers';

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

describe('useAdminUsers', () => {
  it('exposes initial empty state', () => {
    const { result } = renderHook(() => useAdminUsers());
    expect(result.current.usersData).toEqual([]);
    expect(result.current.usersLoading).toBe(false);
    expect(result.current.userStats.total).toBe(0);
    expect(result.current.userPlanFilter).toBe('전체');
    expect(result.current.userGradeFilter).toBe('전체');
  });

  it('loadUsers maps API rows into UserRecord shape', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      users: [{
        id: 'u1',
        display_name: 'Alice',
        email: 'alice@example.com',
        plan: 'pro',
        credit_balance: 120,
        created_at: '2026-01-01T00:00:00Z',
        status: 'active',
        last_login_at: '2026-04-22T10:00:00Z',
        last_login_ip: '1.2.3.4',
        project_count: 3,
        member_grade: 'vip',
      }],
    }));

    const { result } = renderHook(() => useAdminUsers());
    await act(async () => { await result.current.loadUsers(); });

    expect(result.current.usersData).toHaveLength(1);
    expect(result.current.usersData[0]).toMatchObject({
      id: 'u1',
      name: 'Alice',
      email: 'alice@example.com',
      plan: 'Pro',
      credits: 120,
      status: 'active',
      loginIp: '1.2.3.4',
      projects: 3,
      memberGrade: 'vip',
    });
    expect(result.current.usersLoading).toBe(false);
  });

  it('loadUsers falls back when display_name is missing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      users: [{ id: 'u2', email: 'bob@x.com' }],
    }));
    const { result } = renderHook(() => useAdminUsers());
    await act(async () => { await result.current.loadUsers(); });

    expect(result.current.usersData[0].name).toBe('bob');
    expect(result.current.usersData[0].plan).toBe('Free');
    expect(result.current.usersData[0].credits).toBe(0);
  });

  it('loadUsers passes search/plan/grade as query params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ users: [] }));
    const { result } = renderHook(() => useAdminUsers());
    await act(async () => { await result.current.loadUsers('alice', 'Pro', 'vip'); });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('action')).toBe('list_users');
    expect(url.searchParams.get('search')).toBe('alice');
    expect(url.searchParams.get('plan')).toBe('pro');
    expect(url.searchParams.get('grade')).toBe('vip');
  });

  it('loadUsers omits filter when value is "전체"', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ users: [] }));
    const { result } = renderHook(() => useAdminUsers());
    await act(async () => { await result.current.loadUsers('', '전체', '전체'); });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.has('plan')).toBe(false);
    expect(url.searchParams.has('grade')).toBe(false);
  });

  it('loadUsers swallows fetch errors and clears data', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAdminUsers());
    await act(async () => { await result.current.loadUsers(); });

    expect(result.current.usersData).toEqual([]);
    await waitFor(() => expect(result.current.usersLoading).toBe(false));
    spy.mockRestore();
  });

  it('loadUserStats writes stats from response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      stats: { total: 10, active: 7, inactive: 2, suspended: 1, free: 5, pro: 4, enterprise: 1 },
    }));
    const { result } = renderHook(() => useAdminUsers());
    await act(async () => { await result.current.loadUserStats(); });

    expect(result.current.userStats.total).toBe(10);
    expect(result.current.userStats.pro).toBe(4);
  });
});
