-- Rate-limit hit log used by supabase/functions/_shared/rateLimit.ts.
--
-- Every successful request inserts a row keyed by an arbitrary "bucket"
-- string (typically "<function-name>:<user_id>"). The helper counts rows
-- newer than `now() - window_seconds` to decide whether to allow the next
-- call.
--
-- Writes are Edge-Function only (service-role bypasses RLS). Clients cannot
-- see or delete rows, so users cannot tamper with their own quota.

create table if not exists public.rate_limits (
  id         bigserial primary key,
  bucket     text not null,
  created_at timestamptz not null default now()
);

-- Compound index matching the access pattern:
--   SELECT count(*) FROM rate_limits
--   WHERE bucket = $1 AND created_at > $2
create index if not exists rate_limits_bucket_created_at_idx
  on public.rate_limits (bucket, created_at desc);

-- RLS: deny all end-user access.
alter table public.rate_limits enable row level security;
-- (no policies = deny-by-default for authenticated / anon)

-- Periodic cleanup so the table stays bounded. Keeps rows for 1 hour —
-- long enough for any reasonable window, short enough that the table
-- stays in the low thousands of rows under typical load.
create or replace function public.cleanup_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where created_at < now() - interval '1 hour';
$$;

revoke all on function public.cleanup_rate_limits() from public;
revoke all on function public.cleanup_rate_limits() from authenticated;
revoke all on function public.cleanup_rate_limits() from anon;
grant execute on function public.cleanup_rate_limits() to service_role;

-- If pg_cron is available on the project, schedule hourly cleanup. The
-- `create extension` is a no-op if the extension isn't available — admins
-- can call cleanup_rate_limits() manually or via healthcheck-scheduler.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'rate_limits_cleanup_hourly',
      '*/15 * * * *',
      $cmd$select public.cleanup_rate_limits();$cmd$
    );
  end if;
exception when others then
  -- Extension may require ALTER ROLE privileges we don't have; cleanup can
  -- also be invoked by the existing healthcheck-scheduler function.
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end$$;
