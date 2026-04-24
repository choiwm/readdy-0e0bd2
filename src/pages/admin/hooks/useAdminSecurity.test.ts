import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminSecurity } from './useAdminSecurity';
import type { AdminAccount, IpBlock } from '../types';

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

describe('useAdminSecurity', () => {
  it('exposes initial state', () => {
    const { result } = renderHook(() => useAdminSecurity());
    expect(result.current.ipBlockList).toEqual([]);
    expect(result.current.ipBlockInput).toBe('');
    expect(result.current.ipBlockReason).toBe('');
    expect(result.current.newAdminName).toBe('');
    expect(result.current.newAdminRole).toBe('CS Manager');
    expect(result.current.newAdminPerms).toEqual([]);
  });

  it('blockIp returns null for empty input', async () => {
    const { result } = renderHook(() => useAdminSecurity());
    let out: Awaited<ReturnType<typeof result.current.blockIp>> | undefined;
    await act(async () => { out = await result.current.blockIp([], vi.fn(), vi.fn()); });

    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blockIp POSTs with ip + reason and reloads on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const reload = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useAdminSecurity());

    act(() => {
      result.current.setIpBlockInput('1.1.1.1');
      result.current.setIpBlockReason('봇 공격');
    });

    let out: Awaited<ReturnType<typeof result.current.blockIp>> | undefined;
    await act(async () => { out = await result.current.blockIp([], vi.fn(), reload); });

    expect(out).toEqual({ ok: true, ip: '1.1.1.1' });
    expect(reload).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ ip_address: '1.1.1.1', reason: '봇 공격' });
    expect(result.current.ipBlockInput).toBe('');
    expect(result.current.ipBlockReason).toBe('');
  });

  it('blockIp uses "수동 차단" default reason when empty', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { result } = renderHook(() => useAdminSecurity());
    act(() => { result.current.setIpBlockInput('2.2.2.2'); });
    await act(async () => { await result.current.blockIp([], vi.fn(), vi.fn(() => Promise.resolve())); });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.reason).toBe('수동 차단');
  });

  it('blockIp falls back to appending into hook state when reload fails', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const setIpBlocksData = vi.fn();
    const { result } = renderHook(() => useAdminSecurity());
    act(() => { result.current.setIpBlockInput('3.3.3.3'); });

    await act(async () => {
      await result.current.blockIp([], setIpBlocksData, vi.fn(() => Promise.resolve()));
    });

    expect(setIpBlocksData).not.toHaveBeenCalled(); // ipBlocksData was empty
    expect(result.current.ipBlockList).toHaveLength(1);
    expect(result.current.ipBlockList[0]).toMatchObject({ ip: '3.3.3.3', status: 'active', blockedBy: 'admin' });
    spy.mockRestore();
  });

  it('unblockIp marks row as released and returns ip', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const { result } = renderHook(() => useAdminSecurity());

    const existing: IpBlock[] = [
      { ip: '5.5.5.5', reason: 'x', blockedAt: '-', blockedBy: '-', status: 'active' },
    ];
    let current = existing;
    const setIpBlocksData = vi.fn((u: (p: IpBlock[]) => IpBlock[]) => { current = u(current); });

    let out: Awaited<ReturnType<typeof result.current.unblockIp>> | undefined;
    await act(async () => { out = await result.current.unblockIp('5.5.5.5', existing, setIpBlocksData); });

    expect(out).toEqual({ ok: true, ip: '5.5.5.5' });
    expect(current[0].status).toBe('released');
  });

  it('unblockIp returns null for unknown ip', async () => {
    const { result } = renderHook(() => useAdminSecurity());
    let out: Awaited<ReturnType<typeof result.current.unblockIp>> | undefined;
    await act(async () => { out = await result.current.unblockIp('9.9.9.9', [], vi.fn()); });

    expect(out).toBeNull();
  });

  it('createAdmin returns null for empty name/email', async () => {
    const { result } = renderHook(() => useAdminSecurity());
    let out: Awaited<ReturnType<typeof result.current.createAdmin>> | undefined;
    await act(async () => { out = await result.current.createAdmin(vi.fn(), vi.fn(() => Promise.resolve())); });

    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createAdmin POSTs + clears form + calls reload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const reload = vi.fn(() => Promise.resolve());
    const { result } = renderHook(() => useAdminSecurity());

    act(() => {
      result.current.setNewAdminName('Alice');
      result.current.setNewAdminEmail('alice@x.com');
      result.current.setNewAdminRole('Owner');
      result.current.setNewAdminPerms(['read', 'write']);
    });

    let out: Awaited<ReturnType<typeof result.current.createAdmin>> | undefined;
    await act(async () => { out = await result.current.createAdmin(vi.fn(), reload); });

    expect(out).toEqual({ ok: true, name: 'Alice' });
    expect(reload).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ email: 'alice@x.com', display_name: 'Alice', role: 'Owner', permissions: ['read', 'write'] });
    expect(result.current.newAdminName).toBe('');
    expect(result.current.newAdminEmail).toBe('');
    expect(result.current.newAdminRole).toBe('CS Manager');
    expect(result.current.newAdminPerms).toEqual([]);
  });

  it('createAdmin falls back to optimistic append on fetch error', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const setAdmins = vi.fn();
    const { result } = renderHook(() => useAdminSecurity());

    act(() => {
      result.current.setNewAdminName('Bob');
      result.current.setNewAdminEmail('bob@x.com');
    });

    await act(async () => {
      await result.current.createAdmin(setAdmins as (u: (p: AdminAccount[]) => AdminAccount[]) => void, vi.fn(() => Promise.resolve()));
    });

    expect(setAdmins).toHaveBeenCalled();
    const updater = setAdmins.mock.calls[0][0] as (prev: AdminAccount[]) => AdminAccount[];
    const appended = updater([]);
    expect(appended).toHaveLength(1);
    expect(appended[0]).toMatchObject({ name: 'Bob', email: 'bob@x.com', role: 'CS Manager', twofa: false });
    spy.mockRestore();
  });
});
