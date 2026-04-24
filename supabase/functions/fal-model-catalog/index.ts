import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

async function getEncryptionKeyV2(): Promise<CryptoKey> {
  const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
}

async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    if (encrypted.startsWith('aes_v2:')) {
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const key = await getEncryptionKeyV2();
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, key, combined.slice(12));
      return new TextDecoder().decode(decrypted);
    }
    if (encrypted.startsWith('aes_v1:')) {
      try {
        const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
        const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
        const keyMaterial = new TextEncoder().encode(secret.slice(0, 32).padEnd(32, '0'));
        const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0, 12) }, cryptoKey, combined.slice(12));
        return new TextDecoder().decode(decrypted);
      } catch { return null; }
    }
    if (encrypted.startsWith('enc_v1:')) {
      const parts = encrypted.split(':');
      if (parts.length >= 3) { try { return atob(parts[2]); } catch { return null; } }
    }
    return encrypted;
  } catch { return null; }
}

async function getFalKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    const { data } = await supabase.from('api_keys').select('encrypted_key').eq('service_slug', 'fal').eq('status', 'active').maybeSingle();
    if (!data?.encrypted_key) return null;
    return await decryptKey(data.encrypted_key as string);
  } catch { return null; }
}

interface FalModelMetadata {
  display_name?: string;
  category?: string;
  description?: string;
  status?: string;
  tags?: string[];
  updated_at?: string;
  is_favorited?: boolean;
  thumbnail_url?: string;
  model_url?: string;
  date?: string;
  highlighted?: boolean;
  pinned?: boolean;
}

interface FalModel {
  endpoint_id: string;
  metadata?: FalModelMetadata;
}

interface FalModelsResponse {
  models: FalModel[];
  next_cursor: string | null;
  has_more: boolean;
}

/**
 * fal.ai Platform API v1/models 호출
 * 지원 모드:
 * 1. List Mode: 파라미터 없이 전체 목록 페이지네이션
 * 2. Find Mode: endpoint_id 파라미터로 특정 모델 조회
 * 3. Search Mode: q, category, status 파라미터로 검색
 */
async function fetchFalModels(params: {
  falKey: string | null;
  endpoint_id?: string | string[];
  q?: string;
  category?: string;
  status?: 'active' | 'deprecated';
  expand?: string[];
  limit?: number;
  cursor?: string;
}): Promise<{ data: FalModelsResponse | null; error: string | null }> {
  try {
    const url = new URL('https://api.fal.ai/v1/models');

    if (params.endpoint_id) {
      const ids = Array.isArray(params.endpoint_id) ? params.endpoint_id : [params.endpoint_id];
      ids.forEach(id => url.searchParams.append('endpoint_id', id));
    }
    if (params.q) url.searchParams.set('q', params.q);
    if (params.category) url.searchParams.set('category', params.category);
    if (params.status) url.searchParams.set('status', params.status);
    if (params.expand) params.expand.forEach(e => url.searchParams.append('expand', e));
    if (params.limit) url.searchParams.set('limit', String(params.limit));
    if (params.cursor) url.searchParams.set('cursor', params.cursor);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // API 키가 있으면 더 높은 rate limit 적용
    if (params.falKey) {
      headers['Authorization'] = `Key ${params.falKey}`;
    }

    console.log(`[fal-model-catalog] API 호출: ${url.toString()}`);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[fal-model-catalog] API 오류 HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { data: null, error: `fal.ai API 오류 (HTTP ${res.status}): ${errText.slice(0, 100)}` };
    }

    const data: FalModelsResponse = await res.json();
    console.log(`[fal-model-catalog] 모델 ${data.models?.length ?? 0}개 수신, has_more=${data.has_more}`);

    return { data, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[fal-model-catalog] fetch 예외:', msg);
    return { data: null, error: `네트워크 오류: ${msg.slice(0, 100)}` };
  }
}

/**
 * 카테고리 목록 조회 (모든 모델에서 unique category 추출)
 */
