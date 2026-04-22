import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface ReferenceSlot {
  id: string;
  label: string;
  icon: string;
  imageUrl: string | null;
}

interface ShotCard {
  id: string;
  index: number;
  imageUrl: string | null;
  prompt: string;
  shotType: string;
  isGenerating: boolean;
  progress: number;
  error: string | null;
}

interface Project {
  id: string;
  title: string;
  aspectRatio: string;
  model: string;
  resolution: string;
  outputMode: 'image' | 'video';
  shots: ShotCard[];
  refSlots: ReferenceSlot[];
}

interface DbRow {
  id: string;
  title: string;
  aspect_ratio: string;
  model: string;
  resolution: string;
  output_mode: string;
  shots: ShotCard[];
  ref_slots: ReferenceSlot[];
  created_at: string;
  updated_at: string;
}

function rowToProject(row: DbRow): Project {
  return {
    id: row.id,
    title: row.title,
    aspectRatio: row.aspect_ratio,
    model: row.model,
    resolution: row.resolution,
    outputMode: row.output_mode as 'image' | 'video',
    shots: (row.shots ?? []).map((s: ShotCard) => ({
      ...s,
      isGenerating: false,
      progress: s.imageUrl ? 100 : 0,
      error: null,
    })),
    refSlots: row.ref_slots ?? [],
  };
}

function projectToRow(p: Project): Omit<DbRow, 'created_at' | 'updated_at'> {
  return {
    id: p.id,
    title: p.title,
    aspect_ratio: p.aspectRatio,
    model: p.model,
    resolution: p.resolution,
    output_mode: p.outputMode,
    shots: p.shots.map((s) => ({
      id: s.id,
      index: s.index,
      imageUrl: s.imageUrl,
      prompt: s.prompt,
      shotType: s.shotType,
      isGenerating: false,
      progress: s.imageUrl ? 100 : 0,
      error: null,
    })),
    ref_slots: p.refSlots,
  };
}

export function useBoardProjects(userId?: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 마지막으로 Supabase에 저장된 스냅샷 (변경사항 감지용)
  const savedSnapshotRef = useRef<Record<string, string>>({});

  const loadProjects = useCallback(async (): Promise<Project[]> => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('board_projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      const loaded = (data as DbRow[]).map(rowToProject);
      setProjects(loaded);
      // 로드된 프로젝트들을 저장 스냅샷으로 등록
      loaded.forEach((p) => {
        savedSnapshotRef.current[p.id] = JSON.stringify(projectToRow(p));
      });
      return loaded;
    } catch (err) {
      console.error('Failed to load board projects:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const saveProject = useCallback(async (project: Project): Promise<boolean> => {
    setIsSaving(true);
    try {
      const row = {
        ...projectToRow(project),
        user_id: userId ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('board_projects')
        .upsert(row, { onConflict: 'id' });

      if (error) throw error;

      // 저장 성공 시 스냅샷 업데이트
      savedSnapshotRef.current[project.id] = JSON.stringify(projectToRow(project));

      setProjects((prev) => {
        const exists = prev.find((p) => p.id === project.id);
        if (exists) {
          return prev.map((p) => (p.id === project.id ? project : p));
        }
        return [project, ...prev];
      });

      return true;
    } catch (err) {
      console.error('Failed to save board project:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [userId]);

  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('board_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      return true;
    } catch (err) {
      console.error('Failed to delete board project:', err);
      return false;
    }
  }, []);

  // 자동 저장 (디바운스 1.5초)
  const autoSave = useCallback((project: Project) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProject(project);
    }, 1500);
  }, [saveProject]);

  // 미저장 변경사항 감지
  const hasUnsavedChanges = useCallback((project: Project): boolean => {
    const snapshot = savedSnapshotRef.current[project.id];
    if (!snapshot) return false; // 신규 프로젝트는 이미 saveProject로 저장됨
    const current = JSON.stringify(projectToRow(project));
    return snapshot !== current;
  }, []);

  return {
    projects,
    setProjects,
    isLoading,
    isSaving,
    loadProjects,
    saveProject,
    deleteProject,
    autoSave,
    hasUnsavedChanges,
  };
}
