# Automated Deploy

`.github/workflows/deploy.yml` runs on every push to `main` and deploys:

1. **Supabase** — DB migrations (`supabase db push`) + all Edge Functions
2. **Vercel** — production build of the Vite SPA

Each job checks its required secrets/variables and **skips gracefully** with a
notice if they're missing — so merging the workflow before secrets are
configured is safe.

## Quick start (recommended)

Two interactive scripts walk through every required value, validate input, and
write secrets/variables for you. Both are idempotent — safe to re-run any time
to add a missing one or rotate a key.

```bash
# 1) GitHub Actions Secrets/Variables (uses gh CLI)
bash scripts/setup-deploy-secrets.sh

# 2) Supabase Edge Function runtime secrets (uses supabase CLI)
bash scripts/setup-supabase-secrets.sh

# Audit only (non-interactive, exit 0 = all set):
bash scripts/setup-deploy-secrets.sh --check
bash scripts/setup-supabase-secrets.sh --check
```

After both scripts report green:

```bash
gh workflow run deploy.yml --ref main   # trigger immediately
gh run watch                            # follow the run
```

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

The Toss **secret** key, webhook secret, and CORS allowlist are set via
`supabase secrets set` (see `setup-supabase-secrets.sh`) — NOT GitHub Actions
secrets, because they're read by the Edge Function runtime, not by `vite build`.

## First-time setup

```bash
# 1. Link Supabase locally (once)
supabase login
supabase link --project-ref <SUPABASE_PROJECT_ID>

# 2. Link Vercel locally (once) — creates .vercel/project.json
vercel link

# 3. Run the setup scripts
bash scripts/setup-deploy-secrets.sh
bash scripts/setup-supabase-secrets.sh
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
