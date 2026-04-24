function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Copy .env.example to .env and fill in the values.`
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  'VITE_PUBLIC_SUPABASE_URL',
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  'VITE_PUBLIC_SUPABASE_ANON_KEY',
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
);

/**
 * Synchronously returns an `Authorization` header value using the Supabase
 * session stored in localStorage. Falls back to the anon key only if no
 * session exists (most Edge Functions now require a valid JWT).
 *
 * Async callers should prefer `callEdge()` from `./edgeClient`, which goes
 * through the SDK and auto-refreshes the token.
 */
export function getAuthorizationHeader(): string {
  try {
    const raw = localStorage.getItem('sb-session');
    if (raw) {
      const parsed = JSON.parse(raw) as { access_token?: string };
      if (parsed.access_token) return `Bearer ${parsed.access_token}`;
    }
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('sb-') || !key.includes('auth')) continue;
      const val = localStorage.getItem(key);
      if (!val) continue;
      try {
        const p = JSON.parse(val) as { access_token?: string };
        if (p.access_token) return `Bearer ${p.access_token}`;
      } catch { /* 다음 키 */ }
    }
  } catch { /* fallback */ }
  return `Bearer ${SUPABASE_ANON_KEY}`;
}
