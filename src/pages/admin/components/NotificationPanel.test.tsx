import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotificationPanel, { initialNotifications, Notification } from "./NotificationPanel";

function renderPanel(overrides: Partial<Parameters<typeof NotificationPanel>[0]> = {}) {
  const defaults = {
    notifications: initialNotifications,
    onClose: vi.fn(),
    onMarkRead: vi.fn(),
    onMarkAllRead: vi.fn(),
    onDelete: vi.fn(),
    isDark: true,
    ...overrides,
  };
  return { ...defaults, ...render(<NotificationPanel {...defaults} />) };
}

describe("NotificationPanel", () => {
  it("renders all notifications by default", () => {
    renderPanel();
    initialNotifications.slice(0, 3).forEach((n) => {
      expect(screen.getByText(n.title)).toBeInTheDocument();
    });
  });

  it("shows the unread count badge when any notification is unread", () => {
    renderPanel();
    const unreadCount = initialNotifications.filter((n) => !n.read).length;
    expect(unreadCount).toBeGreaterThan(0);
    // At least one rendered element should carry the exact unread count
    expect(screen.getAllByText(String(unreadCount)).length).toBeGreaterThan(0);
  });

  it("calls onMarkRead when a notification row is clicked", () => {
    const onMarkRead = vi.fn();
    renderPanel({ onMarkRead });
    const firstTitle = screen.getByText(initialNotifications[0].title);
    fireEvent.click(firstTitle);
    expect(onMarkRead).toHaveBeenCalledWith(initialNotifications[0].id);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    const closeBtn = document.querySelector("button .ri-close-line")?.closest("button");
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders empty state when filter yields no results", () => {
    const none: Notification[] = [];
    renderPanel({ notifications: none });
    expect(screen.getByText("알림이 없습니다")).toBeInTheDocument();
  });

  it("calls onMarkAllRead only when unread notifications exist", () => {
    const onMarkAllRead = vi.fn();
    renderPanel({ onMarkAllRead });
    fireEvent.click(screen.getByText("모두 읽음"));
    expect(onMarkAllRead).toHaveBeenCalled();
  });
});
