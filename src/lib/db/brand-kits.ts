/**
 * Brand kits — multi-row table for studio + client brand identities.
 *
 * The studio's own kit (Farley Girls Creative) is row 1 with
 * is_studio_self=true. Each client gets their own row with
 * is_studio_self=false. Same data shape across the board.
 *
 * Used by:
 *   - AI listing copy generation (voice_notes + brand_book_notes)
 *   - Marketing post drafting (voice + colors)
 *   - Customer-message drafts (voice)
 *   - Future: design surface chrome when editing for a specific client
 */

import { query, queryOne } from "./client";

export type BrandKit = {
  id: number;
  name: string;
  is_studio_self: boolean;
  bio: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  voice_notes: string;
  brand_book_notes: string;
  etsy_shop_url: string;
  website_url: string;
  instagram_url: string;
  pinterest_url: string;
  /** Brand kit depth — added 2026-05-24 PM. */
  writing_samples: string;
  always_say: string[];
  never_say: string[];
  audience_persona: string;
  differentiators: string;
  created_at: Date;
  updated_at: Date;
};

export type BrandKitUpdate = Partial<
  Omit<BrandKit, "id" | "created_at" | "updated_at">
>;

export type BrandKitCreate = Partial<Omit<BrandKit, "id" | "created_at" | "updated_at">> & {
  name: string;
};

/**
 * Load the studio's own brand kit. Creates a default one if missing
 * so the caller never has to handle null.
 */
export async function getStudioKit(): Promise<BrandKit> {
  const existing = await queryOne<BrandKit>(
    `SELECT * FROM brand_kits WHERE is_studio_self = TRUE LIMIT 1`,
  );
  if (existing) return existing;

  const created = await queryOne<BrandKit>(
    `INSERT INTO brand_kits (name, is_studio_self)
       VALUES ($1, TRUE)
       RETURNING *`,
    ["Farley Girls Creative"],
  );
  if (!created) throw new Error("Failed to create studio brand kit");
  return created;
}

/**
 * List all brand kits — studio first, then clients alphabetical.
 */
export async function listBrandKits(): Promise<BrandKit[]> {
  return query<BrandKit>(
    `SELECT * FROM brand_kits ORDER BY is_studio_self DESC, name ASC`,
  );
}

export async function getBrandKit(id: number): Promise<BrandKit | null> {
  return queryOne<BrandKit>(`SELECT * FROM brand_kits WHERE id = $1`, [id]);
}

export async function updateBrandKit(
  id: number,
  updates: BrandKitUpdate,
): Promise<BrandKit> {
  const fields = Object.keys(updates) as Array<keyof BrandKitUpdate>;
  if (fields.length === 0) {
    const existing = await getBrandKit(id);
    if (!existing) throw new Error("Brand kit not found");
    return existing;
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  fields.forEach((f, i) => {
    setClauses.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  setClauses.push(`updated_at = NOW()`);

  values.push(id);
  const sql = `
    UPDATE brand_kits
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;

  const updated = await queryOne<BrandKit>(sql, values);
  if (!updated) throw new Error("Failed to update brand kit");
  return updated;
}

/**
 * Create a client brand kit (is_studio_self=false enforced).
 */
export async function createClientKit(input: BrandKitCreate): Promise<BrandKit> {
  const row = await queryOne<BrandKit>(
    `INSERT INTO brand_kits (name, is_studio_self, bio, primary_color, secondary_color, accent_color, voice_notes, brand_book_notes, etsy_shop_url, website_url, instagram_url, pinterest_url)
       VALUES ($1, FALSE, COALESCE($2, ''), COALESCE($3, '#1a1a1a'), COALESCE($4, ''), COALESCE($5, ''), COALESCE($6, ''), COALESCE($7, ''), COALESCE($8, ''), COALESCE($9, ''), COALESCE($10, ''), COALESCE($11, ''))
       RETURNING *`,
    [
      input.name,
      input.bio,
      input.primary_color,
      input.secondary_color,
      input.accent_color,
      input.voice_notes,
      input.brand_book_notes,
      input.etsy_shop_url,
      input.website_url,
      input.instagram_url,
      input.pinterest_url,
    ],
  );
  if (!row) throw new Error("Failed to create client brand kit");
  return row;
}
