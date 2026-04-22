import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── hoisted mocks ──────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  getSessionMock: vi.fn(),
  signOutMock: vi.fn(async () => ({})),
  authStateChangeMock: vi.fn((_cb: unknown) => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigateMock,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mocks.getSessionMock(),
      signOut: () => mocks.signOutMock(),
      onAuthStateChange: (cb: unknown) => mocks.authStateChangeMock(cb),
    },
  },
}));

import AdminGuard from "./AdminGuard";

function renderGuard() {
  return render(
    <MemoryRouter>
      <AdminGuard>
        <div data-testid="protected">admin content</div>
      </AdminGuard>
    </MemoryRouter>,
  );
}

describe("AdminGuard", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mocks.navigateMock.mockReset();
    mocks.getSessionMock.mockReset();
    mocks.signOutMock.mockClear();
    mocks.authStateChangeMock.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("shows the loading state initially", () => {
    mocks.getSessionMock.mockImplementation(
      () => new Promise(() => { /* never resolves during initial render */ }),
    );
    renderGuard();
    expect(screen.getByText("관리자 권한 확인 중...")).toBeInTheDocument();
  });

  it("redirects to /admin-login when there is no session", async () => {
    mocks.getSessionMock.mockResolvedValue({ data: { session: null } });
    renderGuard();

    await waitFor(() => {
      expect(mocks.navigateMock).toHaveBeenCalledWith("/admin-login", { replace: true });
    });
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("redirects when the admin check returns non-admin", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ is_admin: false }),
    }) as unknown as Response) as typeof fetch;

    renderGuard();

    await waitFor(() => {
      expect(mocks.navigateMock).toHaveBeenCalledWith("/admin-login", { replace: true });
    });
    expect(mocks.signOutMock).toHaveBeenCalled();
  });

  it("renders children when the user is an active admin", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ is_admin: true, role: "superadmin" }),
    }) as unknown as Response) as typeof fetch;

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("protected")).toBeInTheDocument();
    });
    expect(mocks.navigateMock).not.toHaveBeenCalled();
  });

  it("treats a failed admin check as unauthorized", async () => {
    mocks.getSessionMock.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as unknown as Response) as typeof fetch;

    renderGuard();

    await waitFor(() => {
      expect(mocks.navigateMock).toHaveBeenCalledWith("/admin-login", { replace: true });
    });
    errSpy.mockRestore();
  });

  it("falls back to the localStorage token when getSession throws", async () => {
    mocks.getSessionMock.mockRejectedValue(new Error("network"));
    localStorage.setItem(
      "sb-session",
      JSON.stringify({ access_token: "ls-token" }),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer ls-token");
      return {
        ok: true,
        status: 200,
        json: async () => ({ is_admin: true }),
      } as unknown as Response;
    }) as typeof fetch;

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId("protected")).toBeInTheDocument();
    });
    warnSpy.mockRestore();
  });
});
