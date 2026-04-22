import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
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

// ── 암호화 키 파생: SHA-256 해시로 항상 정확히 32바이트 생성 ──
// APP_JWT_SECRET 길이(88자든 32자든)에 상관없이 동일한 32바이트 키 보장
async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
  // SHA-256으로 해시 → 항상 32바이트, 길이 무관
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(secret)
  );
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptKey(rawKey: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(rawKey)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return `aes_v2:${btoa(String.fromCharCode(...combined))}`;
}

async function decryptKey(encrypted: string): Promise<string | null> {
  if (!encrypted) return null;
  try {
    // ── aes_v2: SHA-256 해시 기반 (현재 방식) ──
    if (encrypted.startsWith('aes_v2:')) {
      const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
      const key = await getEncryptionKey();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: combined.slice(0, 12) },
        key,
        combined.slice(12)
      );
      return new TextDecoder().decode(decrypted);
    }

    // ── aes_v1: 구버전 (slice 방식) — 복호화 시도, 실패하면 null ──
    if (encrypted.startsWith('aes_v1:')) {
      try {
        const combined = Uint8Array.from(atob(encrypted.slice(7)), c => c.charCodeAt(0));
        const secret = Deno.env.get('APP_JWT_SECRET') ?? 'readdy-ai-api-key-encryption-secret-2026';
        const legacyKey = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(secret.slice(0, 32).padEnd(32, '0')),
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: combined.slice(0, 12) },
          legacyKey,
          combined.slice(12)
        );
        return new TextDecoder().decode(decrypted);
      } catch {
        console.warn('aes_v1 decryption failed — key was encrypted with different secret');
        return null;
      }
    }

    // ── enc_v1: 레거시 base64 방식 ──
    if (encrypted.startsWith('enc_v1:')) {
      const parts = encrypted.split(':');
      if (parts.length >= 3) {
        try { return atob(parts[2]); } catch { return null; }
      }
    }

    // ── 평문 (암호화 안 된 경우) ──
    return encrypted;
  } catch (e) {
    console.error('decryptKey error:', e);
    return null;
  }
}

