import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  normalizeError,
  getUserMessage,
  subscribeToasts,
  toast,
  reportAndToast,
  ToastMessage,
} from "./errorHandler";

describe("normalizeError", () => {
  it("wraps Error instances", () => {
    const err = new Error("boom");
    const normalized = normalizeError(err, { where: "test" });
    expect(normalized.message).toBe("boom");
    expect(normalized.cause).toBe(err);
    expect(normalized.context).toEqual({ where: "test" });
  });

  it("preserves string errors", () => {
    expect(normalizeError("something broke").message).toBe("something broke");
  });

  it("extracts message/code from plain objects", () => {
    const obj = { message: "db failed", code: "PGRST204" };
    const n = normalizeError(obj);
    expect(n.message).toBe("db failed");
    expect(n.code).toBe("PGRST204");
  });

  it("falls back for unknown shapes", () => {
    expect(normalizeError(42).message).toBe("Unknown error");
    expect(normalizeError(null).message).toBe("Unknown error");
  });
});

describe("getUserMessage", () => {
  it("returns the error message when present", () => {
    expect(getUserMessage(new Error("nope"))).toBe("nope");
  });

  it("returns fallback for unknown errors", () => {
    expect(getUserMessage(null, "fallback")).toBe("fallback");
  });
});

describe("toast bus", () => {
  beforeEach(() => {
    // clean any leftover listeners by subscribing then unsubscribing first
  });

  it("delivers messages to subscribers and respects unsubscribe", () => {
    const received: ToastMessage[] = [];
    const unsub = subscribeToasts((t) => received.push(t));

    toast("hello", "info", 1000);
    expect(received).toHaveLength(1);
    expect(received[0].message).toBe("hello");
    expect(received[0].level).toBe("info");

    unsub();
    toast("after", "info");
    expect(received).toHaveLength(1);
  });

  it("reportAndToast logs and emits error level toast", () => {
    const received: ToastMessage[] = [];
    const unsub = subscribeToasts((t) => received.push(t));

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    reportAndToast(new Error("db down"), "Please retry");

    expect(received).toHaveLength(1);
    expect(received[0].level).toBe("error");
    expect(received[0].message).toBe("db down");

    spy.mockRestore();
    unsub();
  });
});
