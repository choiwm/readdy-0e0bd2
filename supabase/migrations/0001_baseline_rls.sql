-- Baseline RLS policies for user-owned tables.
-- TEMPLATE ONLY — run `supabase db pull` first and reconcile with actual columns
-- before applying. Column names below (especially `user_id`) must match production.
--
-- Convention:
--   * Every table here has RLS enabled.
--   * Users can only read/write rows where user_id = auth.uid().
--   * Admin-only tables (admin_accounts, audit_logs, credit_costs) deny all client
--     access and are written exclusively via Edge Functions using the service role.

-- ── User-owned tables ────────────────────────────────────────────────────────

do $$
declare
  t text;
  user_tables text[] := array[
    'user_profiles',
    'user_shortcuts',
    'gallery_items',
    'automation_projects',
    'board_projects',
    'audio_history',
    'ad_works',
    'credits'
  ];
begin
  foreach t in array user_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      drop policy if exists %1$I_select_own on public.%2$I;
      create policy %1$I_select_own on public.%2$I
        for select to authenticated
        using (user_id = auth.uid());
    $f$, t || '_select', t);

    execute format($f$
      drop policy if exists %1$I_insert_own on public.%2$I;
      create policy %1$I_insert_own on public.%2$I
        for insert to authenticated
        with check (user_id = auth.uid());
    $f$, t || '_insert', t);

    execute format($f$
      drop policy if exists %1$I_update_own on public.%2$I;
      create policy %1$I_update_own on public.%2$I
        for update to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t || '_update', t);

    execute format($f$
      drop policy if exists %1$I_delete_own on public.%2$I;
      create policy %1$I_delete_own on public.%2$I
        for delete to authenticated
        using (user_id = auth.uid());
    $f$, t || '_delete', t);
  end loop;
end$$;

-- ── Admin-only tables ────────────────────────────────────────────────────────
-- No policies are created, so with RLS enabled anon/authenticated cannot read
-- or write. Access is only via Edge Functions that use the service-role key.

alter table public.admin_accounts enable row level security;
alter table public.audit_logs     enable row level security;
alter table public.credit_costs   enable row level security;
