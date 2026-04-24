import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminCs } from './useAdminCs';

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

describe('useAdminCs', () => {
  it('exposes initial state', () => {
    const { result } = renderHook(() => useAdminCs());
    expect(result.current.csTickets).toEqual([]);
    expect(result.current.csLoading).toBe(false);
    expect(result.current.csTicketStats.total).toBe(0);
    expect(result.current.noticeList).toEqual([]);
  });

  it('loadCsTickets maps API rows', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      tickets: [{
        id: 'T1', user_name: 'Alice', user_email: 'a@x.com',
        title: '로그인 문제', category: 'account', priority: 'high',
        status: 'open', created_at: '2026-04-22T00:00:00Z',
      }],
    }));
    const { result } = renderHook(() => useAdminCs());
    await act(async () => { await result.current.loadCsTickets(); });

    expect(result.current.csTickets).toHaveLength(1);
    expect(result.current.csTickets[0]).toMatchObject({
      id: 'T1',
      user: 'Alice',
      subject: '로그인 문제',
      status: 'open',
    });
  });

  it('loadCsTickets falls back to email when user_name missing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      tickets: [{ id: 'T2', user_email: 'bob@x.com', title: '?', category: 'x', priority: 'low', status: 'open', created_at: '2026-04-22T00:00:00Z' }],
    }));
    const { result } = renderHook(() => useAdminCs());
    await act(async () => { await result.current.loadCsTickets(); });

    expect(result.current.csTickets[0].user).toBe('bob@x.com');
  });

  it('loadCsTickets skips status param when filter is "all"', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: [] }));
    const { result } = renderHook(() => useAdminCs());
    await act(async () => { await result.current.loadCsTickets('all'); });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.has('status')).toBe(false);
  });

  it('loadCsTickets passes status filter when non-all', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tickets: [] }));
    const { result } = renderHook(() => useAdminCs());
    await act(async () => { await result.current.loadCsTickets('open'); });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('status')).toBe('open');
  });

  it('loadCsTicketStats writes stats', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      stats: { total: 20, open: 10, in_progress: 4, resolved: 3, closed: 3, urgent: 2, high: 5 },
    }));
    const { result } = renderHook(() => useAdminCs());
    await act(async () => { await result.current.loadCsTicketStats(); });

    expect(result.current.csTicketStats.total).toBe(20);
    expect(result.current.csTicketStats.urgent).toBe(2);
  });

  it('loadNotices maps notices and formats date', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      notices: [{
        id: 'N1', title: '공지', category: '업데이트', status: 'published',
        created_at: '2026-04-22T10:00:00Z', view_count: 150,
      }],
    }));
    const { result } = renderHook(() => useAdminCs());
    await act(async () => { await result.current.loadNotices(); });

    expect(result.current.noticeList).toHaveLength(1);
    expect(result.current.noticeList[0]).toMatchObject({
      id: 'N1', title: '공지', type: '업데이트', status: 'published', views: 150,
    });
    expect(result.current.noticeList[0].date).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it('loadCsTickets swallows fetch errors', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAdminCs());
    await act(async () => { await result.current.loadCsTickets(); });

    expect(result.current.csTickets).toEqual([]);
    expect(result.current.csLoading).toBe(false);
    spy.mockRestore();
  });
});
