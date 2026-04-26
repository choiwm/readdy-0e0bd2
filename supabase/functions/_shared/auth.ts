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

/** 4-tier admin role enum, mirroring the SQL admin_role type (migration 0007). */
export type AdminRole = 'super_admin' | 'ops' | 'cs' | 'billing';

export const ALL_ADMIN_ROLES: readonly AdminRole[] = ['super_admin', 'ops', 'cs', 'billing'];

export interface AuthedAdmin extends AuthedUser {
  adminId: string;
  role: AdminRole;
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
 *
 * Pass `allowedRoles` to scope an endpoint to a subset of admin roles. The
 * default (no argument) means "any active admin" which is what the legacy
 * call sites used. New endpoints SHOULD pass an explicit allowlist — even
 * if it's all four roles, the explicit choice surfaces the policy decision.
 *
 * Returns 403 with `{error: 'forbidden_role', required_roles}` when the
 * caller is admin but not in the allowed set, so the frontend can render
 * a precise message instead of the generic "관리자만 접근 가능" copy.
 */
export async function requireAdmin(
  req: Request,
  allowedRoles?: readonly AdminRole[],
): Promise<AuthedAdmin> {
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

  // After migration 0007 role is NOT NULL, but defensive cast for legacy
  // rows that haven't migrated yet (e.g. older deploy hitting newer client).
  const role = (data.role ?? 'super_admin') as AdminRole;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new AuthFailure(jsonResponse({
      error: 'forbidden_role',
      required_roles: allowedRoles,
      caller_role: role,
    }, 403, req));
  }

  return { ...user, adminId: data.id, role };
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
 * Audit-log actions worth alerting on. Anything that modifies money,
 * deletes data, or grants/removes access goes here. Mirrors the
 * action filter in audit_high_risk_7d view (migration 0008).
 *
 * When `writeAuditLog` is called for one of these AND the actor is
 * super_admin (the only role that can do most of them), a Slack message
 * is fired async. Non-fatal — alert failures never block the audit row
 * write or the original request.
 */
const HIGH_RISK_ACTIONS: ReadonlySet<string> = new Set([
  // API key rotations
  '관리자 API 키 등록',
  '관리자 API 키 회수',
  // admin roster
  '관리자 계정 생성',
  '관리자 계정 수정',
  '관리자 계정 삭제',
  // user-level destructive ops
  '코인 일괄 지급',
  '회원 등급 변경',
  '회원 플랜 변경',
  '회원 계정 정지',
  // billing
  '결제 환불 처리',
  // network
  'IP 차단 등록',
]);

async function postSuperAdminSlack(
  webhookUrl: string,
  admin: AuthedAdmin,
  action: string,
  options: AuditLogOptions,
): Promise<void> {
  const lines = [
    `*행동:* ${action}`,
    `*대상:* ${options.target_label ?? options.target_id ?? '-'}`,
    options.detail ? `*세부:* ${String(options.detail).slice(0, 200)}` : '',
    `*결과:* ${options.result ?? 'success'}`,
  ].filter(Boolean).join('\n');

  const payload = {
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '🛡️ super_admin 행동 감지', emoji: true } },
      { type: 'section', text: { type: 'mrkdwn', text:
        `*${admin.email}* (super_admin) 가 high-risk 행동을 수행했어요.` } },
      { type: 'section', text: { type: 'mrkdwn', text: lines } },
      { type: 'context', elements: [{ type: 'mrkdwn',
        text: `🕐 ${new Date().toLocaleString('ko-KR')} | audit_logs id 기록됨` }] },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // Slack 실패는 fire-and-forget — 원 행동 차단 X.
  }
}

/**
 * Insert an audit-log row for a destructive or sensitive admin action.
 *
 * Admin identity (email) is pulled from the verified JWT via AuthedAdmin, not
 * from request body — requests cannot spoof who performed the action.
 *
 * Side effect: if `action` is in HIGH_RISK_ACTIONS AND the actor is
 * super_admin AND ADMIN_AUDIT_SLACK_WEBHOOK_URL is set, an async Slack
 * notification fires. Failures don't block the row insert.
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
      actor_role: admin.role,
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

  // super_admin 의 high-risk 행동만 Slack 으로 즉시 알림. 다른 role 의
  // 같은 action 은 그 role 의 정상 직무 범위라 제외 (예: cs 가 update_user_status
  // 하는 건 자연스러움). DB 인서트 실패와 무관하게 시도해서 모니터링 누락
  // 최소화.
  if (admin.role === 'super_admin' && HIGH_RISK_ACTIONS.has(action)) {
    const webhook = Deno.env.get('ADMIN_AUDIT_SLACK_WEBHOOK_URL');
    if (webhook) {
      void postSuperAdminSlack(webhook, admin, action, options);
    }
  }
}
