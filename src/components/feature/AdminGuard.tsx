import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { logError } from '@/utils/errorHandler';

/**
 * 4-tier admin role enum, mirrors AdminRole in supabase/functions/_shared/auth.ts
 * (migration 0007). Server enforces via requireAdmin(req, allowedRoles[]);
 * the context here is only for UX (hide tabs the role can't use).
 */
export type AdminRole = 'super_admin' | 'ops' | 'cs' | 'billing';

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: '슈퍼 관리자',
  ops:         '운영',
  cs:          'CS',
  billing:     '결제',
};

interface RoleCtx {
  role: AdminRole;
  isSuper: boolean;
}

const RoleContext = createContext<RoleCtx | null>(null);

/**
 * Throws when called outside <AdminGuard>. Components inside the guard
 * can safely assume role is set.
 */
export function useAdminRole(): RoleCtx {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useAdminRole must be used inside <AdminGuard>');
  return ctx;
}

interface AdminGuardProps {
  children: React.ReactNode;
}

type AuthState =
  | { kind: 'checking' }
  | { kind: 'authorized'; role: AdminRole }
  | { kind: 'unauthorized' };
const STORAGE_KEY = 'sb-session';
const TIMEOUT_MS = 15000;
const REVALIDATE_MS = 5 * 60 * 1000; // 5분마다 서버 재검증

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

function getTokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    }
    // 폴백: sb- 로 시작하는 모든 키 탐색
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.includes('auth')) {
        const val = localStorage.getItem(key);
        if (!val) continue;
        try {
          const p = JSON.parse(val) as { access_token?: string };
          if (p.access_token) return p.access_token;
        } catch (err) {
          logError(err, { where: 'AdminGuard.getTokenFromStorage.parse', key }, 'warn');
        }
      }
    }
  } catch (err) {
    logError(err, { where: 'AdminGuard.getTokenFromStorage' }, 'warn');
  }
  return null;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>({ kind: 'checking' });
  const abortRef = useRef<AbortController | null>(null);

  const verifyAdmin = useCallback(async (signal: AbortSignal): Promise<AuthState> => {
    let accessToken: string | null = null;

    try {
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        TIMEOUT_MS,
        signal,
      );
      accessToken = session?.access_token ?? null;
    } catch (err) {
      logError(err, { where: 'AdminGuard.getSession' }, 'warn');
      accessToken = getTokenFromStorage();
    }

    if (!accessToken) return { kind: 'unauthorized' };

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-stats?action=check_admin`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        signal,
      });
      if (!resp.ok) return { kind: 'unauthorized' };
      const result = (await resp.json()) as { is_admin?: boolean; role?: string };
      if (result.is_admin !== true) return { kind: 'unauthorized' };

      // 마이그레이션 0007 이전의 free-text role 또는 NULL 은 super_admin 으로
      // 폴백 (서버측 requireAdmin 도 같은 폴백을 함).
      const rawRole = (result.role ?? '').toString();
      const role: AdminRole =
        rawRole === 'ops' || rawRole === 'cs' || rawRole === 'billing'
          ? rawRole
          : 'super_admin';
      return { kind: 'authorized', role };
    } catch (err) {
      if (signal.aborted) throw err;
      logError(err, { where: 'AdminGuard.checkAdmin' }, 'error');
      return { kind: 'unauthorized' };
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let timer: ReturnType<typeof setInterval> | null = null;

    const runCheck = async () => {
      try {
        const next = await verifyAdmin(controller.signal);
        if (controller.signal.aborted) return;
        setAuthState(next);
        if (next.kind === 'unauthorized') {
          try { await supabase.auth.signOut(); } catch (err) {
            logError(err, { where: 'AdminGuard.signOut' }, 'warn');
          }
          navigate('/admin-login', { replace: true });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        logError(err, { where: 'AdminGuard.runCheck' }, 'error');
        setAuthState({ kind: 'unauthorized' });
        navigate('/admin-login', { replace: true });
      }
    };

    runCheck();
    timer = setInterval(runCheck, REVALIDATE_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !controller.signal.aborted) {
        setAuthState({ kind: 'unauthorized' });
        navigate('/admin-login', { replace: true });
      }
    });

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
      subscription.unsubscribe();
    };
  }, [navigate, verifyAdmin]);

  if (authState.kind === 'checking') {
    return (
      <div className="min-h-screen bg-[#09090c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <i className="ri-shield-star-line text-white text-xl" />
          </div>
          <div className="flex items-center gap-2">
            <i className="ri-loader-4-line animate-spin text-zinc-500 text-lg" />
            <span className="text-sm text-zinc-500">관리자 권한 확인 중...</span>
          </div>
        </div>
      </div>
    );
  }

  if (authState.kind === 'unauthorized') {
    return null;
  }

  return (
    <RoleContext.Provider value={{ role: authState.role, isSuper: authState.role === 'super_admin' }}>
      {children}
    </RoleContext.Provider>
  );
}
