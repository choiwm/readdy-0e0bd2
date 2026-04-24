-- Payments table for TossPayments integration.
-- Each row represents one payment intent created when a user clicks "Buy".
-- The same row is updated as the payment progresses (pending → done/cancelled/failed).
--
-- Note: amount is integer KRW (no decimals). credits is integer (no fractions).
-- order_id is generated client-side and passed to Toss; it's the join key
-- between Toss and our DB.

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        text unique not null,
  user_id         uuid references auth.users(id) on delete set null,
  package_id      text not null,
  amount          integer not null check (amount > 0),
  credits         integer not null check (credits > 0),
  status          text not null default 'pending'
                  check (status in ('pending', 'done', 'cancelled', 'failed', 'refunded')),
  payment_key     text,
  payment_method  text,
  toss_response   jsonb,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists payments_user_id_idx     on public.payments (user_id);
create index if not exists payments_status_idx      on public.payments (status);
create index if not exists payments_created_at_idx  on public.payments (created_at desc);

-- updated_at autotouch
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists payments_touch_updated_at on public.payments;
create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- payments table: user can read their own rows; writes are Edge-Function only
-- (service-role bypasses RLS).
alter table public.payments enable row level security;

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policies for users — Edge Functions handle writes
-- using SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
