// Per-user / per-bucket sliding-window rate limiter.
//
// Uses a simple hit-log strategy: every call that passes inserts a row into
// `rate_limits`. The next call counts rows newer than `now() - window` for
// the same bucket. Implementation is intentionally simple — we're protecting
// against scripted abuse, not a distributed attack.
//
// The `rate_limits` table auto-vacuums via `cleanup_rate_limits()` (runs via
// pg_cron hourly; see migration 0004) so the table stays small.
//
// Usage:
//
//   const rl = await checkRateLimit(supabase, {
//     bucket: `generate-image:${user.id}`,
//     max: 20,
//     windowSeconds: 60,
//   });
//   if (!rl.ok) return rateLimitedResponse(rl.resetAt, buildCorsHeaders(req));

// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitOptions {
  /** Unique key for the limit (e.g. `generate-image:<user_id>`). */
  bucket: string;
  /** Maximum hits allowed inside `windowSeconds`. */
  max: number;
  /** Sliding window size in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Wall-clock time when the oldest hit in the window expires (client
   *  can safely retry after this). For a fresh violation this is `windowSeconds`
   *  from now; a cheap approximation that avoids an extra query. */
  resetAt: Date;
}

/**
 * Check and record a hit. Fails OPEN on DB errors — a transient Supabase
 * outage should not lock out all users of an otherwise-healthy function.
 */
export async function checkRateLimit(
  supabase: SupabaseClient<any, any, any>,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - opts.windowSeconds * 1000).toISOString();
  const resetAt = new Date(Date.now() + opts.windowSeconds * 1000);

  try {
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('bucket', opts.bucket)
      .gte('created_at', since);

    if (error) {
      console.warn('[rateLimit] select error, failing open:', error.message);
      return { ok: true, remaining: opts.max, resetAt };
    }

    const used = count ?? 0;
    if (used >= opts.max) {
      return { ok: false, remaining: 0, resetAt };
    }

    // Record this hit. We don't await strict consistency — if this insert
    // fails, the worst case is under-counting by one, which is fine.
    await supabase.from('rate_limits').insert({ bucket: opts.bucket });

    return {
      ok: true,
      remaining: Math.max(0, opts.max - used - 1),
      resetAt,
    };
  } catch (e) {
    console.warn('[rateLimit] unexpected error, failing open:', e);
    return { ok: true, remaining: opts.max, resetAt };
  }
}

/**
 * 429 Too Many Requests response with a Retry-After header.
 */
export function rateLimitedResponse(
  resetAt: Date,
  corsHeaders: Record<string, string>,
  message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
): Response {
  const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return new Response(
    JSON.stringify({ error: 'rate_limited', message, retry_after: retryAfter }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  );
}

// Centralised per-function policy. Tuned for a small SaaS:
//   - Image: 20/min (a user generating storyboards for an hour rarely exceeds this)
//   - Video: 5/min (video is expensive on fal.ai; 5 concurrent is plenty)
//   - Audio/misc: 30/min
//   - Payment create_order: 10/min (humans don't need more)
export const POLICIES = {
  generateImage:        { max: 20, windowSeconds: 60 },
  generateVideo:        { max:  5, windowSeconds: 60 },
  generateTts:          { max: 30, windowSeconds: 60 },
  generateMusic:        { max: 10, windowSeconds: 60 },
  generateSfx:          { max: 30, windowSeconds: 60 },
  generateScript:       { max: 30, windowSeconds: 60 },
  generateVton:         { max: 10, windowSeconds: 60 },
  generateTranscribe:   { max: 20, windowSeconds: 60 },
  generateMultishot:    { max:  5, windowSeconds: 60 },
  analyzeVideoSfx:      { max: 20, windowSeconds: 60 },
  cleanAudio:           { max: 20, windowSeconds: 60 },
  summarizeText:        { max: 30, windowSeconds: 60 },
  paymentsCreateOrder:  { max: 10, windowSeconds: 60 },
} as const;
