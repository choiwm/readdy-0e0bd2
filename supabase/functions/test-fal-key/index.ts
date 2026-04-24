import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

async function decryptKey(encrypted: string): Promise<{ success: boolean; key?: string; error?: string; method?: string }> {
  if (!encrypted) return { success: false, error: 'encrypted 값 없음' };

  try {
    // ── aes_v2: SHA-256 해시 기반 (현재 방식) ──
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
      const result = new TextDecoder().decode(decrypted);
      return { success: true, key: result, method: 'aes_v2' };
    }

    // ── aes_v1: 구버전 (slice 방식) ──
    if (encrypted.startsWith('aes_v1:')) {
      const base64Data = encrypted.slice(7);
      let combined: Uint8Array;
      try {
        combined = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      } catch (e) {
        return { success: false, error: `base64 디코딩 실패: ${e}` };
      }

      if (combined.length < 13) {
        return { success: false, error: `데이터 너무 짧음: ${combined.length} bytes` };
      }

      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);

      const secret = Deno.env.get('APP_JWT_SECRET') ?? '';
      if (!secret) {
        return { success: false, error: 'APP_JWT_SECRET 환경변수 없음' };
      }

      const secretBytes = new TextEncoder().encode(secret);
      const keyMaterial = secretBytes.length >= 32
        ? secretBytes.slice(0, 32)
        : (() => {
            const padded = new Uint8Array(32).fill(48);
            padded.set(secretBytes);
            return padded;
          })();

      let cryptoKey: CryptoKey;
      try {
        cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
      } catch (e) {
        return { success: false, error: `CryptoKey 생성 실패: ${e}` };
      }

      let decrypted: ArrayBuffer;
      try {
        decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encryptedData);
      } catch (e) {
        return { success: false, error: `AES-GCM 복호화 실패: ${e}` };
      }

      const result = new TextDecoder().decode(decrypted);
      return { success: true, key: result, method: 'aes_v1' };
    }

    if (encrypted.startsWith('enc_v1:')) {
      const parts = encrypted.split(':');
      if (parts.length >= 3) {
        try {
          const key = atob(parts[2]);
          return { success: true, key, method: 'enc_v1' };
        } catch (e) {
          return { success: false, error: `enc_v1 base64 디코딩 실패: ${e}` };
        }
      }
    }

    return { success: true, key: encrypted, method: 'plaintext' };
  } catch (e) {
    return { success: false, error: `예외 발생: ${e}` };
  }
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const jwtSecret = Deno.env.get('APP_JWT_SECRET') ?? '';
  const falKeyEnv = Deno.env.get('FAL_KEY') ?? '';

  // DB에서 fal 키 조회
  const { data: keyData, error: keyError } = await supabase
    .from('api_keys')
    .select('encrypted_key, status')
    .eq('service_slug', 'fal')
    .eq('status', 'active')
    .maybeSingle();

  let decryptResult = null;
  let falKeyValid = false;
  let falKeyPreview = '';
  let decryptedKey = '';

  if (keyData?.encrypted_key) {
    decryptResult = await decryptKey(keyData.encrypted_key as string);
    if (decryptResult.success && decryptResult.key) {
      decryptedKey = decryptResult.key;
      falKeyPreview = decryptResult.key.slice(0, 12) + '...';
      falKeyValid = decryptResult.key.length > 10;
    }
  }

  // fal.ai API 연결 테스트
  let falApiTest = null;
  const testKey = decryptedKey || falKeyEnv;

  if (testKey) {
    try {
      const testRes = await fetch('https://queue.fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${testKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'test connectivity check',
          num_images: 1,
          num_inference_steps: 1,
          image_size: 'square_hd',
        }),
        signal: AbortSignal.timeout(15000),
      });

      const responseText = await testRes.text();
      let responseData: unknown = null;
      try { responseData = JSON.parse(responseText); } catch { responseData = responseText.slice(0, 200); }

      const isAuthSuccess = testRes.status === 422 || testRes.status === 200 || testRes.status === 201 || testRes.status === 202;

      falApiTest = {
        status: testRes.status,
        ok: isAuthSuccess,
        response_preview: typeof responseData === 'object'
          ? JSON.stringify(responseData).slice(0, 300)
          : String(responseData).slice(0, 300),
        endpoint: 'queue.fal.run/fal-ai/flux/schnell (auth check)',
        auth_success: isAuthSuccess,
      };

      if (!isAuthSuccess && testRes.status !== 401 && testRes.status !== 403) {
        try {
          const fallbackRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
            method: 'POST',
            headers: {
              'Authorization': `Key ${testKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: 'test', num_images: 1 }),
            signal: AbortSignal.timeout(10000),
          });
          const fbText = await fallbackRes.text();
          let fbData: unknown = null;
          try { fbData = JSON.parse(fbText); } catch { fbData = fbText.slice(0, 100); }
          const fbAuthSuccess = fallbackRes.status === 422 || fallbackRes.status === 200 || fallbackRes.status === 201 || fallbackRes.status === 202;
          falApiTest = {
            status: fallbackRes.status,
            ok: fbAuthSuccess,
            response_preview: typeof fbData === 'object' ? JSON.stringify(fbData).slice(0, 300) : String(fbData).slice(0, 300),
            endpoint: 'fal.run/fal-ai/flux/schnell (fallback)',
            auth_success: fbAuthSuccess,
          };
        } catch { /* fallback 실패 무시 */ }
      }
    } catch (e) {
      falApiTest = { error: String(e), status: 0, ok: false, endpoint: 'connection failed', auth_success: false };
    }
  }

  // OpenRouter 키도 확인
  const { data: orKeyData } = await supabase
    .from('api_keys')
    .select('encrypted_key, status')
    .eq('service_slug', 'openrouter')
    .eq('status', 'active')
    .maybeSingle();

  let orDecryptResult = null;
  if (orKeyData?.encrypted_key) {
    orDecryptResult = await decryptKey(orKeyData.encrypted_key as string);
  }

  return new Response(JSON.stringify({
    env_check: {
      jwt_secret_exists: !!jwtSecret,
      jwt_secret_length: jwtSecret.length,
      fal_key_env_exists: !!falKeyEnv,
      supabase_url_exists: !!Deno.env.get('SUPABASE_URL'),
      service_role_exists: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    },
    db_key: {
      found: !!keyData,
      error: keyError?.message ?? null,
      encrypted_prefix: keyData?.encrypted_key?.slice(0, 20) ?? null,
      status: keyData?.status ?? null,
    },
    decrypt_result: decryptResult ? {
      success: decryptResult.success,
      method: decryptResult.method,
      key_preview: falKeyPreview,
      key_valid: falKeyValid,
      error: decryptResult.error ?? null,
    } : null,
    fal_api_test: falApiTest,
    openrouter_key: {
      found: !!orKeyData,
      status: orKeyData?.status ?? null,
      decrypt_success: orDecryptResult?.success ?? false,
      decrypt_error: orDecryptResult?.error ?? null,
      key_preview: orDecryptResult?.success && orDecryptResult.key
        ? orDecryptResult.key.slice(0, 12) + '...'
        : null,
    },
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
