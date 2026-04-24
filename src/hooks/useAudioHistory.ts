/**
 * useAudioHistory — Supabase DB 기반 오디오 히스토리 영구 저장
 * 로그인 사용자: user_id 기반으로 계정에 저장 (기기 간 동기화)
 * 비로그인: user_session 기반으로 세션 단위 저장
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { AudioHistoryItem, AudioType } from '@/mocks/audioHistory';

const SESSION_KEY = 'ai_audio_session_id';
const MAX_ITEMS = 50;

// 세션 ID 생성/로드 (비로그인 세션 단위 구분)
function getSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

// DB row → AudioHistoryItemExtended 변환
function rowToItem(row: Record<string, unknown>): AudioHistoryItemExtended {
  return {
    id: row.id as string,
    title: row.title as string,
    text: (row.text as string) ?? '',
    voiceName: (row.voice_name as string) ?? '',
    voiceAvatar: (row.voice_avatar as string) ?? '',
    duration: (row.duration as number) ?? 0,
    status: (row.status as AudioHistoryItem['status']) ?? 'completed',
    type: (row.type as AudioType) ?? 'tts',
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    fileSize: (row.file_size as string) ?? '-',
    lang: (row.lang as string) ?? '',
    liked: (row.liked as boolean) ?? false,
    progress: (row.progress as number | undefined),
    audioUrl: (row.audio_url as string | undefined),
    storageUrl: (row.storage_url as string | undefined),
  };
}

// AudioHistoryItem → DB row 변환
function itemToRow(
  item: AudioHistoryItem,
  sessionId: string,
  userId?: string | null
): Record<string, unknown> {
  return {
    id: item.id,
    title: item.title,
    text: item.text,
    voice_name: item.voiceName,
    voice_avatar: item.voiceAvatar,
    duration: item.duration,
    status: item.status,
    type: item.type,
    created_at: item.createdAt,
    file_size: item.fileSize,
    lang: item.lang,
    liked: item.liked,
    progress: item.progress ?? null,
    audio_url: (item as AudioHistoryItem & { audioUrl?: string }).audioUrl ?? null,
    storage_url: (item as AudioHistoryItem & { storageUrl?: string }).storageUrl ?? null,
    user_session: sessionId,
    // 로그인 사용자면 user_id 저장
    user_id: userId ?? null,
  };
}

export interface AudioHistoryItemExtended extends AudioHistoryItem {
  audioUrl?: string;
  storageUrl?: string;
}

export function useAudioHistory(userId?: string | null) {
  const [items, setItems] = useState<AudioHistoryItemExtended[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const sessionId = useRef(getSessionId());

  // 마운트 시 또는 userId 변경 시 DB에서 히스토리 로드
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('audio_history')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(MAX_ITEMS);

        if (userId) {
          // 로그인 사용자: user_id 기반 조회 (계정에 저장된 전체 이력)
          query = query.eq('user_id', userId);
        } else {
          // 비로그인: 세션 기반 조회
          query = query.eq('user_session', sessionId.current);
        }

        const { data, error } = await query;

        if (error) {
          console.warn('오디오 히스토리 로드 실패:', error.message);
          return;
        }

        if (data && data.length > 0) {
          setItems(data.map(rowToItem) as AudioHistoryItemExtended[]);
        } else {
          setItems([]);
        }
      } catch (err) {
        console.warn('오디오 히스토리 로드 오류:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [userId]);

  // 새 항목 추가 (generating 상태로 시작)
  const addItem = useCallback(async (item: AudioHistoryItemExtended) => {
    // 로컬 상태 즉시 업데이트
    setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS));

    // DB에 저장
    try {
      await supabase
        .from('audio_history')
        .upsert(itemToRow(item, sessionId.current, userId), { onConflict: 'id' });
    } catch (err) {
      console.warn('오디오 히스토리 저장 실패:', err);
    }
  }, [userId]);

  // 항목 업데이트 (completed/failed 상태 전환)
  const updateItem = useCallback(async (id: string, updates: Partial<AudioHistoryItemExtended>) => {
    setItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, ...updates } : item)
    );

    // DB 업데이트
    const dbUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
    if (updates.fileSize !== undefined) dbUpdates.file_size = updates.fileSize;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.audioUrl !== undefined) dbUpdates.audio_url = updates.audioUrl;
    if (updates.storageUrl !== undefined) dbUpdates.storage_url = updates.storageUrl;
    if (updates.liked !== undefined) dbUpdates.liked = updates.liked;

    if (Object.keys(dbUpdates).length > 0) {
      try {
        await supabase
          .from('audio_history')
          .update(dbUpdates)
          .eq('id', id);
      } catch (err) {
        console.warn('오디오 히스토리 업데이트 실패:', err);
      }
    }
  }, []);

  // 항목 삭제
  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await supabase.from('audio_history').delete().eq('id', id);
    } catch (err) {
      console.warn('오디오 히스토리 삭제 실패:', err);
    }
  }, []);

  // 좋아요 토글
  const toggleLike = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((item) => item.id === id ? { ...item, liked: !item.liked } : item)
    );
    const item = items.find((i) => i.id === id);
    if (item) {
      try {
        await supabase
          .from('audio_history')
          .update({ liked: !item.liked })
          .eq('id', id);
      } catch (err) {
        console.warn('좋아요 업데이트 실패:', err);
      }
    }
  }, [items]);

  // 전체 삭제
  const clearAll = useCallback(async () => {
    setItems([]);
    try {
      if (userId) {
        await supabase.from('audio_history').delete().eq('user_id', userId);
      } else {
        await supabase.from('audio_history').delete().eq('user_session', sessionId.current);
      }
    } catch (err) {
      console.warn('전체 삭제 실패:', err);
    }
  }, [userId]);

  // 외부에서 items 직접 교체 (AudioHistoryPanel 호환)
  const setItemsExternal = useCallback((newItems: AudioHistoryItemExtended[]) => {
    setItems(newItems);
  }, []);

  return {
    items,
    isLoading,
    addItem,
    updateItem,
    removeItem,
    toggleLike,
    clearAll,
    setItems: setItemsExternal,
  };
}

/**
 * Supabase Storage에 오디오 파일 업로드 (blob URL 또는 외부 URL)
 */
export async function uploadAudioToStorage(
  audioSource: string,
  fileName: string,
  mimeType = 'audio/mpeg'
): Promise<string | null> {
  try {
    const res = await fetch(audioSource);
    if (!res.ok) throw new Error(`fetch 실패: ${res.status}`);
    const blob = await res.blob();

    const filePath = `public/${fileName}`;
    const { error } = await supabase.storage
      .from('sfx-library')
      .upload(filePath, blob, { contentType: mimeType, upsert: true });

    if (error) {
      console.warn('Storage 업로드 실패:', error.message);
      return null;
    }

    const { data, error: signError } = await supabase.storage
      .from('sfx-library')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7일 유효
    if (signError) {
      console.warn('Signed URL 생성 실패:', signError.message);
      return null;
    }
    return data.signedUrl ?? null;
  } catch (err) {
    console.warn('Storage 업로드 오류:', err);
    return null;
  }
}
