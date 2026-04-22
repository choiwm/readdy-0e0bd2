import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { AppNotification } from "./useNotifications";

// ─── hoisted mocks ─────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const authState = {
    isLoggedIn: true,
    profile: { id: "user-1" } as { id: string } | null,
  };
  return {
    authState,
    callEdgeMock: vi.fn(),
    subscribeMock: vi.fn(),
    removeChannelMock: vi.fn(),
    channelCalls: [] as string[],
  };
});

vi.mock("./useAuth", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@/lib/edgeClient", () => ({
  callEdge: (...args: unknown[]) => mocks.callEdgeMock(...args),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    channel: (name: string) => {
      mocks.channelCalls.push(name);
      const builder = {
        on: vi.fn(() => builder),
        subscribe: mocks.subscribeMock,
      };
      return builder;
    },
    removeChannel: mocks.removeChannelMock,
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────
import { useNotifications } from "./useNotifications";

function makeNotif(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    type: "system_notice",
    title: "hi",
    message: "msg",
    data: {},
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.callEdgeMock.mockReset();
    mocks.subscribeMock.mockReset();
    mocks.removeChannelMock.mockReset();
    mocks.channelCalls.length = 0;
    mocks.authState.isLoggedIn = true;
    mocks.authState.profile = { id: "user-1" };
  });

  it("fetches notifications on mount and populates state", async () => {
    mocks.callEdgeMock.mockResolvedValueOnce({
      notifications: [makeNotif({ id: "a" }), makeNotif({ id: "b", is_read: true })],
      unread_count: 1,
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(2);
    });
    expect(result.current.unreadCount).toBe(1);
    // First fetch call targets get_notifications
    expect(mocks.callEdgeMock).toHaveBeenCalledWith(
      "credit-alert-notify",
      expect.objectContaining({
        method: "GET",
        query: expect.objectContaining({ action: "get_notifications", user_id: "user-1" }),
      }),
    );
  });

  it("markRead optimistically updates, then calls edge", async () => {
    mocks.callEdgeMock
      .mockResolvedValueOnce({ notifications: [makeNotif({ id: "n1" })], unread_count: 1 })
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.markRead("n1");
    });

    expect(result.current.notifications[0].is_read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
    expect(mocks.callEdgeMock).toHaveBeenLastCalledWith(
      "credit-alert-notify",
      expect.objectContaining({
        query: { action: "mark_read" },
        body: { user_id: "user-1", notification_id: "n1" },
      }),
    );
  });

  it("markAllRead clears unreadCount and marks every row read", async () => {
    mocks.callEdgeMock
      .mockResolvedValueOnce({
        notifications: [
          makeNotif({ id: "n1" }),
          makeNotif({ id: "n2" }),
          makeNotif({ id: "n3", is_read: true }),
        ],
        unread_count: 2,
      })
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.is_read)).toBe(true);
  });

  it("clears state and skips fetch when not logged in", async () => {
    mocks.authState.isLoggedIn = false;
    mocks.authState.profile = null;

    const { result } = renderHook(() => useNotifications());

    // Let microtasks drain
    await act(async () => { await Promise.resolve(); });

    expect(mocks.callEdgeMock).not.toHaveBeenCalled();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("swallows errors from callEdge without tearing state", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.callEdgeMock.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.notifications).toEqual([]);
    spy.mockRestore();
  });

  it("subscribes to the user's realtime channel and unsubscribes on unmount", async () => {
    mocks.callEdgeMock.mockResolvedValueOnce({ notifications: [], unread_count: 0 });

    const { unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(mocks.channelCalls).toContain("notifications:user-1");
    });

    unmount();
    expect(mocks.removeChannelMock).toHaveBeenCalled();
  });
});