async function fetchFalCategories(falKey: string | null): Promise<string[]> {
  const categories = new Set<string>();
  let cursor: string | undefined;
  let attempts = 0;
  const maxAttempts = 10; // 최대 10페이지까지 조회

  while (attempts < maxAttempts) {
    const { data, error } = await fetchFalModels({
      falKey,
      status: 'active',
      limit: 100,
      cursor,
    });

    if (error || !data) break;

    data.models.forEach(m => {
      if (m.metadata?.category) categories.add(m.metadata.category);
    });

    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
    attempts++;
  }

  return Array.from(categories).sort();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  const err = (msg: string, status = 400) => json({ error: msg }, status);
  try {
    await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return err('Server configuration error', 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'list';

  // fal.ai API 키 조회 (rate limit 향상용, 없어도 동작)
  const falKey = await getFalKey(supabase);
  if (falKey) {
    console.log('[fal-model-catalog] fal.ai API 키 사용 — 높은 rate limit 적용');
  } else {
    console.log('[fal-model-catalog] fal.ai API 키 없음 — 익명으로 조회 (rate limit 제한)');
  }

  try {
    // ── 1. 모델 목록 조회 (List / Search Mode) ──
    if (req.method === 'GET' && action === 'list') {
      const q = url.searchParams.get('q') ?? undefined;
      const category = url.searchParams.get('category') ?? undefined;
      const status = (url.searchParams.get('status') ?? 'active') as 'active' | 'deprecated';
      const limit = parseInt(url.searchParams.get('limit') ?? '50');
      const cursor = url.searchParams.get('cursor') ?? undefined;

      const { data, error } = await fetchFalModels({
        falKey,
        q,
        category,
        status,
        limit: Math.min(limit, 100),
        cursor,
        expand: ['enterprise_status'],
      });

      if (error || !data) return err(error ?? 'fal.ai API 호출 실패', 502);

      return json({
        models: data.models,
        next_cursor: data.next_cursor,
        has_more: data.has_more,
        total_fetched: data.models.length,
        authenticated: !!falKey,
      });
    }

    // ── 2. 특정 모델 조회 (Find Mode) ──
    if (req.method === 'GET' && action === 'find') {
      const endpointIds = url.searchParams.getAll('endpoint_id');
      if (!endpointIds.length) return err('endpoint_id required');

      const { data, error } = await fetchFalModels({
        falKey,
        endpoint_id: endpointIds,
        expand: ['openapi-3.0', 'enterprise_status'],
      });

      if (error || !data) return err(error ?? 'fal.ai API 호출 실패', 502);

      return json({
        models: data.models,
        total: data.models.length,
        authenticated: !!falKey,
      });
    }

    // ── 3. 카테고리 목록 조회 ──
    if (req.method === 'GET' && action === 'categories') {
      const categories = await fetchFalCategories(falKey);
      return json({ categories, total: categories.length, authenticated: !!falKey });
    }

    // ── 4. 모든 모델 일괄 로드 (페이지네이션 자동 처리) ──
    if (req.method === 'GET' && action === 'load_all') {
      const category = url.searchParams.get('category') ?? undefined;
      const q = url.searchParams.get('q') ?? undefined;
      const status = (url.searchParams.get('status') ?? 'active') as 'active' | 'deprecated';
      const maxModels = parseInt(url.searchParams.get('max') ?? '300');

      const allModels: FalModel[] = [];
      let cursor: string | undefined;
      let pageCount = 0;
      const maxPages = Math.ceil(maxModels / 100);

      while (pageCount < maxPages) {
        const { data, error } = await fetchFalModels({
          falKey,
          q,
          category,
          status,
          limit: 100,
          cursor,
          expand: ['enterprise_status'],
        });

        if (error || !data) break;

        allModels.push(...data.models);
        pageCount++;

        if (!data.has_more || !data.next_cursor || allModels.length >= maxModels) break;
        cursor = data.next_cursor;
      }

      // 카테고리별로 그룹화
      const grouped: Record<string, FalModel[]> = {};
      allModels.forEach(m => {
        const cat = m.metadata?.category ?? 'other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
      });

      const categoryList = Object.keys(grouped).sort();

      return json({
        models: allModels,
        grouped,
        categories: categoryList,
        total: allModels.length,
        pages_loaded: pageCount,
        authenticated: !!falKey,
      });
    }

    // ── 5. 현재 서비스에서 사용 중인 모델 검증 ──
    if (req.method === 'POST' && action === 'validate') {
      let body: { endpoint_ids?: string[] };
      try { body = await req.json(); } catch { return err('Invalid JSON body'); }
      const { endpoint_ids } = body;
      if (!endpoint_ids?.length) return err('endpoint_ids required');

      const chunks: string[][] = [];
      for (let i = 0; i < endpoint_ids.length; i += 20) {
        chunks.push(endpoint_ids.slice(i, i + 20));
      }

      const results: Record<string, { exists: boolean; status?: string; display_name?: string }> = {};

      for (const chunk of chunks) {
        const { data } = await fetchFalModels({ falKey, endpoint_id: chunk });
        if (data) {
          const foundIds = new Set(data.models.map(m => m.endpoint_id));
          chunk.forEach(id => {
            const model = data.models.find(m => m.endpoint_id === id);
            results[id] = {
              exists: foundIds.has(id),
              status: model?.metadata?.status,
              display_name: model?.metadata?.display_name,
            };
          });
        } else {
          // API 실패 시 unknown으로 마킹
          chunk.forEach(id => { results[id] = { exists: false }; });
        }
      }

      const valid = Object.entries(results).filter(([, v]) => v.exists && v.status === 'active').map(([id]) => id);
      const deprecated = Object.entries(results).filter(([, v]) => v.exists && v.status === 'deprecated').map(([id]) => id);
      const notFound = Object.entries(results).filter(([, v]) => !v.exists).map(([id]) => id);

      return json({
        results,
        summary: {
          total: endpoint_ids.length,
          valid: valid.length,
          deprecated: deprecated.length,
          not_found: notFound.length,
        },
        valid_ids: valid,
        deprecated_ids: deprecated,
        not_found_ids: notFound,
        authenticated: !!falKey,
      });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('[fal-model-catalog] 오류:', e);
    return err(`Internal error: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
});
