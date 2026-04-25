// User-triggered deletion of a saved generation. Without this entry point
// the frontend deletes the row directly and the Supabase Storage object
// stays orphaned forever — we keep paying for storage that nothing
// references.
//
// Flow:
//   1. requireUser — only authed users can delete their own rows.
//   2. Look up the row via service-role with an explicit user_id check.
//      (We can't trust an RLS user-context here because we then need the
//      service role to write to the locked-down 'generated-assets' bucket.)
//   3. Capture the URL, delete the row, then remove the Storage object via
//      removeFalAsset.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { removeFalAsset } from '../_shared/fal_storage.ts';

type Kind = 'gallery' | 'ad_work';

interface RequestBody {
  id: string;
  kind: Kind;
}

const TABLE_BY_KIND: Record<Kind, { table: string; urlColumn: string }> = {
  gallery: { table: 'gallery_items', urlColumn: 'url' },
  ad_work: { table: 'ad_works',     urlColumn: 'result_url' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let user;
  try {
    user = await requireUser(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  let body: RequestBody;
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  if (!body.id || (body.kind !== 'gallery' && body.kind !== 'ad_work')) {
    return json({ error: 'id and kind=gallery|ad_work required' }, 400);
  }

  const { table, urlColumn } = TABLE_BY_KIND[body.kind];

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Confirm row exists and belongs to the caller. We scope by user_id
  // explicitly — service-role bypasses RLS so this is the ownership check.
  const { data: row, error: readErr } = await supabase
    .from(table)
    .select(`id, user_id, ${urlColumn}`)
    .eq('id', body.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (readErr) {
    console.error(`[delete-saved-asset] read ${table}/${body.id} failed:`, readErr.message);
    return json({ error: 'lookup_failed' }, 500);
  }
  if (!row) return json({ error: 'not_found_or_not_owner' }, 404);

  const url = (row as Record<string, unknown>)[urlColumn] as string | null | undefined;

  // Delete row first — if Storage cleanup fails afterwards we still want
  // the row gone (orphaned blob is a smaller problem than a row the user
  // thought they deleted).
  const { error: delErr } = await supabase.from(table).delete().eq('id', body.id).eq('user_id', user.id);
  if (delErr) {
    console.error(`[delete-saved-asset] delete ${table}/${body.id} failed:`, delErr.message);
    return json({ error: 'delete_failed' }, 500);
  }

  if (url) await removeFalAsset(supabase, url);

  return json({ ok: true });
});
