/**
 * Etsy taxonomy — the category tree a listing must reference.
 *
 * Strategy: fetch once from Etsy (a few thousand nodes), store flat in
 * etsy_taxonomy_cache with the full path string ("Home & Living > Kitchen
 * & Dining > Drinkware"). Refresh every ~30 days or when manually invoked.
 *
 * The full tree response is ~500KB; we only call it from the cache-rebuild
 * endpoint, not from the listing UI.
 */

import { query, queryOne } from "@/lib/db/client";
import { etsyFetch } from "./client";

export type TaxonomyNode = {
  id: number;
  parent_id: number | null;
  name: string;
  level: number;
  path: string;
};

type RawNode = {
  id: number;
  level: number;
  name: string;
  parent_id: number | null;
  children: RawNode[];
};

const REFRESH_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function getTaxonomyNodes(): Promise<TaxonomyNode[]> {
  return query<TaxonomyNode>(
    `SELECT id, parent_id, name, level, path
       FROM etsy_taxonomy_cache
      ORDER BY path`,
  );
}

export async function searchTaxonomy(q: string, limit = 30): Promise<TaxonomyNode[]> {
  const term = `%${q.toLowerCase()}%`;
  return query<TaxonomyNode>(
    `SELECT id, parent_id, name, level, path
       FROM etsy_taxonomy_cache
      WHERE LOWER(path) LIKE $1
      ORDER BY level DESC, length(path) ASC
      LIMIT $2`,
    [term, limit],
  );
}

export async function getTaxonomyNode(id: number): Promise<TaxonomyNode | null> {
  return queryOne<TaxonomyNode>(
    `SELECT id, parent_id, name, level, path
       FROM etsy_taxonomy_cache
      WHERE id = $1`,
    [id],
  );
}

export async function isCacheFresh(): Promise<boolean> {
  const row = await queryOne<{ fetched_at: Date }>(
    `SELECT MAX(fetched_at) AS fetched_at FROM etsy_taxonomy_cache`,
  );
  if (!row?.fetched_at) return false;
  return Date.now() - new Date(row.fetched_at).getTime() < REFRESH_AGE_MS;
}

/**
 * Re-fetch the entire seller taxonomy tree from Etsy and replace the
 * cache. Idempotent; safe to run anytime. Takes ~1-2 seconds.
 */
export async function rebuildTaxonomyCache(): Promise<{ count: number }> {
  const res = await etsyFetch<{ results: RawNode[] }>(
    "/application/seller-taxonomy/nodes",
  );
  const flat: TaxonomyNode[] = [];

  function walk(node: RawNode, parentPath: string) {
    const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
    flat.push({
      id: node.id,
      parent_id: node.parent_id,
      name: node.name,
      level: node.level,
      path,
    });
    for (const child of node.children ?? []) walk(child, path);
  }
  for (const root of res.results) walk(root, "");

  await query(`TRUNCATE etsy_taxonomy_cache`);
  const chunkSize = 200;
  for (let i = 0; i < flat.length; i += chunkSize) {
    const chunk = flat.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    chunk.forEach((n, idx) => {
      const base = idx * 5;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`,
      );
      values.push(n.id, n.parent_id, n.name, n.level, n.path);
    });
    await query(
      `INSERT INTO etsy_taxonomy_cache (id, parent_id, name, level, path)
         VALUES ${placeholders.join(", ")}`,
      values,
    );
  }
  return { count: flat.length };
}
