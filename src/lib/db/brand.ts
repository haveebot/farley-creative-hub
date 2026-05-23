/**
 * Brand identity — single-row table that holds the studio's brand
 * configuration. Read by anything that needs to render brand-aware
 * UI (header, accent color, email signatures, listing copy voice).
 *
 * Phase 1: single-tenant, one row. `getBrand()` creates the row with
 * defaults on first read so the Hub always has values to render.
 * Phase 2+: multi-tenant via tenant_id column + scoped queries.
 */

import { query, queryOne } from "./client";

export type BrandIdentity = {
  id: number;
  studio_name: string;
  hub_label: string;
  bio: string;
  primary_color: string;
  voice_notes: string;
  etsy_shop_url: string;
  website_url: string;
  instagram_url: string;
  pinterest_url: string;
  updated_at: Date;
};

export type BrandUpdate = Partial<Omit<BrandIdentity, "id" | "updated_at">>;

const SELECT_SQL = `SELECT * FROM brand_identity ORDER BY id LIMIT 1`;

/**
 * Load the brand record. Creates it with defaults if missing so
 * the caller never has to handle a null brand.
 */
export async function getBrand(): Promise<BrandIdentity> {
  const existing = await queryOne<BrandIdentity>(SELECT_SQL);
  if (existing) return existing;

  const created = await queryOne<BrandIdentity>(
    `INSERT INTO brand_identity DEFAULT VALUES RETURNING *`,
  );
  if (!created) {
    throw new Error("Failed to create brand_identity row");
  }
  return created;
}

/**
 * Update the brand record. Pass only fields you want to change.
 */
export async function updateBrand(updates: BrandUpdate): Promise<BrandIdentity> {
  // Ensure the row exists first (creates with defaults if not).
  const current = await getBrand();

  const fields = Object.keys(updates) as Array<keyof BrandUpdate>;
  if (fields.length === 0) return current;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  fields.forEach((f, i) => {
    setClauses.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  setClauses.push(`updated_at = NOW()`);

  values.push(current.id);
  const sql = `
    UPDATE brand_identity
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;

  const updated = await queryOne<BrandIdentity>(sql, values);
  if (!updated) throw new Error("Failed to update brand_identity");
  return updated;
}
