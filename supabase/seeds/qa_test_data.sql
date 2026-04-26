-- QA seed data for launch verification scenarios.
--
-- WHY THIS EXISTS
-- ────────────────
-- The launch checklist (docs/launch-runbook.md + the audit report) has ~30
-- end-to-end QA items that need an admin to click around and verify
-- behaviour. Several of those — "admin replies to a CS ticket → user gets
-- bell notification + sees reply on /my-account" — require pre-existing
-- ticket rows. This script drops in just enough realistic test data so the
-- admin can flow through the scenarios without first having to manually
-- generate inputs.
--
-- USAGE
-- ─────
--   psql "$SUPABASE_DB_URL" -v target_email='you@company.com' \
--                           -v target_user_id='<auth.users.id>' \
--                           -f supabase/seeds/qa_test_data.sql
--
-- Or via Supabase Studio SQL editor — replace :'target_*' with literals.
--
-- IDEMPOTENCY + CLEANUP
-- ─────────────────────
-- All rows are tagged with meta -> 'qa_seed' = 'true' (or a is_test flag in
-- a separate column where applicable). To wipe:
--
--   delete from cs_tickets    where meta ? 'qa_seed';
--   delete from notifications where data ? 'qa_seed';
--   delete from gallery_items where source = 'qa_seed';
--   delete from ad_works      where session_id = 'qa_seed_session';
--
-- Re-running this script is safe: each insert blocks duplicates by content
-- hash. (See `on conflict do nothing` clauses below — they require uniqueness
-- against an existing index, so we use synthetic content keys.)

\set ON_ERROR_STOP on

\echo
\echo '─────────────────────────────────────────────'
\echo '  QA Seed Data — target user:' :target_email
\echo '─────────────────────────────────────────────'