function isLegacyFormat(encrypted: string): boolean {
  return encrypted.startsWith('enc_v1:') || encrypted.startsWith('aes_v1:');
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

async function safeAuditLog(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  try { await supabase.from('audit_logs').insert(payload); } catch (e) { console.warn('audit log failed:', e); }
}

interface TestHistoryEntry {
  tested_at: string;
  success: boolean;
  message: string;
  latency_ms?: number;
}

async function appendTestHistory(
  supabase: ReturnType<typeof createClient>,
  slug: string,
  entry: TestHistoryEntry
) {
  const { data } = await supabase
    .from('api_keys')
    .select('test_history')
    .eq('service_slug', slug)
    .maybeSingle();

  const existing: TestHistoryEntry[] = Array.isArray(data?.test_history) ? data.test_history : [];
  const updated = [entry, ...existing].slice(0, 30);

  await supabase
    .from('api_keys')
    .update({
      test_history: updated,
      last_tested_at: entry.tested_at,
      test_result: entry.message,
      status: entry.success ? 'active' : 'error',
    })
    .eq('service_slug', slug);
}

async function checkAndHandleMonthlyLimit(
  supabase: ReturnType<typeof createClient>,
  slug: string
): Promise<{ exceeded: boolean; nearLimit: boolean; action: string }> {
  const { data: keyData } = await supabase
    .from('api_keys')
    .select('service_name, service_slug, monthly_limit, monthly_used, monthly_limit_action, limit_notify_threshold, limit_notified_at, status')
    .eq('service_slug', slug)
    .maybeSingle();

  if (!keyData || !keyData.monthly_limit || keyData.monthly_limit === 0) {
    return { exceeded: false, nearLimit: false, action: 'none' };
  }

  const { monthly_limit, monthly_used, monthly_limit_action, limit_notify_threshold, limit_notified_at, status } = keyData;
  const usagePercent = (monthly_used / monthly_limit) * 100;
  const threshold = limit_notify_threshold ?? 80;
  const exceeded = monthly_used >= monthly_limit;
  const nearLimit = !exceeded && usagePercent >= threshold;
  const now = new Date().toISOString();

  if (exceeded) {
    const action = monthly_limit_action ?? 'notify';
    if ((action === 'disable' || action === 'both') && status !== 'inactive') {
      await supabase.from('api_keys').update({ status: 'inactive', updated_at: now }).eq('service_slug', slug);
      await safeAuditLog(supabase, { admin_email: 'system', action: 'API 키 자동 비활성화', target_type: 'system', target_id: slug, target_label: keyData.service_name, result: 'success', detail: `월 사용량 한도 초과 (${monthly_used}/${monthly_limit}) — 자동 비활성화` });
    }
    if (action === 'notify' || action === 'both') {
      const lastNotified = limit_notified_at ? new Date(limit_notified_at).getTime() : 0;
      if ((Date.now() - lastNotified) / (1000 * 60 * 60) >= 1) {
        await supabase.from('notifications').insert({ type: 'system', title: `API 키 한도 초과: ${keyData.service_name}`, message: `${keyData.service_name}의 월 사용량이 한도(${monthly_limit.toLocaleString()}회)를 초과했습니다.`, is_read: false, created_at: now });
        await supabase.from('api_keys').update({ limit_notified_at: now }).eq('service_slug', slug);
      }
    }
    return { exceeded: true, nearLimit: false, action };
  }

  if (nearLimit) {
    const lastNotified = limit_notified_at ? new Date(limit_notified_at).getTime() : 0;
    if ((Date.now() - lastNotified) / (1000 * 60 * 60) >= 6) {
      await supabase.from('notifications').insert({ type: 'system', title: `API 키 한도 임박: ${keyData.service_name}`, message: `${keyData.service_name}의 월 사용량이 ${Math.round(usagePercent)}%에 도달했습니다.`, is_read: false, created_at: now });
      await supabase.from('api_keys').update({ limit_notified_at: now }).eq('service_slug', slug);
    }
    return { exceeded: false, nearLimit: true, action: 'warned' };
  }

  return { exceeded: false, nearLimit: false, action: 'none' };
}

async function incrementMonthlyUsed(supabase: ReturnType<typeof createClient>, slug: string): Promise<{ exceeded: boolean; nearLimit: boolean }> {
  const { data } = await supabase.from('api_keys').select('monthly_used').eq('service_slug', slug).maybeSingle();
  await supabase.from('api_keys').update({ monthly_used: (data?.monthly_used ?? 0) + 1 }).eq('service_slug', slug);
  const result = await checkAndHandleMonthlyLimit(supabase, slug);
  return { exceeded: result.exceeded, nearLimit: result.nearLimit };
}

async function testOpenRouterKey(rawKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${rawKey}`,
        'HTTP-Referer': 'https://readdy.ai',
        'X-Title': 'Readdy AI',
      },
    });
    if (res.ok) {
      const data = await res.json();
      const modelCount = data?.data?.length ?? 0;
      return { success: true, message: `OpenRouter 연결 성공 (모델 ${modelCount}개 사용 가능)` };
    }
    if (res.status === 401 || res.status === 403) {
      return { success: false, message: `인증 실패 (HTTP ${res.status}) — 키를 확인해주세요` };
    }
    return { success: false, message: `HTTP ${res.status} 오류` };
  } catch (e) {
    return { success: false, message: `연결 오류: ${String(e).slice(0, 60)}` };
  }
}

// ── 서비스별 API 키 테스트 ──
async function testApiKey(slug: string, rawKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (slug === 'fal') {
      const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': `Key ${rawKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'white square', image_size: { width: 64, height: 64 }, num_images: 1, num_inference_steps: 1 }),
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: `fal.ai 인증 실패 (HTTP ${res.status}) — 키를 확인해주세요` };
      }
      if (res.status === 200) return { success: true, message: 'fal.ai 연결 성공 — 이미지 생성 정상 작동' };
      return { success: true, message: `fal.ai 키 인증 성공 (HTTP ${res.status})` };
    }

    if (slug === 'goapi') {
      try {
        const balRes = await fetch('https://api.goapi.ai/api/v1/user/balance', {
          headers: { 'x-api-key': rawKey },
        });
        if (balRes.ok) {
          const data = await balRes.json();
          const balance = data?.data?.balance ?? data?.balance;
          if (balance !== undefined) return { success: true, message: `GoAPI 연결 성공 (잔액: $${Number(balance).toFixed(2)})` };
          return { success: true, message: 'GoAPI 연결 성공' };
        }
        if (balRes.status === 401 || balRes.status === 403) {
          return { success: false, message: `GoAPI 인증 실패 (HTTP ${balRes.status})` };
        }
      } catch (_) { /* 다음 방법 시도 */ }

      const imgRes = await fetch('https://api.goapi.ai/api/flux/v1/image', {
        method: 'POST',
        headers: { 'x-api-key': rawKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'flux-realism', prompt: 'test', image_size: { width: 64, height: 64 } }),
      });
      if (imgRes.status === 401 || imgRes.status === 403) {
        return { success: false, message: `GoAPI 인증 실패 (HTTP ${imgRes.status})` };
      }
      return { success: true, message: `GoAPI 키 인증 성공 (HTTP ${imgRes.status})` };
    }

    if (slug === 'elevenlabs') {
      const res = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': rawKey },
      });
      if (res.ok) {
        const data = await res.json();
        const charLimit = data?.subscription?.character_limit ?? null;
        const charUsed = data?.subscription?.character_count ?? null;
        const msg = charLimit
          ? `ElevenLabs 연결 성공 (문자 사용: ${Number(charUsed).toLocaleString()}/${Number(charLimit).toLocaleString()})`
          : 'ElevenLabs 연결 성공';
        return { success: true, message: msg };
      }
      if (res.status === 401 || res.status === 403) return { success: false, message: `ElevenLabs 인증 실패 (HTTP ${res.status})` };
      return { success: false, message: `ElevenLabs HTTP ${res.status} 오류` };
    }

    if (slug === 'suno') {
      const res = await fetch('https://api.goapi.ai/api/suno/v1/music', {
        method: 'POST',
        headers: { 'x-api-key': rawKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_mode: false, prompt: 'test', mv: 'chirp-v3-5', wait_audio: false }),
      });
      if (res.status === 401 || res.status === 403) return { success: false, message: `Suno API 인증 실패 (HTTP ${res.status})` };
      return { success: true, message: `Suno API 키 인증 성공 (HTTP ${res.status})` };
    }

    if (slug === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${rawKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const modelCount = data?.data?.length ?? 0;
        return { success: true, message: `OpenAI 연결 성공 (모델 ${modelCount}개 사용 가능)` };
      }
      if (res.status === 401 || res.status === 403) return { success: false, message: `OpenAI 인증 실패 (HTTP ${res.status})` };
      return { success: false, message: `OpenAI HTTP ${res.status} 오류` };
    }

    if (slug === 'openrouter') return await testOpenRouterKey(rawKey);

    if (slug === 'lalalai' || slug === 'lalal') {
      if (rawKey.length < 10) return { success: false, message: 'LALAL.AI 키가 너무 짧습니다' };
      try {
        const res = await fetch('https://www.lalal.ai/api/preview/', {
          method: 'POST',
          headers: { 'Authorization': `license ${rawKey}` },
        });
        if (res.status === 401 || res.status === 403) return { success: false, message: `LALAL.AI 인증 실패 (HTTP ${res.status})` };
        return { success: true, message: `LALAL.AI 키 인증 성공 (HTTP ${res.status})` };
      } catch (e) {
        return { success: false, message: `LALAL.AI 연결 오류: ${String(e).slice(0, 50)}` };
      }
    }

    if (rawKey.length < 10) return { success: false, message: '키가 너무 짧습니다 (최소 10자)' };
    return { success: true, message: '키 형식 확인됨' };
  } catch (e) {
    return { success: false, message: `연결 오류: ${String(e).slice(0, 80)}` };
  }
}

