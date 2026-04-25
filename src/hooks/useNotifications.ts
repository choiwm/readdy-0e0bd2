import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { callEdge } from '@/lib/edgeClient';
import { logError } from '@/utils/errorHandler';

export type NotificationType =
  | 'credit_alert'
  | 'generation_complete'
  | 'generation_in_progress'
  | 'generation_failed'
  | 'system_notice'
  | 'feature_update'
  | 'welcome'
  | 'promotion';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: {
    current_balance?: number;
    alert_type?: string;
    action_url?: string;
    is_test?: boolean;
    generation_type?: string;
    model_name?: string;
    credits_used?: number;
    result_url?: string;
    broadcast?: boolean;
    is_welcome?: boolean;
    status?: 'in_progress' | 'complete' | 'failed';
    client_job_id?: string;
    error_message?: string;
  };
  is_read: boolean;
  created_at: string;
}

export const NOTIF_CONFIG: Record<NotificationType, {
  icon: string;
  iconColor: string;
  bgColor: string;
  label: string;
  accentColor: string;
  spinning?: boolean;
}> = {
  credit_alert: {
    icon: 'ri-copper-diamond-line',
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    label: '크레딧',
    accentColor: 'text-amber-400',
  },
  generation_complete: {
    icon: 'ri-sparkling-2-line',
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    label: '생성 완료',
    accentColor: 'text-emerald-400',
  },
  generation_in_progress: {
    icon: 'ri-loader-4-line',
    iconColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/15',
    label: '생성 중',
    accentColor: 'text-indigo-400',
    spinning: true,
  },
  generation_failed: {
    icon: 'ri-error-warning-line',
    iconColor: 'text-red-400',
    bgColor: 'bg-red-500/15',
    label: '생성 실패',
    accentColor: 'text-red-400',
  },
  system_notice: {
    icon: 'ri-megaphone-line',
    iconColor: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    label: '공지',
    accentColor: 'text-sky-400',
  },
  feature_update: {
    icon: 'ri-rocket-2-line',
    iconColor: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    label: '업데이트',
    accentColor: 'text-violet-400',
  },
  welcome: {
    icon: 'ri-hand-heart-line',
    iconColor: 'text-pink-400',
    bgColor: 'bg-pink-500/15',
    label: '환영',
    accentColor: 'text-pink-400',
  },
  promotion: {
    icon: 'ri-gift-2-line',
    iconColor: 'text-orange-400',
    bgColor: 'bg-orange-500/15',
    label: '혜택',
    accentColor: 'text-orange-400',
  },
};

const NOTIFY_FN = 'credit-alert-notify';