-- ── 1. CS tickets (3 states) ─────────────────────────────────────────────
-- These exercise the /my-account "내 문의 / 답변" view (PR #28) and the
-- admin-cs reply flow (PR #41 reply notification).
insert into public.cs_tickets (user_id, user_email, user_name, title, body, category, status, meta)
select
  :'target_user_id'::uuid,
  :'target_email',
  'QA 테스트 사용자',
  'QA: 새 문의 (대기 중)',
  '런칭 점검용 시드 — 이 문의는 아직 접수만 된 상태예요. admin 패널에서 답변을 달아 사용자 측 알림을 검증해주세요.',
  'general',
  'new',
  jsonb_build_object('qa_seed', true, 'created_by_seed_script', true)
where not exists (
  select 1 from public.cs_tickets
   where meta ? 'qa_seed'
     and title = 'QA: 새 문의 (대기 중)'
     and user_id = :'target_user_id'::uuid
);

insert into public.cs_tickets (user_id, user_email, user_name, title, body, category, status, meta)
select
  :'target_user_id'::uuid,
  :'target_email',
  'QA 테스트 사용자',
  'QA: 처리 중 문의',
  '런칭 점검용 시드 — 이미 접수돼서 admin 이 in_progress 상태로 바꾼 케이스. 사용자 화면에서 노란 "처리 중" 배지가 보여야 해요.',
  'billing',
  'in_progress',
  jsonb_build_object('qa_seed', true, 'created_by_seed_script', true)
where not exists (
  select 1 from public.cs_tickets
   where meta ? 'qa_seed'
     and title = 'QA: 처리 중 문의'
     and user_id = :'target_user_id'::uuid
);

insert into public.cs_tickets (user_id, user_email, user_name, title, body, category, status,
                               reply_content, replied_at, replied_by, resolved_at, meta)
select
  :'target_user_id'::uuid,
  :'target_email',
  'QA 테스트 사용자',
  'QA: 답변 완료 문의',
  '런칭 점검용 시드 — admin 답변까지 완료된 사례. /my-account 에서 답변이 보라색 박스로 표시돼야 합니다.',
  'technical',
  'resolved',
  '안녕하세요, 운영팀입니다. 문의주신 내용 확인했고 정상 처리됐어요. 추가 문의는 언제든 다시 보내주세요.',
  now() - interval '2 hours',
  'qa-admin@aimetawow.com',
  now() - interval '2 hours',
  jsonb_build_object('qa_seed', true, 'created_by_seed_script', true)
where not exists (
  select 1 from public.cs_tickets
   where meta ? 'qa_seed'
     and title = 'QA: 답변 완료 문의'
     and user_id = :'target_user_id'::uuid
);

\echo '✓ cs_tickets (3 rows)'

-- ── 2. Notifications (multiple types) ──────────────────────────────────
-- Exercises the bell dropdown (PR #25 delete + PR #41 system_notice + PR #42
-- credit_alert with email_enabled=false).

insert into public.notifications (user_id, type, title, message, data, is_read)
select
  :'target_user_id'::uuid,
  'credit_alert',
  'QA: 크레딧이 부족합니다',
  '런칭 점검용 — 크레딧 임계 알림 시드. PR #42 에서 email_enabled=false 라도 bell 은 떠야 해요.',
  jsonb_build_object('qa_seed', true, 'current_balance', 50, 'action_url', '/credit-purchase'),
  false
where not exists (
  select 1 from public.notifications
   where data ? 'qa_seed'
     and type = 'credit_alert'
     and user_id = :'target_user_id'::uuid
);

insert into public.notifications (user_id, type, title, message, data, is_read)
select
  :'target_user_id'::uuid,
  'generation_complete',
  'QA: 영상 생성 완료',
  '런칭 점검용 — 영상 생성 완료 알림. 클릭 시 /ai-create 로 이동해야 해요.',
  jsonb_build_object('qa_seed', true, 'generation_type', 'video', 'action_url', '/ai-create'),
  false
where not exists (
  select 1 from public.notifications
   where data ? 'qa_seed'
     and type = 'generation_complete'
     and user_id = :'target_user_id'::uuid
);

insert into public.notifications (user_id, type, title, message, data, is_read)
select
  :'target_user_id'::uuid,
  'system_notice',
  'QA: 운영팀 답변 도착 (시드)',
  '런칭 점검용 — admin-cs reply_ticket 시 발송되는 알림 (PR #41) 의 모양 미리보기.',
  jsonb_build_object('qa_seed', true, 'action_url', '/my-account'),
  false
where not exists (
  select 1 from public.notifications
   where data ? 'qa_seed'
     and type = 'system_notice'
     and user_id = :'target_user_id'::uuid
);

insert into public.notifications (user_id, type, title, message, data, is_read)
select
  :'target_user_id'::uuid,
  'welcome',
  'QA: 환영 알림 (이미 읽음)',
  '런칭 점검용 — 읽음 처리된 알림이 unread badge 카운트에서 빠지는지 검증용.',
  jsonb_build_object('qa_seed', true),
  true
where not exists (
  select 1 from public.notifications
   where data ? 'qa_seed'
     and type = 'welcome'
     and user_id = :'target_user_id'::uuid
);

\echo '✓ notifications (4 rows)'

-- ── 3. Gallery item that intentionally points to expired URL ───────────
-- Exercises ExpirableMedia fallback (PR #14/#19/#20). The URL is a valid
-- domain that returns 404 (instagram.com returns a real 404 for that path).
-- ExpirableMedia's onError should swap to "콘텐츠 만료" panel.

insert into public.gallery_items (id, type, url, prompt, model, ratio, liked, user_id, source)
select
  'qa_seed_gallery_expired',
  'image',
  'https://v3.fal.media/files/this-url-intentionally-404-for-qa.png',
  'QA: 만료된 fal.media URL 시뮬레이션',
  'fal-ai/flux/dev',
  '1:1',
  false,
  :'target_user_id'::uuid,
  'qa_seed'
where not exists (
  select 1 from public.gallery_items where id = 'qa_seed_gallery_expired'
);

\echo '✓ gallery_items (1 row — expired URL fallback test)'

\echo
\echo '─────────────────────────────────────────────'
\echo '  QA seed complete. Cleanup with:'
\echo '    delete from cs_tickets    where meta ? ''qa_seed'';'
\echo '    delete from notifications where data ? ''qa_seed'';'
\echo '    delete from gallery_items where source = ''qa_seed'';'
\echo '─────────────────────────────────────────────'
