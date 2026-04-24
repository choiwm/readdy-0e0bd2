# Automated Deploy

`.github/workflows/deploy.yml` runs on every push to `main` and deploys:

1. **Supabase** — DB migrations (`supabase db push`) + all Edge Functions
2. **Vercel** — production build of the Vite SPA

Each job checks its required secrets/variables and **skips gracefully** with a
notice if they're missing — so merging the workflow before secrets are
configured is safe.

## Required GitHub configuration

Settings → Secrets and variables → Actions.

### Variables (non-sensitive, visible to anyone with repo access)

| Name                  | Example                | Purpose |
|-----------------------|------------------------|---------|
| `SUPABASE_PROJECT_ID` | `abcdefghijklmnop`     | Project ref from your Supabase dashboard URL |
| `VERCEL_ORG_ID`       | `team_xxxxxxxxxxxx`    | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID`   | `prj_xxxxxxxxxxxx`     | Same file |

### Secrets (encrypted)

| Name                                 | Purpose |
|--------------------------------------|---------|
| `SUPABASE_ACCESS_TOKEN`              | https://supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD`               | Postgres password (Project settings → Database → Connection Info) |
| `VERCEL_TOKEN`                       | https://vercel.com/account/tokens |
| `PROD_VITE_PUBLIC_SUPABASE_URL`      | Frontend env at build time |
| `PROD_VITE_PUBLIC_SUPABASE_ANON_KEY` | Frontend env at build time |
| `PROD_VITE_PUBLIC_TOSS_CLIENT_KEY`   | `live_ck_xxx` for production, `test_ck_xxx` for staging |

The Toss **secret** key and webhook secret are set via `supabase secrets set`
(see `docs/payments-setup.md` step 3) — NOT GitHub Actions secrets, because
they're read by the Edge Function runtime, not by `vite build`.

## First-time setup

```bash
# 1. Link Supabase locally (once)
supabase login
supabase link --project-ref <SUPABASE_PROJECT_ID>

# 2. Link Vercel locally (once) — creates .vercel/project.json
vercel link

# 3. Copy IDs to GitHub
#    SUPABASE_PROJECT_ID  ← project-ref from step 1
#    VERCEL_ORG_ID        ← orgId from .vercel/project.json
#    VERCEL_PROJECT_ID    ← projectId from .vercel/project.json

# 4. Set Toss secrets in Supabase (Edge Function env)
supabase secrets set TOSS_SECRET_KEY=live_sk_xxx
supabase secrets set TOSS_WEBHOOK_SECRET=$(openssl rand -hex 16)
```

## Runtime behavior

- Push to `main` → both jobs attempt to run, in sequence (Supabase first, then
  Vercel — so migrations/functions are live before the UI that depends on them)
- PR → `check` + `e2e` jobs from `ci.yml` run; deploy does NOT run
- Manual re-deploy: **Actions tab → Deploy → Run workflow**

## Rollback

The workflow does not do blue/green deploys. To roll back:

- **Frontend**: `vercel rollback` or redeploy previous commit in Vercel dashboard
- **Edge Functions**: redeploy from a previous git commit
  (`git checkout <sha> -- supabase/functions && supabase functions deploy`)
- **Migrations**: Supabase migrations are **append-only** — write a new migration
  that reverses the change; do NOT try to delete past migration files
