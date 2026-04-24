import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// ── AES-GCM v2 복호화 (SHA-256 키 파생) ───────────────────────────────────
async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    if (encrypted.startsWith('aes_v2:')) {
      const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
      const cryptoKey = await crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) },
        cryptoKey,
        combined.slice(12)
      );
      return new TextDecoder().decode(decrypted);
    }
    if (encrypted.startsWith('aes_v1:')) {
      try {
        const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
        const secret = Deno.env.get('APP_JWT_SECRET') ?? '';
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

// ── fal.ai 저장된 키 조회 ────────────────────────────────────────────────
async function getFalAdminKey(supabase: ReturnType<typeof createClient>): Promise<{ key: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('encrypted_key, status')
      .eq('service_slug', 'fal')
      .maybeSingle();

    if (error) return { key: null, error: error.message };
    if (!data?.encrypted_key) return { key: null, error: 'fal.ai API 키가 등록되어 있지 않습니다. API 키 관리에서 먼저 등록해주세요.' };

    const rawKey = await decryptKey(data.encrypted_key as string);
    if (!rawKey) return { key: null, error: '키 복호화 실패 — 키를 다시 등록해주세요.' };

    return { key: rawKey, error: null };
  } catch (e) {
    return { key: null, error: String(e) };
  }
}

// ── fal.ai Platform API 공통 호출 ────────────────────────────────────────
async function falPlatformRequest(
  method: string,
  path: string,
  adminKey: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<{ data: unknown; status: number; error: string | null }> {
  try {
    const url = new URL(`https://api.fal.ai${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    }

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Key ${adminKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    };

    if (body && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    console.log(`[fal-key-manager] ${method} ${url.toString()}`);
    const res = await fetch(url.toString(), options);

    let data: unknown = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      const errMsg = (data as Record<string, string>)?.detail
        ?? (data as Record<string, string>)?.error
        ?? (data as Record<string, string>)?.message
        ?? `HTTP ${res.status}`;
      return { data, status: res.status, error: errMsg };
    }

    return { data, status: res.status, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, status: 0, error: `네트워크 오류: ${msg.slice(0, 100)}` };
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

  // fal.ai Admin Key 조회
  const { key: falKey, error: keyError } = await getFalAdminKey(supabase);
  if (!falKey) {
    return json({
      error: keyError,
      hint: 'fal.ai API 키를 먼저 관리자 패널 > AI 엔진 > API 키 관리에서 등록해주세요.',
      keys: [],
      authenticated: false,
    }, 400);
  }

  try {
    // ────────────────────────────────────────────────────────────────────
    // GET action=list — fal.ai 워크스페이스 API 키 목록 조회
    // GET /v1/keys
    // Query: limit, cursor, expand
    // ────────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list') {
      const limit = url.searchParams.get('limit') ?? '50';
      const cursor = url.searchParams.get('cursor') ?? '';
      const expand = url.searchParams.get('expand') ?? '';

      const params: Record<string, string> = { limit };
      if (cursor) params.cursor = cursor;
      if (expand) params.expand = expand;

      const { data, status, error } = await falPlatformRequest('GET', '/v1/keys', falKey, undefined, params);

      if (error) {
        return json({
          error,
          status_code: status,
          hint: status === 401 || status === 403
            ? '등록된 fal.ai 키가 admin 권한이 없습니다. fal.ai 대시보드에서 Admin API 키를 발급해주세요.'
            : '잠시 후 다시 시도해주세요.',
          keys: [],
          authenticated: false,
        }, status >= 400 ? status : 502);
      }

      const typedData = data as { keys: unknown[]; next_cursor: string | null; has_more: boolean };

      return json({
        keys: typedData.keys ?? [],
        next_cursor: typedData.next_cursor ?? null,
        has_more: typedData.has_more ?? false,
        total: (typedData.keys ?? []).length,
        authenticated: true,
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // GET action=list_all — 모든 페이지 자동 로드
    // ────────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'list_all') {
      const expand = url.searchParams.get('expand') ?? 'creator_info';
      const allKeys: unknown[] = [];
      let cursor: string | undefined;
      let pageCount = 0;
      const maxPages = 20; // 안전 상한

      while (pageCount < maxPages) {
        const params: Record<string, string> = { limit: '100', expand };
        if (cursor) params.cursor = cursor;

        const { data, error, status } = await falPlatformRequest('GET', '/v1/keys', falKey, undefined, params);

        if (error) {
          return json({ error, status_code: status, keys: allKeys, authenticated: true }, 502);
        }

        const typedData = data as { keys: unknown[]; next_cursor: string | null; has_more: boolean };
        allKeys.push(...(typedData.keys ?? []));
        pageCount++;

        if (!typedData.has_more || !typedData.next_cursor) break;
        cursor = typedData.next_cursor;
      }

      return json({
        keys: allKeys,
        total: allKeys.length,
        pages_loaded: pageCount,
        authenticated: true,
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // POST action=create — 새 API 키 생성
    // POST /v1/keys
    // Body: { alias: string }
    // ────────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'create') {
      let body: { alias?: string };
      try { body = await req.json(); } catch { return err('Invalid JSON body'); }

      const { alias } = body;
      if (!alias || alias.trim().length < 1) return err('alias is required');
      if (alias.trim().length > 100) return err('alias must be 100 characters or less');

      const { data, status, error } = await falPlatformRequest(
        'POST',
        '/v1/keys',
        falKey,
        { alias: alias.trim() }
      );

      if (error) {
        return json({
          error,
          status_code: status,
          hint: status === 401 || status === 403
            ? '등록된 fal.ai 키가 admin 권한이 없습니다.'
            : '키 생성 실패 — fal.ai 대시보드를 확인해주세요.',
        }, status >= 400 ? status : 502);
      }

      // 생성된 key_secret은 한 번만 반환됨 — 프론트에서 즉시 표시 필요
      const typedData = data as { key_id: string; key_secret: string; alias: string; scope: string; created_at: string };

      // audit log 기록
      try {
        await supabase.from('audit_logs').insert({
          admin_email: 'admin',
          action: 'fal.ai API 키 생성',
          target_type: 'system',
          target_id: typedData.key_id,
          target_label: alias.trim(),
          result: 'success',
          detail: `alias: ${alias.trim()} | key_id: ${typedData.key_id}`,
        });
      } catch { /* audit log 실패는 무시 */ }

      return json({
        key_id: typedData.key_id,
        key_secret: typedData.key_secret, // 한 번만 반환 — 즉시 저장 필요
        alias: typedData.alias,
        scope: typedData.scope,
        created_at: typedData.created_at,
        warning: 'key_secret은 이 응답에서만 표시됩니다. 지금 바로 복사해주세요!',
        authenticated: true,
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // DELETE action=delete — API 키 삭제
    // DELETE /v1/keys/{key_id}
    // ────────────────────────────────────────────────────────────────────
    if (req.method === 'DELETE' && action === 'delete') {
      const keyId = url.searchParams.get('key_id');
      if (!keyId) return err('key_id query parameter is required');

      const { data, status, error } = await falPlatformRequest(
        'DELETE',
        `/v1/keys/${encodeURIComponent(keyId)}`,
        falKey
      );

      if (error) {
        return json({
          error,
          status_code: status,
          hint: status === 404 ? '해당 key_id가 존재하지 않거나 이미 삭제됐습니다.' : '삭제 실패',
        }, status >= 400 ? status : 502);
      }

      // audit log 기록
      try {
        await supabase.from('audit_logs').insert({
          admin_email: 'admin',
          action: 'fal.ai API 키 삭제',
          target_type: 'system',
          target_id: keyId,
          target_label: `key_id: ${keyId}`,
          result: 'success',
          detail: JSON.stringify(data).slice(0, 200),
        });
      } catch { /* 무시 */ }

      return json({
        success: true,
        deleted_key_id: keyId,
        response: data,
        authenticated: true,
      });
    }

    // ────────────────────────────────────────────────────────────────────
    // GET action=validate_admin — 현재 키가 admin 권한인지 확인
    // ────────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'validate_admin') {
      const { data, status, error } = await falPlatformRequest(
        'GET',
        '/v1/keys',
        falKey,
        undefined,
        { limit: '1' }
      );

      if (error) {
        return json({
          is_admin: false,
          status_code: status,
          error,
          message: status === 401 || status === 403
            ? '현재 등록된 키는 Admin API 권한이 없습니다. fal.ai 대시보드에서 Admin 키를 생성해주세요.'
            : `API 접근 오류: ${error}`,
        });
      }

      const typedData = data as { keys: unknown[] };
      return json({
        is_admin: true,
        status_code: status,
        message: '현재 등록된 fal.ai 키는 Admin API 권한이 있습니다.',
        keys_count_preview: (typedData.keys ?? []).length,
      });
    }

    return err('Unknown action. Available: list, list_all, create, delete, validate_admin', 404);

  } catch (e) {
    console.error('[fal-key-manager] 오류:', e);
    return err(`Internal error: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
});
