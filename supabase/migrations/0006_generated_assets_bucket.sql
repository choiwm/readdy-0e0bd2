-- 0006: Public 'generated-assets' bucket for persisted fal.ai outputs.
--
-- fal.ai signed URLs (fal.media, v3.fal.media) expire within hours. Without
-- re-hosting we end up with broken images/videos in the user's gallery a day
-- later. This bucket holds the downloaded copy that backs gallery_items.url
-- and ad_works.result_url permanently.
--
-- Path layout (enforced by code, not RLS):
--   <kind>/<owner_id>/<timestamp>-<uuid>.<ext>
--   e.g. image/u_abc/1714050000-xxxx.png
--        video/sess_def/1714050100-yyyy.mp4
--        audio/u_abc/1714050200-zzzz.mp3

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-assets',
  'generated-assets',
  true,                                                  -- publicly readable
  104857600,                                             -- 100 MB ceiling — videos can be large
  array[
    'image/png','image/jpeg','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/x-wav'
  ]
)
on conflict (id) do nothing;

-- Read: anyone (bucket is public). Write: service_role only — Edge Functions
-- write via service-role client; end users never upload here directly.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'generated_assets_public_read'
  ) then
    create policy generated_assets_public_read on storage.objects
      for select using (bucket_id = 'generated-assets');
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'generated_assets_service_role_write'
  ) then
    create policy generated_assets_service_role_write on storage.objects
      for insert with check (
        bucket_id = 'generated-assets'
        and auth.role() = 'service_role'
      );
  end if;
end$$;
