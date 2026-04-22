import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthorizationHeader } from '@/lib/env';

// ── Types ─────────────────────────────────────────────────────────────────
interface FalModelMetadata {
  display_name?: string;
  category?: string;
  description?: string;
  status?: string;
  tags?: string[];
  updated_at?: string;
  thumbnail_url?: string;
  model_url?: string;
  highlighted?: boolean;
  pinned?: boolean;
}

interface FalModel {
  endpoint_id: string;
  metadata?: FalModelMetadata;
}

interface CatalogResponse {
  models: FalModel[];
  grouped?: Record<string, FalModel[]>;
  categories?: string[];
  total: number;
  has_more?: boolean;
  next_cursor?: string | null;
  authenticated?: boolean;
}

interface Props {
  isDark: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSelectModel?: (endpointId: string, category: 'image' | 'video' | 'music') => void;
}

// ── 카테고리 → 서비스 타입 매핑 ──
const CATEGORY_TO_SERVICE: Record<string, 'image' | 'video' | 'music'> = {
  'text-to-image': 'image',
  'image-to-image': 'image',
  'image-to-video': 'video',
  'text-to-video': 'video',
  'video-to-video': 'video',
  'audio': 'music',
  'text-to-audio': 'music',
  'text-to-music': 'music',
  'text-to-speech': 'music',
};

