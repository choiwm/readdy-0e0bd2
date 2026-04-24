-- Additions to support the public-facing support-submit Edge Function.
--
-- 1. `newsletter_subscribers` — simple email list (footer signup).
-- 2. `cs_tickets`             — add columns if missing so the function can
--                               write without breaking existing admin flows.

-- ── 1) newsletter_subscribers ────────────────────────────────────────────────
create table if not exists public.newsletter_subscribers (
  id             bigserial primary key,
  email          text unique not null,
  subscribed_at  timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create index if not exists newsletter_subscribers_subscribed_at_idx
  on public.newsletter_subscribers (subscribed_at desc);

alter table public.newsletter_subscribers enable row level security;
-- deny-all: access only via Edge Function (service role)

-- ── 2) cs_tickets hardening ──────────────────────────────────────────────────
-- These are additive columns; skip silently if they already exist so re-running
-- the migration is safe on projects that bootstrapped cs_tickets earlier.
alter table public.cs_tickets add column if not exists user_id     uuid references auth.users(id) on delete set null;
alter table public.cs_tickets add column if not exists user_email  text;
alter table public.cs_tickets add column if not exists user_name   text;
alter table public.cs_tickets add column if not exists body        text;
alter table public.cs_tickets add column if not exists meta        jsonb default '{}'::jsonb;

-- Users can SELECT their own tickets (used by /my-payments refund tracking).
-- This is an additive policy — other user-facing queries (if any) still work.
alter table public.cs_tickets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'cs_tickets'
      and policyname = 'cs_tickets_select_own'
  ) then
    create policy cs_tickets_select_own on public.cs_tickets
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end$$;
