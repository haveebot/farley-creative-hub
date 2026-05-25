/**
 * GET /api/etsy/taxonomy?q=<term> — search the cached taxonomy.
 * Rebuilds the cache on demand if empty (first call seeds the table).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  getTaxonomyNodes,
  isCacheFresh,
  rebuildTaxonomyCache,
  searchTaxonomy,
} from "@/lib/etsy/taxonomy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  let fresh = await isCacheFresh();
  if (!fresh) {
    try {
      await rebuildTaxonomyCache();
      fresh = true;
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes("No connected Etsy shop") ? 503 : 502;
      return NextResponse.json({ ok: false, error: "etsy", message }, { status });
    }
  }

  const nodes = q.length > 0 ? await searchTaxonomy(q, 30) : (await getTaxonomyNodes()).slice(0, 100);
  return NextResponse.json({ ok: true, nodes });
}
