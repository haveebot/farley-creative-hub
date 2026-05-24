/**
 * Vercel Blob storage wrapper.
 *
 * Vercel auto-wires BLOB_READ_WRITE_TOKEN when you add Blob storage
 * via the Storage tab in the project. The token grants read+write
 * to the project's Blob namespace; no extra config needed.
 *
 * Files are uploaded with `access: 'public'` by default — they live
 * at a stable Vercel CDN URL anyone with the link can fetch. For
 * tenant-private files in the future, add signed-URL retrieval.
 */

import { put, del, list, type PutBlobResult } from "@vercel/blob";

export type UploadResult = {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
};

/**
 * Upload a file to Blob storage. Returns the public URL + metadata.
 *
 * @param pathname - desired path/name in storage (Vercel will dedupe
 *   by appending a random suffix if name collides)
 * @param data - the file body (Buffer, Blob, ArrayBuffer, etc.)
 * @param contentType - MIME type
 */
export async function uploadBlob(
  pathname: string,
  data: Buffer | Blob | ArrayBuffer | ReadableStream,
  contentType: string,
): Promise<UploadResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN not set. Add Vercel Blob storage via Project → Storage → Create Database → Blob.",
    );
  }

  const result: PutBlobResult = await put(pathname, data, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    contentType: result.contentType ?? contentType,
    size: typeof (data as Blob).size === "number"
      ? (data as Blob).size
      : data instanceof ArrayBuffer
      ? data.byteLength
      : Buffer.isBuffer(data)
      ? data.length
      : 0,
  };
}

/**
 * Delete a blob by URL.
 */
export async function deleteBlob(url: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN not set");
  }
  await del(url);
}

/**
 * List all blobs under a prefix (e.g. `assets/`).
 */
export async function listBlobs(prefix?: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN not set");
  }
  return list({ prefix });
}
