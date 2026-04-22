import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callEdge, EdgeCallError } from "./edgeClient";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "user-token" } },
      })),
    },
  },
}));

describe("callEdge", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed JSON on 2xx", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ hello: "world" }),
    }) as unknown as Response) as typeof fetch;

    const result = await callEdge<{ hello: string }>("demo");
    expect(result.hello).toBe("world");
  });

  it("uses the user access token as bearer when available", async () => {
    const fetchSpy = vi.fn(async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer user-token");
      return { ok: true, status: 200, text: async () => "null" } as unknown as Response;
    }) as typeof fetch;
    globalThis.fetch = fetchSpy;

    await callEdge("demo", { method: "GET" });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("throws EdgeCallError with parsed body on 4xx", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => '{"error":"bad input","code":"BAD"}',
      json: async () => ({ error: "bad input", code: "BAD" }),
    }) as unknown as Response) as typeof fetch;

    await expect(callEdge("demo", { retries: 0 })).rejects.toMatchObject({
      name: "EdgeCallError",
      status: 400,
      code: "BAD",
      message: "bad input",
    });
  });

  it("retries on 5xx and succeeds when server recovers", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls < 2) {
        return {
          ok: false,
          status: 503,
          text: async () => '{"error":"temp"}',
          json: async () => ({ error: "temp" }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => '{"ok":true}',
      } as unknown as Response;
    }) as typeof fetch;

    const result = await callEdge<{ ok: boolean }>("demo", { retries: 1 });
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("propagates AbortError when the fetch is cancelled", async () => {
    globalThis.fetch = vi.fn((_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          },
          { once: true },
        );
      });
    }) as typeof fetch;

    const controller = new AbortController();
    const pending = callEdge("demo", { signal: controller.signal, retries: 0 });
    // let the attempt enter fetch, then abort
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("EdgeCallError", () => {
  it("captures status and code", () => {
    const err = new EdgeCallError("nope", 404, "NOT_FOUND");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("nope");
  });
});
