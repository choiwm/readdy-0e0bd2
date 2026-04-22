import { useState, useEffect, useCallback, useRef } from 'react';
import { ShortcutTool } from '@/mocks/aiShortcuts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY = 'ai_shortcuts_custom_services';
const SESSION_KEY = 'ai_shortcuts_session_id';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sc_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface CustomService extends ShortcutTool {
  categoryId: string;
  addedAt: number;
}

function lsLoad(): CustomService[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomService[]) : [];
  } catch {
    return [];
  }
}

function lsSave(services: CustomService[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
  } catch { /* ignore */ }
}

export function useCustomServices() {
  const { profile } = useAuth();
  const [customServices, setCustomServices] = useState<CustomService[]>(lsLoad);
  const sessionId = useRef(getSessionId());
  const dbReady = useRef(false);

  // DB에서 커스텀 서비스 로드
  useEffect(() => {
    const load = async () => {
      try {
        let query = supabase
          .from('user_shortcuts')
          .select('*')
          .order('added_at', { ascending: true });

        if (profile?.id) {
          query = query.eq('user_id', profile.id);
        } else {
          query = query.eq('session_id', sessionId.current);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          const loaded: CustomService[] = data.map((row) => ({
            name: row.name,
            url: row.url,
            icon: row.icon ?? 'ri-global-line',
            color: row.color ?? '#6366f1',
            desc: row.description ?? '',
            categoryId: row.category_id,
            addedAt: row.added_at ?? Date.now(),
          }));
          setCustomServices(loaded);
          lsSave(loaded);
        }
        dbReady.current = true;
      } catch {
        // localStorage 폴백
        dbReady.current = false;
      }
    };
    load();
  }, [profile?.id]);

  const addServices = useCallback(
    async (services: Array<{ name: string; url: string; icon: string; color: string; bg: string; border: string; categoryId: string; desc: string }>) => {
      setCustomServices((prev) => {
        const existingNames = new Set(prev.map((s) => s.name));
        const newOnes: CustomService[] = services
          .filter((s) => !existingNames.has(s.name))
          .map((s) => ({
            name: s.name,
            url: s.url,
            icon: s.icon ?? 'ri-global-line',
            color: s.color,
            desc: s.desc || `${s.name} AI 서비스`,
            categoryId: s.categoryId,
            addedAt: Date.now(),
          }));
        const updated = [...prev, ...newOnes];
        lsSave(updated);

        // DB 저장 (비동기)
        if (newOnes.length > 0) {
          const rows = newOnes.map((s) => ({
            id: `sc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            user_id: profile?.id ?? null,
            session_id: sessionId.current,
            name: s.name,
            url: s.url,
            icon: s.icon,
            color: s.color,
            category_id: s.categoryId,
            description: s.desc,
            added_at: s.addedAt,
          }));
          supabase.from('user_shortcuts').upsert(rows, { onConflict: 'id' }).then(() => {});
        }

        return updated;
      });
    },
    [profile?.id]
  );

  const removeService = useCallback(async (name: string) => {
    setCustomServices((prev) => {
      const updated = prev.filter((s) => s.name !== name);
      lsSave(updated);
      return updated;
    });

    // DB에서도 삭제
    try {
      let query = supabase.from('user_shortcuts').delete().eq('name', name);
      if (profile?.id) {
        query = query.eq('user_id', profile.id);
      } else {
        query = query.eq('session_id', sessionId.current);
      }
      await query;
    } catch { /* 조용히 실패 */ }
  }, [profile?.id]);

  const isAdded = useCallback(
    (name: string) => customServices.some((s) => s.name === name),
    [customServices]
  );

  const save = useCallback((services: CustomService[]) => {
    setCustomServices(services);
    lsSave(services);
  }, []);

  return { customServices, addServices, removeService, isAdded, save };
}