const SLUG_TO_NAME: Record<string, string> = {
  fal: 'fal.ai (통합 AI)',
  goapi: 'GoAPI (이미지/영상)',
  elevenlabs: 'ElevenLabs (TTS/SFX)',
  suno: 'Suno (음악)',
  openai: 'OpenAI GPT-4o',
  lalalai: 'LALAL.AI (오디오 클린)',
  openrouter: 'OpenRouter (Claude/GPT/Gemini)',
};

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

  try {
    if (req.method === 'GET' && action === 'list') {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, service_name, service_slug, key_hint, status, last_tested_at, test_result, test_history, monthly_limit, monthly_used, monthly_limit_action, limit_notify_threshold, limit_notified_at, notes, updated_at, encrypted_key, healthcheck_enabled, healthcheck_interval_min, healthcheck_last_run_at, healthcheck_next_run_at, healthcheck_consecutive_failures')
        .order('service_name');
      if (error) return err(error.message);
      const safeData = (data ?? []).map((row) => ({
        ...row,
        is_legacy: row.encrypted_key ? isLegacyFormat(row.encrypted_key) : false,
        encrypted_key: undefined,
      }));
      return json({ api_keys: safeData });
    }

    if (req.method === 'GET' && action === 'failed_logs') {
      const slug = url.searchParams.get('slug');
      const days = parseInt(url.searchParams.get('days') ?? '7');
      const limit = parseInt(url.searchParams.get('limit') ?? '50');
      const statusFilter = url.searchParams.get('status') ?? 'failed';
      const from = new Date();
      from.setDate(from.getDate() - days);
      let query = supabase
        .from('usage_logs')
        .select('id, user_id, service_slug, action, credits_deducted, user_plan, status, metadata, created_at')
        .gte('created_at', from.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);
      if (slug) query = query.eq('service_slug', slug);
      if (statusFilter === 'failed') query = query.eq('status', 'failed');
      const { data: logs, error: logsError } = await query;
      if (logsError) return err(logsError.message);
      const allLogs = logs ?? [];
      const userIds = [...new Set(allLogs.map((l) => l.user_id).filter(Boolean))];
      let profileMap: Record<string, { email: string; display_name: string; plan: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('user_profiles').select('id, email, display_name, plan').in('id', userIds);
        (profiles ?? []).forEach((p) => { profileMap[p.id] = { email: p.email ?? '', display_name: p.display_name ?? '', plan: p.plan ?? 'free' }; });
      }
      const enriched = allLogs.map((log) => {
        const profile = profileMap[log.user_id] ?? null;
        return { ...log, user_email: profile?.email ?? null, user_name: profile?.display_name ?? null, user_plan: log.user_plan ?? profile?.plan ?? 'free', error_message: log.metadata?.error ?? log.metadata?.error_message ?? log.metadata?.reason ?? null, model_used: log.metadata?.model ?? log.metadata?.model_id ?? null, duration_ms: log.metadata?.duration_ms ?? log.metadata?.latency_ms ?? null };
      });
      const summary: Record<string, { total: number; failed: number; top_errors: Record<string, number> }> = {};
      enriched.forEach((log) => { const s = log.service_slug; if (!summary[s]) summary[s] = { total: 0, failed: 0, top_errors: {} }; summary[s].total++; if (log.status === 'failed') { summary[s].failed++; const errKey = log.error_message ?? '알 수 없는 오류'; summary[s].top_errors[errKey] = (summary[s].top_errors[errKey] ?? 0) + 1; } });
      const errorTypes: Record<string, number> = {};
      enriched.filter((l) => l.status === 'failed').forEach((log) => { const key = log.error_message ?? '알 수 없는 오류'; errorTypes[key] = (errorTypes[key] ?? 0) + 1; });
      const dailyFailures: Record<string, number> = {};
      enriched.filter((l) => l.status === 'failed').forEach((log) => { const day = log.created_at.slice(0, 10); dailyFailures[day] = (dailyFailures[day] ?? 0) + 1; });
      return json({ logs: enriched, total: enriched.length, failed_count: enriched.filter((l) => l.status === 'failed').length, summary, error_types: Object.entries(errorTypes).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([error, count]) => ({ error, count })), daily_failures: dailyFailures, days });
    }

    if (req.method === 'GET' && action === 'scan_legacy') {
      const { data, error } = await supabase.from('api_keys').select('id, service_name, service_slug, encrypted_key, key_hint').order('service_name');
      if (error) return err(error.message);
      const rows = data ?? [];
      const legacyKeys = rows.filter((r) => r.encrypted_key && isLegacyFormat(r.encrypted_key)).map((r) => ({ id: r.id, service_name: r.service_name, service_slug: r.service_slug, key_hint: r.key_hint }));
      const aesV2Keys = rows.filter((r) => r.encrypted_key && r.encrypted_key.startsWith('aes_v2:')).map((r) => ({ service_slug: r.service_slug, service_name: r.service_name }));
      const noKeyRows = rows.filter((r) => !r.encrypted_key).map((r) => ({ service_slug: r.service_slug, service_name: r.service_name }));
      return json({ total: rows.length, legacy_count: legacyKeys.length, aes_v2_count: aesV2Keys.length, no_key_count: noKeyRows.length, legacy_keys: legacyKeys, aes_v2_keys: aesV2Keys, no_key_rows: noKeyRows });
    }

    if (req.method === 'GET' && action === 'get_key') {
      const slug = url.searchParams.get('slug');
      if (!slug) return err('slug required');
      const { data, error } = await supabase.from('api_keys').select('encrypted_key, status, monthly_limit, monthly_used').eq('service_slug', slug).eq('status', 'active').maybeSingle();
      if (error) return err(error.message);
      if (!data) return err('API key not found or inactive', 404);
      if (data.monthly_limit && data.monthly_limit > 0 && data.monthly_used >= data.monthly_limit) return err('월 사용량 한도를 초과했습니다.', 429);
      const rawKey = await decryptKey(data.encrypted_key ?? '');
      if (!rawKey) return err('Key decryption failed', 500);
      await incrementMonthlyUsed(supabase, slug);
      return json({ key: rawKey });
    }

    if (req.method === 'POST' && action === 'save_key') {
      let body: { service_slug?: string; raw_key?: string; notes?: string; monthly_limit?: number; monthly_limit_action?: string; limit_notify_threshold?: number };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { service_slug, raw_key, notes, monthly_limit, monthly_limit_action, limit_notify_threshold } = body;
      if (!service_slug || !raw_key) return err('service_slug and raw_key required');
      if (raw_key.trim().length < 8) return err('API 키가 너무 짧습니다 (최소 8자)', 400);
      const validActions = ['notify', 'disable', 'both'];
      const limitAction = monthly_limit_action && validActions.includes(monthly_limit_action) ? monthly_limit_action : 'notify';
      const encrypted = await encryptKey(raw_key.trim());
      const hint = maskKey(raw_key.trim());
      const serviceName = SLUG_TO_NAME[service_slug] ?? service_slug;
      const { data: existing } = await supabase.from('api_keys').select('id').eq('service_slug', service_slug).maybeSingle();
      let resultData, resultError;
      const updatePayload = {
        service_name: serviceName,
        encrypted_key: encrypted,
        key_hint: hint,
        status: 'active',
        notes: notes ?? null,
        monthly_limit: monthly_limit ?? 0,
        monthly_limit_action: limitAction,
        limit_notify_threshold: limit_notify_threshold ?? 80,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        const { data, error } = await supabase.from('api_keys').update(updatePayload).eq('service_slug', service_slug).select('id, service_name, service_slug, key_hint, status').maybeSingle();
        resultData = data; resultError = error;
      } else {
        const { data, error } = await supabase.from('api_keys').insert({ service_slug, ...updatePayload }).select('id, service_name, service_slug, key_hint, status').maybeSingle();
        resultData = data; resultError = error;
      }
      if (resultError) return err(resultError.message);
      await safeAuditLog(supabase, { admin_email: 'admin', action: 'API 키 저장', target_type: 'system', target_id: service_slug, target_label: serviceName, result: 'success', detail: `키 힌트: ${hint} | 암호화: AES-GCM v2 (SHA-256)` });
      return json({ success: true, api_key: resultData });
    }

    // ── test_key: 입력한 raw_key로 즉시 테스트 (저장 없이) ──
    if (req.method === 'POST' && action === 'test_key') {
      let body: { service_slug?: string; raw_key?: string };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { service_slug, raw_key } = body;
      if (!service_slug) return err('service_slug required');
      let rawKey: string | null = null;
      const isLiveTest = !!raw_key;
      if (raw_key) {
        rawKey = raw_key.trim();
      } else {
        const { data: keyData } = await supabase.from('api_keys').select('encrypted_key').eq('service_slug', service_slug).maybeSingle();
        if (!keyData?.encrypted_key) return json({ success: false, message: 'API 키가 설정되지 않았습니다' });
        rawKey = await decryptKey(keyData.encrypted_key);
      }
      if (!rawKey) return json({ success: false, message: '키 복호화 실패 — 키를 다시 등록해주세요' });
      const startTime = Date.now();
      const result = await testApiKey(service_slug, rawKey);
      const latencyMs = Date.now() - startTime;
      if (!isLiveTest) {
        await appendTestHistory(supabase, service_slug, { tested_at: new Date().toISOString(), success: result.success, message: result.message, latency_ms: latencyMs });
      }
      return json({ success: result.success, message: result.message, latency_ms: latencyMs });
    }

    // ── test_saved_key: DB에 저장된 키로 연결 테스트 ──
    if (req.method === 'POST' && action === 'test_saved_key') {
      let body: { service_slug?: string };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { service_slug } = body;
      if (!service_slug) return err('service_slug required');
      const { data: keyData } = await supabase.from('api_keys').select('encrypted_key').eq('service_slug', service_slug).maybeSingle();
      if (!keyData?.encrypted_key) return json({ success: false, message: 'API 키가 설정되지 않았습니다. 먼저 키를 등록해주세요.' });
      const rawKey = await decryptKey(keyData.encrypted_key);
      if (!rawKey) return json({ success: false, message: '키 복호화 실패 — 키를 다시 등록해주세요' });
      const startTime = Date.now();
      const result = await testApiKey(service_slug, rawKey);
      const latencyMs = Date.now() - startTime;
      await appendTestHistory(supabase, service_slug, {
        tested_at: new Date().toISOString(),
        success: result.success,
        message: result.message,
        latency_ms: latencyMs,
      });
      return json({ success: result.success, message: result.message, latency_ms: latencyMs });
    }

    if (req.method === 'PATCH' && action === 'toggle_status') {
      let body: { service_slug?: string; status?: string };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { service_slug, status } = body;
      if (!service_slug || !status) return err('service_slug and status required');
      if (!['active', 'inactive', 'error'].includes(status)) return err('Invalid status value', 400);
      const { error } = await supabase.from('api_keys').update({ status, updated_at: new Date().toISOString() }).eq('service_slug', service_slug);
      if (error) return err(error.message);
      return json({ success: true });
    }

    if (req.method === 'PATCH' && action === 'update_limit_settings') {
      let body: { service_slug?: string; monthly_limit?: number; monthly_limit_action?: string; limit_notify_threshold?: number };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { service_slug, monthly_limit, monthly_limit_action, limit_notify_threshold } = body;
      if (!service_slug) return err('service_slug required');
      const validActions = ['notify', 'disable', 'both'];
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (monthly_limit !== undefined) updateData.monthly_limit = Math.max(0, monthly_limit);
      if (monthly_limit_action && validActions.includes(monthly_limit_action)) updateData.monthly_limit_action = monthly_limit_action;
      if (limit_notify_threshold !== undefined) updateData.limit_notify_threshold = Math.min(100, Math.max(1, limit_notify_threshold));
      const { error } = await supabase.from('api_keys').update(updateData).eq('service_slug', service_slug);
      if (error) return err(error.message);
      await safeAuditLog(supabase, { admin_email: 'admin', action: 'API 키 한도 설정 변경', target_type: 'system', target_id: service_slug, target_label: service_slug, result: 'success', detail: JSON.stringify(updateData) });
      return json({ success: true });
    }

    if (req.method === 'POST' && action === 'reset_monthly_usage') {
      let body: { service_slug?: string };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { service_slug } = body;
      if (!service_slug) return err('service_slug required');
      const { error } = await supabase.from('api_keys').update({ monthly_used: 0, limit_notified_at: null, status: 'active', updated_at: new Date().toISOString() }).eq('service_slug', service_slug);
      if (error) return err(error.message);
      await safeAuditLog(supabase, { admin_email: 'admin', action: 'API 키 월 사용량 리셋', target_type: 'system', target_id: service_slug, target_label: service_slug, result: 'success', detail: '월 사용량 수동 리셋' });
      return json({ success: true });
    }

    if (req.method === 'POST' && action === 'reset_all_monthly_usage') {
      const { error } = await supabase.from('api_keys').update({ monthly_used: 0, limit_notified_at: null, updated_at: new Date().toISOString() });
      if (error) return err(error.message);
      await safeAuditLog(supabase, { admin_email: 'system', action: '전체 API 키 월 사용량 리셋', target_type: 'system', target_id: 'api_keys', target_label: '전체 서비스', result: 'success', detail: '월초 자동 리셋' });
      return json({ success: true });
    }

    if (req.method === 'POST' && action === 'check_limit') {
      let body: { service_slug?: string };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { service_slug } = body;
      if (!service_slug) return err('service_slug required');
      const result = await checkAndHandleMonthlyLimit(supabase, service_slug);
      return json({ success: true, ...result });
    }

    if (req.method === 'GET' && action === 'usage_stats') {
      const days = parseInt(url.searchParams.get('days') ?? '7');
      const from = new Date();
      from.setDate(from.getDate() - days);
      const { data, error } = await supabase.from('usage_logs').select('service_slug, credits_deducted, status, user_plan, created_at').gte('created_at', from.toISOString());
      if (error) return err(error.message);
      const logs = data ?? [];
      const byService: Record<string, { total: number; success: number; failed: number; credits: number }> = {};
      logs.forEach((l) => { if (!byService[l.service_slug]) byService[l.service_slug] = { total: 0, success: 0, failed: 0, credits: 0 }; byService[l.service_slug].total++; if (l.status === 'success') byService[l.service_slug].success++; else byService[l.service_slug].failed++; byService[l.service_slug].credits += l.credits_deducted ?? 0; });
      const planDist: Record<string, number> = {};
      logs.forEach((l) => { planDist[l.user_plan ?? 'free'] = (planDist[l.user_plan ?? 'free'] ?? 0) + 1; });
      return json({ usage_stats: byService, plan_distribution: planDist, total_requests: logs.length, total_credits_used: logs.reduce((s, l) => s + (l.credits_deducted ?? 0), 0) });
    }

    if (req.method === 'GET' && action === 'get_model_settings') {
      const category = url.searchParams.get('category');
      let query = supabase.from('ai_model_settings').select('category, setting_key, setting_value, updated_at');
      if (category) query = query.eq('category', category);
      const { data, error } = await query.order('category').order('setting_key');
      if (error) return err(error.message);
      const grouped: Record<string, Record<string, string>> = {};
      (data ?? []).forEach((row) => { if (!grouped[row.category]) grouped[row.category] = {}; grouped[row.category][row.setting_key] = row.setting_value; });
      return json({ settings: grouped, raw: data ?? [] });
    }

    if (req.method === 'POST' && action === 'save_model_settings') {
      let body: { category?: string; settings?: Record<string, string> };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { category, settings } = body;
      if (!category || !settings) return err('category and settings required');
      const upserts = Object.entries(settings).map(([key, value]) => ({ category, setting_key: key, setting_value: String(value), updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('ai_model_settings').upsert(upserts, { onConflict: 'category,setting_key' });
      if (error) return err(error.message);
      await safeAuditLog(supabase, { admin_email: 'admin', action: 'AI 모델 설정 변경', target_type: 'system', target_id: category, target_label: `${category} 모델 설정`, result: 'success', detail: JSON.stringify(settings).slice(0, 200) });
      return json({ success: true });
    }

    if (req.method === 'GET' && action === 'get_credit_costs') {
      const category = url.searchParams.get('category');
      let query = supabase.from('credit_costs').select('id, category, model_id, model_name, cost, unit, description, is_active, updated_at').order('category').order('cost');
      if (category) query = query.eq('category', category);
      const { data, error } = await query;
      if (error) return err(error.message);
      const grouped: Record<string, typeof data> = {};
      (data ?? []).forEach((row) => { if (!grouped[row.category]) grouped[row.category] = []; grouped[row.category].push(row); });
      return json({ credit_costs: data ?? [], grouped });
    }

    if (req.method === 'POST' && action === 'save_credit_costs') {
      let body: { costs?: Array<{ category: string; model_id: string; cost: number; is_active?: boolean }> };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { costs } = body;
      if (!costs || !Array.isArray(costs)) return err('costs array required');
      const updates = costs.map((c) => ({ category: c.category, model_id: c.model_id, cost: Math.max(0, Math.round(c.cost)), is_active: c.is_active ?? true, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('credit_costs').upsert(updates, { onConflict: 'category,model_id' });
      if (error) return err(error.message);
      await safeAuditLog(supabase, { admin_email: 'admin', action: '크레딧 비용 설정 변경', target_type: 'system', target_id: 'credit_costs', target_label: '크레딧 비용 설정', result: 'success', detail: `${updates.length}개 항목 업데이트` });
      return json({ success: true, updated: updates.length });
    }

    if (req.method === 'PATCH' && action === 'update_credit_cost') {
      let body: { category?: string; model_id?: string; cost?: number; is_active?: boolean };
      try { body = await req.json(); } catch { return err('Invalid JSON body', 400); }
      const { category, model_id, cost, is_active } = body;
      if (!category || !model_id) return err('category and model_id required');
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (cost !== undefined) updateData.cost = Math.max(0, Math.round(cost));
      if (is_active !== undefined) updateData.is_active = is_active;
      const { error } = await supabase.from('credit_costs').update(updateData).eq('category', category).eq('model_id', model_id);
      if (error) return err(error.message);
      return json({ success: true });
    }

    return err('Unknown action', 404);
  } catch (e) {
    console.error('admin-api-keys unhandled error:', e);
    return err(`Internal server error: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
});