// ── 카테고리 뱃지 색상 ──
function getCategoryColor(category: string): string {
  if (category.includes('image')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20';
  if (category.includes('video')) return 'bg-violet-500/15 text-violet-400 border-violet-500/20';
  if (category.includes('audio') || category.includes('music') || category.includes('speech')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  if (category.includes('3d')) return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (category.includes('training') || category.includes('fine-tun')) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20';
  return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
}

function getCategoryIcon(category: string): string {
  if (category.includes('text-to-image')) return 'ri-image-ai-line';
  if (category.includes('image-to-image')) return 'ri-image-edit-line';
  if (category.includes('image-to-video')) return 'ri-film-ai-line';
  if (category.includes('text-to-video')) return 'ri-video-ai-line';
  if (category.includes('video')) return 'ri-video-line';
  if (category.includes('audio') || category.includes('music')) return 'ri-music-ai-line';
  if (category.includes('speech') || category.includes('tts')) return 'ri-mic-ai-line';
  if (category.includes('3d')) return 'ri-box-3-line';
  if (category.includes('train') || category.includes('fine-tun')) return 'ri-brain-line';
  return 'ri-cpu-line';
}

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const BASE_URL = `${SUPABASE_URL}/functions/v1/fal-model-catalog`;

const KNOWN_CATEGORIES = [
  'text-to-image', 'image-to-image', 'image-to-video', 'text-to-video',
  'video-to-video', 'audio', 'text-to-audio', 'text-to-speech', 'text-to-music',
  '3d', 'training', 'fine-tuning', 'other',
];

export default function FalModelCatalog({ isDark, onToast, onSelectModel }: Props) {
  const [models, setModels] = useState<FalModel[]>([]);
  const [grouped, setGrouped] = useState<Record<string, FalModel[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  // 필터 상태
  const [searchQ, setSearchQ] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'active' | 'deprecated' | ''>('active');

  // 페이지네이션
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalLoaded, setTotalLoaded] = useState(0);

  // 검색 디바운스
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQ, setDebouncedQ] = useState('');

  // 선택된 모델 (상세 패널)
  const [selectedModel, setSelectedModel] = useState<FalModel | null>(null);

  // 검증 상태
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    results: Record<string, { exists: boolean; status?: string; display_name?: string }>;
    summary: { total: number; valid: number; deprecated: number; not_found: number };
  } | null>(null);

  const t = {
    cardBg:    isDark ? 'bg-[#0f0f13]'   : 'bg-white',
    cardBg2:   isDark ? 'bg-zinc-900/60'  : 'bg-gray-50',
    border:    isDark ? 'border-white/5'  : 'border-gray-200',
    text:      isDark ? 'text-white'      : 'text-gray-900',
    textSub:   isDark ? 'text-zinc-400'   : 'text-gray-500',
    textFaint: isDark ? 'text-zinc-600'   : 'text-gray-400',
    inputBg:   isDark ? 'bg-zinc-800 border-white/10' : 'bg-white border-gray-200',
    inputBg2:  isDark ? 'bg-zinc-800'     : 'bg-gray-100',
    divider:   isDark ? 'divide-white/[0.03]' : 'divide-gray-100',
    rowHover:  isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50',
  };

  // ── 검색 디바운스 ──
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedQ(searchQ), 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQ]);

  // ── 모델 로드 ──
  const loadModels = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ action: 'list', limit: '50' });
      if (debouncedQ) params.set('q', debouncedQ);
      if (selectedCategory) params.set('category', selectedCategory);
      if (statusFilter) params.set('status', statusFilter);
      if (isLoadMore && cursor) params.set('cursor', cursor);

      const res = await fetch(`${BASE_URL}?${params.toString()}`, {
        headers: { 'Authorization': getAuthorizationHeader() },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CatalogResponse & { next_cursor?: string | null; has_more?: boolean } = await res.json();

      if (isLoadMore) {
        setModels(prev => [...prev, ...(data.models ?? [])]);
      } else {
        setModels(data.models ?? []);

        // grouped와 categories는 처음 로드 시에만 (카테고리 필터 없을 때)
        if (!selectedCategory && !debouncedQ) {
          // 카테고리 목록 추출
          const cats = new Set<string>();
          (data.models ?? []).forEach(m => { if (m.metadata?.category) cats.add(m.metadata.category); });
          if (cats.size > 0) setCategories(Array.from(cats).sort());
        }
      }

      setCursor(data.next_cursor ?? null);
      setHasMore(data.has_more ?? false);
      setTotalLoaded(prev => isLoadMore ? prev + (data.models?.length ?? 0) : (data.models?.length ?? 0));
      setAuthenticated(data.authenticated ?? false);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast(`모델 로드 실패: ${msg}`, 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedQ, selectedCategory, statusFilter, cursor, onToast]);

  // ── 전체 로드 (카테고리별 그룹화 포함) ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ action: 'load_all', max: '300', status: 'active' });
      if (selectedCategory) params.set('category', selectedCategory);
      if (debouncedQ) params.set('q', debouncedQ);

      const res = await fetch(`${BASE_URL}?${params.toString()}`, {
        headers: { 'Authorization': getAuthorizationHeader() },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CatalogResponse = await res.json();

      setModels(data.models ?? []);
      setGrouped(data.grouped ?? {});
      setCategories(data.categories ?? []);
      setTotalLoaded(data.total ?? 0);
      setHasMore(false);
      setCursor(null);
      setAuthenticated(data.authenticated ?? false);

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onToast(`모델 로드 실패: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, debouncedQ, onToast]);

  // ── 현재 사용 중인 모델 검증 ──
  const validateCurrentModels = useCallback(async () => {
    setValidating(true);
    try {
      // 현재 서비스에서 사용 중인 모델 ID 목록
      const currentModelIds = [
        'fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro',
        'fal-ai/flux-pro/v1.1', 'fal-ai/flux-pro/v1.1-ultra',
        'fal-ai/kling-video/v1/standard/text-to-video',
        'fal-ai/kling-video/v1.5/pro/text-to-video',
        'fal-ai/kling-video/v2.1/standard/text-to-video',
        'fal-ai/kling-video/v2.1/pro/text-to-video',
        'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
        'fal-ai/kling-video/v3/pro/text-to-video',
        'fal-ai/wan-25-preview/text-to-video',
        'fal-ai/wan-25-preview/image-to-video',
        'fal-ai/veo3',
        'fal-ai/stable-audio', 'fal-ai/musicgen',
      ];

      const res = await fetch(`${BASE_URL}?action=validate`, {
        method: 'POST',
        headers: {
          'Authorization': getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint_ids: currentModelIds }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setValidationResult(data);
      onToast(
        `검증 완료: 유효 ${data.summary?.valid}개, deprecated ${data.summary?.deprecated}개, 미존재 ${data.summary?.not_found}개`,
        data.summary?.not_found > 0 || data.summary?.deprecated > 0 ? 'warning' : 'success'
      );
    } catch (e) {
      onToast(`검증 실패: ${String(e)}`, 'error');
    } finally {
      setValidating(false);
    }
  }, [onToast]);

  // ── 초기 로드 ──
  useEffect(() => {
    loadAll();
  }, []);

  // ── 필터 변경 시 재로드 ──
  useEffect(() => {
    if (debouncedQ || selectedCategory) {
      loadModels(false);
    } else {
      loadAll();
    }
  }, [debouncedQ, selectedCategory]);

  // ── 모델을 서비스에 적용 ──
  const handleApplyModel = (model: FalModel) => {
    const cat = model.metadata?.category ?? '';
    const serviceType = CATEGORY_TO_SERVICE[cat];
    if (!serviceType) {
      onToast(`이 모델(${cat})은 현재 이미지/영상/음악 이외 카테고리입니다`, 'warning');
      return;
    }
    onSelectModel?.(model.endpoint_id, serviceType);
    onToast(`${model.metadata?.display_name ?? model.endpoint_id} → ${serviceType} 모델로 적용`, 'success');
  };

  // ── 렌더링 대상 모델 결정 ──
  const displayModels = models;
  const isFiltered = !!debouncedQ || !!selectedCategory;

  // ── 모델 카드 ──
  const ModelCard = ({ model }: { model: FalModel }) => {
    const cat = model.metadata?.category ?? 'other';
    const isApplicable = !!CATEGORY_TO_SERVICE[cat];
    const statusBadge = model.metadata?.status === 'deprecated'
      ? 'bg-red-500/15 text-red-400 border-red-500/20'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';

    return (
      <div
        className={`${t.cardBg2} border ${t.border} rounded-xl p-3 cursor-pointer transition-all hover:border-indigo-500/30 group relative`}
        onClick={() => setSelectedModel(model)}
      >
        {/* 썸네일 */}
        {model.metadata?.thumbnail_url && (
          <div className="w-full h-20 rounded-lg overflow-hidden mb-2.5 bg-zinc-800">
            <img
              src={model.metadata.thumbnail_url}
              alt={model.metadata.display_name ?? model.endpoint_id}
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* 카테고리 + 상태 */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getCategoryColor(cat)} flex items-center gap-1`}>
            <i className={`${getCategoryIcon(cat)} text-[9px]`} />
            {cat}
          </span>
          {model.metadata?.status && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${statusBadge}`}>
              {model.metadata.status}
            </span>
          )}
          {model.metadata?.highlighted && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/20">추천</span>
          )}
        </div>

        {/* 모델명 */}
        <p className={`text-xs font-semibold ${t.text} mb-0.5 leading-tight`}>
          {model.metadata?.display_name ?? model.endpoint_id.split('/').pop() ?? model.endpoint_id}
        </p>

        {/* endpoint_id */}
        <p className={`text-[10px] font-mono ${t.textFaint} mb-1.5 truncate`}>{model.endpoint_id}</p>

        {/* 설명 */}
        {model.metadata?.description && (
          <p className={`text-[10px] ${t.textFaint} line-clamp-2 mb-2`}>{model.metadata.description}</p>
        )}

        {/* 태그 */}
        {model.metadata?.tags && model.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {model.metadata.tags.slice(0, 3).map(tag => (
              <span key={tag} className={`text-[8px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-zinc-700 text-zinc-400' : 'bg-gray-200 text-gray-500'}`}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 적용 버튼 (해당 카테고리인 경우만) */}
        {isApplicable && onSelectModel && (
          <button
            onClick={(e) => { e.stopPropagation(); handleApplyModel(model); }}
            className="w-full py-1.5 text-[10px] font-bold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-pointer whitespace-nowrap opacity-0 group-hover:opacity-100"
          >
            <i className="ri-add-circle-line mr-1" />
            {CATEGORY_TO_SERVICE[cat]} 모델로 적용
          </button>
        )}
      </div>
    );
  };

  // ── 모델 상세 패널 ──
  const ModelDetailPanel = ({ model }: { model: FalModel }) => {
    const cat = model.metadata?.category ?? 'other';
    const isApplicable = !!CATEGORY_TO_SERVICE[cat];
    return (
      <div className={`fixed inset-y-0 right-0 z-50 w-80 ${t.cardBg} border-l ${t.border} shadow-2xl flex flex-col`}>
        {/* 헤더 */}
        <div className={`px-4 py-3 border-b ${t.border} flex items-center justify-between`}>
          <p className={`text-sm font-black ${t.text}`}>모델 상세</p>
          <button
            onClick={() => setSelectedModel(null)}
            className={`w-7 h-7 rounded-lg ${t.inputBg2} flex items-center justify-center hover:opacity-80 cursor-pointer`}
          >
            <i className={`ri-close-line text-sm ${t.textSub}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* 썸네일 */}
          {model.metadata?.thumbnail_url && (
            <div className="w-full h-36 rounded-xl overflow-hidden bg-zinc-800">
              <img
                src={model.metadata.thumbnail_url}
                alt={model.metadata.display_name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          {/* 기본 정보 */}
          <div>
            <p className={`text-base font-black ${t.text}`}>
              {model.metadata?.display_name ?? model.endpoint_id}
            </p>
            <p className={`text-[11px] font-mono ${t.textFaint} mt-0.5 break-all`}>{model.endpoint_id}</p>
          </div>

          {/* 뱃지들 */}
          <div className="flex flex-wrap gap-1.5">
            {model.metadata?.category && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryColor(model.metadata.category)}`}>
                {model.metadata.category}
              </span>
            )}
            {model.metadata?.status && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                model.metadata.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'
              }`}>
                {model.metadata.status}
              </span>
            )}
            {model.metadata?.highlighted && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/20">
                <i className="ri-star-fill mr-0.5 text-[9px]" />추천
              </span>
            )}
          </div>

          {/* 설명 */}
          {model.metadata?.description && (
            <div>
              <p className={`text-[10px] font-bold ${t.textSub} mb-1`}>설명</p>
              <p className={`text-xs ${t.textFaint} leading-relaxed`}>{model.metadata.description}</p>
            </div>
          )}

          {/* 태그 */}
          {model.metadata?.tags && model.metadata.tags.length > 0 && (
            <div>
              <p className={`text-[10px] font-bold ${t.textSub} mb-1.5`}>태그</p>
              <div className="flex flex-wrap gap-1">
                {model.metadata.tags.map(tag => (
                  <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-zinc-700 text-zinc-300' : 'bg-gray-100 text-gray-600'}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 업데이트 날짜 */}
          {model.metadata?.updated_at && (
            <div className={`text-[10px] ${t.textFaint}`}>
              <i className="ri-time-line mr-1" />
              업데이트: {new Date(model.metadata.updated_at).toLocaleDateString('ko-KR')}
            </div>
          )}

          {/* fal.ai 링크 */}
          <a
            href={model.metadata?.model_url ?? `https://fal.ai/models/${model.endpoint_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <i className="ri-external-link-line text-[10px]" />
            fal.ai에서 보기
          </a>
        </div>

        {/* 적용 버튼 */}
        {isApplicable && onSelectModel && (
          <div className={`p-4 border-t ${t.border}`}>
            <button
              onClick={() => { handleApplyModel(model); setSelectedModel(null); }}
              className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors whitespace-nowrap"
            >
              <i className="ri-add-circle-line mr-1.5" />
              {CATEGORY_TO_SERVICE[model.metadata?.category ?? '']} 모델로 서비스 적용
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 relative">
      {/* ── 헤더 ── */}
      <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${t.border} flex items-center justify-between`}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className={`text-sm font-black ${t.text}`}>fal.ai 모델 카탈로그</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                authenticated ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
              }`}>
                {authenticated ? '인증됨 (높은 rate limit)' : '익명 조회'}
              </span>
            </div>
            <p className={`text-xs ${t.textSub}`}>
              fal.ai Platform API v1/models — 실시간 모델 탐색 및 서비스 적용
              {totalLoaded > 0 && <span className={`ml-2 font-bold ${t.text}`}>{totalLoaded.toLocaleString()}개 로드됨</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={validateCurrentModels}
              disabled={validating}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap border ${
                validating ? 'opacity-50' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
              }`}
            >
              {validating ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-shield-check-line" />}
              현재 모델 검증
            </button>
            <button
              onClick={loadAll}
              disabled={loading}
              className={`w-8 h-8 flex items-center justify-center rounded-xl ${t.inputBg2} hover:opacity-80 cursor-pointer transition-colors`}
            >
              {loading ? <i className={`ri-loader-4-line animate-spin text-sm ${t.textSub}`} /> : <i className={`ri-refresh-line text-sm ${t.textSub}`} />}
            </button>
          </div>
        </div>

        {/* ── 검증 결과 ── */}
        {validationResult && (
          <div className={`px-5 py-3 border-b ${t.border} bg-amber-500/5`}>
            <div className="flex items-center gap-2 mb-2">
              <i className="ri-shield-check-line text-amber-400 text-sm" />
              <p className={`text-xs font-bold ${t.text}`}>현재 사용 모델 검증 결과</p>
              <button
                onClick={() => setValidationResult(null)}
                className={`ml-auto text-xs ${t.textFaint} hover:${t.textSub} cursor-pointer`}
              >
                <i className="ri-close-line" />
              </button>
            </div>
            <div className="flex items-center gap-4 flex-wrap mb-2">
              <span className="text-[11px] text-emerald-400 font-bold">유효 {validationResult.summary.valid}개</span>
              <span className="text-[11px] text-amber-400 font-bold">deprecated {validationResult.summary.deprecated}개</span>
              <span className="text-[11px] text-red-400 font-bold">미존재 {validationResult.summary.not_found}개</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(validationResult.results).map(([id, v]) => (
                <span key={id} className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                  !v.exists ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                  v.status === 'deprecated' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                }`}>
                  {id.split('/').slice(-2).join('/')}
                  {!v.exists && ' ✗'}
                  {v.status === 'deprecated' && ' ⚠'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 검색 + 필터 ── */}
        <div className={`px-5 py-3 border-b ${t.border} flex items-center gap-3 flex-wrap`}>
          {/* 검색 */}
          <div className="flex-1 min-w-48 relative">
            <i className={`ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-sm ${t.textFaint}`} />
            <input
              type="text"
              placeholder="모델 검색 (예: flux, kling, wan...)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs ${t.inputBg} ${t.text} focus:outline-none`}
            />
            {searchQ && (
              <button
                onClick={() => setSearchQ('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${t.textFaint} hover:${t.textSub} cursor-pointer`}
              >
                <i className="ri-close-circle-fill text-sm" />
              </button>
            )}
          </div>

          {/* 카테고리 필터 */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs ${t.inputBg} ${t.text} focus:outline-none cursor-pointer`}
          >
            <option value="">전체 카테고리</option>
            {(categories.length > 0 ? categories : KNOWN_CATEGORIES).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* 상태 필터 */}
          <div className={`flex items-center gap-1 ${t.inputBg2} rounded-xl p-1`}>
            {(['active', '', 'deprecated'] as const).map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all whitespace-nowrap ${
                  statusFilter === s
                    ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                    : `${t.textFaint} hover:${t.textSub}`
                }`}
              >
                {s === 'active' ? '활성' : s === '' ? '전체' : 'deprecated'}
              </button>
            ))}
          </div>

          {/* 뷰 모드 */}
          <div className={`flex items-center gap-1 ${t.inputBg2} rounded-xl p-1`}>
            <button
              onClick={() => setViewMode('grid')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${viewMode === 'grid' ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-gray-900 shadow-sm' : t.textFaint}`}
            >
              <i className="ri-grid-line text-sm" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${viewMode === 'list' ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-gray-900 shadow-sm' : t.textFaint}`}
            >
              <i className="ri-list-unordered text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 에러 ── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <i className="ri-error-warning-line flex-shrink-0" />
          <span>{error}</span>
          <button onClick={loadAll} className="ml-auto underline cursor-pointer whitespace-nowrap">다시 시도</button>
        </div>
      )}

      {/* ── 로딩 ── */}
      {loading && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl flex items-center justify-center py-16`}>
          <div className="text-center">
            <i className={`ri-loader-4-line animate-spin text-2xl ${t.textFaint} block mb-2`} />
            <p className={`text-xs ${t.textFaint}`}>fal.ai 모델 카탈로그 로딩 중...</p>
          </div>
        </div>
      )}

      {/* ── 카테고리별 그룹 표시 (필터 없을 때) ── */}
      {!loading && !isFiltered && Object.keys(grouped).length > 0 && (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => {
              const priority = ['text-to-image', 'image-to-image', 'text-to-video', 'image-to-video'];
              const ai = priority.indexOf(a);
              const bi = priority.indexOf(b);
              if (ai !== -1 && bi !== -1) return ai - bi;
              if (ai !== -1) return -1;
              if (bi !== -1) return 1;
              return a.localeCompare(b);
            })
            .map(([category, categoryModels]) => (
              <div key={category} className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
                <div className={`px-5 py-3 border-b ${t.border} flex items-center gap-3`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${getCategoryColor(category).split(' ').filter(c => c.startsWith('bg-')).join(' ')}`}>
                    <i className={`${getCategoryIcon(category)} text-sm ${getCategoryColor(category).split(' ').filter(c => c.startsWith('text-')).join(' ')}`} />
                  </div>
                  <div>
                    <p className={`text-xs font-black ${t.text}`}>{category}</p>
                    <p className={`text-[10px] ${t.textFaint}`}>{categoryModels.length}개 모델</p>
                  </div>
                </div>

                {viewMode === 'grid' ? (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {categoryModels.map(model => (
                      <ModelCard key={model.endpoint_id} model={model} />
                    ))}
                  </div>
                ) : (
                  <div className={`divide-y ${t.divider}`}>
                    {categoryModels.map(model => (
                      <div
                        key={model.endpoint_id}
                        className={`px-5 py-3 flex items-center gap-3 ${t.rowHover} cursor-pointer transition-colors group`}
                        onClick={() => setSelectedModel(model)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-xs font-semibold ${t.text}`}>
                              {model.metadata?.display_name ?? model.endpoint_id}
                            </span>
                            {model.metadata?.highlighted && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">추천</span>
                            )}
                            {model.metadata?.status === 'deprecated' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">deprecated</span>
                            )}
                          </div>
                          <p className={`text-[10px] font-mono ${t.textFaint}`}>{model.endpoint_id}</p>
                          {model.metadata?.description && (
                            <p className={`text-[10px] ${t.textFaint} mt-0.5 truncate`}>{model.metadata.description}</p>
                          )}
                        </div>
                        {onSelectModel && CATEGORY_TO_SERVICE[model.metadata?.category ?? ''] && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleApplyModel(model); }}
                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap opacity-0 group-hover:opacity-100 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20`}
                          >
                            적용
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ── 검색/필터 결과 ── */}
      {!loading && isFiltered && displayModels.length > 0 && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl overflow-hidden`}>
          <div className={`px-5 py-3 border-b ${t.border}`}>
            <p className={`text-xs font-bold ${t.textSub}`}>검색 결과 {displayModels.length}개</p>
          </div>
          {viewMode === 'grid' ? (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {displayModels.map(model => (
                <ModelCard key={model.endpoint_id} model={model} />
              ))}
            </div>
          ) : (
            <div className={`divide-y ${t.divider}`}>
              {displayModels.map(model => (
                <div
                  key={model.endpoint_id}
                  className={`px-5 py-3 flex items-center gap-3 ${t.rowHover} cursor-pointer transition-colors group`}
                  onClick={() => setSelectedModel(model)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-xs font-semibold ${t.text}`}>
                        {model.metadata?.display_name ?? model.endpoint_id}
                      </span>
                      {model.metadata?.category && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getCategoryColor(model.metadata.category)}`}>
                          {model.metadata.category}
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] font-mono ${t.textFaint}`}>{model.endpoint_id}</p>
                  </div>
                  {onSelectModel && CATEGORY_TO_SERVICE[model.metadata?.category ?? ''] && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApplyModel(model); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-colors whitespace-nowrap opacity-0 group-hover:opacity-100 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20`}
                    >
                      적용
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 더 불러오기 */}
          {hasMore && (
            <div className={`px-5 py-3 border-t ${t.border} flex justify-center`}>
              <button
                onClick={() => loadModels(true)}
                disabled={loadingMore}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${t.inputBg2} ${t.textSub} hover:opacity-80 disabled:opacity-50 whitespace-nowrap`}
              >
                {loadingMore ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-arrow-down-line" />}
                더 불러오기
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {!loading && displayModels.length === 0 && isFiltered && !error && (
        <div className={`${t.cardBg} border ${t.border} rounded-2xl flex flex-col items-center justify-center py-16`}>
          <i className={`ri-search-line text-2xl ${t.textFaint} mb-2`} />
          <p className={`text-sm font-semibold ${t.textSub}`}>검색 결과가 없습니다</p>
          <p className={`text-xs ${t.textFaint} mt-1`}>다른 키워드나 카테고리로 검색해보세요</p>
          <button
            onClick={() => { setSearchQ(''); setSelectedCategory(''); }}
            className="mt-3 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold rounded-xl cursor-pointer hover:bg-indigo-500/20 transition-colors whitespace-nowrap"
          >
            필터 초기화
          </button>
        </div>
      )}

      {/* ── 모델 상세 패널 ── */}
      {selectedModel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedModel(null)}
          />
          <ModelDetailPanel model={selectedModel} />
        </>
      )}
    </div>
  );
}
