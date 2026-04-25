// Admin-only sweep that finds orphaned files in the 'generated-assets'
// bucket and (optionally) removes them.
//
// Why this exists
// ───────────────
// PR #16 made user-triggered deletions clean up Storage. But every deletion
// before PR #16 left the underlying file orphaned forever. This sweep is
// the one-time recovery for that, and a safety net if anything in the
// generation pipeline ever creates a file but fails to write the
// gallery_items / ad_works row.
//
// Algorithm
// ─────────
//   1. Build a set of all referenced storage paths by reading
//      gallery_items.url and ad_works.result_url and parsing the path
//      out of each URL that points to our bucket.
//   2. Walk the bucket recursively (image/, video/, audio/) one prefix
//      at a time, listing in pages of 100.
//   3. Any file whose path isn't in the referenced set is an orphan.
//   4. Default mode is **dry_run = true** — return the orphan list without
//      deleting. Pass `{ "dry_run": false }` to actually remove.
//
// Auth: requireAdmin. Audited on every run.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin, AuthFailure } from '../_shared/auth.ts';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';

const BUCKET = 'generated-assets';
const SUBDIRS = ['image', 'video', 'audio'] as const;
const PAGE_SIZE = 100;

interface SweepResult {
  dry_run: boolean;
  scanned: number;
  referenced: number;
  orphans: string[];
  removed: number;
  errors: string[];
}

function pathsFromUrls(urls: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const u of urls) {
    if (!u) continue;
    const m = u.match(/\/object\/(?:public|sign)\/generated-assets\/([^?]+)/);
    if (m && m[1]) out.add(decodeURIComponent(m[1]));
  }
  return out;
}

async function collectReferencedPaths(
  supabase: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const refs = new Set<string>();

  // gallery_items.url — paginate to avoid loading the whole table at once
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('gallery_items')
      .select('url')
      .range(from, from + 999);
    if (error) throw new Error(`gallery_items read: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const p of pathsFromUrls(data.map((r) => r.url as string | null))) refs.add(p);
    if (data.length < 1000) break;
  }

  // ad_works.result_url
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('ad_works')
      .select('result_url')
      .range(from, from + 999);
    if (error) throw new Error(`ad_works read: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const p of pathsFromUrls(data.map((r) => r.result_url as string | null))) refs.add(p);
    if (data.length < 1000) break;
  }

  return refs;
}

interface StorageEntry {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
}

async function listAllFiles(
  supabase: ReturnType<typeof createClient>,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage.from(BUCKET).list(currentPath, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) throw new Error(`list ${currentPath}: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const entry of data as StorageEntry[]) {
        const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        // Files have an id; folders don't.
        if (entry.id) {
          out.push(fullPath);
        } else {
          await walk(fullPath);
        }
      }

      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  await walk(prefix);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);

  const corsHeaders = buildCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let admin;
  try {
    admin = await requireAdmin(req);
  } catch (e) {
    if (e instanceof AuthFailure) return e.response;
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dry_run !== false; // default true — never auto-delete unless explicit

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const result: SweepResult = {
    dry_run: dryRun,
    scanned: 0,
    referenced: 0,
    orphans: [],
    removed: 0,
    errors: [],
  };

  try {
    const referenced = await collectReferencedPaths(supabase);
    result.referenced = referenced.size;

    let allFiles: string[] = [];
    for (const sub of SUBDIRS) {
      try {
        const files = await listAllFiles(supabase, sub);
        allFiles = allFiles.concat(files);
      } catch (e) {
        result.errors.push(`${sub}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    result.scanned = allFiles.length;

    const orphans = allFiles.filter((p) => !referenced.has(p));
    result.orphans = orphans;

    if (!dryRun && orphans.length > 0) {
      // Remove in batches of 100 — Supabase Storage remove() supports
      // multiple paths per call.
      for (let i = 0; i < orphans.length; i += 100) {
        const batch = orphans.slice(i, i + 100);
        const { error } = await supabase.storage.from(BUCKET).remove(batch);
        if (error) {
          result.errors.push(`remove batch ${i / 100}: ${error.message}`);
        } else {
          result.removed += batch.length;
        }
      }
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  // Audit trail
  try {
    await supabase.from('audit_logs').insert({
      admin_email: admin.email,
      action: 'storage orphan sweep',
      target_type: 'storage',
      target_id: BUCKET,
      target_label: dryRun ? `dry_run (${result.orphans.length} orphans)` : `removed ${result.removed}`,
      detail: `scanned=${result.scanned} referenced=${result.referenced} orphans=${result.orphans.length}`,
      result: result.errors.length === 0 ? 'success' : 'failure',
    });
  } catch { /* ignore audit failure */ }

  return json(result);
});
