#!/usr/bin/env bash
#
# Interactive setup for the GitHub Actions deploy workflow.
#
# Walks you through every Variable + Secret that .github/workflows/deploy.yml
# expects, lets you skip any that are already set correctly, and writes the
# rest via `gh variable set` / `gh secret set`.
#
# Idempotent — safe to re-run any time. For each item the current value (or
# its presence) is shown so you can decide whether to keep or replace.
#
# Requirements:
#   - GitHub CLI (`gh`)         https://cli.github.com
#   - `gh auth login` already done (the script verifies)
#
# Usage:
#   bash scripts/setup-deploy-secrets.sh                      # interactive
#   bash scripts/setup-deploy-secrets.sh --check              # dry-run audit
#

set -euo pipefail

CHECK_ONLY=0
if [[ "${1:-}" == "--check" || "${1:-}" == "-c" ]]; then
  CHECK_ONLY=1
fi

# ── helpers ──────────────────────────────────────────────────────────────────
c_red()    { printf '\033[31m%s\033[0m' "$*"; }
c_green()  { printf '\033[32m%s\033[0m' "$*"; }
c_yellow() { printf '\033[33m%s\033[0m' "$*"; }
c_blue()   { printf '\033[34m%s\033[0m' "$*"; }
c_dim()    { printf '\033[2m%s\033[0m' "$*"; }
c_bold()   { printf '\033[1m%s\033[0m' "$*"; }

heading() {
  echo
  echo "═══════════════════════════════════════════════════════════"
  echo "  $(c_bold "$1")"
  echo "═══════════════════════════════════════════════════════════"
}

die() { echo "$(c_red "✗ $*")" >&2; exit 1; }

# ── pre-flight ───────────────────────────────────────────────────────────────
command -v gh >/dev/null 2>&1 || die "GitHub CLI not found. Install: https://cli.github.com"

if ! gh auth status >/dev/null 2>&1; then
  die "Not logged in to gh. Run: gh auth login"
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
if [[ -z "$REPO" ]]; then
  die "Not in a GitHub repo (or no upstream). cd into the repo and re-run."
fi

echo "Repo:           $(c_blue "$REPO")"
echo "GitHub user:    $(c_blue "$(gh api user -q .login)")"

# ── variable / secret definitions ────────────────────────────────────────────
# Format per item:
#   NAME|kind|description|where_to_find
# where kind is "var" or "secret".

ITEMS=(
  # ── Supabase
  "SUPABASE_PROJECT_ID|var|Supabase project ref (e.g. abcdefghijklmnop)|Supabase Dashboard URL: https://supabase.com/dashboard/project/<THIS>"
  "SUPABASE_ACCESS_TOKEN|secret|Personal access token for the Supabase CLI|https://supabase.com/dashboard/account/tokens"
  "SUPABASE_DB_PASSWORD|secret|Postgres password (for 'supabase db push')|Project Settings → Database → Connection Info"

  # ── Vercel
  "VERCEL_ORG_ID|var|Vercel team/org id (e.g. team_xxxx)|.vercel/project.json after 'vercel link' (key 'orgId')"
  "VERCEL_PROJECT_ID|var|Vercel project id (e.g. prj_xxxx)|.vercel/project.json after 'vercel link' (key 'projectId')"
  "VERCEL_TOKEN|secret|Vercel personal access token|https://vercel.com/account/tokens"

  # ── Frontend env baked into the build
  "PROD_VITE_PUBLIC_SUPABASE_URL|secret|Production Supabase URL (https://<ref>.supabase.co)|Same project as SUPABASE_PROJECT_ID — Settings → API"
  "PROD_VITE_PUBLIC_SUPABASE_ANON_KEY|secret|Public anon key (sb_publishable_*)|Settings → API → anon public key"
  "PROD_VITE_PUBLIC_TOSS_CLIENT_KEY|secret|Toss client (publishable) key — live_ck_xxx for prod, test_ck_xxx for staging|Toss console → 상점관리 → 결제연동 → 클라이언트키"
)

