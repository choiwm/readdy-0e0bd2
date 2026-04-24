import { useState, useCallback, useEffect, useRef } from 'react';
import { logDev } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth, updateCachedCreditBalance } from '@/hooks/useAuth';

const GUEST_MAX_CREDITS = 200;
const SESSION_KEY = 'ai_platform_session_id';
const LS_KEY = 'ai_platform_credits';
// 알림 쿨다운 키 (로컬 중복 방지)
const ALERT_COOLDOWN_KEY = 'credit_alert_last_sent';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function lsLoad(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return GUEST_MAX_CREDITS;
    const val = parseInt(raw, 10);
    return Number.isNaN(val) ? GUEST_MAX_CREDITS : Math.max(0, val);
  } catch { return GUEST_MAX_CREDITS; }
}

function lsSave(val: number) {
  try { localStorage.setItem(LS_KEY, String(val)); } catch { /* ignore */ }
}

// 로컬 쿨다운 체크 (Edge Function 호출 전 빠른 필터링)
function isAlertCooldownActive(): boolean {
  try {
    const raw = localStorage.getItem(ALERT_COOLDOWN_KEY);
    if (!raw) return false;
    const lastSent = parseInt(raw, 10);
    // 1시간 로컬 쿨다운
    return Date.now() - lastSent < 60 * 60 * 1000;
  } catch { return false; }
}

function markAlertSent() {
  try { localStorage.setItem(ALERT_COOLDOWN_KEY, String(Date.now())); } catch { /* ignore */ }
}

export function useCredits() {
  const { isLoggedIn, profile } = useAuth();
  const sessionId = useRef(getSessionId());
  const userIdRef = useRef<string | null>(null);

  const [guestCredits, setGuestCredits] = useState<number>(lsLoad);
  const [loaded, setLoaded] = useState(false);

  const credits = isLoggedIn && profile ? profile.credit_balance : guestCredits;

  useEffect(() => {
    if (isLoggedIn && profile) {
      userIdRef.current = profile.id;
      lsSave(profile.credit_balance);
      setLoaded(true);
    } else if (!isLoggedIn) {
      userIdRef.current = null;
      loadGuestCredits();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, profile?.id]);

  const loadGuestCredits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('balance')
        .eq('session_id', sessionId.current)
        .maybeSingle();

      if (!error && data) {
        setGuestCredits(data.balance);
        lsSave(data.balance);
      } else if (!error && !data) {
        const { data: inserted } = await supabase
          .from('credits')
          .insert({ session_id: sessionId.current, balance: GUEST_MAX_CREDITS })
          .select('balance')
          .maybeSingle();
        if (inserted) {
          setGuestCredits(inserted.balance);
          lsSave(inserted.balance);
        }
      }
    } catch { /* 폴백: localStorage */ }
    setLoaded(true);
  }, []);

  const updateDB = useCallback(async (newBalance: number) => {
    lsSave(newBalance);
    try {
      if (userIdRef.current) {
        updateCachedCreditBalance(newBalance);
        await supabase
          .from('user_profiles')
          .update({ credit_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', userIdRef.current);
      } else {
        await supabase
          .from('credits')
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq('session_id', sessionId.current);
      }
    } catch { /* 폴백: localStorage만 사용 */ }
  }, []);

  // 크레딧 부족 인앱 알림 트리거 (로그인 사용자만)
  const triggerCreditAlert = useCallback(async (newBalance: number) => {
    if (!userIdRef.current) return; // 비로그인 스킵
    if (isAlertCooldownActive()) return; // 로컬 쿨다운 체크

    try {
      const res = await supabase.functions.invoke('credit-alert-notify', {
        body: {
          user_id: userIdRef.current,
          current_balance: newBalance,
          max_balance: 5000, // 기본 최대값 (Pro 플랜 기준)
        },
      });

      if (res.data?.sent) {
        markAlertSent();
        logDev('[Credit Alert] In-app notification sent:', res.data.user_id);
      }
    } catch (e) {
      // 알림 실패는 조용히 무시 (UX 방해 금지)
      console.warn('[Credit Alert] Failed to trigger:', e);
    }
  }, []);

  const deduct = useCallback((amount: number): boolean => {
    const current = isLoggedIn && profile ? profile.credit_balance : guestCredits;
    if (current < amount) return false;
    const next = current - amount;

    if (isLoggedIn && profile) {
      updateCachedCreditBalance(next);
    } else {
      setGuestCredits(next);
    }
    updateDB(next);

    // 크레딧 차감 후 알림 체크 (비동기, UX 블로킹 없음)
    triggerCreditAlert(next);

    return true;
  }, [isLoggedIn, profile, guestCredits, updateDB, triggerCreditAlert]);

  const refund = useCallback((amount: number): void => {
    const current = isLoggedIn && profile ? profile.credit_balance : guestCredits;
    const next = current + amount;

    if (isLoggedIn && profile) {
      updateCachedCreditBalance(next);
    } else {
      setGuestCredits(next);
    }
    updateDB(next);
  }, [isLoggedIn, profile, guestCredits, updateDB]);

  const canAfford = useCallback((amount: number): boolean => {
    return credits >= amount;
  }, [credits]);

  const refreshCredits = useCallback(async () => {
    if (userIdRef.current) {
      const { data } = await supabase
        .from('user_profiles')
        .select('credit_balance')
        .eq('id', userIdRef.current)
        .maybeSingle();
      if (data) {
        updateCachedCreditBalance(data.credit_balance);
        lsSave(data.credit_balance);
      }
    } else {
      await loadGuestCredits();
    }
  }, [loadGuestCredits]);

  return {
    credits,
    maxCredits: isLoggedIn ? Infinity : GUEST_MAX_CREDITS,
    deduct,
    refund,
    canAfford,
    loaded,
    isLoggedIn,
    refreshCredits,
  };
}
