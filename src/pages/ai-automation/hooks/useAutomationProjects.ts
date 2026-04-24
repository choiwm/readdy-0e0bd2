import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, AutomationProjectDB } from '@/lib/supabase';
import { AutomationProject } from '@/mocks/automationProjects';

const SESSION_KEY = 'ai_platform_session_id';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function dbToProject(row: AutomationProjectDB): AutomationProject {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    status: row.status,
    duration: row.duration,
    ratio: row.ratio,
    style: row.style,
    thumbnail: row.thumbnail,
    views: row.views,
    likes: row.likes,
    model: row.model,
    mode: row.mode as 'AutoPilot' | 'Manual',
    cuts: row.cuts,
    progress: row.progress ?? undefined,
    createdAt: row.created_at,
  };
}

function projectToDB(
  p: AutomationProject,
  userId?: string | null,
  sessionId?: string,
): Omit<AutomationProjectDB, 'created_at' | 'updated_at'> & { user_id?: string | null; session_id?: string | null } {
  return {
    id: p.id,
    title: p.title,
    topic: p.topic,
    status: p.status,
    duration: p.duration,
    ratio: p.ratio,
    style: p.style,
    thumbnail: p.thumbnail,
    views: p.views,
    likes: p.likes,
    model: p.model,
    mode: p.mode,
    cuts: p.cuts,
    progress: p.progress ?? null,
    user_id: userId ?? sessionId ?? null,
    session_id: userId ? null : (sessionId ?? null),
  };
}

export function useAutomationProjects(initialProjects: AutomationProject[], userId?: string | null) {
  const [projects, setProjects] = useState<AutomationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);
  const sessionId = useRef(getSessionId());
  const migrationDoneRef = useRef(false);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  // 비로그인 → 로그인 시 session 데이터 마이그레이션
  const migrateSessionData = useCallback(async (uid: string) => {
    if (migrationDoneRef.current) return;
    migrationDoneRef.current = true;
    try {
      const sid = sessionId.current;
      const { data: sessionItems } = await supabase
        .from('automation_projects')
        .select('id')
        .eq('user_id', sid);

      if (!sessionItems || sessionItems.length === 0) return;

      await supabase
        .from('automation_projects')
        .update({ user_id: uid, session_id: sid })
        .eq('user_id', sid);
    } catch { /* 조용히 실패 */ }
  }, []);

  // initialProjects를 ref로 저장해서 stale closure 방지
  const initialProjectsRef = useRef(initialProjects);
  useEffect(() => { initialProjectsRef.current = initialProjects; }, [initialProjects]);

  const load = useCallback(async (uid: string | null | undefined) => {
    setLoading(true);
    const currentInitialProjects = initialProjectsRef.current;
    try {
      let data: AutomationProjectDB[] | null = null;
      let error: unknown = null;

      if (uid) {
        // 로그인 사용자: user_id로 조회
        const result = await supabase
          .from('automation_projects')
          .select('*')
          .order('created_at', { ascending: false })
          .eq('user_id', uid);
        data = result.data as AutomationProjectDB[] | null;
        error = result.error;
      } else {
        // 비로그인: session_id 컬럼으로 조회 (user_id에 sessionId를 저장하는 방식도 병행)
        const sid = sessionId.current;
        const result = await supabase
          .from('automation_projects')
          .select('*')
          .order('created_at', { ascending: false })
          .or(`user_id.eq.${sid},session_id.eq.${sid}`);
        data = result.data as AutomationProjectDB[] | null;
        error = result.error;
      }

      if (error) throw error;

      if (data && data.length > 0) {
        setProjects((data as AutomationProjectDB[]).map(dbToProject));
      } else if (!uid) {
        // 비로그인 첫 방문 시 mock 데이터 시드
        if (currentInitialProjects.length > 0) {
          const inserts = currentInitialProjects.map((p) => projectToDB(p, null, sessionId.current));
          const { error: insertErr } = await supabase
            .from('automation_projects')
            .upsert(inserts, { onConflict: 'id' });
          if (!insertErr) {
            setProjects(currentInitialProjects);
          }
        }
      } else {
        // 로그인 사용자 첫 방문 시 빈 갤러리
        setProjects([]);
      }
      setDbReady(true);
    } catch {
      setProjects(uid ? [] : currentInitialProjects);
      setDbReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // userId 변경 감지 → 마이그레이션 + 리로드
  useEffect(() => {
    if (prevUserIdRef.current === userId) return;
    const wasLoggedOut = !prevUserIdRef.current || prevUserIdRef.current === undefined;
    prevUserIdRef.current = userId;

    if (userId && wasLoggedOut) {
      migrateSessionData(userId).then(() => load(userId));
    } else {
      load(userId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addProject = useCallback(async (project: AutomationProject) => {
    setProjects((prev) => [project, ...prev]);
    // dbReady 여부와 관계없이 DB 저장 시도 (초기 로딩 중 추가된 프로젝트도 보존)
    try {
      await supabase
        .from('automation_projects')
        .upsert(projectToDB(project, userId, sessionId.current), { onConflict: 'id' });
    } catch {
      // silently fail — local state already updated
    }
  }, [userId]);

  const updateProjects = useCallback(async (updated: AutomationProject[]) => {
    // stale closure 방지: setProjects의 functional update로 현재 projects 참조
    // removedIds를 Promise로 추출하여 비동기 타이밍 문제 해결
    const removedIds = await new Promise<string[]>((resolve) => {
      setProjects((prev) => {
        const updatedIds = new Set(updated.map((p) => p.id));
        const removed = prev.filter((p) => !updatedIds.has(p.id)).map((p) => p.id);
        resolve(removed);
        return updated;
      });
    });
    if (!dbReady) return;
    // Sync deletions
    if (removedIds.length > 0) {
      await supabase.from('automation_projects').delete().in('id', removedIds);
    }
    // Upsert remaining
    if (updated.length > 0) {
      await supabase
        .from('automation_projects')
        .upsert(updated.map((p) => projectToDB(p, userId, sessionId.current)), { onConflict: 'id' });
    }
  }, [dbReady, userId]);

  const deleteProject = useCallback(async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (!dbReady) return;
    await supabase.from('automation_projects').delete().eq('id', id);
  }, [dbReady]);

  const upsertProject = useCallback(async (project: AutomationProject) => {
    setProjects((prev) => {
      const exists = prev.find((p) => p.id === project.id);
      if (exists) return prev.map((p) => p.id === project.id ? project : p);
      return [project, ...prev];
    });
    if (!dbReady) return;
    await supabase
      .from('automation_projects')
      .upsert(projectToDB(project, userId, sessionId.current), { onConflict: 'id' });
  }, [dbReady, userId]);

  return {
    projects,
    loading,
    dbReady,
    addProject,
    updateProjects,
    deleteProject,
    upsertProject,
    setProjects,
  };
}
