# Edge Function Security

Two defensive layers sit between the browser and every Supabase Edge Function:

1. **CORS allowlist** — only whitelisted origins can call the function. Any
   other site hosting JavaScript sees a browser-level CORS failure. Prevents
   third parties from draining generation credits via scripted calls.
2. **Per-user rate limit** — sliding-window hit counter per user per function.
   Stops abuse from a single compromised account.

## CORS allowlist

### Runtime behaviour

`supabase/functions/_shared/cors.ts` exposes:

```ts
buildCorsHeaders(req): Record<string, string>
handlePreflight(req): Response
isOriginAllowed(req): boolean
```

`buildCorsHeaders` reads `ALLOWED_ORIGINS` from the Edge Function env (comma-
separated domain list). If the env var is **empty** (development), it falls
back to `Access-Control-Allow-Origin: *`. If set, it echoes back the caller's
`Origin` only when it exactly matches an allowlist entry (no prefix / subdomain
matching — those get their first-entry Origin, which browsers then block).

### Setting the allowlist in production

```bash
supabase secrets set ALLOWED_ORIGINS="https://aimetawow.com,https://www.aimetawow.com"
```

Verify by curling a non-allowed Origin:

```bash
curl -sD- -X OPTIONS \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: POST" \
  https://<project>.supabase.co/functions/v1/payments-toss \
  | grep -i access-control-allow-origin
# Expected: Access-Control-Allow-Origin: https://aimetawow.com (not the evil origin)
```

Every Edge Function was migrated in a single pass. To verify:

```bash
grep -L "buildCorsHeaders\|handlePreflight" supabase/functions/*/index.ts
# Expected output: empty
```

## Rate limiting

### Policies

Defined once in `supabase/functions/_shared/rateLimit.ts`:

| Function bucket              | Max / window |
|------------------------------|---------------|
| `generate-image`             | 20 / min |
| `generate-video`             | 5 / min  |
| `generate-tts`               | 30 / min |
| `generate-music`             | 10 / min |
| `generate-sfx`               | 30 / min |
| `generate-script`            | 30 / min |
| `generate-vton`              | 10 / min |
| `generate-transcribe`        | 20 / min |
| `generate-multishot`         | 5 / min  |
| `analyze-video-sfx`          | 20 / min |
| `clean-audio`                | 20 / min |
| `summarize-text`             | 30 / min |
| `payments-create-order`      | 10 / min |

Adjust `POLICIES` in the helper to tune.

### Storage

Migration `0004_rate_limits.sql` creates a `rate_limits` table with index
`(bucket, created_at desc)`. Every successful call inserts one row; the next
call `SELECT count(*) WHERE bucket = ? AND created_at > now() - window`. If
the count is at or above the limit, the function returns **HTTP 429** with
`Retry-After`. The helper **fails open** on DB errors so a transient Supabase
outage doesn't lock out healthy users.

### Cleanup

If the Supabase project has `pg_cron`, the migration automatically schedules
`cleanup_rate_limits()` every 15 minutes. Otherwise call it manually or from
`healthcheck-scheduler`:

```sql
select public.cleanup_rate_limits();
```

At ~60 req/min across a few hundred users, the table stays in the thousands.

### Client-side

When the browser sees a 429, it gets this response body:

```json
{ "error": "rate_limited", "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", "retry_after": 34 }
```

UI code should distinguish 429 from 4xx/5xx and show a cooldown hint rather
than the generic failure toast. TODO: add a handler in `supabase.functions.invoke`
wrappers.

## What's NOT covered by this layer

- **DDoS** — Supabase Edge Functions sit behind Cloudflare, which absorbs
  volumetric attacks. Our rate limiter protects credit burn, not bandwidth.
- **Per-IP limiting** — we rate-limit by user_id (JWT). Anonymous endpoints
  or webhook endpoints (`payments-toss?action=webhook`) rely on header
  secrets instead.
- **Quota per day** — only per-minute sliding windows. For daily caps, add a
  second bucket `<fn>-daily:<user_id>` with `windowSeconds: 86400`.