export function useNotifications() {
  const { isLoggedIn, profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isLoggedIn || !profile?.id) return;
    setLoading(true);
    try {
      const data = await callEdge<{ notifications?: AppNotification[]; unread_count?: number }>(
        NOTIFY_FN,
        {
          method: 'GET',
          query: { action: 'get_notifications', user_id: profile.id, limit: 40 },
          retries: 0,
        },
      );
      if (data?.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count ?? 0);
      }
    } catch (err) {
      logError(err, { where: 'useNotifications.fetchNotifications' }, 'warn');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, profile?.id]);

  useEffect(() => {
    if (!isLoggedIn || !profile?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
    pollingRef.current = setInterval(fetchNotifications, 15_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isLoggedIn, profile?.id, fetchNotifications]);

  const markRead = useCallback(async (notificationId: string) => {
    if (!profile?.id) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await callEdge(NOTIFY_FN, {
        query: { action: 'mark_read' },
        body: { user_id: profile.id, notification_id: notificationId },
        retries: 0,
      });
    } catch (err) {
      logError(err, { where: 'useNotifications.markRead' }, 'warn');
    }
  }, [profile?.id]);

  const markAllRead = useCallback(async () => {
    if (!profile?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await callEdge(NOTIFY_FN, {
        query: { action: 'mark_read' },
        body: { user_id: profile.id, mark_all: true },
        retries: 0,
      });
    } catch (err) {
      logError(err, { where: 'useNotifications.markAllRead' }, 'warn');
    }
  }, [profile?.id]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!profile?.id) return;
    const removed = notifications.find((n) => n.id === notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (removed && !removed.is_read) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await callEdge(NOTIFY_FN, {
        query: { action: 'delete' },
        body: { user_id: profile.id, notification_id: notificationId },
        retries: 0,
      });
    } catch (err) {
      logError(err, { where: 'useNotifications.deleteNotification' }, 'warn');
    }
  }, [profile?.id, notifications]);

  const deleteAll = useCallback(async () => {
    if (!profile?.id) return;
    setNotifications([]);
    setUnreadCount(0);
    try {
      await callEdge(NOTIFY_FN, {
        query: { action: 'delete' },
        body: { user_id: profile.id, delete_all: true },
        retries: 0,
      });
    } catch (err) {
      logError(err, { where: 'useNotifications.deleteAll' }, 'warn');
    }
  }, [profile?.id]);

  // ── 생성 시작 알림 (진행 중) ─────────────────────────────────────────
  const sendGenerationInProgress = useCallback(async (params: {
    generation_type: string;
    model_name?: string;
    client_job_id?: string;
  }): Promise<string | null> => {
    if (!profile?.id) return null;
    try {
      const data = await callEdge<{ notification_id?: string }>(NOTIFY_FN, {
        query: { action: 'generation_in_progress' },
        body: { user_id: profile.id, ...params },
        retries: 0,
      });
      // 로컬 상태에 즉시 반영
      if (data?.notification_id) {
        const typeLabels: Record<string, string> = {
          image: '이미지', video: '영상', music: '음악', tts: 'TTS 음성', sfx: '효과음', transcribe: '음성 전사', clean: '오디오 클린',
        };
        const label = typeLabels[params.generation_type] ?? params.generation_type;
        const newNotif: AppNotification = {
          id: data.notification_id,
          type: 'generation_in_progress',
          title: `${label} 생성 중...`,
          message: `${params.model_name ? `[${params.model_name}] ` : ''}${label}을(를) 생성하고 있습니다.`,
          data: { generation_type: params.generation_type, model_name: params.model_name, status: 'in_progress' },
          is_read: false,
          created_at: new Date().toISOString(),
        };
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
      return data?.notification_id ?? null;
    } catch (err) {
      logError(err, { where: 'useNotifications.sendGenerationInProgress' }, 'warn');
      return null;
    }
  }, [profile?.id]);

  // ── 생성 완료 알림 (진행 중 → 완료로 업데이트) ───────────────────────
  const completeGenerationNotif = useCallback(async (params: {
    generation_type: string;
    model_name?: string;
    credits_used?: number;
    result_url?: string;
    action_url?: string;
    notification_id?: string | null;
  }) => {
    if (!profile?.id) return;
    try {
      await callEdge(NOTIFY_FN, {
        query: { action: 'generation_complete' },
        body: { user_id: profile.id, ...params },
        retries: 0,
      });
      // 로컬 상태 업데이트
      if (params.notification_id) {
        const typeLabels: Record<string, string> = {
          image: '이미지', video: '영상', music: '음악', tts: 'TTS 음성', sfx: '효과음', transcribe: '음성 전사', clean: '오디오 클린',
        };
        const label = typeLabels[params.generation_type] ?? params.generation_type;
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === params.notification_id
              ? {
                  ...n,
                  type: 'generation_complete' as NotificationType,
                  title: `${label} 생성 완료`,
                  message: `${params.model_name ? `[${params.model_name}] ` : ''}${label} 생성이 완료됐습니다.${params.credits_used ? ` ${params.credits_used} CR 사용됨.` : ''}`,
                  data: { ...n.data, status: 'complete' },
                  is_read: false,
                }
              : n,
          ),
        );
      } else {
        // 새 알림 추가
        await fetchNotifications();
      }
    } catch (err) { logError(err, { where: "useNotifications" }, "warn"); }
  }, [profile?.id, fetchNotifications]);

  // ── 생성 실패 알림 ────────────────────────────────────────────────────
  const failGenerationNotif = useCallback(async (params: {
    generation_type: string;
    model_name?: string;
    error_message?: string;
    notification_id?: string | null;
  }) => {
    if (!profile?.id) return;
    try {
      await callEdge(NOTIFY_FN, {
        query: { action: 'generation_failed' },
        body: { user_id: profile.id, ...params },
        retries: 0,
      });
      if (params.notification_id) {
        const typeLabels: Record<string, string> = {
          image: '이미지', video: '영상', music: '음악', tts: 'TTS 음성', sfx: '효과음', transcribe: '음성 전사', clean: '오디오 클린',
        };
        const label = typeLabels[params.generation_type] ?? params.generation_type;
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === params.notification_id
              ? {
                  ...n,
                  type: 'generation_failed' as NotificationType,
                  title: `${label} 생성 실패`,
                  message: `${params.model_name ? `[${params.model_name}] ` : ''}${label} 생성 중 오류가 발생했습니다.`,
                  data: { ...n.data, status: 'failed' },
                  is_read: false,
                }
              : n,
          ),
        );
      }
    } catch (err) { logError(err, { where: "useNotifications" }, "warn"); }
  }, [profile?.id]);

  // ── 레거시 호환 (기존 코드에서 사용 중) ──────────────────────────────
  const sendGenerationComplete = useCallback(async (params: {
    generation_type: string;
    model_name?: string;
    credits_used?: number;
    result_url?: string;
    action_url?: string;
  }) => {
    if (!profile?.id) return;
    try {
      await callEdge(NOTIFY_FN, {
        query: { action: 'generation_complete' },
        body: { user_id: profile.id, ...params },
        retries: 0,
      });
    } catch (err) {
      logError(err, { where: 'useNotifications.sendGenerationComplete' }, 'warn');
    }
  }, [profile?.id]);

  // Supabase Realtime으로 새 알림 실시간 수신
  useEffect(() => {
    if (!isLoggedIn || !profile?.id) return;

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setNotifications((prev) => {
            // 중복 방지
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          setUnreadCount((prev) => prev + 1);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n)),
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn, profile?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
    deleteAll,
    sendGenerationComplete,
    sendGenerationInProgress,
    completeGenerationNotif,
    failGenerationNotif,
  };
}
