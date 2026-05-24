/**
 * Client-safe asset types + helpers. No DB imports — safe to use
 * from client components (which can't include `pg`).
 *
 * The server-side DB CRUD lives in src/lib/db/assets.ts and re-exports
 * these types so server code has one import path.
 */

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

/**
 * Human-readable size formatting. 1.4 MB, 240 KB, etc.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
