/**
 * Etsy connection CRUD — server-only.
 *
 * Phase 1 supports a single connected shop. Schema allows multiple
 * (one row per shop) if she ever runs multiple brands; the helpers
 * here just return the first/only row.
 */

import { query, queryOne } from "./client";

export type EtsyConnection = {
  id: number;
  shop_id: number | null;
  shop_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  scopes: string[];
  connected_by: string;
  connected_at: Date;
  updated_at: Date;
};

export async function getActiveConnection(): Promise<EtsyConnection | null> {
  return queryOne<EtsyConnection>(
    `SELECT * FROM etsy_connections ORDER BY updated_at DESC LIMIT 1`,
  );
}

export type EtsyTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scopes?: string[];
};

export async function upsertConnection(input: {
  tokens: EtsyTokens;
  shop_id?: number | null;
  shop_name?: string | null;
  connected_by: string;
}): Promise<EtsyConnection> {
  const expires_at = new Date(Date.now() + input.tokens.expires_in * 1000);
  // Single-shop pattern: replace the existing row if there's one with
  // the same shop_id, else insert.
  if (input.shop_id) {
    const existing = await queryOne<EtsyConnection>(
      `SELECT * FROM etsy_connections WHERE shop_id = $1 LIMIT 1`,
      [input.shop_id],
    );
    if (existing) {
      const updated = await queryOne<EtsyConnection>(
        `UPDATE etsy_connections
            SET access_token = $1, refresh_token = $2, expires_at = $3,
                scopes = $4, shop_name = COALESCE($5, shop_name), updated_at = NOW()
          WHERE id = $6
          RETURNING *`,
        [
          input.tokens.access_token,
          input.tokens.refresh_token,
          expires_at,
          input.tokens.scopes ?? [],
          input.shop_name ?? null,
          existing.id,
        ],
      );
      if (!updated) throw new Error("Failed to update etsy_connection");
      return updated;
    }
  }
  const row = await queryOne<EtsyConnection>(
    `INSERT INTO etsy_connections
       (shop_id, shop_name, access_token, refresh_token, expires_at, scopes, connected_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.shop_id ?? null,
      input.shop_name ?? null,
      input.tokens.access_token,
      input.tokens.refresh_token,
      expires_at,
      input.tokens.scopes ?? [],
      input.connected_by,
    ],
  );
  if (!row) throw new Error("Failed to create etsy_connection");
  return row;
}

export async function disconnectAll(): Promise<void> {
  await query(`DELETE FROM etsy_connections`);
}

export async function updateShopMeta(
  id: number,
  meta: { shop_id?: number; shop_name?: string },
): Promise<void> {
  await query(
    `UPDATE etsy_connections
        SET shop_id = COALESCE($1, shop_id),
            shop_name = COALESCE($2, shop_name),
            updated_at = NOW()
      WHERE id = $3`,
    [meta.shop_id ?? null, meta.shop_name ?? null, id],
  );
}
