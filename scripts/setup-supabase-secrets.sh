#!/usr/bin/env bash
#
# Interactive setup for the Supabase Edge Function runtime secrets that the
# deployed code reads at request time. These are SEPARATE from GitHub Actions
# secrets — they live in your Supabase project and are read by the Deno
# runtime, not by `vite build`.
#
# Required Edge Function secrets:
#   TOSS_SECRET_KEY        Toss live (or test) SECRET key — never client-side
#   TOSS_WEBHOOK_SECRET    Random hex; same value goes in Toss console webhook
#   ALLOWED_ORIGINS        Comma-separated CORS allowlist for production
#
# Optional but recommended:
#   APP_JWT_SECRET         Random hex used by admin-api-keys to encrypt the
#                          stored AI-provider API keys at rest (AES-GCM)
#   SCHEDULER_SECRET       Random hex protecting cron-triggered functions
#
# Requirements:
#   - Supabase CLI (`supabase`)        https://supabase.com/docs/guides/cli
#   - Already linked to your project:  supabase link --project-ref <ref>
#
# Usage:
#   bash scripts/setup-supabase-secrets.sh
#   bash scripts/setup-supabase-secrets.sh --check
#

set -euo pipefail

CHECK_ONLY=0
if [[ "${1:-}" == "--check" || "${1:-}" == "-c" ]]; then
  CHECK_ONLY=1
fi

c_red()    { printf '\033[31m%s\033[0m' "$*"; }
c_green()  { printf '\033[32m%s\033[0m' "$*"; }
c_yellow() { printf '\033[33m%s\033[0m' "$*"; }
c_dim()    { printf '\033[2m%s\033[0m' "$*"; }
c_bold()   { printf '\033[1m%s\033[0m' "$*"; }

heading() {
  echo
  echo "═══════════════════════════════════════════════════════════"
  echo "  $(c_bold "$1")"
  echo "═══════════════════════════════════════════════════════════"
}
die() { echo "$(c_red "✗ $*")" >&2; exit 1; }

command -v supabase >/dev/null 2>&1 || die "Supabase CLI not found. Install: brew install supabase/tap/supabase"

# `supabase secrets list` exits non-zero if not linked — surface that.
if ! supabase secrets list >/dev/null 2>&1; then
  die "Project not linked. Run: supabase link --project-ref <your-project-ref>"
fi

# Items: NAME|description|generator (or empty)
ITEMS=(
  "TOSS_SECRET_KEY|Toss SECRET key (live_sk_xxx for prod, test_sk_xxx for staging) — never expose to client||"
  "TOSS_WEBHOOK_SECRET|Shared secret for Toss webhook header — random 32-byte hex|openssl rand -hex 16"
  "ALLOWED_ORIGINS|CORS allowlist (e.g. https://aimetawow.com,https://www.aimetawow.com)|"
  "APP_JWT_SECRET|AES-GCM key for encrypting stored AI-provider API keys|openssl rand -hex 32"
  "SCHEDULER_SECRET|Required header for cron-triggered Edge Functions|openssl rand -hex 24"
)

current_secrets() {
  # Output is a table; first column is name. We only need names.
  supabase secrets list 2>/dev/null \
    | awk 'NR>2 && $1 != "" {print $1}'
}

CURRENT="$(current_secrets)"

heading "Current Edge Function secrets"

set_count=0
missing_count=0
declare -a MISSING

for item in "${ITEMS[@]}"; do
  IFS='|' read -r name desc gen <<<"$item"
  if echo "$CURRENT" | grep -Fxq "$name"; then
    printf "  %s %-25s %s\n" "$(c_green "✓")" "$name" "$(c_dim "(set)")"
    set_count=$((set_count+1))
  else
    printf "  %s %-25s %s\n" "$(c_red "✗")" "$name" "$(c_dim "(not set)")"
    missing_count=$((missing_count+1))
    MISSING+=("$item")
  fi
done

echo
echo "$(c_bold "$set_count") set, $(c_bold "$missing_count") missing"

if [[ "$CHECK_ONLY" == "1" ]]; then
  if [[ "$missing_count" -gt 0 ]]; then exit 1; fi
  exit 0
fi

if [[ "$missing_count" -eq 0 ]]; then
  echo
  echo "$(c_green "Nothing to do.")"
  exit 0
fi

heading "Set $missing_count missing secret(s)"
echo "$(c_dim "Press Ctrl-C any time. Already-set secrets above are not touched.")"

for item in "${MISSING[@]}"; do
  IFS='|' read -r name desc gen <<<"$item"
  echo
  echo "$(c_bold "$name")"
  echo "  $desc"
  if [[ -n "$gen" ]]; then
    echo "  $(c_dim "Generator: $gen")"
    printf "  Auto-generate? [Y/n]: "
    IFS= read -r yn
    if [[ -z "$yn" || "$yn" =~ ^[Yy] ]]; then
      value="$(eval "$gen")"
      echo "  $(c_dim "Generated: ${value:0:8}…${value: -4}")"
    else
      printf "  Value (input hidden, blank = skip): "
      IFS= read -r -s value
      echo
    fi
  else
    printf "  Value (input hidden, blank = skip): "
    IFS= read -r -s value
    echo
  fi

  if [[ -z "$value" ]]; then
    echo "  $(c_yellow "skipped")"
    continue
  fi

  if supabase secrets set "$name=$value" >/dev/null 2>&1; then
    echo "  $(c_green "✓ set")"
  else
    echo "  $(c_red "✗ failed")"
  fi
done

heading "Reminder"
cat <<EOF
1. Push migrations + deploy functions for the new secrets to take effect:

     supabase db push
     supabase functions deploy

2. Configure the Toss webhook URL in your Toss console with the secret you set:

     URL: https://<your-project-ref>.supabase.co/functions/v1/payments-toss?action=webhook
     Header: X-Toss-Webhook-Secret: <TOSS_WEBHOOK_SECRET value>

3. Re-audit any time:

     bash scripts/setup-supabase-secrets.sh --check

EOF
