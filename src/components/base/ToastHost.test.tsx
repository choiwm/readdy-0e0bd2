import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastHost } from "./ToastHost";
import { toast } from "@/utils/errorHandler";

describe("ToastHost", () => {
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
});
