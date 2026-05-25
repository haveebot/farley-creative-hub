/**
 * Listing images — multi-image attachments for a listing.
 *
 * One row per (listing_id, asset_id). `position` orders them for the
 * Etsy upload (Etsy displays in upload order). `etsy_image_id` +
 * `uploaded_at` track which assets have already been pushed.
 */

import { query, queryOne } from "./client";
import type { ListingImage } from "@/lib/listings-shared";

export type { ListingImage } from "@/lib/listings-shared";

export async function listImagesForListing(listingId: number): Promise<ListingImage[]> {
  return query<ListingImage>(
    `SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY position ASC, id ASC`,
    [listingId],
  );
}

export async function attachImage(
  listingId: number,
  assetId: number,
  position: number,
): Promise<ListingImage> {
  const row = await queryOne<ListingImage>(
    `INSERT INTO listing_images (listing_id, asset_id, position)
     VALUES ($1, $2, $3)
     ON CONFLICT (listing_id, asset_id) DO UPDATE SET position = EXCLUDED.position
     RETURNING *`,
    [listingId, assetId, position],
  );
  if (!row) throw new Error("attachImage failed");
  return row;
}

export async function detachImage(listingId: number, imageId: number): Promise<void> {
  await query(`DELETE FROM listing_images WHERE id = $1 AND listing_id = $2`, [
    imageId,
    listingId,
  ]);
}

export async function reorderImages(
  listingId: number,
  imageIdsInOrder: number[],
): Promise<void> {
  for (let i = 0; i < imageIdsInOrder.length; i++) {
    await query(
      `UPDATE listing_images SET position = $1 WHERE id = $2 AND listing_id = $3`,
      [i, imageIdsInOrder[i], listingId],
    );
  }
}

export async function markImageUploaded(
  imageId: number,
  etsyImageId: number,
): Promise<void> {
  await query(
    `UPDATE listing_images
        SET etsy_image_id = $1, uploaded_at = NOW()
      WHERE id = $2`,
    [etsyImageId, imageId],
  );
}

export async function clearUploadState(listingId: number): Promise<void> {
  await query(
    `UPDATE listing_images
        SET etsy_image_id = NULL, uploaded_at = NULL
      WHERE listing_id = $1`,
    [listingId],
  );
}
