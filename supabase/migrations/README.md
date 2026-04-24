# Supabase Migrations

This directory is the source of truth for the database schema and Row-Level Security (RLS) policies. Because `.env` exposes the Supabase project URL and anon key to every browser, **every table referenced by the client must have RLS enabled with explicit policies**, or authenticated users can read/write each other's data.

## Tables referenced by the client

Grepping `from('...')` in `src/` currently finds these tables. Each of them must be covered:

- `ad_works`
- `admin_accounts`
- `audio_history`
- `audit_logs`
- `automation_projects`
- `board_projects`
- `credit_costs`
- `credits`
- `gallery_items`
- `user_profiles`
- `user_shortcuts`

## Required baseline policies

For every user-owned table (everything except `admin_accounts`, `audit_logs`, `credit_costs`):

1. `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;`
2. `SELECT` — only rows where `user_id = auth.uid()`.
3. `INSERT` — only with `user_id = auth.uid()`.
4. `UPDATE` / `DELETE` — only rows where `user_id = auth.uid()`.

Admin-only tables (`admin_accounts`, `audit_logs`, `credit_costs`) must deny anon/authenticated access entirely and be reached only through Edge Functions using the service-role key.

The file `0001_baseline_rls.sql` contains a starter template. **Do not apply it blindly** — compare against the current production schema first (`supabase db diff`) and adjust column names to match reality.

## Workflow

```bash
# 1. link local CLI to the project
supabase link --project-ref <ref>

# 2. pull the current production schema so local stays in sync
supabase db pull

# 3. create a new migration
supabase migration new <name>

# 4. apply locally then push
supabase db push
```

Commit every generated `.sql` file — migrations are the audit trail for schema changes.
