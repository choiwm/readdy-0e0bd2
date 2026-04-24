// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders } from './cors.ts';

/**
 * Default CORS headers used when no Request is available. Kept for backward
 * compatibility with callers that imported `corsHeaders` directly. New code
 * should use `buildCorsHeaders(req)` from ./cors.ts so the allowlist works.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function jsonResponse(data: unknown, status: number, req?: Request): Response {
  const headers = req ? buildCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export class AuthFailure extends Error {
  response: Response;
  constructor(response: Response) {
    super('auth failure');
    this.response = response;
  }
}

export interface AuthedUser {
  id: string;
  email: string;
  jwt: string;
}

export interface AuthedAdmin extends AuthedUser {
  adminId: string;
  role: string | null;
}

/**
 * Verifies the request's Authorization header contains a valid Supabase JWT.
 * Returns the user or throws AuthFailure with a 401 Response ready to return.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    throw new AuthFailure(jsonResponse({ error: "unauthorized" }, 401, req));
  }
  const jwt = auth.slice('Bearer '.length);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    throw new AuthFailure(jsonResponse({ error: "server_misconfigured" }, 500, req));
  }

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !data.user.email) {
    throw new AuthFailure(jsonResponse({ error: "unauthorized" }, 401, req));
  }

  return { id: data.user.id, email: data.user.email, jwt };
}

/**
 * Verifies the caller is a user AND is listed as an active admin in admin_accounts.
 * Throws AuthFailure with 401 (no auth) or 403 (not admin).
 */
export async function requireAdmin(req: Request): Promise<AuthedAdmin> {
  const user = await requireUser(req);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    throw new AuthFailure(jsonResponse({ error: "server_misconfigured" }, 500, req));
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from('admin_accounts')
    .select('id, role, is_active')
    .eq('email', user.email)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new AuthFailure(jsonResponse({ error: "forbidden" }, 403, req));
  }
  if (!data) {
    throw new AuthFailure(jsonResponse({ error: "forbidden" }, 403, req));
  }

  return { ...user, adminId: data.id, role: data.role ?? null };
}

/**
 * Validates a scheduler header against an environment secret in constant time.
 */
export function requireSchedulerSecret(req: Request, envVar = 'SCHEDULER_SECRET'): void {
  const expected = Deno.env.get(envVar);
  const received = req.headers.get('x-scheduler-secret') ?? '';
  if (!expected) {
    throw new AuthFailure(jsonResponse({ error: "server_misconfigured" }, 500, req));
  }
  if (received.length !== expected.length) {
    throw new AuthFailure(jsonResponse({ error: "unauthorized" }, 401, req));
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  if (mismatch !== 0) {
    throw new AuthFailure(jsonResponse({ error: "unauthorized" }, 401, req));
  }
}

/**
 * Convenience wrapper to run a handler with AuthFailure → Response conversion.
 * Usage:
 *   Deno.serve((req) => withAuth(req, async () => { ... }));
 */
export async function withAuth(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }
}

export interface AuditLogOptions {
  target_type?: string;
  target_id?: string | null;
  target_label?: string | null;
  detail?: string | null;
  ip_address?: string | null;
  result?: 'success' | 'failure';
}

/**
 * Insert an audit-log row for a destructive or sensitive admin action.
 *
 * Admin identity (email) is pulled from the verified JWT via AuthedAdmin, not
 * from request body — requests cannot spoof who performed the action.
 */
export async function writeAuditLog(
  supabase: SupabaseClient<any, any, any>,
  admin: AuthedAdmin,
  action: string,
  options: AuditLogOptions = {},
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      admin_email: admin.email,
      action,
      target_type: options.target_type ?? null,
      target_id: options.target_id ?? null,
      target_label: options.target_label ?? null,
      detail: options.detail ?? null,
      ip_address: options.ip_address ?? null,
      result: options.result ?? 'success',
    });
  } catch {
    // audit 실패로 원 작업을 막지 않는다 — 배치 모니터링에서 탐지
  }
}
