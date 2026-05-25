/**
 * Listings CRUD — server-only (imports pg).
 * Types live in @/lib/listings-shared.
 */

import { query, queryOne } from "./client";
import type {
  EtsyState,
  EtsyWhenMade,
  EtsyWhoMade,
  Listing,
  ListingStatus,
} from "@/lib/listings-shared";

export type { Listing, ListingStatus } from "@/lib/listings-shared";

export type ListingCreate = {
  working_name: string;
  asset_id?: number | null;
  brand_kit_id?: number | null;
  context_notes?: string;
  title?: string;
  description?: string;
  tags?: string[];
  keywords?: string[];
  status?: ListingStatus;
  ai_model_used?: string | null;
  created_by: string;
};

export type ListingUpdate = Partial<Omit<ListingCreate, "created_by">> & {
  // Etsy-publishing fields, all optional on update
  price_cents?: number | null;
  currency_code?: string;
  quantity?: number;
  etsy_listing_id?: number | null;
  etsy_state?: EtsyState;
  etsy_taxonomy_id?: number | null;
  etsy_shipping_profile_id?: number | null;
  etsy_who_made?: EtsyWhoMade;
  etsy_when_made?: EtsyWhenMade;
  etsy_pushed_at?: string | null;
  etsy_synced_at?: string | null;
  etsy_url?: string | null;
};

const ALLOWED_UPDATE_FIELDS = new Set<string>([
  "working_name",
  "asset_id",
  "brand_kit_id",
  "context_notes",
  "title",
  "description",
  "tags",
  "keywords",
  "status",
  "ai_model_used",
  "price_cents",
  "currency_code",
  "quantity",
  "etsy_listing_id",
  "etsy_state",
  "etsy_taxonomy_id",
  "etsy_shipping_profile_id",
  "etsy_who_made",
  "etsy_when_made",
  "etsy_pushed_at",
  "etsy_synced_at",
  "etsy_url",
]);

export async function listListings(filter?: { status?: ListingStatus }): Promise<Listing[]> {
  if (filter?.status) {
    return query<Listing>(
      `SELECT * FROM listings WHERE status = $1 ORDER BY updated_at DESC`,
      [filter.status],
    );
  }
  return query<Listing>(`SELECT * FROM listings ORDER BY updated_at DESC`);
}

export async function getListing(id: number): Promise<Listing | null> {
  return queryOne<Listing>(`SELECT * FROM listings WHERE id = $1`, [id]);
}

export async function createListing(input: ListingCreate): Promise<Listing> {
  const row = await queryOne<Listing>(
    `INSERT INTO listings
       (working_name, asset_id, brand_kit_id, context_notes, title,
        description, tags, keywords, status, ai_model_used, created_by)
     VALUES ($1, $2, $3, COALESCE($4, ''), COALESCE($5, ''),
             COALESCE($6, ''), COALESCE($7, '{}'::text[]),
             COALESCE($8, '{}'::text[]), COALESCE($9, 'draft'),
             $10, $11)
     RETURNING *`,
    [
      input.working_name,
      input.asset_id ?? null,
      input.brand_kit_id ?? null,
      input.context_notes ?? null,
      input.title ?? null,
      input.description ?? null,
      input.tags ?? null,
      input.keywords ?? null,
      input.status ?? null,
      input.ai_model_used ?? null,
      input.created_by,
    ],
  );
  if (!row) throw new Error("Failed to create listing");
  return row;
}

export async function updateListing(id: number, updates: ListingUpdate): Promise<Listing> {
  const fields = (Object.keys(updates) as Array<keyof ListingUpdate>).filter((f) =>
    ALLOWED_UPDATE_FIELDS.has(f as string),
  );
  if (fields.length === 0) {
    const existing = await getListing(id);
    if (!existing) throw new Error("Listing not found");
    return existing;
  }
  const setClauses: string[] = [];
  const values: unknown[] = [];
  fields.forEach((f, i) => {
    setClauses.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  setClauses.push(`updated_at = NOW()`);
  if (updates.status === "posted") {
    setClauses.push(`posted_at = NOW()`);
  }
  values.push(id);
  const sql = `
    UPDATE listings
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<Listing>(sql, values);
  if (!row) throw new Error("Failed to update listing");
  return row;
}

export async function deleteListing(id: number): Promise<void> {
  await query(`DELETE FROM listings WHERE id = $1`, [id]);
}
