// Persist fal.ai-generated assets to Supabase Storage.
//
// fal.ai returns signed URLs (fal.media, v3.fal.media) that expire within
// hours. If we save the raw URL to gallery_items / ad_works, every saved
// piece of content 404s the next day. This helper downloads the asset once
// and re-hosts it on the public 'generated-assets' bucket, returning a
// permanent Supabase Storage URL.
//
// Soft-fail design: if download or upload fails, we return the original
// fal.ai URL. Better a short-lived working link than a broken save while
// we debug the storage issue. The error is logged so admins notice.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SupabaseLike = ReturnType<typeof createClient>;

const BUCKET = 'generated-assets';

export type AssetKind = 'image' | 'video' | 'audio';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

const DEFAULT_CONTENT_TYPE: Record<AssetKind, string> = {
  image: 'image/png',
  video: 'video/mp4',
  audio: 'audio/mpeg',
};

const DEFAULT_EXT: Record<AssetKind, string> = {
  image: 'png',
  video: 'mp4',
  audio: 'mp3',
};

function looksLikeOurStorage(url: string): boolean {
  // Already on Supabase storage (e.g. user-uploaded source images, or a
  // previously persisted asset). Don't re-download.
  return url.includes('/storage/v1/object/');
}

export async function persistFalAsset(
  supabase: SupabaseLike,
  falUrl: string,
  kind: AssetKind,
  ownerId: string,
): Promise<string> {
  if (!falUrl) return falUrl;
  if (looksLikeOurStorage(falUrl)) return falUrl;

  const safeOwner = (ownerId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

  try {
    const downloadRes = await fetch(falUrl, { signal: AbortSignal.timeout(60_000) });
    if (!downloadRes.ok) {
      console.warn(`[fal_storage] download HTTP ${downloadRes.status} for ${kind} — falling back to fal URL`);
      return falUrl;
    }
    const contentType = (downloadRes.headers.get('content-type') ?? DEFAULT_CONTENT_TYPE[kind]).split(';')[0].trim();
    const ext = EXT_BY_CONTENT_TYPE[contentType] ?? DEFAULT_EXT[kind];
    const bytes = new Uint8Array(await downloadRes.arrayBuffer());

    const path = `${kind}/${safeOwner}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadErr) {
      console.warn(`[fal_storage] upload failed (${kind}): ${uploadErr.message} — falling back to fal URL`);
      return falUrl;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      console.warn(`[fal_storage] getPublicUrl returned empty — falling back to fal URL`);
      return falUrl;
    }
    console.log(`[fal_storage] ${kind} persisted: ${path}`);
    return data.publicUrl;
  } catch (e) {
    console.warn('[fal_storage] persist exception:', e instanceof Error ? e.message : String(e));
    return falUrl;
  }
}

/**
 * Remove a previously-persisted asset from Storage. Called when a user
 * deletes a gallery_item or ad_work — without this the Storage object
 * stays around forever and we keep paying for it.
 *
 * Soft-fails like persistFalAsset — if the URL isn't ours, isn't parseable,
 * or remove() errors, log and move on. The row deletion is the user-visible
 * action; Storage cleanup is a janitorial side-effect.
 */
export async function removeFalAsset(
  supabase: SupabaseLike,
  url: string,
): Promise<void> {
  if (!url) return;
  // Match …/object/public/generated-assets/<path> or …/object/sign/…
  const m = url.match(/\/object\/(?:public|sign)\/generated-assets\/([^?]+)/);
  if (!m || !m[1]) {
    // Not in our bucket (could be a legacy fal.media URL or external) —
    // nothing to clean.
    return;
  }
  const path = decodeURIComponent(m[1]);
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      console.warn(`[fal_storage] remove failed for ${path}: ${error.message}`);
      return;
    }
    console.log(`[fal_storage] removed: ${path}`);
  } catch (e) {
    console.warn('[fal_storage] remove exception:', e instanceof Error ? e.message : String(e));
  }
}
