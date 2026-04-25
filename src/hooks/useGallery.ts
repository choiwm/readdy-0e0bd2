import { useState, useEffect, useCallback, useRef } from 'react';
import { logDev } from '@/lib/logger';
import { supabase, GalleryItemDB } from '@/lib/supabase';
import { GalleryItem, GalleryItemSource } from '@/mocks/galleryItems';

const ITEMS_PER_PAGE = 12;
const SESSION_KEY = 'ai_platform_session_id';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function dbToGalleryItem(row: GalleryItemDB): GalleryItem {
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    prompt: row.prompt,
    model: row.model,
    ratio: row.ratio,
    liked: row.liked,
    duration: row.duration ?? undefined,
    createdAt: row.created_at,
    source: (row.source as GalleryItemSource) ?? 'ai-create',
  };
}

export function useGallery(userId?: string | null) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'liked'>('newest');
  const [sourceFilter, setSourceFilter] = useState<GalleryItemSource | 'ALL'>('ALL');

  const sessionId = useRef(getSessionId());
  const migrationDoneRef = useRef(false);
  const userIdInitializedRef = useRef(false);
  // 현재 로드된 오프셋 추적
  const offsetRef = useRef(0);
  // 진행 중인 fetch 취소용
  const abortRef = useRef<AbortController | null>(null);

  // ── 로그인 후 session 데이터 → user_id 마이그레이션 ──────────────────
  const migrateSessionData = useCallback(async (uid: string) => {
    if (migrationDoneRef.current) return;
    migrationDoneRef.current = true;
    try {
      const sid = sessionId.current;
      const { data: sessionItems, error: fetchErr } = await supabase
        .from('gallery_items')
        .select('id')
        .eq('user_id', sid);

      if (fetchErr || !sessionItems || sessionItems.length === 0) return;

      await supabase
        .from('gallery_items')
        .update({ user_id: uid, session_id: sid })
        .eq('user_id', sid);

      logDev(`[Gallery] Migrated ${sessionItems.length} items from session ${sid} to user ${uid}`);
    } catch (e) {
      console.warn('[Gallery] Migration failed:', e);
    }
  }, []);

  // ── 초기 로드 (리셋 후 첫 페이지) ────────────────────────────────────
  const fetchInitial = useCallback(async (
    f: 'ALL' | 'IMAGE' | 'VIDEO',
    s: 'newest' | 'oldest' | 'liked',
    uid: string | null | undefined,
    sf: GalleryItemSource | 'ALL',
  ) => {
    // 이전 fetch 취소
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    offsetRef.current = 0;

    try {
      const effectiveUserId = uid ?? sessionId.current;

      let query = supabase
        .from('gallery_items')
        .select('*', { count: 'exact' })
        .eq('user_id', effectiveUserId);

      if (f === 'IMAGE') query = query.eq('type', 'image');
      else if (f === 'VIDEO') query = query.eq('type', 'video');
      if (sf !== 'ALL') query = query.eq('source', sf);

      if (s === 'newest') query = query.order('created_at', { ascending: false });
      else if (s === 'oldest') query = query.order('created_at', { ascending: true });
      else query = query.order('liked', { ascending: false }).order('created_at', { ascending: false });

      query = query.range(0, ITEMS_PER_PAGE - 1);

      const { data, error: err, count } = await query;

      if (controller.signal.aborted) return;
      if (err) throw err;

      const fetched = (data ?? []).map(dbToGalleryItem);
      setItems(fetched);
      setTotalCount(count ?? 0);
      setHasMore(fetched.length === ITEMS_PER_PAGE && fetched.length < (count ?? 0));
      offsetRef.current = fetched.length;
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : '갤러리를 불러오지 못했습니다');
      setItems([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // ── 추가 로드 (스크롤 시 append) ─────────────────────────────────────
  const loadMore = useCallback(async (
    f: 'ALL' | 'IMAGE' | 'VIDEO',
    s: 'newest' | 'oldest' | 'liked',
    uid: string | null | undefined,
    sf: GalleryItemSource | 'ALL',
  ) => {
    if (loadingMore) return;
    setLoadingMore(true);

    try {
      const effectiveUserId = uid ?? sessionId.current;
      const from = offsetRef.current;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('gallery_items')
        .select('*', { count: 'exact' })
        .eq('user_id', effectiveUserId);

      if (f === 'IMAGE') query = query.eq('type', 'image');
      else if (f === 'VIDEO') query = query.eq('type', 'video');
      if (sf !== 'ALL') query = query.eq('source', sf);

      if (s === 'newest') query = query.order('created_at', { ascending: false });
      else if (s === 'oldest') query = query.order('created_at', { ascending: true });
      else query = query.order('liked', { ascending: false }).order('created_at', { ascending: false });

      query = query.range(from, to);

      const { data, error: err, count } = await query;
      if (err) throw err;

      const fetched = (data ?? []).map(dbToGalleryItem);
      setItems((prev) => {
        // 중복 제거
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = fetched.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });
      setTotalCount(count ?? 0);
      offsetRef.current = from + fetched.length;
      setHasMore(fetched.length === ITEMS_PER_PAGE && offsetRef.current < (count ?? 0));
    } catch (e) {
      console.warn('[Gallery] loadMore failed:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  // ── 통합 Effect: 필터/정렬/userId 변경 시 초기 로드 ──────────────────
  useEffect(() => {
    if (userId === undefined) {
      setLoading(true);
      return;
    }

    const wasUninitialized = !userIdInitializedRef.current;
    userIdInitializedRef.current = true;

    if (userId && wasUninitialized) {
      migrateSessionData(userId).then(() => {
        fetchInitial(filter, sort, userId, sourceFilter);
      });
    } else {
      fetchInitial(filter, sort, userId, sourceFilter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, filter, sort, sourceFilter]);

  // ── 외부에서 호출하는 loadMore (클로저로 현재 상태 캡처) ─────────────
  const loadMoreItems = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    loadMore(filter, sort, userId, sourceFilter);
  }, [hasMore, loadingMore, loading, filter, sort, userId, sourceFilter, loadMore]);

  const addItem = useCallback(async (item: Omit<GalleryItem, 'id' | 'createdAt'>) => {
    const effectiveUserId = userId ?? sessionId.current;

    const { data, error: err } = await supabase
      .from('gallery_items')
      .insert({
        type: item.type,
        url: item.url,
        prompt: item.prompt,
        model: item.model,
        ratio: item.ratio,
        liked: item.liked ?? false,
        duration: item.duration ?? null,
        source: item.source ?? 'ai-create',
        user_id: effectiveUserId,
        session_id: userId ? null : sessionId.current,
      })
      .select()
      .maybeSingle();

    if (err) throw err;
    if (data) {
      const newItem = dbToGalleryItem(data as GalleryItemDB);
      // 맨 앞에 추가 (newest 정렬 기준)
      setItems((prev) => [newItem, ...prev]);
      setTotalCount((c) => c + 1);
      offsetRef.current += 1;
      return newItem;
    }
    return null;
  }, [userId]);

  const toggleLike = useCallback(async (id: string, currentLiked: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, liked: !currentLiked } : i))
    );
    const { error: err } = await supabase
      .from('gallery_items')
      .update({ liked: !currentLiked })
      .eq('id', id);
    if (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, liked: currentLiked } : i))
      );
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotalCount((c) => Math.max(0, c - 1));
    offsetRef.current = Math.max(0, offsetRef.current - 1);
    // Edge Function 경유: row 삭제와 함께 Supabase Storage 의 영상/이미지
    // 파일도 같이 정리 (orphan 방지). 미인증 사용자 (anon row) 케이스는
    // Edge Function 이 401 → 직접 DB 삭제로 fallback.
    const { error: err } = await supabase.functions.invoke('delete-saved-asset', {
      body: { id, kind: 'gallery' },
    });
    if (err) {
      const { error: directErr } = await supabase.from('gallery_items').delete().eq('id', id);
      if (directErr) fetchInitial(filter, sort, userId, sourceFilter);
    }
  }, [filter, sort, userId, sourceFilter, fetchInitial]);

  const refresh = useCallback(() => {
    fetchInitial(filter, sort, userId, sourceFilter);
  }, [filter, sort, userId, sourceFilter, fetchInitial]);

  return {
    items,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore,
    loadMoreItems,
    filter,
    setFilter,
    sort,
    setSort,
    sourceFilter,
    setSourceFilter,
    addItem,
    toggleLike,
    deleteItem,
    refresh,
  };
}