# ── helpers to read current state ────────────────────────────────────────────
have_var() {
  gh variable list --json name -q '.[].name' 2>/dev/null | grep -Fxq "$1"
}
have_secret() {
  gh secret list --json name -q '.[].name' 2>/dev/null | grep -Fxq "$1"
}
get_var() {
  gh variable list --json name,value -q ".[] | select(.name==\"$1\") | .value" 2>/dev/null
}

# ── audit pass ───────────────────────────────────────────────────────────────
heading "Current state"

set_count=0
missing_count=0
declare -a MISSING

for item in "${ITEMS[@]}"; do
  IFS='|' read -r name kind desc _ <<<"$item"
  if [[ "$kind" == "var" ]]; then
    if have_var "$name"; then
      val="$(get_var "$name")"
      printf "  %s %-37s = %s\n" "$(c_green "✓")" "$name" "$(c_dim "$val")"
      set_count=$((set_count+1))
    else
      printf "  %s %-37s %s\n" "$(c_red "✗")" "$name" "$(c_dim "(not set)")"
      missing_count=$((missing_count+1))
      MISSING+=("$item")
    fi
  else
    if have_secret "$name"; then
      printf "  %s %-37s = %s\n" "$(c_green "✓")" "$name" "$(c_dim "(encrypted)")"
      set_count=$((set_count+1))
    else
      printf "  %s %-37s %s\n" "$(c_red "✗")" "$name" "$(c_dim "(not set)")"
      missing_count=$((missing_count+1))
      MISSING+=("$item")
    fi
  fi
done

echo
echo "$(c_bold "$set_count") set, $(c_bold "$missing_count") missing"

if [[ "$CHECK_ONLY" == "1" ]]; then
  echo
  if [[ "$missing_count" -gt 0 ]]; then
    echo "$(c_yellow "Run without --check to be prompted for the missing values.")"
    exit 1
  fi
  echo "$(c_green "All required Secrets/Variables are set.")"
  exit 0
fi

if [[ "$missing_count" -eq 0 ]]; then
  echo
  echo "$(c_green "Nothing to do — re-run with --check anytime to verify.")"
  exit 0
fi

# ── interactive set pass (only missing) ──────────────────────────────────────
heading "Set $missing_count missing item(s)"
echo "$(c_dim "Press Ctrl-C any time. Already-set items above are not touched.")"
echo

for item in "${MISSING[@]}"; do
  IFS='|' read -r name kind desc where <<<"$item"
  echo
  echo "$(c_bold "$name")  $(c_dim "[$kind]")"
  echo "  $desc"
  echo "  $(c_dim "Where: $where")"
  if [[ "$kind" == "secret" ]]; then
    # -s suppresses echo for secrets. Read until Enter.
    printf "  Value (input hidden, blank = skip): "
    IFS= read -r -s value
    echo
  else
    printf "  Value (blank = skip): "
    IFS= read -r value
  fi

  if [[ -z "$value" ]]; then
    echo "  $(c_yellow "skipped")"
    continue
  fi

  if [[ "$kind" == "var" ]]; then
    if gh variable set "$name" --body "$value" --repo "$REPO" >/dev/null; then
      echo "  $(c_green "✓ set variable")"
    else
      echo "  $(c_red "✗ failed to set variable")"
    fi
  else
    if printf '%s' "$value" | gh secret set "$name" --repo "$REPO" >/dev/null; then
      echo "  $(c_green "✓ set secret")"
    else
      echo "  $(c_red "✗ failed to set secret")"
    fi
  fi
done

heading "Next steps"
cat <<EOF
1. (One-time) Set Supabase Edge Function runtime secrets locally:

     supabase secrets set TOSS_SECRET_KEY=live_sk_xxx
     supabase secrets set TOSS_WEBHOOK_SECRET=\$(openssl rand -hex 16)
     supabase secrets set ALLOWED_ORIGINS="https://aimetawow.com,https://www.aimetawow.com"

2. Trigger a deploy:

     gh workflow run deploy.yml --ref main
     gh run watch                  # follow the run

3. Re-audit any time:

     bash scripts/setup-deploy-secrets.sh --check

EOF
