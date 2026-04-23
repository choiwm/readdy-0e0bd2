import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminContent } from './useAdminContent';

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

describe('useAdminContent', () => {
  it('exposes initial state', () => {
    const { result } = renderHook(() => useAdminContent());
    expect(result.current.contentDbItems).toEqual([]);
    expect(result.current.contentDbStats).toBeNull();
    expect(result.current.contentDbLoading).toBe(false);
    expect(result.current.teamsData).toEqual([]);
    expect(result.current.teamsLoading).toBe(false);
    expect(result.current.teamStats.total).toBe(0);
  });

  it('loadContentItems sets items and toggles loading', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      items: [{ id: 'c1', title: 'song', user: 'alice', type: 'audio', status: 'approved', date: '2026-04-22', thumbnail: '' }],
    }));
    const { result } = renderHook(() => useAdminContent());
    await act(async () => { await result.current.loadContentItems(); });

    expect(result.current.contentDbItems).toHaveLength(1);
    expect(result.current.contentDbLoading).toBe(false);
  });

  it('loadContentItems maps Korean filter to API status', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    const { result } = renderHook(() => useAdminContent());
    await act(async () => { await result.current.loadContentItems('승인'); });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('status')).toBe('approved');
  });

  it('loadContentItems omits status when filter is "전체"', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    const { result } = renderHook(() => useAdminContent());
    await act(async () => { await result.current.loadContentItems('전체'); });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.has('status')).toBe(false);
  });

  it('loadContentStats writes stats from response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      stats: { total: 50, gallery: 10, audio: 20, automation: 15, board: 5, pending: 3, blocked: 2 },
    }));
    const { result } = renderHook(() => useAdminContent());
    await act(async () => { await result.current.loadContentStats(); });

    expect(result.current.contentDbStats?.total).toBe(50);
    expect(result.current.contentDbStats?.pending).toBe(3);
  });

  it('loadTeams loads list + stats in parallel', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        teams: [{ id: 't1', name: 'Team1', description: null, owner_id: 'u1', status: 'active', content_access: 'shared', max_members: 10, member_count: 3, created_at: '2026-01-01' }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        stats: { total: 1, active: 1, inactive: 0, total_members: 3 },
      }));

    const { result } = renderHook(() => useAdminContent());
    await act(async () => { await result.current.loadTeams(); });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.teamsData).toHaveLength(1);
    expect(result.current.teamStats.total_members).toBe(3);
    expect(result.current.teamsLoading).toBe(false);
  });

  it('loadContentItems swallows fetch errors', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAdminContent());
    await act(async () => { await result.current.loadContentItems(); });

    expect(result.current.contentDbItems).toEqual([]);
    expect(result.current.contentDbLoading).toBe(false);
    spy.mockRestore();
  });
});
