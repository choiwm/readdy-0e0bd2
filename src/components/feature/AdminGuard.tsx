import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

interface AdminGuardProps {
  children: React.ReactNode;
}

type AuthState = 'checking' | 'authorized' | 'unauthorized';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
// supabase.ts의 storageKey와 동일하게 맞춤
const STORAGE_KEY = 'sb-session';
const TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

function getTokenFromStorage(): string | null {
  try {
    // storageKey가 'sb-session'이므로 해당 키로 직접 접근
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    }

    // 폴백: sb- 로 시작하는 모든 키 탐색
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') && key.includes('auth')) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const p = JSON.parse(val) as { access_token?: string };
            if (p.access_token) return p.access_token;
          } catch {
            // 무시
          }
        }
      }
    }
  } catch {
    // 무시
  }
  return null;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>('checking');
  const checkedRef = useRef(false);

  useEffect(() => {
    // 중복 실행 방지
    if (checkedRef.current) return;
    checkedRef.current = true;

    let mounted = true;

    const checkAdminAuth = async (): Promise<void> => {
      try {
        let accessToken: string | null = null;

        // 1. SDK로 세션 가져오기 (타임아웃 15초)
        try {
          const { data: { session } } = await withTimeout(
            supabase.auth.getSession(),
            TIMEOUT_MS
          );
          accessToken = session?.access_token ?? null;
        } catch {
          // SDK 타임아웃 → localStorage에서 직접 추출
          accessToken = getTokenFromStorage();
        }

        if (!accessToken) {
          if (mounted) {
            setAuthState('unauthorized');
            navigate('/admin-login', { replace: true });
          }
          return;
        }

        // 2. Edge Function으로 관리자 권한 확인
        let isAdmin = false;
        try {
          const resp = await withTimeout(
            fetch(`${SUPABASE_URL}/functions/v1/admin-stats?action=check_admin`, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                apikey: SUPABASE_ANON_KEY,
              },
            }),
            TIMEOUT_MS
          );

          if (resp.ok) {
            const result = await resp.json() as { is_admin: boolean };
            isAdmin = result.is_admin === true;
          }
        } catch {
          // Edge Function 타임아웃/실패 → 로그인 페이지로
          if (mounted) {
            setAuthState('unauthorized');
            navigate('/admin-login', { replace: true });
          }
          return;
        }

        if (!isAdmin) {
          await supabase.auth.signOut();
          if (mounted) {
            setAuthState('unauthorized');
            navigate('/admin-login', { replace: true });
          }
          return;
        }

        if (mounted) {
          setAuthState('authorized');
        }
      } catch {
        if (mounted) {
          setAuthState('unauthorized');
          navigate('/admin-login', { replace: true });
        }
      }
    };

    checkAdminAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && mounted) {
        setAuthState('unauthorized');
        navigate('/admin-login', { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (authState === 'checking') {
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

  if (authState === 'unauthorized') {
    return null;
  }

  return <>{children}</>;
}
