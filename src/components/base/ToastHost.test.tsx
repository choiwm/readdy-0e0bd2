import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastHost } from "./ToastHost";
import { toast } from "@/utils/errorHandler";

describe("ToastHost", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders toasts emitted via the bus", () => {
    render(<ToastHost />);
    act(() => {
      toast("hello world", "info", 100);
    });
    expect(screen.getByRole("status")).toHaveTextContent("hello world");
  });

  it("applies error styling for error level toasts", () => {
    render(<ToastHost />);
    act(() => {
      toast("bad thing", "error", 100);
    });
    const node = screen.getByText("bad thing");
    expect(node.className).toMatch(/bg-red-600/);
  });

  it("applies warn styling for warn level toasts", () => {
    render(<ToastHost />);
    act(() => {
      toast("careful", "warn", 100);
    });
    expect(screen.getByText("careful").className).toMatch(/bg-amber-500/);
  });

  it("removes the toast after durationMs", () => {
    render(<ToastHost />);
    act(() => {
      toast("goes away", "info", 500);
    });
    expect(screen.queryByText("goes away")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText("goes away")).not.toBeInTheDocument();
  });

  it("renders multiple concurrent toasts", () => {
    render(<ToastHost />);
    act(() => {
      toast("one", "info", 1000);
      toast("two", "info", 1000);
      toast("three", "error", 1000);
    });
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });
});
