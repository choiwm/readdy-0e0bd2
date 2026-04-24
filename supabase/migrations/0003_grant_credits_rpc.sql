-- Atomic credit-grant RPC used by the payments-toss Edge Function.
-- Returns the new balance. Falls back to read-modify-write if this RPC is
-- missing, but using this RPC avoids race conditions when a single user has
-- multiple concurrent payments (e.g. retried webhooks).

create or replace function public.grant_credits(p_user_id uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  update public.user_profiles
     set credit_balance = coalesce(credit_balance, 0) + p_amount
   where id = p_user_id
   returning credit_balance into new_balance;

  if new_balance is null then
    raise exception 'user_profile not found for %', p_user_id;
  end if;

  return new_balance;
end;
$$;

-- Only callable by the service role (Edge Functions). Authenticated end-users
-- must NEVER be able to grant themselves credits.
revoke all on function public.grant_credits(uuid, integer) from public;
revoke all on function public.grant_credits(uuid, integer) from authenticated;
revoke all on function public.grant_credits(uuid, integer) from anon;
grant execute on function public.grant_credits(uuid, integer) to service_role;
