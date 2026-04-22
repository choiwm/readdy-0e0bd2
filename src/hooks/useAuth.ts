import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  status: string;
  role: string;
  credit_balance: number;
  is_email_verified: boolean;
  created_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
}

// ─── 모듈 레벨 싱글톤 ────────────────────────────────────────────────────────
let cachedState: AuthState = {
  user: null,
  session: null,
  profile: null,
  loading: true,
};
let initialized = false;
const listeners = new Set<(state: AuthState) => void>();

function notifyListeners(next: AuthState) {
  cachedState = next;
  listeners.forEach((fn) => fn(next));
}

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, display_name, avatar_url, plan, status, role, credit_balance, is_email_verified, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data as UserProfile | null;
  } catch {
    return null;
  }
}

async function createProfile(user: User): Promise<UserProfile | null> {
  try {
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      '사용자';
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        display_name: displayName,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        plan: 'free',
        status: 'active',
        role: 'user',
        credit_balance: 200,
        is_email_verified: !!user.email_confirmed_at,
        signup_source: 'web',
        language: 'ko',
      })
      .select('id, email, display_name, avatar_url, plan, status, role, credit_balance, is_email_verified, created_at')
      .maybeSingle();
    if (error) return null;
    return data as UserProfile | null;
  } catch {
    return null;
  }
}

// 크레딧 잔액을 싱글톤 캐시에 즉시 반영 (Navbar 실시간 업데이트)
export function updateCachedCreditBalance(newBalance: number) {
  if (!cachedState.profile) return;
  notifyListeners({
    ...cachedState,
    profile: { ...cachedState.profile, credit_balance: newBalance },
  });
}

function initAuthSingleton() {
  if (initialized) return;
  initialized = true;

  const run = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // 세션 확인 즉시 user 세팅 + loading: false → 버튼 즉시 표시
      notifyListeners({ user: session.user, session, profile: null, loading: false });
      // 이후 profile 비동기 로딩
      let profile = await fetchProfile(session.user.id);
      if (!profile) profile = await createProfile(session.user);
      notifyListeners({ user: session.user, session, profile, loading: false });
    } else {
      notifyListeners({ user: null, session: null, profile: null, loading: false });
    }
  };

  run();

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      // user 확정 즉시 loading: false로 전환 (버튼이 즉시 보이도록)
      notifyListeners({ user: session.user, session, profile: cachedState.profile, loading: false });
      let profile = await fetchProfile(session.user.id);
      if (!profile && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        profile = await createProfile(session.user);
      }
      // profile 로딩 완료 후 업데이트
      notifyListeners({ user: session.user, session, profile, loading: false });
    } else {
      notifyListeners({ user: null, session: null, profile: null, loading: false });
    }
  });
}

initAuthSingleton();
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth() {
  const [state, setState] = useState<AuthState>(cachedState);

  useEffect(() => {
    setState(cachedState);
    const listener = (s: AuthState) => setState(s);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName || email.split('@')[0] } },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // DB에서 최신 프로필 다시 불러와서 싱글톤 캐시 갱신
  const refreshProfile = useCallback(async () => {
    if (!cachedState.user) return;
    const profile = await fetchProfile(cachedState.user.id);
    if (profile) {
      notifyListeners({ ...cachedState, profile });
    }
  }, []);

  return {
    user: state.user,
    session: state.session,
    profile: state.profile,
    loading: state.loading,
    isLoggedIn: !!state.user,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };
}
