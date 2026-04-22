import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
const STORAGE_KEY = 'sb-session';
const TIMEOUT_MS = 10000;

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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string };
      if (parsed.access_token) return parsed.access_token;
    }
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('sb-') && key.includes('auth')) {
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const p = JSON.parse(val) as { access_token?: string };
            if (p.access_token) return p.access_token;
          } catch { /* 무시 */ }
        }
      }
    }
  } catch { /* 무시 */ }
  return null;
}

async function checkAdminViaEdge(accessToken: string): Promise<boolean> {
  try {
    const resp = await withTimeout(
      fetch(
        `${SUPABASE_URL}/functions/v1/admin-stats?action=check_admin`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
          },
        }
      ),
      TIMEOUT_MS
    );
    if (!resp.ok) return false;
    const result = await resp.json() as { is_admin: boolean };
    return result.is_admin === true;
  } catch {
    return false;
  }
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const checkedRef = useRef(false);

  // 이미 로그인된 관리자면 /admin으로 리다이렉트 (한 번만 실행)
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const checkSession = async () => {
      try {
        let accessToken: string | null = null;

        try {
          const { data: { session } } = await withTimeout(
            supabase.auth.getSession(),
            TIMEOUT_MS
          );
          accessToken = session?.access_token ?? null;
        } catch {
          // SDK 타임아웃 → localStorage 폴백
          accessToken = getTokenFromStorage();
        }

        if (accessToken) {
          const isAdmin = await checkAdminViaEdge(accessToken);
          if (isAdmin) {
            navigate('/admin', { replace: true });
            return;
          }
        }
      } catch {
        // 세션 확인 실패 시 그냥 로그인 폼 표시
      }
      setCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Supabase Auth 로그인
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData.session) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      // 2. Edge Function(service_role)으로 관리자 권한 확인 → RLS 완전 우회
      const isAdmin = await checkAdminViaEdge(authData.session.access_token);

      if (!isAdmin) {
        await supabase.auth.signOut();
        setError('관리자 권한이 없습니다. 접근이 거부됐습니다.');
        setLoading(false);
        return;
      }

      // 3. 마지막 로그인 시간 업데이트 (실패해도 무시)
      try {
        await supabase
          .from('admin_accounts')
          .update({ last_login_at: new Date().toISOString() })
          .eq('email', authData.user?.email ?? '');
      } catch {
        // 무시
      }

      // 4. Admin 페이지로 이동
      navigate('/admin', { replace: true });
    } catch {
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#09090c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <i className="ri-shield-star-line text-white text-lg" />
          </div>
          <i className="ri-loader-4-line animate-spin text-zinc-500 text-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090c] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-4">
            <i className="ri-shield-star-line text-white text-2xl" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">Admin Console</h1>
          <p className="text-sm text-zinc-500 mt-1">AiMetaWOW 관리자 전용</p>
        </div>

        <div className="bg-[#0f0f13] border border-white/8 rounded-2xl p-6">
          <div className="mb-5">
            <h2 className="text-base font-black text-white">관리자 로그인</h2>
            <p className="text-xs text-zinc-500 mt-1">등록된 관리자 계정으로만 접근 가능합니다</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-error-warning-line text-red-400 text-sm" />
              </div>
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
                관리자 이메일
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-mail-line text-zinc-500 text-sm" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@aimetawow.com"
                  autoComplete="email"
                  className="w-full bg-zinc-900 border border-white/8 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 mb-1.5 block">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                  <i className="ri-lock-line text-zinc-500 text-sm" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-zinc-900 border border-white/8 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-sm`} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-2 whitespace-nowrap mt-2"
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-sm" />
                  인증 중...
                </>
              ) : (
                <>
                  <i className="ri-shield-keyhole-line text-sm" />
                  관리자 로그인
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className="ri-information-line text-zinc-600 text-xs" />
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                이 페이지는 등록된 관리자만 접근할 수 있습니다. 무단 접근 시도는 기록되며 법적 조치를 받을 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-5">
          <a
            href="/"
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line mr-1" />
            메인 페이지로 돌아가기
          </a>
        </div>
      </div>
    </div>
  );
}
