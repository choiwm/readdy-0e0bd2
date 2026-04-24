// Shared CORS helper for Edge Functions.
//
// Previously every function hard-coded
//   'Access-Control-Allow-Origin': '*'
// which means anyone hosting arbitrary JavaScript can fire authenticated
// requests at our API (abuse of `generate-*` = credit drain, abuse of
// `payments-toss` = order-spam).
//
// Production configuration:
//   supabase secrets set ALLOWED_ORIGINS="https://aimetawow.com,https://www.aimetawow.com"
//
// Dev mode (ALLOWED_ORIGINS empty or unset) falls back to '*' so local
// development with `vite dev` on any port still works. This preserves the
// current behaviour in dev while enforcing the allowlist in prod.
//
// Usage in a function:
//
//   import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
//
//   Deno.serve((req) => {
//     if (req.method === 'OPTIONS') return handlePreflight(req);
//     ...
//     return new Response(JSON.stringify(body), {
//       headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
//     });
//   });

const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-scheduler-secret, x-toss-webhook-secret',
  'Access-Control-Allow-Methods':
    'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Returns CORS headers for the given request.
 *
 * - If ALLOWED_ORIGINS is empty (dev), returns `*`.
 * - If the request Origin matches an entry, echoes that origin back
 *   (must be exact — not a prefix match — to avoid subdomain takeovers).
 * - Otherwise returns the first allowed origin (browsers will block
 *   the request anyway because origins won't match; this just keeps
 *   the preflight response well-formed).
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const allowed = parseAllowedOrigins();
  if (allowed.length === 0) {
    return {
      ...BASE_HEADERS,
      'Access-Control-Allow-Origin': '*',
    };
  }
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
  return {
    ...BASE_HEADERS,
    'Access-Control-Allow-Origin': allowOrigin,
    'Vary': 'Origin',
  };
}

/** Preflight response for OPTIONS requests. */
export function handlePreflight(req: Request): Response {
  return new Response(null, { headers: buildCorsHeaders(req) });
}

/** Returns true if an Origin is explicitly allowed. Useful for extra checks
 *  (e.g. rejecting same-origin DELETEs from a stale tab on an old domain).
 *  Returns true in dev mode (no allowlist configured) by design. */
export function isOriginAllowed(req: Request): boolean {
  const allowed = parseAllowedOrigins();
  if (allowed.length === 0) return true;
  const origin = req.headers.get('Origin') ?? '';
  return allowed.includes(origin);
}
