/**
 * Asset library CRUD.
 *
 * One row per file in the studio's library. The actual file bytes
 * live in Vercel Blob; this table just stores metadata + the public
 * URL. Optional brand_kit_id links assets to a specific brand kit
 * (logo, brand book, etc.).
 */

import { query, queryOne } from "./client";

export type AssetKind =
  | "general"
  | "logo"
  | "brand_book"
  | "design_master"
  | "design_export";

export const ASSET_KINDS: AssetKind[] = [
  "general",
  "logo",
  "brand_book",
  "design_master",
  "design_export",
];

export type Asset = {
  id: number;
  name: string;
  filename: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  kind: AssetKind;
  brand_kit_id: number | null;
  description: string;
  uploaded_by: string;
  created_at: Date;
};

export type AssetCreate = {
  name: string;
  filename: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  kind?: AssetKind;
  brand_kit_id?: number | null;
  description?: string;
  uploaded_by: string;
};

export type AssetListFilter = {
  kind?: AssetKind;
  brand_kit_id?: number | null;
};

export async function listAssets(filter: AssetListFilter = {}): Promise<Asset[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.kind) {
    params.push(filter.kind);
    where.push(`kind = $${params.length}`);
  }

  if (filter.brand_kit_id !== undefined) {
    if (filter.brand_kit_id === null) {
      where.push(`brand_kit_id IS NULL`);
    } else {
      params.push(filter.brand_kit_id);
      where.push(`brand_kit_id = $${params.length}`);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `SELECT * FROM assets ${whereSql} ORDER BY created_at DESC`;
  return query<Asset>(sql, params);
}

export async function getAsset(id: number): Promise<Asset | null> {
  return queryOne<Asset>(`SELECT * FROM assets WHERE id = $1`, [id]);
}

export async function createAsset(input: AssetCreate): Promise<Asset> {
  const row = await queryOne<Asset>(
    `INSERT INTO assets
      (name, filename, url, mime_type, size_bytes, kind, brand_kit_id, description, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'general'), $7, COALESCE($8, ''), $9)
     RETURNING *`,
    [
      input.name,
      input.filename,
      input.url,
      input.mime_type,
      input.size_bytes,
      input.kind ?? "general",
      input.brand_kit_id ?? null,
      input.description ?? "",
      input.uploaded_by,
    ],
  );
  if (!row) throw new Error("Failed to create asset");
  return row;
}

export async function deleteAsset(id: number): Promise<Asset | null> {
  return queryOne<Asset>(
    `DELETE FROM assets WHERE id = $1 RETURNING *`,
    [id],
  );
}

/**
 * Human-readable size formatting. 1.4 MB, 240 KB, etc.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
