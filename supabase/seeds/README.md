# Supabase Seed Data

QA-only test rows for launch verification scenarios. **Never run on production
without first confirming you understand the cleanup commands at the bottom of
each file.**

## qa_test_data.sql

Seeds three CS tickets (new / in_progress / resolved-with-reply), four
notifications (credit_alert, generation_complete, system_notice, welcome),
and one gallery item with an intentionally-404 URL for ExpirableMedia
fallback testing.

### Run

Get your test user's auth uuid from `auth.users` (Studio → Authentication →
Users → click row → copy `id`):

```bash
psql "$SUPABASE_DB_URL" \
  -v target_email='you@company.com' \
  -v target_user_id='123e4567-e89b-12d3-a456-426614174000' \
  -f supabase/seeds/qa_test_data.sql
```

Or in Supabase Studio SQL editor: paste the file contents and replace
`:'target_email'` and `:'target_user_id'::uuid` with literals.

### Cleanup (always wipe before launch)

```sql
delete from cs_tickets    where meta ? 'qa_seed';
delete from notifications where data ? 'qa_seed';
delete from gallery_items where source = 'qa_seed';
```

### Why these specific rows

Each row is mapped to a launch checklist item:

| Seed row | Verifies |
|----------|----------|
| cs_tickets (new) | admin-cs reply flow PR #41 entry point |
| cs_tickets (in_progress) | /my-account "처리 중" badge rendering PR #28 |
| cs_tickets (resolved with reply) | reply_content rendering on /my-account PR #28 |
| notifications (credit_alert) | bell + email-disabled-but-still-bell PR #42 |
| notifications (generation_complete) | bell click → action_url navigation |
| notifications (system_notice) | PR #41 reply notification preview |
| notifications (welcome, is_read=true) | unread count exclusion |
| gallery_items (404 URL) | ExpirableMedia onError fallback PR #14 |
