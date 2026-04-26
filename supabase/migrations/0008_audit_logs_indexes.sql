-- 0008: audit_logs indexes + view for role-aware monitoring
--
-- Migration 0007 added audit_logs.actor_role; this migration makes the
-- common operational queries (find suspicious super_admin activity, count
-- destructive actions per role per day, find a specific admin's recent
-- actions) actually fast.
--
-- Index choices
-- ─────────────
-- 1. actor_role + created_at desc — covers the daily "what did super_admin
--    do today?" query and the role-grouped activity dashboard.
-- 2. admin_email + created_at desc — covers the per-person audit drilldown
--    when investigating a specific admin.
-- 3. action + created_at desc — covers "show me every refund_payment in
--    the last 30 days regardless of who did it".
--
-- All three use desc to match `order by created_at desc` in real queries.

create index if not exists audit_logs_actor_role_created_at_idx
  on public.audit_logs (actor_role, created_at desc);

create index if not exists audit_logs_admin_email_created_at_idx
  on public.audit_logs (admin_email, created_at desc);

create index if not exists audit_logs_action_created_at_idx
  on public.audit_logs (action, created_at desc);

-- Role activity summary view — "actions per role per day for the last 30 days".
-- Powers admin dashboards and the optional Slack daily-digest.
create or replace view public.audit_role_activity_30d as
select
  actor_role,
  date_trunc('day', created_at)::date as day,
  count(*)                            as action_count,
  count(*) filter (where result = 'failure') as failure_count
from public.audit_logs
where created_at >= now() - interval '30 days'
group by actor_role, date_trunc('day', created_at)::date
order by day desc, actor_role;

-- High-risk actions in the last 7 days. Used by the Slack alert wrapper
-- (PR after this) and as a manual sanity check in incident response.
-- Definition matches the HIGH_RISK_ACTIONS list in
-- supabase/functions/_shared/auth.ts so they stay in sync.
create or replace view public.audit_high_risk_7d as
select id, admin_email, actor_role, action, target_label, detail,
       result, created_at
from public.audit_logs
where created_at >= now() - interval '7 days'
  and action in (
    -- API key ops
    '관리자 API 키 등록',
    '관리자 API 키 회수',
    -- admin roster ops
    '관리자 계정 생성',
    '관리자 계정 수정',
    '관리자 계정 삭제',
    -- destructive user ops
    '코인 일괄 지급',
    '회원 등급 변경',
    '회원 플랜 변경',
    '회원 계정 정지',
    -- billing
    '결제 환불 처리',
    -- IP block
    'IP 차단 등록'
  )
order by created_at desc;
