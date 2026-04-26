-- 0007: admin_role enum + tighten admin_accounts.role
--
-- Before this migration, admin_accounts.role was free-text. SecurityTab.tsx
-- referenced "Super Admin" / "CS Manager" as display labels, but no Edge
-- Function actually enforced anything based on role — every admin had god
-- mode. The schema-level fix is to constrain the column to a known enum so
-- a typo can't silently grant elevated access.
--
-- Migration policy
-- ────────────────
-- Existing admin_accounts rows keep working: any non-NULL row is mapped to
-- 'super_admin' (we'd rather grandfather an active admin than lock them
-- out at deploy time). Operators can downgrade them via the new admin
-- roster panel afterward.
--
-- Roles
-- ─────
--   super_admin — every admin endpoint, plus inviting/removing other admins
--   ops         — infra/AI engine/diagnostic/content/stats/audit
--   cs          — CS tickets/notices/user lookup/manual credit grant
--   billing     — payments view+refund/stats; never users or AI keys
--
-- Endpoint-level mapping is enforced inside requireAdmin() in
-- supabase/functions/_shared/auth.ts via the new allowedRoles parameter.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type public.admin_role as enum ('super_admin', 'ops', 'cs', 'billing');
  end if;
end$$;

-- Map free-text values to the enum. Anything we don't recognise → super_admin
-- (defensive — better grandfather than lock out).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'admin_accounts'
      and column_name  = 'role'
      and udt_name     <> 'admin_role'
  ) then
    -- Step 1 — drop default that would block enum cast.
    alter table public.admin_accounts alter column role drop default;

    -- Step 2 — coerce existing values via a translation expression.
    alter table public.admin_accounts
      alter column role type public.admin_role
      using (case
        when role in ('super_admin', 'ops', 'cs', 'billing')
          then role::public.admin_role
        when role is null or role = ''
          then 'super_admin'::public.admin_role
        when lower(role) like '%super%'  then 'super_admin'::public.admin_role
        when lower(role) like '%cs%'     then 'cs'::public.admin_role
        when lower(role) like '%bill%'   then 'billing'::public.admin_role
        when lower(role) like '%ops%'    then 'ops'::public.admin_role
        else 'super_admin'::public.admin_role
      end);

    -- Step 3 — re-add a sensible default for new inserts via the admin UI.
    alter table public.admin_accounts alter column role set default 'cs'::public.admin_role;
    alter table public.admin_accounts alter column role set not null;
  end if;
end$$;

-- audit_logs.actor_role — capture who-with-what-role did the action.
-- Existing rows get NULL (we don't know retroactively); new rows must
-- supply it from the requireAdmin() result.
alter table public.audit_logs
  add column if not exists actor_role public.admin_role;
