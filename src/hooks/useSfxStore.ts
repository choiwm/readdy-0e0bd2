/**
 * useSfxStore — SFX + Music 공유 배경음 스토어
 * AI Sound에서 생성된 효과음/음악을 Supabase Storage에 영구 저장하고
 * AI Board / YouTube Studio에서 배경음으로 불러올 수 있게 합니다.
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type SfxItemType = 'sfx' | 'music';

export interface SfxItem {
  id: string;
  prompt: string;
  audioUrl: string;
  storageUrl?: string; // Supabase Storage 영구 URL
  duration: number | null;
  createdAt: string; // ISO string
  promptInfluence: number;
  type?: SfxItemType; // 'sfx' | 'music'
  title?: string; // 음악 제목
  tags?: string; // 음악 태그
}

const STORAGE_KEY = 'ai_sfx_library';
const STORAGE_BUCKET = 'sfx-library';
const MAX_ITEMS = 30;

function loadFromStorage(): SfxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SfxItem[];
  } catch {
    return [];
  }
}

function saveToStorage(items: SfxItem[]): void {
  try {
    // blob URL은 세션 종료 시 무효화되므로 저장하지 않음
    const persistable = items.filter((i) => !i.audioUrl.startsWith('blob:') || i.storageUrl);
    const toSave = persistable.map((i) => ({
      ...i,
      // blob URL 대신 storageUrl 사용
      audioUrl: i.storageUrl ?? i.audioUrl,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave.slice(0, MAX_ITEMS)));
  } catch {
    // storage full 등 무시
  }
}

/**
 * Supabase Storage에 오디오 blob URL을 업로드하고 영구 URL 반환
 */
export async function uploadSfxToStorage(
  blobUrl: string,
  fileName: string,
  mimeType = 'audio/mpeg'
): Promise<string | null> {
  try {
    // blob URL → Blob 변환
    const res = await fetch(blobUrl);
    const blob = await res.blob();

    const filePath = `public/${fileName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn('SFX Storage 업로드 실패:', error.message);
      return null;
    }

    const { data, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7일 유효
    if (signError) {
      console.warn('SFX Signed URL 생성 실패:', signError.message);
      return null;
    }
    return data.signedUrl ?? null;
  } catch (err) {
    console.warn('SFX Storage 업로드 오류:', err);
    return null;
  }
}

/**
 * 외부 URL(mp3 등)을 fetch → Storage에 업로드
 */
export async function uploadUrlToStorage(
  audioUrl: string,
  fileName: string,
  mimeType = 'audio/mpeg'
): Promise<string | null> {
  try {
    const res = await fetch(audioUrl);
    const blob = await res.blob();
    const filePath = `public/${fileName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.warn('URL Storage 업로드 실패:', error.message);
      return null;
    }

    const { data, error: signError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7일 유효
    if (signError) {
      console.warn('URL Signed URL 생성 실패:', signError.message);
      return null;
    }
    return data.signedUrl ?? null;
  } catch (err) {
    console.warn('URL Storage 업로드 오류:', err);
    return null;
  }
}

export function useSfxStore() {
  const [items, setItems] = useState<SfxItem[]>([]);

  // 마운트 시 localStorage에서 로드
  useEffect(() => {
    setItems(loadFromStorage());
  }, []);

  // 새 SFX 추가 (EffectsPanel에서 호출) - Storage 업로드 포함
  const addSfx = useCallback((sfx: Omit<SfxItem, 'createdAt'> & { createdAt?: string | Date }) => {
    const item: SfxItem = {
      ...sfx,
      type: sfx.type ?? 'sfx',
      createdAt: sfx.createdAt instanceof Date
        ? sfx.createdAt.toISOString()
        : sfx.createdAt ?? new Date().toISOString(),
    };
    setItems((prev) => {
      const next = [item, ...prev.filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS);
      saveToStorage(next);
      return next;
    });
  }, []);

  // SFX 삭제
  const removeSfx = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  // 전체 삭제
  const clearAll = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 세션 내 blob URL 아이템 추가 (저장 안 됨, 메모리만)
  const addBlobSfx = useCallback((sfx: Omit<SfxItem, 'createdAt'> & { createdAt?: string | Date }) => {
    const item: SfxItem = {
      ...sfx,
      type: sfx.type ?? 'sfx',
      createdAt: sfx.createdAt instanceof Date
        ? sfx.createdAt.toISOString()
        : sfx.createdAt ?? new Date().toISOString(),
    };
    setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)].slice(0, MAX_ITEMS));
  }, []);

  // storageUrl 업데이트 (업로드 완료 후)
  const updateStorageUrl = useCallback((id: string, storageUrl: string) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === id ? { ...i, storageUrl, audioUrl: storageUrl } : i
      );
      saveToStorage(next);
      return next;
    });
  }, []);

  return {
    items,
    addSfx,
    addBlobSfx,
    removeSfx,
    clearAll,
    updateStorageUrl,
    count: items.length,
    sfxItems: items.filter((i) => !i.type || i.type === 'sfx'),
    musicItems: items.filter((i) => i.type === 'music'),
  };
}

// 전역 이벤트 기반 SFX 추가 (컴포넌트 외부에서 호출 가능)
export function dispatchSfxAdded(sfx: SfxItem): void {
  window.dispatchEvent(new CustomEvent('sfx:added', { detail: sfx }));
}

export function useSfxStoreListener(onAdded: (sfx: SfxItem) => void): void {
  useEffect(() => {
    const handler = (e: Event) => {
      const sfx = (e as CustomEvent<SfxItem>).detail;
      onAdded(sfx);
    };
    window.addEventListener('sfx:added', handler);
    return () => window.removeEventListener('sfx:added', handler);
  }, [onAdded]);
}
